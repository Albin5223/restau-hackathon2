"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { GanttChart } from "@/components/GanttChart";
import { api } from "@/lib/api";
import type {
  BackendCommandeResult,
  BackendTable,
  Recipe,
  ScheduledStep,
  ScheduledStepStatus,
} from "@/lib/types";

type SimMode = "auto" | "manuel";

// ── Mode automatique (simulation fictive) ─────────────────────────────────────

type SimState = "idle" | "running" | "done";

function AutoSimulation() {
  const [state, setState] = useState<SimState>("idle");
  const [progress, setProgress] = useState(0);
  const [params, setParams] = useState({
    durationMin: 180,
    arrivalRatePerHour: 8,
    avgPartySize: 3,
  });

  function runSimulation() {
    setState("running");
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 5;
        if (next >= 100) {
          clearInterval(interval);
          setState("done");
          return 100;
        }
        return next;
      });
    }, 80);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Paramètres
        </h2>
        <div className="space-y-4">
          <Field
            label="Durée du service"
            suffix="min"
            value={params.durationMin}
            onChange={(v) => setParams((p) => ({ ...p, durationMin: v }))}
            min={30}
            max={480}
            step={10}
          />
          <Field
            label="Arrivées (λ)"
            suffix="/ h"
            value={params.arrivalRatePerHour}
            onChange={(v) => setParams((p) => ({ ...p, arrivalRatePerHour: v }))}
            min={1}
            max={30}
            step={1}
          />
          <Field
            label="Taille moyenne du groupe"
            suffix="pers."
            value={params.avgPartySize}
            onChange={(v) => setParams((p) => ({ ...p, avgPartySize: v }))}
            min={1}
            max={8}
            step={1}
          />
        </div>

        <button
          onClick={runSimulation}
          disabled={state === "running"}
          className="mt-6 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {state === "running" ? "Simulation en cours…" : "Lancer la simulation"}
        </button>

        {state !== "idle" ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>Avancement</span>
              <span className="font-mono tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-full bg-zinc-900 transition-all duration-150 dark:bg-zinc-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">
          La simulation automatique (processus de Poisson) sera connectée au
          backend dans une prochaine itération. Utilisez le{" "}
          <strong>mode manuel</strong> pour tester le planning en temps réel.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Arrivées de groupes selon un processus de Poisson de paramètre λ.</li>
          <li>Taille de groupe : loi uniforme bornée autour de la moyenne.</li>
          <li>Choix des plats : tirage uniforme dans le menu.</li>
          <li>Refus si aucune table libre de la bonne taille.</li>
        </ul>
      </section>
    </div>
  );
}

// ── Mode manuel ───────────────────────────────────────────────────────────────

function toScheduledStep(task: BackendCommandeResult["scheduledTasks"][0]): ScheduledStep {
  const now = Date.now();
  let status: ScheduledStepStatus = "a_venir";
  if (task.endAt < now) status = "termine";
  else if (task.startAt <= now) status = "en_cours";
  return {
    id: task.id,
    orderId: task.commandeId,
    tableNumber: task.tableNumber,
    recipeName: task.dishName,
    stepName: task.taskName,
    kind: task.kind,
    resourceId: task.resourceName,
    resourceLabel: task.resourceName,
    startAt: task.startAt,
    endAt: task.endAt,
    status,
  };
}

function ManualSimulation() {
  const [tables, setTables] = useState<BackendTable[]>([]);
  const [dishes, setDishes] = useState<Recipe[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [dishSelections, setDishSelections] = useState<(number | null)[]>([null]);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [result, setResult] = useState<BackendCommandeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.tables.list(), api.dishes.list()])
      .then(([t, d]) => {
        setTables(t);
        setDishes(d);
      })
      .catch(console.error);
  }, []);

  const availableTables = tables.filter(
    (t) => t.status === "libre" || t.status === "commande_passee",
  );
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  function selectTable(id: number) {
    const t = tables.find((tbl) => tbl.id === id);
    setSelectedTableId(id);
    setResult(null);
    setError(null);
    const size = t?.partySize ?? 1;
    setDishSelections(Array(size).fill(null));
  }

  function setCoverCount(n: number) {
    setDishSelections(Array(n).fill(null));
  }

  function setDish(index: number, dishId: number | null) {
    setDishSelections((prev) => prev.map((d, i) => (i === index ? dishId : d)));
  }

  async function placeOrder() {
    if (!selectedTableId) return;
    const dishIds = dishSelections.filter((d): d is number => d !== null);
    if (dishIds.length === 0) {
      setError("Sélectionnez au moins un plat.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.commandes.place(selectedTableId, dishIds, speedMultiplier);
      setResult(res);
      // refresh tables to reflect new status
      setTables(await api.tables.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la commande.");
    } finally {
      setLoading(false);
    }
  }

  const ganttSteps: ScheduledStep[] = result
    ? result.scheduledTasks.map(toScheduledStep)
    : [];

  return (
    <div className="space-y-6">
      {/* Multiplicateur de vitesse */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Multiplicateur de durée des étapes
        </h2>
        <Field
          label="Facteur de temps"
          suffix="×"
          value={speedMultiplier}
          onChange={(v) => setSpeedMultiplier(v)}
          min={0.01}
          max={3.0}
          step={0.01}
        />
        <p className="mt-2 text-xs text-zinc-500">
          {speedMultiplier < 1
            ? `Durées réduites à ${(speedMultiplier * 100).toFixed(speedMultiplier < 0.1 ? 1 : 0)}% — simulation accélérée`
            : speedMultiplier > 1
            ? `Durées multipliées par ${speedMultiplier.toFixed(2)} — simulation ralentie`
            : "Durées réelles"}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sélection de table */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            1. Choisir une table
          </h2>
          {availableTables.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune table disponible.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableTables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTable(t.id)}
                  className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                    selectedTableId === t.id
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  }`}
                >
                  T{t.number}{" "}
                  <span className="text-xs opacity-70">({t.seats} pl.)</span>
                </button>
              ))}
            </div>
          )}

          {selectedTable && selectedTable.status === "libre" ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Nombre de couverts
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: selectedTable.seats }, (_, i) => i + 1).map(
                  (n) => (
                    <button
                      key={n}
                      onClick={() => setCoverCount(n)}
                      className={`rounded-md border px-3 py-1 text-sm ${
                        dishSelections.length === n
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                          : "border-zinc-200 bg-white hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950"
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </section>

        {/* Sélection des plats */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            2. Choisir les plats
          </h2>
          {!selectedTable ? (
            <p className="text-sm text-zinc-500">
              Sélectionnez d&apos;abord une table.
            </p>
          ) : (
            <div className="space-y-3">
              {dishSelections.map((selected, i) => (
                <label key={i} className="block">
                  <span className="text-xs font-medium text-zinc-500">
                    Couvert {i + 1}
                  </span>
                  <select
                    value={selected ?? ""}
                    onChange={(e) =>
                      setDish(i, e.target.value ? Number(e.target.value) : null)
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">— Sélectionner un plat —</option>
                    {dishes.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                  {error}
                </p>
              ) : null}

              <button
                onClick={placeOrder}
                disabled={loading || !selectedTableId}
                className="mt-2 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? "Planification en cours…" : "Passer la commande"}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Résultat */}
      {result ? (
        <section className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Commande planifiée — Table {result.tableNumber}
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Service prévu à{" "}
              <span className="font-mono tabular-nums">
                {new Date(result.serviceTimeAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {" · "}
              <span className="font-mono text-xs opacity-70">{result.commandeId}</span>
            </p>
          </div>
          <GanttChart steps={ganttSteps} />
        </section>
      ) : null}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function SimulationPage() {
  const [mode, setMode] = useState<SimMode>("manuel");

  return (
    <>
      <PageHeader
        title="Simulation"
        subtitle={
          mode === "manuel"
            ? "Mode manuel — passez une commande et visualisez le planning"
            : "Simulation à événements discrets en boucle fermée (générateur Poisson)"
        }
        actions={
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {(["manuel", "auto"] as SimMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {m === "manuel" ? "Manuel" : "Automatique"}
              </button>
            ))}
          </div>
        }
      />

      <div className="p-8">
        {mode === "manuel" ? <ManualSimulation /> : <AutoSimulation />}
      </div>
    </>
  );
}

function Field({
  label,
  suffix,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="font-mono tabular-nums text-zinc-500">
          {value} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-zinc-900 dark:accent-zinc-100"
      />
    </label>
  );
}

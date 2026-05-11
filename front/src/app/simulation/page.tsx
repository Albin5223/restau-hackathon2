"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { simulationMetrics } from "@/lib/mockData";

type SimState = "idle" | "running" | "done";

export default function SimulationPage() {
  const [state, setState] = useState<SimState>("done");
  const [progress, setProgress] = useState(100);
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
    <>
      <PageHeader
        title="Simulation"
        subtitle="Simulation à événements discrets en boucle fermée (générateur Poisson)"
      />

      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-[360px_1fr]">
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
              onChange={(v) =>
                setParams((p) => ({ ...p, arrivalRatePerHour: v }))
              }
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

        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Tables servies"
              value={`${simulationMetrics.servedTables}`}
            />
            <Kpi
              label="Groupes refusés"
              value={`${simulationMetrics.refusedGroups}`}
            />
            <Kpi
              label="Attente moyenne"
              value={`${simulationMetrics.averageWaitMin} min`}
            />
            <Kpi
              label="Écart synchro"
              value={`${simulationMetrics.averageSyncSpreadSec} s`}
              hint="Entre 1er et dernier plat d'une table"
            />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Utilisation des ressources
            </h2>
            <ul className="space-y-3">
              {simulationMetrics.resourceUtilization.map((r) => (
                <li key={r.resourceId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {r.label}
                    </span>
                    <span className="font-mono tabular-nums text-zinc-500">
                      {r.usagePct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div
                      className={`h-full ${barColor(r.usagePct)}`}
                      style={{ width: `${r.usagePct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Hypothèses du modèle
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Arrivées de groupes selon un processus de Poisson de paramètre λ.
              </li>
              <li>
                Taille de groupe : loi uniforme bornée autour de la moyenne.
              </li>
              <li>
                Choix des plats : tirage uniforme dans le menu.
              </li>
              <li>
                Refus si aucune table libre de la bonne taille.
              </li>
              <li>
                Ordonnancement : heuristique alignant les fins de cuisson par
                table.
              </li>
            </ul>
          </div>
        </section>
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

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function barColor(pct: number) {
  if (pct >= 85) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

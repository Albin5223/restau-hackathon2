"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { GanttChart } from "@/components/GanttChart";
import { useResources } from "@/components/ResourcesProvider";
import { useTime } from "@/components/TimeProvider";
import { api } from "@/lib/api";
import type { AutoSimLog, AutoSimStatus, SimulationStats, WaitEntry } from "@/lib/api";
import { SimulationCharts } from "@/components/SimulationCharts";
import { missingResources } from "@/lib/recipes";
import type {
  BackendCommandeResult,
  BackendGanttTask,
  BackendTable,
  Recipe,
  ScheduledStep,
  ScheduledStepStatus,
} from "@/lib/types";

type SimMode = "auto" | "manuel";
type AutoSimParams = {
  durationMin: number;
  arrivalRatePerHour: number;
  avgPartySize: number;
  speedMultiplier: number;
};

// ── Conversion tâches backend → ScheduledStep ─────────────────────────────────

function toScheduledSteps(task: BackendGanttTask): ScheduledStep[] {
  const now = Date.now();
  let status: ScheduledStepStatus = "a_venir";
  if (task.endAt < now) status = "termine";
  else if (task.startAt <= now) status = "en_cours";

  if (task.resourceNames.length === 0) {
    return [{
      id: task.id,
      orderId: task.orderId,
      tableNumber: task.tableNumber,
      recipeName: task.dishName,
      stepName: task.taskName,
      kind: task.kind,
      resourceId: `__no_resource__:${task.id}`,
      resourceLabel: "Sans ressource",
      startAt: task.startAt,
      endAt: task.endAt,
      status,
    }];
  }

  return task.resourceNames.map((name, idx) => ({
    id: idx === 0 ? task.id : `${task.id}__r${idx}`,
    orderId: task.orderId,
    tableNumber: task.tableNumber,
    recipeName: task.dishName,
    stepName: task.taskName,
    kind: task.kind,
    resourceId: name,
    resourceLabel: name,
    startAt: task.startAt,
    endAt: task.endAt,
    status,
  }));
}

// ── Mode automatique ──────────────────────────────────────────────────────────

const LOG_TYPE_STYLES: Record<string, string> = {
  arrival: "text-emerald-700 dark:text-emerald-400",
  rejected: "text-red-600 dark:text-red-400",
  order: "text-sky-700 dark:text-sky-400",
  served: "text-amber-700 dark:text-amber-400",
  left: "text-zinc-500 dark:text-zinc-400",
  info: "text-zinc-600 dark:text-zinc-300",
  error: "text-red-600 dark:text-red-400 font-semibold",
};

const LOG_TYPE_LABELS: Record<string, string> = {
  arrival: "Arrivée",
  rejected: "Refus",
  order: "Commande",
  served: "Servi",
  left: "Départ",
  info: "Info",
  error: "Erreur",
};

function LogLine({ log }: { log: AutoSimLog }) {
  const time = new Date(log.timestamp).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="shrink-0 font-mono text-xs text-zinc-400">{time}</span>
      <span className={`shrink-0 w-20 text-xs font-medium uppercase tracking-wide ${LOG_TYPE_STYLES[log.type] ?? ""}`}>
        {LOG_TYPE_LABELS[log.type] ?? log.type}
      </span>
      <span className="text-zinc-700 dark:text-zinc-300">{log.message}</span>
    </div>
  );
}

const EMPTY_STATS: SimulationStats = {
  totalArrivals: 0,
  totalRejected: 0,
  totalOrdersPlaced: 0,
  totalTablesServed: 0,
  totalClientsServed: 0,
  avgWaitTimeSec: 0,
  rejectionRate: 0,
  rejectionReasons: {},
  resourceUsageSeconds: {},
  recentWaitTimes: [],
  timeSeries: [],
};

function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <p className={`text-xl font-mono font-bold ${highlight ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50"}`}>
        {value}
      </p>
    </div>
  );
}

function StatsPanel({ stats, isLive }: { stats: SimulationStats; isLive: boolean }) {
  const [tab, setTab] = useState<"stats" | "charts">("stats");
  const totalWaitSec = Math.round(stats.avgWaitTimeSec);
  const waitMin = Math.floor(totalWaitSec / 60);
  const waitSec = totalWaitSec % 60;

  const topResources = Object.entries(stats.resourceUsageSeconds)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxUsage = topResources[0]?.[1] ?? 1;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Statistiques de performance
          </h2>
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              En direct
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              Résultats finaux
            </span>
          )}
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {(["stats", "charts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {t === "stats" ? "Chiffres" : "Graphiques"}
            </button>
          ))}
        </div>
      </div>

      {tab === "charts" ? (
        <SimulationCharts
          timeSeries={stats.timeSeries}
          recentWaitTimes={stats.recentWaitTimes}
          avgWaitTimeSec={stats.avgWaitTimeSec}
        />
      ) : null}
      {tab === "stats" ? (<>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox label="Arrivées" value={stats.totalArrivals} />
        <StatBox label="Refusés" value={stats.totalRejected} highlight={stats.totalRejected > 0} />
        <StatBox label="Commandes" value={stats.totalOrdersPlaced} />
        <StatBox label="Tables servies" value={stats.totalTablesServed} />
        <StatBox label="Clients servis" value={stats.totalClientsServed} />
        <StatBox
          label="Taux de refus"
          value={`${stats.rejectionRate.toFixed(1)} %`}
          highlight={stats.rejectionRate > 20}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-md bg-zinc-50 p-4 dark:bg-zinc-900">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Temps d&apos;attente moyen (arrivée → service)
          </p>
          {stats.avgWaitTimeSec > 0 ? (
            <p className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-50">
              {waitMin > 0 ? `${waitMin} min ` : ""}
              {waitSec} s
            </p>
          ) : (
            <p className="text-sm text-zinc-400">Aucune table servie pour l&apos;instant</p>
          )}
          {stats.recentWaitTimes.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-zinc-400">Dernières commandes servies :</p>
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {[...stats.recentWaitTimes].reverse().map((w: WaitEntry, i: number) => {
                  const m = Math.floor(w.waitTimeSec / 60);
                  const s = Math.round(w.waitTimeSec % 60);
                  return (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        T{w.tableNumber}
                        {w.partySize > 0 ? ` · ${w.partySize} pers.` : ""}
                      </span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">
                        {m > 0 ? `${m}m ` : ""}{s}s
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md bg-zinc-50 p-4 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Ressources les plus sollicitées
          </p>
          {topResources.length > 0 ? (
            <div className="space-y-2">
              {topResources.map(([name, secs]) => {
                const pct = (secs / maxUsage) * 100;
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                return (
                  <div key={name}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="text-zinc-700 dark:text-zinc-300">{name}</span>
                      <span className="font-mono text-zinc-500">
                        {m > 0 ? `${m}m ` : ""}
                        {s}s
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div
                        className="h-1.5 rounded-full bg-zinc-800 transition-all dark:bg-zinc-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Aucune tâche complétée pour l&apos;instant</p>
          )}
        </div>
      </div>

      {Object.keys(stats.rejectionReasons).length > 0 && (
        <div className="mt-4 rounded-md border border-red-100 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <p className="mb-1 text-xs font-semibold text-red-800 dark:text-red-200">
            Causes de refus
          </p>
          <div className="space-y-0.5">
            {Object.entries(stats.rejectionReasons).map(([reason, count]) => (
              <div key={reason} className="flex justify-between text-xs text-red-700 dark:text-red-300">
                <span>{reason}</span>
                <span className="font-mono font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </>) : null}
    </section>
  );
}

function AutoSimulation({ onStatusChange }: { onStatusChange: (active: boolean) => void }) {
  const PARAMS_STORAGE_KEY = "autoSimParams";
  const { resourceTypes } = useResources();
  const [status, setStatus] = useState<AutoSimStatus>({ active: false, logs: [], stats: EMPTY_STATS });
  const [finalStats, setFinalStats] = useState<SimulationStats | null>(null);
  const [ganttSteps, setGanttSteps] = useState<ScheduledStep[]>([]);
  const [menu, setMenu] = useState<Recipe[]>([]);

  useEffect(() => {
    api.dishes.list().then(setMenu).catch(() => {});
  }, []);

  const unavailableMenuNames = useMemo(
    () =>
      menu
        .filter((d) => missingResources(d, resourceTypes).length > 0)
        .map((d) => d.name),
    [menu, resourceTypes],
  );
  const [params, setParams] = useState<AutoSimParams>({
    durationMin: 60,
    arrivalRatePerHour: 8,
    avgPartySize: 3,
    speedMultiplier: 0.1,
  });
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const prevLogsCountRef = useRef(0);
  const [logsAutoScroll, setLogsAutoScroll] = useState(true);
  const paramsLoadedRef = useRef(false);
  const prevActiveRef = useRef(false);
  const hasOngoingTasks = useMemo(
    () => ganttSteps.some((step) => step.endAt > Date.now()),
    [ganttSteps],
  );

  function isValidParams(value: unknown): value is AutoSimParams {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return [
      v.durationMin,
      v.arrivalRatePerHour,
      v.avgPartySize,
      v.speedMultiplier,
    ].every((n) => typeof n === "number" && Number.isFinite(n));
  }

  function readStoredParams(): AutoSimParams | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PARAMS_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return isValidParams(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function persistParams(next: AutoSimParams) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(next));
  }

  function clearPersistedParams() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(PARAMS_STORAGE_KEY);
  }

  // Polling du statut de simulation
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const s = await api.simulation.status();
        if (!cancelled) {
          setStatus(s);
          onStatusChange(s.active);
          if (s.active && !paramsLoadedRef.current) {
            const stored = readStoredParams();
            if (stored) setParams(stored);
            paramsLoadedRef.current = true;
          }
          if (!s.active && prevActiveRef.current) {
            setFinalStats(s.stats);
            clearPersistedParams();
            paramsLoadedRef.current = false;
          }
          prevActiveRef.current = s.active;
        }
      } catch {
        // ignore network errors during polling
      }
    }

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [onStatusChange]);

  // Polling du Gantt (toutes les 3 secondes)
  useEffect(() => {
    let cancelled = false;

    async function pollGantt() {
      try {
        const res = await api.cuisine.gantt();
        if (!cancelled) {
          setGanttSteps(res.tasks.flatMap(toScheduledSteps));
        }
      } catch {
        // ignore
      }
    }

    pollGantt();
    const id = setInterval(pollGantt, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Auto-scroll des logs vers le bas (seulement si on est déjà en bas)
  useEffect(() => {
    const isNewLog = status.logs.length > prevLogsCountRef.current;
    prevLogsCountRef.current = status.logs.length;
    if (!isNewLog || !logsAutoScroll) return;
    const el = logsContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [status.logs, logsAutoScroll]);

  async function handleStart() {
    if (hasOngoingTasks) return;
    setStarting(true);
    setError(null);
    setFinalStats(null);
    try {
      persistParams(params);
      await api.simulation.start(params);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur au démarrage.");
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    setError(null);
    try {
      await api.simulation.stop();
      clearPersistedParams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur à l'arrêt.");
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      {/* Panneau de paramètres */}
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
            min={5}
            max={480}
            step={5}
            disabled={status.active}
          />
          <Field
            label="Taux d'arrivées (λ)"
            suffix="/ h"
            value={params.arrivalRatePerHour}
            onChange={(v) => setParams((p) => ({ ...p, arrivalRatePerHour: v }))}
            min={1}
            max={30}
            step={1}
            disabled={status.active}
          />
          <Field
            label="Taille moyenne du groupe"
            suffix="pers."
            value={params.avgPartySize}
            onChange={(v) => setParams((p) => ({ ...p, avgPartySize: v }))}
            min={1}
            max={8}
            step={1}
            disabled={status.active}
          />
          <Field
            label="Multiplicateur de vitesse"
            suffix="×"
            value={params.speedMultiplier}
            onChange={(v) => setParams((p) => ({ ...p, speedMultiplier: v }))}
            min={0.01}
            max={3.0}
            step={0.01}
            disabled={status.active}
          />
          <p className="text-xs text-zinc-500">
            {params.speedMultiplier < 1
              ? `Durées réduites à ${(params.speedMultiplier * 100).toFixed(params.speedMultiplier < 0.1 ? 1 : 0)}% — simulation accélérée`
              : params.speedMultiplier > 1
              ? `Durées multipliées par ${params.speedMultiplier.toFixed(2)} — simulation ralentie`
              : "Durées réelles"}
          </p>
        </div>

        {!status.active && unavailableMenuNames.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              {unavailableMenuNames.length} plat
              {unavailableMenuNames.length > 1 ? "s" : ""} du menu
              indisponible{unavailableMenuNames.length > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              Les commandes tirant ces plats au hasard seront refusées (log
              « erreur »). Ajoutez les ressources nécessaires pour une simulation
              fluide.
            </p>
            <Link
              href="/ressources"
              className="mt-1.5 inline-block font-semibold text-amber-900 underline decoration-dotted hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
            >
              → Page Ressources
            </Link>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {!status.active && hasOngoingTasks ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Impossible de lancer la simulation automatique, veuillez{" "}
            <Link
              href="/salle"
              className="font-semibold underline decoration-dotted hover:text-red-700 dark:hover:text-red-200"
            >
              libérer toutes les tables
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-6 space-y-2">
          {!status.active ? (
            <button
              onClick={handleStart}
              disabled={starting || hasOngoingTasks}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {starting ? "Démarrage…" : "Lancer la simulation"}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {stopping ? "Arrêt en cours…" : "Arrêter la simulation"}
            </button>
          )}
        </div>

        {status.active ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
            Simulation en cours
          </div>
        ) : null}
      </section>

      {/* Journal des événements */}
      <section className="flex flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Journal des événements
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {status.logs.length === 0
              ? "Lancez la simulation pour voir les événements."
              : `${status.logs.length} événement(s) enregistré(s)`}
          </p>
        </div>
        <div
          ref={logsContainerRef}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-3"
          style={{ maxHeight: "60vh" }}
          onScroll={() => {
            const el = logsContainerRef.current;
            if (!el) return;
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setLogsAutoScroll(distanceFromBottom < 24);
          }}
        >
          {status.logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              Aucun événement pour l&apos;instant.
            </p>
          ) : (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {status.logs.map((log, i) => (
                <LogLine key={i} log={log} />
              ))}
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      </section>
    </div>

    {/* Statistiques de performance */}
    {(status.active || finalStats) ? (
      <StatsPanel
        stats={status.active ? status.stats : finalStats!}
        isLive={status.active}
      />
    ) : null}

    {/* Gantt de cuisine en temps réel */}
    {ganttSteps.length > 0 ? (
      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Planning cuisine en temps réel
        </h2>
        <GanttChart steps={ganttSteps} />
      </section>
    ) : null}
    </div>
  );
}

// ── Mode manuel ───────────────────────────────────────────────────────────────

function ManualSimulation({ blocked }: { blocked: boolean }) {
  const { resourceTypes } = useResources();
  const { shiftVersion } = useTime();
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

  // Après un voyage temporel, les horaires de la commande affichée sont
  // décalés en base ; on rafraîchit le résultat depuis le Gantt courant.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    api.cuisine
      .gantt()
      .then((res) => {
        if (cancelled) return;
        const myTasks = res.tasks.filter((t) => t.orderId === result.orderId);
        if (myTasks.length === 0) return; // commande clôturée → on garde tel quel
        const serviceTimeAt = Math.max(...myTasks.map((t) => t.endAt));
        setResult({
          orderId: result.orderId,
          tableNumber: result.tableNumber,
          serviceTimeAt,
          scheduledTasks: myTasks,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // On dépend seulement de shiftVersion et de result.orderId pour éviter une boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftVersion, result?.orderId]);

  // Indisponibilité par plat : id → ressources manquantes
  const unavailableById = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const d of dishes) {
      const m = missingResources(d, resourceTypes);
      if (m.length > 0) map.set(d.id, m);
    }
    return map;
  }, [dishes, resourceTypes]);

  const selectedUnavailable = useMemo(
    () =>
      dishSelections
        .filter((id): id is number => id !== null)
        .map((id) => ({ id, dish: dishes.find((d) => d.id === id) }))
        .filter(({ id }) => unavailableById.has(id))
        .map(({ dish, id }) => ({
          name: dish?.name ?? `#${id}`,
          missing: unavailableById.get(id) ?? [],
        })),
    [dishSelections, dishes, unavailableById],
  );

  if (blocked) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Simulation automatique active
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          Les commandes manuelles sont désactivées pendant la simulation automatique. Arrêtez-la pour reprendre le mode manuel.
        </p>
      </div>
    );
  }

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
      const res = await api.orders.place(selectedTableId, dishIds, speedMultiplier);
      setResult(res);
      setTables(await api.tables.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la commande.");
    } finally {
      setLoading(false);
    }
  }

  const ganttSteps: ScheduledStep[] = result
    ? result.scheduledTasks.flatMap(toScheduledSteps)
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
              {dishSelections.map((selected, i) => {
                const isUnavail =
                  selected !== null && unavailableById.has(selected);
                return (
                  <label key={i} className="block">
                    <span className="text-xs font-medium text-zinc-500">
                      Couvert {i + 1}
                    </span>
                    <select
                      value={selected ?? ""}
                      onChange={(e) =>
                        setDish(i, e.target.value ? Number(e.target.value) : null)
                      }
                      className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-900 ${
                        isUnavail
                          ? "border-amber-400 text-amber-900 dark:border-amber-700 dark:text-amber-200"
                          : "border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      <option value="">— Sélectionner un plat —</option>
                      {dishes.map((d) => {
                        const unavail = unavailableById.has(d.id);
                        return (
                          <option key={d.id} value={d.id} disabled={unavail}>
                            {d.name}
                            {unavail
                              ? ` — indispo. (${(unavailableById.get(d.id) ?? []).join(", ")})`
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                );
              })}

              {selectedUnavailable.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    {selectedUnavailable.length} plat
                    {selectedUnavailable.length > 1 ? "s" : ""} indisponible
                    {selectedUnavailable.length > 1 ? "s" : ""} dans la sélection
                  </p>
                  <ul className="mt-1 space-y-0.5 text-amber-800 dark:text-amber-300">
                    {selectedUnavailable.map((u, idx) => (
                      <li key={idx}>
                        • {u.name} — manque : {u.missing.join(", ")}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/ressources"
                    className="mt-1.5 inline-block font-semibold text-amber-900 underline decoration-dotted hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
                  >
                    → Ajouter les ressources manquantes
                  </Link>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                  {error}
                </p>
              ) : null}

              <button
                onClick={placeOrder}
                disabled={
                  loading ||
                  !selectedTableId ||
                  selectedUnavailable.length > 0
                }
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
              <span className="font-mono text-xs opacity-70">{result.orderId}</span>
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
  const [isAutoActive, setIsAutoActive] = useState(false);
  const hasInitializedMode = useRef(false);

  // Poll status even when on the manual tab so the warning appears immediately
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const s = await api.simulation.status();
        if (!cancelled) {
          setIsAutoActive(s.active);
          if (!hasInitializedMode.current) {
            hasInitializedMode.current = true;
            if (s.active) setMode("auto");
          }
        }
      } catch {}
    }
    poll();
    const id = setInterval(poll, 2_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Simulation"
        subtitle={
          mode === "manuel"
            ? "Mode manuel — passez une commande et visualisez le planning"
            : "Simulation à événements discrets en boucle fermée (processus de Poisson)"
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
                {m === "auto" && isAutoActive ? (
                  <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
                ) : null}
              </button>
            ))}
          </div>
        }
      />

      <div className="p-8">
        {mode === "manuel" ? (
          <ManualSimulation blocked={isAutoActive} />
        ) : (
          <AutoSimulation onStatusChange={setIsAutoActive} />
        )}
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
  disabled,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
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
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-zinc-900 disabled:opacity-50 dark:accent-zinc-100"
      />
    </label>
  );
}

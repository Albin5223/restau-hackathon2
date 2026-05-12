"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduledStep } from "@/lib/types";

function kindColor(kind: string): string {
  if (kind === "cuisson") return "bg-amber-500/80 border-amber-600 text-white";
  if (kind === "dressage") return "bg-emerald-500/80 border-emerald-600 text-white";
  return "bg-blue-500/80 border-blue-600 text-white";
}

function kindDotColor(kind: string): string {
  if (kind === "cuisson") return "bg-amber-500/80";
  if (kind === "dressage") return "bg-emerald-500/80";
  return "bg-blue-500/80";
}

function kindLabel(kind: string): string {
  if (kind === "cuisson") return "Cuisson";
  if (kind === "dressage") return "Dressage";
  if (kind === "preparation") return "Préparation";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

type Props = {
  steps: ScheduledStep[];
};

export function GanttChart({ steps }: Props) {
  const [filter, setFilter] = useState<string>("toutes");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Derive available kinds from actual data — never hardcode
  const availableKinds = useMemo(() => {
    const seen = new Set<string>();
    for (const s of steps) seen.add(s.kind);
    return [...seen];
  }, [steps]);

  const visibleSteps =
    filter === "toutes" ? steps : steps.filter((s) => s.kind === filter);

  const { baseTime, endTime } = useMemo(() => {
    if (steps.length === 0) {
      const t = Date.now();
      return { baseTime: t, endTime: t + 30 * 60_000 };
    }
    return {
      baseTime: Math.min(...steps.map((s) => s.startAt)) - 60_000,
      endTime: Math.max(...steps.map((s) => s.endAt)) + 60_000,
    };
  }, [steps]);

  const totalMs = endTime - baseTime;

  const rows = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of steps) {
      if (!seen.has(s.resourceId)) seen.set(s.resourceId, s.resourceLabel);
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [steps]);

  const tickCount = Math.max(Math.floor(totalMs / 60_000 / 2), 2);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    baseTime + (i / tickCount) * totalMs,
  );

  const nowPct = ((now - baseTime) / totalMs) * 100;
  const showNow = nowPct >= 0 && nowPct <= 100;

  if (steps.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
        Aucune tâche en cours — passez une commande depuis la page Simulation.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("toutes")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filter === "toutes"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            Toutes
          </button>
          {availableKinds.map((kind) => (
            <button
              key={kind}
              onClick={() => setFilter(kind)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === kind
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {kindLabel(kind)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          {availableKinds.map((kind) => (
            <Legend key={kind} color={kindDotColor(kind)} label={kindLabel(kind)} />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[140px_1fr] border-b border-zinc-200 pb-2 dark:border-zinc-800">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Ressource
            </div>
            <div className="relative h-6">
              {ticks.map((ts) => {
                const left = ((ts - baseTime) / totalMs) * 100;
                return (
                  <div
                    key={ts}
                    className="absolute -translate-x-1/2 font-mono text-[10px] tabular-nums text-zinc-400"
                    style={{ left: `${left}%` }}
                  >
                    {formatTime(ts)}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative mt-2">
            {showNow && (
              <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-[140px_1fr]">
                <div />
                <div className="relative">
                  <div
                    className="absolute inset-y-0 w-px bg-red-500"
                    style={{ left: `${nowPct}%` }}
                  />
                </div>
              </div>
            )}
            {rows.map(({ id, label }) => {
              const rowSteps = visibleSteps.filter((s) => s.resourceId === id);
              return (
                <div
                  key={id}
                  className="grid grid-cols-[140px_1fr] items-center border-b border-zinc-100 py-2 dark:border-zinc-900"
                >
                  <div className="pr-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {label}
                  </div>
                  <div className="relative h-8">
                    {ticks.map((ts) => (
                      <div
                        key={ts}
                        className="absolute h-full w-px bg-zinc-100 dark:bg-zinc-900"
                        style={{ left: `${((ts - baseTime) / totalMs) * 100}%` }}
                      />
                    ))}
                    {rowSteps.map((step) => {
                      const left = ((step.startAt - baseTime) / totalMs) * 100;
                      const width = ((step.endAt - step.startAt) / totalMs) * 100;
                      return (
                        <div
                          key={step.id}
                          className={`absolute top-1 flex h-6 flex-col justify-center overflow-hidden rounded border px-1 leading-tight shadow-sm ${kindColor(step.kind)} ${step.status === "termine" ? "opacity-40" : ""}`}
                          style={{
                            left: `${left}%`,
                            width: `${Math.max(width, 1.5)}%`,
                          }}
                          title={`T${step.tableNumber} · ${step.recipeName} · ${step.stepName} (${kindLabel(step.kind)})`}
                        >
                          <span className="truncate text-[10px] font-semibold">
                            {step.stepName}
                          </span>
                          <span className="truncate text-[9px] opacity-80">
                            T{step.tableNumber} · {step.recipeName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

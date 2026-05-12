"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduledStep, ScheduledStepStatus } from "@/lib/types";

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

function statusLabel(status: ScheduledStepStatus): string {
  if (status === "en_cours") return "En cours";
  if (status === "termine") return "Terminé";
  return "À venir";
}

function statusBadge(status: ScheduledStepStatus): string {
  if (status === "en_cours")
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (status === "termine")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400";
}

type Props = {
  steps: ScheduledStep[];
};

export function GanttChart({ steps }: Props) {
  const [filter, setFilter] = useState<string>("toutes");
  const [now, setNow] = useState(Date.now());
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Auto-close the panel if the selected commande disappears from the data
  useEffect(() => {
    if (selectedOrderId && !steps.some((s) => s.orderId === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [steps, selectedOrderId]);

  const activeOrderId = selectedOrderId ?? hoveredOrderId;

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
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
                        const isActive =
                          activeOrderId === null || step.orderId === activeOrderId;
                        const isSelected = step.orderId === selectedOrderId;
                        const opacity = !isActive
                          ? "opacity-20"
                          : step.status === "termine"
                            ? "opacity-40"
                            : "";
                        const ring = isSelected
                          ? "ring-2 ring-zinc-900 dark:ring-zinc-50"
                          : "";
                        return (
                          <div
                            key={step.id}
                            className={`absolute top-1 flex h-6 cursor-pointer flex-col justify-center overflow-hidden rounded border px-1 leading-tight shadow-sm transition-opacity ${kindColor(step.kind)} ${opacity} ${ring}`}
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(width, 1.5)}%`,
                            }}
                            title={`T${step.tableNumber} · ${step.recipeName} · ${step.stepName} (${kindLabel(step.kind)})`}
                            onMouseEnter={() => setHoveredOrderId(step.orderId)}
                            onMouseLeave={() => setHoveredOrderId(null)}
                            onClick={() =>
                              setSelectedOrderId((prev) =>
                                prev === step.orderId ? null : step.orderId,
                              )
                            }
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

      {selectedOrderId ? (
        <CommandeDetailPanel
          orderId={selectedOrderId}
          steps={steps.filter((s) => s.orderId === selectedOrderId)}
          onClose={() => setSelectedOrderId(null)}
        />
      ) : null}
    </div>
  );
}

function CommandeDetailPanel({
  orderId,
  steps,
  onClose,
}: {
  orderId: string;
  steps: ScheduledStep[];
  onClose: () => void;
}) {
  if (steps.length === 0) return null;

  const sorted = [...steps].sort((a, b) => a.startAt - b.startAt);
  const tableNumber = sorted[0].tableNumber;
  const startAt = Math.min(...sorted.map((s) => s.startAt));
  const endAt = Math.max(...sorted.map((s) => s.endAt));
  const durationMin = Math.round((endAt - startAt) / 60_000);

  const byDish = new Map<string, ScheduledStep[]>();
  for (const s of sorted) {
    const list = byDish.get(s.recipeName) ?? [];
    list.push(s);
    byDish.set(s.recipeName, list);
  }

  const done = sorted.filter((s) => s.status === "termine").length;
  const total = sorted.length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <aside className="w-80 shrink-0 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Commande #{orderId.slice(0, 6)}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Table {tableNumber}
          </h3>
          <p className="mt-1 font-mono text-xs tabular-nums text-zinc-500">
            {formatTime(startAt)} → {formatTime(endAt)} · {durationMin} min
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </header>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-zinc-500">Avancement</span>
          <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
            {done}/{total} · {progressPct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
          <div
            className="h-full bg-zinc-900 dark:bg-zinc-100"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {Array.from(byDish.entries()).map(([dish, dishSteps]) => (
          <section key={dish}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              {dish}
            </h4>
            <ol className="mt-2 space-y-1.5">
              {dishSteps.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-sm ${kindDotColor(s.kind)}`}
                  />
                  <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                    {s.stepName}
                  </span>
                  <span className="font-mono tabular-nums text-zinc-500">
                    {formatTime(s.startAt)}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(s.status)}`}
                  >
                    {statusLabel(s.status)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </aside>
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

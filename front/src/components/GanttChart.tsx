"use client";

import { useMemo, useState } from "react";
import type { ScheduledStep, StepKind } from "@/lib/types";
import { resources, SERVICE_START } from "@/lib/mockData";

const stepColors: Record<StepKind, string> = {
  preparation: "bg-blue-500/80 border-blue-600 text-white",
  cuisson: "bg-amber-500/80 border-amber-600 text-white",
  dressage: "bg-emerald-500/80 border-emerald-600 text-white",
};

const stepLabels: Record<StepKind, string> = {
  preparation: "Préparation",
  cuisson: "Cuisson",
  dressage: "Dressage",
};

type Props = {
  steps: ScheduledStep[];
};

export function GanttChart({ steps }: Props) {
  const [filter, setFilter] = useState<"toutes" | StepKind>("toutes");

  const visibleSteps = filter === "toutes"
    ? steps
    : steps.filter((s) => s.kind === filter);

  const { startMin, endMin } = useMemo(() => {
    if (steps.length === 0) return { startMin: 0, endMin: 30 };
    const baseStart = SERVICE_START.getTime();
    const minStart = Math.min(...steps.map((s) => s.startAt));
    const maxEnd = Math.max(...steps.map((s) => s.endAt));
    return {
      startMin: Math.floor((minStart - baseStart) / 60_000) - 1,
      endMin: Math.ceil((maxEnd - baseStart) / 60_000) + 1,
    };
  }, [steps]);

  const totalMin = endMin - startMin;
  const baseStart = SERVICE_START.getTime();
  const nowOffsetMin = (Date.now() - baseStart) / 60_000;

  const stepsByResource = resources.map((r) => ({
    resource: r,
    steps: visibleSteps.filter((s) => s.resourceId === r.id),
  }));

  const ticks = Array.from(
    { length: Math.floor(totalMin / 2) + 1 },
    (_, i) => startMin + i * 2,
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(["toutes", "preparation", "cuisson", "dressage"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {f === "toutes" ? "Toutes" : stepLabels[f]}
              </button>
            ),
          )}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <Legend color="bg-blue-500/80" label="Préparation" />
          <Legend color="bg-amber-500/80" label="Cuisson" />
          <Legend color="bg-emerald-500/80" label="Dressage" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[120px_1fr] border-b border-zinc-200 pb-2 dark:border-zinc-800">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Ressource
            </div>
            <div className="relative h-6">
              <div className="absolute inset-0 flex">
                {ticks.map((tick) => {
                  const left = ((tick - startMin) / totalMin) * 100;
                  return (
                    <div
                      key={tick}
                      className="absolute -translate-x-1/2 font-mono text-[10px] tabular-nums text-zinc-400"
                      style={{ left: `${left}%` }}
                    >
                      {formatTickLabel(tick)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-2">
            {stepsByResource.map(({ resource, steps: rowSteps }) => (
              <div
                key={resource.id}
                className="grid grid-cols-[120px_1fr] items-center border-b border-zinc-100 py-2 dark:border-zinc-900"
              >
                <div className="pr-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {resource.label}
                </div>
                <div className="relative h-8">
                  <div className="absolute inset-0 flex">
                    {ticks.map((tick) => {
                      const left = ((tick - startMin) / totalMin) * 100;
                      return (
                        <div
                          key={tick}
                          className="absolute h-full w-px bg-zinc-100 dark:bg-zinc-900"
                          style={{ left: `${left}%` }}
                        />
                      );
                    })}
                  </div>
                  {nowOffsetMin >= startMin && nowOffsetMin <= endMin ? (
                    <div
                      className="pointer-events-none absolute top-0 z-10 h-full w-px bg-red-500"
                      style={{
                        left: `${((nowOffsetMin - startMin) / totalMin) * 100}%`,
                      }}
                    />
                  ) : null}
                  {rowSteps.map((step) => {
                    const startOffset =
                      (step.startAt - baseStart) / 60_000;
                    const endOffset = (step.endAt - baseStart) / 60_000;
                    const left = ((startOffset - startMin) / totalMin) * 100;
                    const width = ((endOffset - startOffset) / totalMin) * 100;
                    return (
                      <div
                        key={step.id}
                        className={`absolute top-1 flex h-6 items-center overflow-hidden rounded border px-1 text-[10px] font-medium leading-none shadow-sm ${stepColors[step.kind]} ${step.status === "termine" ? "opacity-40" : ""}`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 1.5)}%`,
                        }}
                        title={`T${step.tableNumber} · ${step.recipeName} · ${stepLabels[step.kind]}`}
                      >
                        <span className="truncate">
                          T{step.tableNumber} · {step.recipeName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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

function formatTickLabel(offsetMin: number): string {
  const d = new Date(SERVICE_START.getTime() + offsetMin * 60_000);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

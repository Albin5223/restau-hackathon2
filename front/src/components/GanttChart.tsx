"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScheduledStep, ScheduledStepStatus } from "@/lib/types";
import { formatDuration } from "@/lib/format";

function kindColor(kind: string, noResource = false): string {
  if (noResource) return "bg-zinc-300/80 border border-zinc-400 text-zinc-700 border-dashed";
  if (kind === "cuisson") return "bg-amber-500/85 text-white";
  if (kind === "dressage") return "bg-emerald-500/85 text-white";
  return "bg-blue-500/85 text-white";
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

// Strip the "__rN" suffix added when expanding multi-resource steps
function getBaseStepId(id: string): string {
  return id.replace(/__r\d+$/, "");
}

// Stable color per step — same palette, picked by hashing the base step ID
const LINK_COLORS = ["#fde68a", "#f9a8d4", "#c4b5fd", "#5eead4", "#fdba74", "#bfdbfe"];
function linkColor(baseId: string): string {
  let h = 0;
  for (const c of baseId) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return LINK_COLORS[h % LINK_COLORS.length];
}

const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6, 8];

type Props = {
  steps: ScheduledStep[];
  onDelayTask?: (ganttTaskId: string, additionalSeconds: number) => Promise<void>;
};

export function GanttChart({ steps, onDelayTask }: Props) {
  const [filter, setFilter] = useState<string>("toutes");
  const [now, setNow] = useState(Date.now());
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [hoveredBaseStepId, setHoveredBaseStepId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [pendingDelayStepId, setPendingDelayStepId] = useState<string | null>(null);

  // Scroll container ref — measures viewport width (fixed regardless of zoom)
  const [scrollContainerEl, setScrollContainerEl] = useState<HTMLDivElement | null>(null);
  const [containerChartWidth, setContainerChartWidth] = useState(0);

  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = ZOOM_LEVELS[zoomIndex];

  useEffect(() => {
    if (!scrollContainerEl) return;
    const update = () => {
      // Subtract the 140px label column to get the chart-only viewport width
      setContainerChartWidth(Math.max(0, scrollContainerEl.getBoundingClientRect().width - 140));
    };
    const ro = new ResizeObserver(update);
    ro.observe(scrollContainerEl);
    update();
    return () => ro.disconnect();
  }, [scrollContainerEl]);

  const effectiveChartWidth = Math.max(660, containerChartWidth) * zoom;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Auto-close the panel if the selected commande disappears from the data
  useEffect(() => {
    if (selectedOrderId && !steps.some((s) => s.orderId === selectedOrderId)) {
      setSelectedOrderId(null);
      setPendingDelayStepId(null);
    }
  }, [steps, selectedOrderId]);

  const activeOrderId = selectedOrderId ?? hoveredOrderId;

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

  const toPx = useCallback(
    (ts: number) =>
      effectiveChartWidth > 0
        ? Math.round(((ts - baseTime) / totalMs) * effectiveChartWidth)
        : 0,
    [effectiveChartWidth, baseTime, totalMs],
  );

  const rows = useMemo(() => {
    const seen = new Map<string, string>();
    let noResCount = 0;
    for (const s of steps) {
      if (!seen.has(s.resourceId)) {
        if (s.resourceId.startsWith("__no_resource__")) {
          noResCount++;
          seen.set(s.resourceId, `Sans ressource ${noResCount}`);
        } else {
          seen.set(s.resourceId, s.resourceLabel);
        }
      }
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [steps]);

  const multiResourceBaseIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of steps) {
      const base = getBaseStepId(s.id);
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id),
    );
  }, [steps]);

  const ticks = useMemo(() => {
    const MINUTE_INTERVALS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 300];
    const maxTicks = Math.round(12 * zoom);
    const intervalMs =
      (MINUTE_INTERVALS.find((m) => totalMs / (m * 60_000) <= maxTicks) ?? 300) *
      60_000;
    const firstTick = Math.ceil(baseTime / intervalMs) * intervalMs;
    const result: number[] = [];
    for (let ts = firstTick; ts <= endTime; ts += intervalMs) result.push(ts);
    return result;
  }, [baseTime, endTime, totalMs, zoom]);

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
        {/* Toolbar: filters + zoom */}
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

          {/* Zoom controls */}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-zinc-500">Zoom</span>
            <button
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              disabled={zoomIndex === 0}
              className="rounded px-2 py-0.5 text-sm font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Dézoomer"
            >
              −
            </button>
            <button
              onClick={() => setZoomIndex(0)}
              className="w-10 rounded px-1 py-0.5 text-center font-mono text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Réinitialiser le zoom"
            >
              ×{zoom % 1 === 0 ? zoom : zoom.toFixed(1)}
            </button>
            <button
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
              className="rounded px-2 py-0.5 text-sm font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Zoomer"
            >
              +
            </button>

            <div className="ml-3 flex items-center gap-3 text-xs text-zinc-500">
              {availableKinds.map((kind) => (
                <Legend key={kind} color={kindDotColor(kind)} label={kindLabel(kind)} />
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div ref={setScrollContainerEl} className="overflow-x-auto">
          <div style={{ width: effectiveChartWidth + 140 }}>
            {/* Header: tick labels */}
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

            {/* Rows */}
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
                const isNoResource = id.startsWith("__no_resource__");
                return (
                  <div
                    key={id}
                    className={`grid grid-cols-[140px_1fr] items-center border-b py-2 ${
                      isNoResource
                        ? "border-dashed border-zinc-200 dark:border-zinc-800"
                        : "border-zinc-100 dark:border-zinc-900"
                    }`}
                  >
                    <div
                      className={`pr-3 text-sm font-medium ${
                        isNoResource
                          ? "italic text-zinc-400 dark:text-zinc-500"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
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
                        const leftPx = toPx(step.startAt);
                        const widthPx = Math.max(toPx(step.endAt) - leftPx, 6);
                        const isNoResourceStep = step.resourceId.startsWith("__no_resource__");
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
                        const baseId = getBaseStepId(step.id);
                        const isMultiResource = multiResourceBaseIds.has(baseId);
                        const isSiblingHovered =
                          isMultiResource &&
                          hoveredBaseStepId === baseId &&
                          !isSelected;
                        // En_cours bars gettable for direct delay
                        const isDelayable = step.status === "en_cours" && !!onDelayTask;
                        return (
                          <div
                            key={step.id}
                            className={`absolute top-1 flex h-6 cursor-pointer flex-col justify-center overflow-hidden rounded px-1 leading-tight transition-opacity ${isNoResourceStep ? "" : "shadow-sm ring-1 ring-inset ring-black/[.12]"} ${kindColor(step.kind, isNoResourceStep)} ${opacity} ${ring}`}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                              outline: isSiblingHovered
                                ? "2px solid rgba(255,255,255,0.85)"
                                : isDelayable
                                  ? "1px dashed rgba(255,255,255,0.5)"
                                  : undefined,
                              outlineOffset: "1px",
                            }}
                            title={
                              isMultiResource
                                ? `T${step.tableNumber} · ${step.recipeName} · ${step.stepName} (${kindLabel(step.kind)}) — étape multi-ressource${isDelayable ? " · Cliquer pour déclarer un retard" : ""}`
                                : `T${step.tableNumber} · ${step.recipeName} · ${step.stepName} (${kindLabel(step.kind)})${isDelayable ? " · Cliquer pour déclarer un retard" : ""}`
                            }
                            onMouseEnter={() => {
                              setHoveredOrderId(step.orderId);
                              setHoveredBaseStepId(baseId);
                            }}
                            onMouseLeave={() => {
                              setHoveredOrderId(null);
                              setHoveredBaseStepId(null);
                            }}
                            onClick={() => {
                              const newOrderId =
                                selectedOrderId === step.orderId ? null : step.orderId;
                              setSelectedOrderId(newOrderId);
                              if (newOrderId && isDelayable) {
                                setPendingDelayStepId(step.id);
                              } else {
                                setPendingDelayStepId(null);
                              }
                            }}
                          >
                            <span className="truncate text-[10px] font-semibold">
                              {step.stepName}
                            </span>
                            <span className="truncate text-[9px] opacity-80">
                              T{step.tableNumber} · {step.recipeName}
                            </span>
                            {isMultiResource && (
                              <span
                                className="absolute right-0.5 top-0.5 h-2 w-2 shrink-0 rounded-full border border-black/20"
                                style={{ background: linkColor(baseId) }}
                              />
                            )}
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
          onClose={() => { setSelectedOrderId(null); setPendingDelayStepId(null); }}
          onDelayTask={onDelayTask}
          initialDelayStepId={pendingDelayStepId}
        />
      ) : null}
    </div>
  );
}

function CommandeDetailPanel({
  orderId,
  steps,
  onClose,
  onDelayTask,
  initialDelayStepId,
}: {
  orderId: string;
  steps: ScheduledStep[];
  onClose: () => void;
  onDelayTask?: (ganttTaskId: string, additionalSeconds: number) => Promise<void>;
  initialDelayStepId?: string | null;
}) {
  const [delayingStepId, setDelayingStepId] = useState<string | null>(null);
  const [delayMinutes, setDelayMinutes] = useState("5");
  const [isDelaying, setIsDelaying] = useState(false);
  const [delayError, setDelayError] = useState<string | null>(null);

  // Auto-open delay form when the user clicks directly on an en_cours bar
  useEffect(() => {
    if (initialDelayStepId) {
      setDelayingStepId(initialDelayStepId);
      setDelayMinutes("5");
      setDelayError(null);
    }
  }, [initialDelayStepId]);

  async function handleConfirmDelay(stepId: string) {
    if (!onDelayTask) return;
    const minutes = parseInt(delayMinutes, 10);
    if (isNaN(minutes) || minutes <= 0) return;
    setIsDelaying(true);
    setDelayError(null);
    try {
      await onDelayTask(getBaseStepId(stepId), minutes * 60);
      setDelayingStepId(null);
    } catch {
      setDelayError("Erreur lors de la déclaration du retard.");
    } finally {
      setIsDelaying(false);
    }
  }

  if (steps.length === 0) return null;

  const sorted = [...steps].sort((a, b) => a.startAt - b.startAt);
  const tableNumber = sorted[0].tableNumber;
  const startAt = Math.min(...sorted.map((s) => s.startAt));
  const endAt = Math.max(...sorted.map((s) => s.endAt));
  const durationSec = Math.round((endAt - startAt) / 1_000);

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
            {formatTime(startAt)} → {formatTime(endAt)} · {formatDuration(durationSec)}
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
              {dishSteps.map((s) => {
                const isBeingDelayed = delayingStepId === s.id;
                const isNoResource = s.resourceId.startsWith("__no_resource__");
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`h-2 w-2 shrink-0 rounded-sm ${kindDotColor(s.kind)}`} />
                    <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                      {s.stepName}
                      {!isNoResource && (
                        <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                          · {s.resourceLabel}
                        </span>
                      )}
                    </span>
                    <span className="font-mono tabular-nums text-zinc-500">
                      {formatTime(s.startAt)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(s.status)}`}
                    >
                      {statusLabel(s.status)}
                    </span>

                    {s.status === "en_cours" && onDelayTask && (
                      isBeingDelayed ? (
                        <div className="flex w-full items-center gap-1 pl-3.5">
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={delayMinutes}
                            onChange={(e) => setDelayMinutes(e.target.value)}
                            className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                          <span className="text-zinc-500">min</span>
                          <button
                            onClick={() => handleConfirmDelay(s.id)}
                            disabled={isDelaying}
                            className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            {isDelaying ? "…" : "✓"}
                          </button>
                          <button
                            onClick={() => { setDelayingStepId(null); setDelayError(null); }}
                            className="rounded px-1 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            ✕
                          </button>
                          {delayError && (
                            <span className="text-[10px] text-red-500">{delayError}</span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setDelayingStepId(s.id);
                            setDelayMinutes("5");
                            setDelayError(null);
                          }}
                          title="Déclarer un retard"
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                        >
                          ⏱ retard
                        </button>
                      )
                    )}
                  </li>
                );
              })}
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

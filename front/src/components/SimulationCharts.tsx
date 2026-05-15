"use client";

import type { SimTimePoint, WaitEntry } from "@/lib/api";

const C = {
  arrivals: "#10b981",
  orders: "#3b82f6",
  served: "#f59e0b",
  rejected: "#ef4444",
  waitDot: "#8b5cf6",
  waitAvg: "#94a3b8",
};

const VW = 560;
const VH = 170;
const P = { t: 8, r: 12, b: 28, l: 40 };
const IW = VW - P.l - P.r;
const IH = VH - P.t - P.b;

function niceMax(v: number) {
  if (v <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / exp) * exp;
}

function yAxis(max: number) {
  const n = Math.min(5, max + 1);
  return Array.from({ length: n }, (_, i) => Math.round((max * i) / (n - 1)));
}

function formatSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m${sec > 0 ? ` ${sec}s` : ""}` : `${sec}s`;
}

function formatMin(sec: number) {
  const m = Math.round(sec / 60);
  return `${m}min`;
}

// ── Flux chart ────────────────────────────────────────────────────────────────

function FluxChart({ points }: { points: SimTimePoint[] }) {
  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-zinc-400">
        La simulation doit être active quelques secondes…
      </p>
    );
  }

  const xs = points.map((p) => p.elapsedSimSec);
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const rawMax = Math.max(
    ...points.flatMap((p) => [p.arrivals, p.ordersPlaced, p.tablesServed, p.rejected]),
    1,
  );
  const maxY = niceMax(rawMax);
  const ticks = yAxis(maxY);
  const xCount = 5;
  const xVals = Array.from(
    { length: xCount },
    (_, i) => minX + ((maxX - minX) * i) / (xCount - 1),
  );

  const scX = (x: number) => ((x - minX) / Math.max(maxX - minX, 1)) * IW;
  const scY = (y: number) => IH - (y / maxY) * IH;
  const path = (key: keyof SimTimePoint) =>
    points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${scX(p.elapsedSimSec).toFixed(1)},${scY(p[key] as number).toFixed(1)}`,
      )
      .join(" ");

  const series: Array<{ key: keyof SimTimePoint; color: string; label: string }> = [
    { key: "arrivals", color: C.arrivals, label: "Arrivées" },
    { key: "ordersPlaced", color: C.orders, label: "Commandes" },
    { key: "tablesServed", color: C.served, label: "Servis" },
    { key: "rejected", color: C.rejected, label: "Refusés" },
  ];

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs">
        {series.map(({ label, color }) => (
          <span
            key={label}
            className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400"
          >
            <span
              className="inline-block h-0.5 w-5 rounded"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" className="overflow-visible">
        <g transform={`translate(${P.l},${P.t})`}>
          {ticks.map((y) => (
            <g key={y}>
              <line
                x1={0}
                y1={scY(y)}
                x2={IW}
                y2={scY(y)}
                className="stroke-zinc-200 dark:stroke-zinc-700"
                strokeWidth={1}
              />
              <text
                x={-4}
                y={scY(y) + 4}
                textAnchor="end"
                fontSize={10}
                className="fill-zinc-400 dark:fill-zinc-500"
              >
                {y}
              </text>
            </g>
          ))}
          {xVals.map((x, i) => (
            <text
              key={i}
              x={scX(x)}
              y={IH + 18}
              textAnchor="middle"
              fontSize={10}
              className="fill-zinc-400 dark:fill-zinc-500"
            >
              {formatMin(x)}
            </text>
          ))}
          {series.map(({ key, color }) => (
            <path
              key={key}
              d={path(key)}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

// ── Wait time chart ───────────────────────────────────────────────────────────

function WaitChart({
  entries,
  avgWait,
}: {
  entries: WaitEntry[];
  avgWait: number;
}) {
  if (entries.length < 1) {
    return (
      <p className="py-8 text-center text-sm text-zinc-400">
        En attente de tables servies…
      </p>
    );
  }

  const xs = entries.map((e) => e.elapsedSimSec);
  const ys = entries.map((e) => e.waitTimeSec);
  const minX = xs[0];
  const maxX = Math.max(...xs);
  const rawMax = Math.max(...ys, avgWait, 60);
  const maxY = niceMax(rawMax);
  const ticks = yAxis(maxY);
  const xCount = 5;
  const xVals = Array.from(
    { length: xCount },
    (_, i) => minX + ((maxX - minX) * i) / (xCount - 1),
  );

  const scX = (x: number) => ((x - minX) / Math.max(maxX - minX, 1)) * IW;
  const scY = (y: number) => IH - (y / maxY) * IH;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: C.waitDot }}
          />
          Attente par table
        </span>
        <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <svg width={20} height={10} className="inline">
            <line
              x1={0}
              y1={5}
              x2={20}
              y2={5}
              stroke={C.waitAvg}
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
          </svg>
          Moyenne
        </span>
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" className="overflow-visible">
        <g transform={`translate(${P.l},${P.t})`}>
          {ticks.map((y) => (
            <g key={y}>
              <line
                x1={0}
                y1={scY(y)}
                x2={IW}
                y2={scY(y)}
                className="stroke-zinc-200 dark:stroke-zinc-700"
                strokeWidth={1}
              />
              <text
                x={-4}
                y={scY(y) + 4}
                textAnchor="end"
                fontSize={10}
                className="fill-zinc-400 dark:fill-zinc-500"
              >
                {formatSec(y)}
              </text>
            </g>
          ))}
          {xVals.map((x, i) => (
            <text
              key={i}
              x={scX(x)}
              y={IH + 18}
              textAnchor="middle"
              fontSize={10}
              className="fill-zinc-400 dark:fill-zinc-500"
            >
              {formatMin(x)}
            </text>
          ))}
          {avgWait > 0 && (
            <line
              x1={0}
              y1={scY(avgWait)}
              x2={IW}
              y2={scY(avgWait)}
              stroke={C.waitAvg}
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
          )}
          {entries.map((e, i) => (
            <circle
              key={i}
              cx={scX(e.elapsedSimSec)}
              cy={scY(e.waitTimeSec)}
              r={4}
              fill={C.waitDot}
              fillOpacity={0.7}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function SimulationCharts({
  timeSeries,
  recentWaitTimes,
  avgWaitTimeSec,
}: {
  timeSeries: SimTimePoint[];
  recentWaitTimes: WaitEntry[];
  avgWaitTimeSec: number;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Flux de clients (cumulatif)
        </h3>
        <p className="mb-2 text-xs text-zinc-500">
          L&apos;écart entre « Arrivées » et « Servis » révèle le carnet de commandes en attente.
        </p>
        <FluxChart points={timeSeries} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Temps d&apos;attente par table servie
        </h3>
        <p className="mb-2 text-xs text-zinc-500">
          Une tendance montante indique que la cuisine prend du retard sous la charge.
        </p>
        <WaitChart entries={recentWaitTimes} avgWait={avgWaitTimeSec} />
      </div>
    </div>
  );
}

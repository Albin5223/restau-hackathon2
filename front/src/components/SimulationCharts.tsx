"use client";

import type { SimTimePoint, WaitEntry } from "@/lib/api";

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  orders: "#3b82f6",
  tables: "#f59e0b",
  rejected: "#ef4444",
  above: "#ef4444",
  below: "#10b981",
  movingAvg: "#8b5cf6",
  globalAvg: "#94a3b8",
};

// ── SVG helpers ───────────────────────────────────────────────────────────────

const VW = 400;
const VH = 140;
const P = { t: 6, r: 8, b: 26, l: 34 };
const IW = VW - P.l - P.r;
const IH = VH - P.t - P.b;

function niceMax(v: number) {
  if (v <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / exp) * exp;
}

function yTicks(max: number, n = 4): number[] {
  return Array.from({ length: n + 1 }, (_, i) => Math.round((max * i) / n));
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m` : `${Math.round(s)}s`;
}

function fmtMin(sec: number) {
  return `${Math.round(sec / 60)}m`;
}

function Axes({
  maxY,
  maxX,
  minX,
  yFmt,
  xFmt,
}: {
  maxY: number;
  maxX: number;
  minX: number;
  yFmt: (v: number) => string;
  xFmt: (v: number) => string;
}) {
  const ticks = yTicks(maxY);
  const xVals = [0, 0.25, 0.5, 0.75, 1].map((r) => minX + (maxX - minX) * r);
  const scY = (y: number) => IH - (y / maxY) * IH;
  const scX = (x: number) => ((x - minX) / Math.max(maxX - minX, 1)) * IW;
  return (
    <>
      {ticks.map((y, idx) => (
        <g key={`y-${idx}`}>
          <line
            x1={0} y1={scY(y)} x2={IW} y2={scY(y)}
            className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={1}
          />
          <text x={-3} y={scY(y) + 4} textAnchor="end" fontSize={9}
            className="fill-zinc-400 dark:fill-zinc-500">
            {yFmt(y)}
          </text>
        </g>
      ))}
      {xVals.map((x, i) => (
        <text key={i} x={scX(x)} y={IH + 17} textAnchor="middle" fontSize={9}
          className="fill-zinc-400 dark:fill-zinc-500">
          {xFmt(x)}
        </text>
      ))}
    </>
  );
}

// ── Chart 1: activité en temps réel ──────────────────────────────────────────

function ActivityChart({ points }: { points: SimTimePoint[] }) {
  if (points.length < 2) {
    return (
      <p className="flex items-center justify-center h-[90px] text-xs text-zinc-400">
        En attente de données…
      </p>
    );
  }

  const xs = points.map((p) => p.elapsedSimSec);
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const rawMax = Math.max(
    ...points.flatMap((p) => [p.ordersInKitchen, p.tablesOccupied]),
    1,
  );
  const maxY = niceMax(rawMax);
  const maxRej = niceMax(Math.max(...points.map((p) => p.totalRejected), 1));
  const scX = (x: number) => ((x - minX) / Math.max(maxX - minX, 1)) * IW;
  const scY = (y: number) => IH - (y / maxY) * IH;
  const scRej = (y: number) => IH - (y / maxRej) * IH;

  const line = (key: "ordersInKitchen" | "tablesOccupied") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${scX(p.elapsedSimSec).toFixed(1)},${scY(p[key]).toFixed(1)}`)
      .join(" ");

  const rejLine = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${scX(p.elapsedSimSec).toFixed(1)},${scRej(p.totalRejected).toFixed(1)}`)
    .join(" ");

  const rejTicks = yTicks(maxRej);

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-3 text-xs">
        {[
          { color: C.orders, label: "Commandes en cours" },
          { color: C.tables, label: "Tables occupées" },
          { color: C.rejected, label: "Refus cumulés (axe →)" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" className="overflow-visible">
        <g transform={`translate(${P.l},${P.t})`}>
          <Axes maxY={maxY} maxX={maxX} minX={minX} yFmt={(v) => String(v)} xFmt={fmtMin} />
          {/* Right Y-axis ticks for rejections */}
          {rejTicks.map((v, idx) => (
            <text key={`rj-${idx}`} x={IW + 3} y={scRej(v) + 4} textAnchor="start" fontSize={9}
              fill={C.rejected} opacity={0.7}>
              {v}
            </text>
          ))}
          <path d={line("tablesOccupied")} fill="none" stroke={C.tables} strokeWidth={1.5} strokeLinejoin="round" />
          <path d={rejLine} fill="none" stroke={C.rejected} strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4,3" />
          <path d={line("ordersInKitchen")} fill="none" stroke={C.orders} strokeWidth={2} strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

// ── Chart 2: temps d'attente ──────────────────────────────────────────────────

function WaitChart({ entries, avgWait }: { entries: WaitEntry[]; avgWait: number }) {
  if (entries.length < 1) {
    return (
      <p className="flex items-center justify-center h-[90px] text-xs text-zinc-400">
        En attente de tables servies…
      </p>
    );
  }

  const xs = entries.map((e) => e.elapsedSimSec);
  const minX = xs[0];
  const maxX = Math.max(...xs, minX + 1);
  const rawMax = Math.max(...entries.map((e) => e.waitTimeSec), avgWait, 60);
  const maxY = niceMax(rawMax);
  const scX = (x: number) => ((x - minX) / Math.max(maxX - minX, 1)) * IW;
  const scY = (y: number) => IH - (y / maxY) * IH;

  // Moving average (window = 5)
  const movingAvg = entries.map((_, i) => {
    const win = entries.slice(Math.max(0, i - 4), i + 1);
    const avg = win.reduce((s, e) => s + e.waitTimeSec, 0) / win.length;
    return { x: entries[i].elapsedSimSec, y: avg };
  });
  const movingPath = movingAvg
    .map((p, i) => `${i === 0 ? "M" : "L"}${scX(p.x).toFixed(1)},${scY(p.y).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: C.above }} />
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: C.below }} />
          Attente (rouge = au-dessus moy.)
        </span>
        <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
          <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: C.movingAvg }} />
          Tendance (moy. mobile)
        </span>
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" className="overflow-visible">
        <g transform={`translate(${P.l},${P.t})`}>
          <Axes maxY={maxY} maxX={maxX} minX={minX} yFmt={fmtSec} xFmt={fmtMin} />
          {/* Global average (dashed reference) */}
          {avgWait > 0 && avgWait <= maxY && (
            <line
              x1={0} y1={scY(avgWait)} x2={IW} y2={scY(avgWait)}
              stroke={C.globalAvg} strokeWidth={1} strokeDasharray="3,3"
            />
          )}
          {/* Moving average line */}
          {entries.length >= 2 && (
            <path d={movingPath} fill="none" stroke={C.movingAvg} strokeWidth={2} strokeLinejoin="round" />
          )}
          {/* Individual dots */}
          {entries.map((e, i) => (
            <circle
              key={i}
              cx={scX(e.elapsedSimSec)}
              cy={scY(e.waitTimeSec)}
              r={3.5}
              fill={e.waitTimeSec > avgWait ? C.above : C.below}
              fillOpacity={0.75}
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Activité en temps réel
        </h3>
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          Quand les commandes en cours s&apos;accumulent, le temps d&apos;attente augmente.
        </p>
        <ActivityChart points={timeSeries} />
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Temps d&apos;attente par service
        </h3>
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          Tendance montante = cuisine qui décroche sous la charge.
        </p>
        <WaitChart entries={recentWaitTimes} avgWait={avgWaitTimeSec} />
      </div>
    </div>
  );
}

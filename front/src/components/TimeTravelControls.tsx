"use client";

import { useState } from "react";
import { useTime } from "@/components/TimeProvider";

const SHIFT_BUTTONS = [
  { label: "−30 min", delta: -1800 },
  { label: "−5 min", delta: -300 },
  { label: "−1 min", delta: -60 },
  { label: "−10 s", delta: -10 },
  { label: "+10 s", delta: 10 },
  { label: "+1 min", delta: 60 },
  { label: "+5 min", delta: 300 },
  { label: "+30 min", delta: 1800 },
];

function formatOffset(offsetMs: number): string {
  if (offsetMs === 0) return "Temps réel";
  const totalSec = Math.round(offsetMs / 1000);
  const sign = totalSec > 0 ? "+" : "−";
  const abs = Math.abs(totalSec);
  if (abs < 60) return `${sign}${abs} s`;
  const min = Math.floor(abs / 60);
  const sec = abs % 60;
  if (min < 60) {
    return sec === 0 ? `${sign}${min} min` : `${sign}${min} min ${sec} s`;
  }
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin === 0 ? `${sign}${hr} h` : `${sign}${hr} h ${remMin} min`;
}

export function TimeTravelControls() {
  const { offsetMs, autoSimActive, shift, reset } = useTime();
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyShift(deltaSec: number) {
    setBusy(true);
    setError(null);
    try {
      await shift(deltaSec);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function applyReset() {
    setBusy(true);
    setError(null);
    try {
      await reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  const shifted = offsetMs !== 0;
  const disabled = busy || autoSimActive;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Ouvrir le contrôle temporel"
        className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg transition-colors ${
          shifted
            ? "border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200"
            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        }`}
      >
        <ClockIcon />
        {formatOffset(offsetMs)}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[340px] rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClockIcon />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Voyage temporel
            </p>
            <p
              className={`font-mono text-base font-bold tabular-nums ${
                shifted
                  ? "text-violet-700 dark:text-violet-300"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {formatOffset(offsetMs)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Réduire"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {autoSimActive ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Désactivé pendant la simulation automatique.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {SHIFT_BUTTONS.map((b) => (
              <button
                key={b.delta}
                type="button"
                onClick={() => applyShift(b.delta)}
                disabled={disabled}
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                  b.delta < 0
                    ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={applyReset}
            disabled={disabled || !shifted}
            className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Réinitialiser au temps réel
          </button>

          {error ? (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Décale les horaires des commandes actives pour visualiser l&apos;avenir
            ou rejouer le passé. N&apos;affecte pas les commandes terminées.
          </p>
        </>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-zinc-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

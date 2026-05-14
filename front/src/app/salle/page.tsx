"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FloorPlanView } from "@/components/FloorPlanView";
import { useTime } from "@/components/TimeProvider";
import { api } from "@/lib/api";
import type {
  BackendGanttTask,
  BackendTable,
  TableStatus,
} from "@/lib/types";

const statusLabel: Record<TableStatus, string> = {
  libre: "Libre",
  commande_passee: "Commande prise",
  en_preparation: "En préparation",
  servie: "Servie",
};

const statusBadge: Record<TableStatus, string> = {
  libre: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  commande_passee: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  en_preparation: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  servie: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const kindLabel: Record<string, string> = {
  preparation: "Préparation",
  cuisson: "Cuisson",
  dressage: "Dressage",
};

const kindBadge: Record<string, string> = {
  preparation: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  cuisson: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  dressage: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const STATUSES_REQUIRING_CONFIRMATION: TableStatus[] = [
  "commande_passee",
  "en_preparation",
];

export default function SallePage() {
  const { shiftVersion } = useTime();
  const [tables, setTables] = useState<BackendTable[]>([]);
  const [ganttTasks, setGanttTasks] = useState<BackendGanttTask[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [confirmingReleaseAll, setConfirmingReleaseAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tablesRes, ganttRes] = await Promise.all([
        api.tables.list(),
        api.cuisine.gantt(),
      ]);
      setTables(tablesRes);
      setGanttTasks(ganttRes.tasks);
      setLastUpdate(new Date());
    } catch {
      // backend non démarré — on garde l'état précédent
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 3_000);
    return () => clearInterval(id);
    // shiftVersion → recharge immédiate après un voyage temporel
  }, [load, shiftVersion]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const selected = useMemo(
    () => tables.find((t) => t.id === selectedId) ?? null,
    [tables, selectedId],
  );

  const clearTable = useCallback(
    async (tableId: number) => {
      await api.tables.release(tableId);
      await load();
    },
    [load],
  );

  const clearAllTables = useCallback(async () => {
    const occupied = tables.filter((t) => t.status !== "libre");
    await Promise.all(occupied.map((t) => api.tables.release(t.id)));
    setSelectedId(null);
    await load();
  }, [tables, load]);

  const selectedTasks = useMemo(() => {
    if (!selected) return [];
    return ganttTasks
      .filter((t) => t.tableNumber === selected.number)
      .sort((a, b) => a.startAt - b.startAt);
  }, [selected, ganttTasks]);

  const libres = tables.filter((t) => t.status === "libre").length;
  const occupees = tables.length - libres;
  const enPrepa = tables.filter((t) => t.status === "en_preparation").length;

  return (
    <>
      <PageHeader
        title="Salle"
        subtitle={`Plan en temps réel — ${occupees}/${tables.length} occupées · ${enPrepa} en préparation`}
        actions={
          <div className="flex items-center gap-3">
            {lastUpdate ? (
              <span className="text-xs text-zinc-400">
                Actualisé à{" "}
                {lastUpdate.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            ) : null}
            {tables.some((t) => t.status !== "libre") ? (
              confirmingReleaseAll ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    Libérer toutes les tables ?
                  </span>
                  <button
                    onClick={() => {
                      setConfirmingReleaseAll(false);
                      clearAllTables();
                    }}
                    className="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  >
                    Confirmer
                  </button>
                  <button
                    onClick={() => setConfirmingReleaseAll(false)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingReleaseAll(true)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Libérer toutes les tables
                </button>
              )
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <FloorPlanView
            tables={tables}
            ganttTasks={ganttTasks}
            now={now}
            selectedTableId={selectedId}
            onSelectTable={setSelectedId}
          />
          <Legend />
        </section>

        <aside className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          {selected ? (
            <SelectedTablePanel
              table={selected}
              tasks={selectedTasks}
              now={now}
              onClear={() => clearTable(selected.id)}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Cliquez sur une table pour voir le détail de sa commande.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function Legend() {
  const items: { color: string; label: string }[] = [
    { color: "#e4e4e7", label: "Libre" },
    { color: "#60a5fa", label: "Commande prise" },
    { color: "#fbbf24", label: "En préparation" },
    { color: "#34d399", label: "Servie" },
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-4 border-t border-zinc-100 pt-4 text-xs text-zinc-600 dark:border-zinc-900 dark:text-zinc-400">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full border border-zinc-400"
            style={{ background: i.color }}
          />
          {i.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-red-500" />
        Progression de la commande
      </span>
    </div>
  );
}

function SelectedTablePanel({
  table,
  tasks,
  now,
  onClear,
}: {
  table: BackendTable;
  tasks: BackendGanttTask[];
  now: number;
  onClear: () => void;
}) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const prevTableId = useRef(table.id);

  if (prevTableId.current !== table.id) {
    prevTableId.current = table.id;
    if (confirmingClear) setConfirmingClear(false);
  }

  function handleClearClick() {
    if (STATUSES_REQUIRING_CONFIRMATION.includes(table.status)) {
      setConfirmingClear(true);
    } else {
      onClear();
    }
  }

  function handleConfirm() {
    setConfirmingClear(false);
    onClear();
  }

  const window = tasks.length
    ? {
        startAt: Math.min(...tasks.map((t) => t.startAt)),
        endAt: Math.max(...tasks.map((t) => t.endAt)),
      }
    : null;
  const progress = window
    ? Math.max(
        0,
        Math.min(1, (now - window.startAt) / (window.endAt - window.startAt)),
      )
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Table {table.number}
        </h2>
        <p className="text-sm text-zinc-500">
          {table.seats} places · {table.partySize ?? 0} couvert(s)
        </p>
        <span
          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge[table.status]}`}
        >
          {statusLabel[table.status]}
        </span>
      </header>

      {table.status !== "libre" ? (
        confirmingClear ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="mb-3 text-xs text-amber-800 dark:text-amber-300">
              Les plats sont encore en cours de préparation. Libérer la table
              annulera le planning en cuisine. Confirmer ?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              >
                Confirmer
              </button>
              <button
                onClick={() => setConfirmingClear(false)}
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleClearClick}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Libérer la table
          </button>
        )
      ) : null}

      {window ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Service prévu à{" "}
            {new Date(window.endAt).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-red-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${(progress * 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Étapes
          </p>
          <ol className="space-y-2">
            {tasks.map((task) => {
              const isDone = task.endAt < now;
              const isActive = task.startAt <= now && now <= task.endAt;
              return (
                <li
                  key={task.id}
                  className={`rounded-md border p-2 text-xs ${
                    isActive
                      ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
                      : isDone
                        ? "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${kindBadge[task.kind] ?? ""}`}
                    >
                      {kindLabel[task.kind] ?? task.kind}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {new Date(task.startAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                      {" → "}
                      {new Date(task.endAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">
                    {task.dishName} — {task.taskName}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {task.resourceNames.join(", ")}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : table.status !== "libre" ? (
        <p className="text-xs text-zinc-500">
          Aucune commande active (planning vide ou déjà servie).
        </p>
      ) : null}
    </div>
  );
}

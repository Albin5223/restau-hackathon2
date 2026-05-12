"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import type { BackendTable, TableStatus } from "@/lib/types";

const statusLabels: Record<TableStatus, string> = {
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

export default function TablesPage() {
  const [tables, setTables] = useState<BackendTable[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadTables = useCallback(async () => {
    try {
      setTables(await api.tables.list());
    } catch {
      // backend non démarré
    }
  }, []);

  useEffect(() => {
    loadTables();
    const id = setInterval(loadTables, 10_000);
    return () => clearInterval(id);
  }, [loadTables]);

  const selected = useMemo(
    () => tables.find((t) => t.id === selectedId) ?? null,
    [tables, selectedId],
  );

  async function seatGuests(tableId: number, partySize: number) {
    await api.tables.install(tableId, partySize);
    await loadTables();
  }

  async function clearTable(tableId: number) {
    await api.tables.release(tableId);
    await loadTables();
  }

  async function serveTable(tableId: number) {
    await api.tables.serve(tableId);
    await loadTables();
  }

  const libres = tables.filter((t) => t.status === "libre").length;

  return (
    <>
      <PageHeader
        title="Salle"
        subtitle={`${tables.length} tables — ${libres} libre(s)`}
      />

      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => setSelectedId(table.id)}
                className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                  selectedId === table.id
                    ? "border-zinc-900 ring-2 ring-zinc-900 dark:border-zinc-50 dark:ring-zinc-50"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                } bg-white dark:bg-zinc-950`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    T{table.number}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">
                    {table.seats} pl.
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge[table.status]}`}
                >
                  {statusLabels[table.status]}
                </span>
                {table.partySize ? (
                  <span className="text-xs text-zinc-500">
                    {table.partySize} couvert(s)
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <aside className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          {selected ? (
            <TableDetail
              table={selected}
              onSeat={(n) => seatGuests(selected.id, n)}
              onClear={() => clearTable(selected.id)}
              onServe={() => serveTable(selected.id)}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Sélectionnez une table pour voir le détail.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function TableDetail({
  table,
  onSeat,
  onClear,
  onServe,
}: {
  table: BackendTable;
  onSeat: (partySize: number) => void;
  onClear: () => void;
  onServe: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Table {table.number}
        </h2>
        <p className="text-sm text-zinc-500">
          {table.seats} places — {statusLabels[table.status]}
        </p>
      </header>

      {table.status === "libre" ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Installer un groupe
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: table.seats }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => onSeat(n)}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                {n} couvert{n > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {table.partySize && table.status !== "libre" ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Groupe en place
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {table.partySize} couvert(s)
          </p>
          {table.commandeId ? (
            <p className="mt-1 text-xs text-zinc-500">
              Commande : <span className="font-mono">{table.commandeId}</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">
              Passez la commande depuis la page{" "}
              <span className="font-medium">Simulation → Mode manuel</span>.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2">
        {table.status === "en_preparation" ? (
          <button
            onClick={onServe}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            Marquer comme servie
          </button>
        ) : null}
        {table.status !== "libre" ? (
          <button
            onClick={onClear}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Libérer la table
          </button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useRecipes } from "@/components/RecipesProvider";
import { api } from "@/lib/api";
import type { BackendGanttTask, BackendTable } from "@/lib/types";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

export default function Home() {
  const { recipes } = useRecipes();
  const [tables, setTables] = useState<BackendTable[]>([]);
  const [ganttTasks, setGanttTasks] = useState<BackendGanttTask[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [t, g] = await Promise.all([
          api.tables.list(),
          api.cuisine.gantt(),
        ]);
        if (!mounted) return;
        setTables(t);
        setGanttTasks(g.tasks);
      } catch {
        // backend non démarré
      }
    }

    load();
    const id = setInterval(load, 15_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const occupied = tables.filter((t) => t.status !== "libre").length;
  const inPrep = tables.filter((t) => t.status === "en_preparation").length;
  const activeCommandeIds = new Set(ganttTasks.map((t) => t.commandeId));

  const upcomingServes = ganttTasks
    .filter((t) => t.kind === "dressage" && t.endAt > Date.now())
    .sort((a, b) => a.endAt - b.endAt)
    .slice(0, 4);

  const totalMs = ganttTasks.length > 0
    ? Math.max(...ganttTasks.map((t) => t.endAt)) - Math.min(...ganttTasks.map((t) => t.startAt))
    : 0;

  const resourceUtil = (() => {
    if (ganttTasks.length === 0 || totalMs === 0) return [];
    const byResource = new Map<string, number>();
    for (const t of ganttTasks) {
      byResource.set(t.resourceName, (byResource.get(t.resourceName) ?? 0) + (t.endAt - t.startAt));
    }
    return Array.from(byResource.entries()).map(([name, ms]) => ({
      name,
      pct: Math.min(Math.round((ms / totalMs) * 100), 100),
    }));
  })();

  return (
    <>
      <PageHeader
        title="Vue d'ensemble du service"
        subtitle="État en temps réel — actualisation toutes les 15 s"
      />

      <div className="p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Tables occupées"
            value={tables.length > 0 ? `${occupied} / ${tables.length}` : "—"}
            hint={`${inPrep} commande(s) en préparation`}
          />
          <StatCard
            label="Commandes actives"
            value={`${activeCommandeIds.size}`}
            hint={`${ganttTasks.length} tâches planifiées`}
          />
          <StatCard
            label="Plats au menu"
            value={`${recipes.length}`}
            hint="Plats principaux uniquement"
          />
          <StatCard
            label="Ressources actives"
            value={`${resourceUtil.length}`}
            hint="Types de ressources en cours d'utilisation"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Prochains services
            </h2>
            {upcomingServes.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Aucun service imminent — passez une commande depuis la page Simulation.
              </p>
            ) : (
              <ul className="space-y-3">
                {upcomingServes.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between border-b border-zinc-100 pb-2 last:border-none dark:border-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        Table {task.tableNumber}
                      </p>
                      <p className="text-xs text-zinc-500">{task.dishName}</p>
                    </div>
                    <span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {new Date(task.endAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Charge des ressources
            </h2>
            {resourceUtil.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Aucune ressource en cours d&apos;utilisation.
              </p>
            ) : (
              <ul className="space-y-2">
                {resourceUtil.map((r) => (
                  <li key={r.name} className="text-sm">
                    <div className="mb-1 flex justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300 capitalize">
                        {r.name}
                      </span>
                      <span className="font-mono tabular-nums text-zinc-500">
                        {r.pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                      <div
                        className="h-full bg-zinc-900 dark:bg-zinc-100"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

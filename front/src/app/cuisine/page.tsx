"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { GanttChart } from "@/components/GanttChart";
import { api } from "@/lib/api";
import type { ScheduledStep, ScheduledStepStatus, BackendGanttTask } from "@/lib/types";

const stepLabel: Record<string, string> = {
  preparation: "Préparation",
  cuisson: "Cuisson",
  dressage: "Dressage",
};

function toScheduledSteps(task: BackendGanttTask): ScheduledStep[] {
  const now = Date.now();
  let status: ScheduledStepStatus = "a_venir";
  if (task.endAt < now) status = "termine";
  else if (task.startAt <= now) status = "en_cours";
  return task.resourceNames.map((name, idx) => ({
    id: idx === 0 ? task.id : `${task.id}__r${idx}`,
    orderId: task.commandeId,
    tableNumber: task.tableNumber,
    recipeName: task.dishName,
    stepName: task.taskName,
    kind: task.kind,
    resourceId: name,
    resourceLabel: name,
    startAt: task.startAt,
    endAt: task.endAt,
    status,
  }));
}

export default function CuisinePage() {
  const [steps, setSteps] = useState<ScheduledStep[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response = await api.cuisine.gantt();
        if (!mounted) return;
        setSteps(response.tasks.flatMap(toScheduledSteps));
        setLastUpdate(new Date());
      } catch {
        // backend pas encore démarré ou commande en cours — on garde l'état précédent
      }
    }

    load();
    const id = setInterval(load, 10_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const upcomingAlerts = steps
    .filter((s) => s.status !== "termine")
    .sort((a, b) => a.startAt - b.startAt)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Cuisine"
        subtitle="Planning des étapes par ressource — diagramme de Gantt"
        actions={
          lastUpdate ? (
            <span className="text-xs text-zinc-400">
              Actualisé à {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          ) : undefined
        }
      />

      <div className="space-y-6 p-8">
        <GanttChart steps={steps} />

        {upcomingAlerts.length > 0 && (
          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Prochaines actions
            </h2>
            <ol className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {upcomingAlerts.map((step) => {
                const start = new Date(step.startAt);
                const end = new Date(step.endAt);
                return (
                  <li
                    key={step.id}
                    className="flex items-center gap-4 py-3 text-sm"
                  >
                    <span className="w-28 font-mono tabular-nums text-zinc-500">
                      {start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      {" → "}
                      {end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span
                      className={`inline-flex w-24 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeForKind(step.kind)}`}
                    >
                      {stepLabel[step.kind]}
                    </span>
                    <span className="flex-1 text-zinc-900 dark:text-zinc-100">
                      <strong>Table {step.tableNumber}</strong> · {step.recipeName}
                    </span>
                    <span className="text-zinc-500">{step.resourceLabel}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </>
  );
}

function badgeForKind(kind: string) {
  if (kind === "preparation")
    return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
  if (kind === "cuisson")
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
}

import { PageHeader } from "@/components/PageHeader";
import { GanttChart } from "@/components/GanttChart";
import { scheduledSteps } from "@/lib/mockData";

const stepLabel: Record<string, string> = {
  preparation: "Préparation",
  cuisson: "Cuisson",
  dressage: "Dressage",
};

export default function CuisinePage() {
  const upcomingAlerts = scheduledSteps
    .filter((s) => s.status !== "termine")
    .sort((a, b) => a.startAt - b.startAt)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Cuisine"
        subtitle="Planning des étapes par ressource — diagramme de Gantt"
      />

      <div className="space-y-6 p-8">
        <GanttChart steps={scheduledSteps} />

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
                  <span className="w-24 font-mono tabular-nums text-zinc-500">
                    {start.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" → "}
                    {end.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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

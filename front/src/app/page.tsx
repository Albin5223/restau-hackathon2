import { PageHeader } from "@/components/PageHeader";
import {
  menu,
  orders,
  scheduledSteps,
  simulationMetrics,
  tables,
} from "@/lib/mockData";

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
  const occupied = tables.filter((t) => t.status !== "libre").length;
  const inPrep = tables.filter((t) => t.status === "en_preparation").length;
  const upcomingServes = scheduledSteps
    .filter((s) => s.kind === "dressage" && s.status !== "termine")
    .sort((a, b) => a.endAt - b.endAt)
    .slice(0, 4);

  return (
    <>
      <PageHeader
        title="Vue d'ensemble du service"
        subtitle="Service du midi — état temps réel"
      />

      <div className="p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Tables occupées"
            value={`${occupied} / ${tables.length}`}
            hint={`${inPrep} commande(s) en préparation`}
          />
          <StatCard
            label="Commandes actives"
            value={`${orders.length}`}
            hint={`${orders.reduce((n, o) => n + o.items.length, 0)} plats au total`}
          />
          <StatCard
            label="Plats au menu"
            value={`${menu.length}`}
            hint="Plats principaux uniquement"
          />
          <StatCard
            label="Taux d'utilisation moyen"
            value={`${Math.round(
              simulationMetrics.resourceUtilization.reduce(
                (s, r) => s + r.usagePct,
                0,
              ) / simulationMetrics.resourceUtilization.length,
            )}%`}
            hint="Toutes ressources confondues"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Prochains services
            </h2>
            <ul className="space-y-3">
              {upcomingServes.map((step) => {
                const date = new Date(step.endAt);
                return (
                  <li
                    key={step.id}
                    className="flex items-center justify-between border-b border-zinc-100 pb-2 last:border-none dark:border-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        Table {step.tableNumber}
                      </p>
                      <p className="text-xs text-zinc-500">{step.dishName}</p>
                    </div>
                    <span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {date.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Charge des ressources
            </h2>
            <ul className="space-y-2">
              {simulationMetrics.resourceUtilization.map((r) => (
                <li key={r.resourceId} className="text-sm">
                  <div className="mb-1 flex justify-between">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {r.label}
                    </span>
                    <span className="font-mono tabular-nums text-zinc-500">
                      {r.usagePct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div
                      className="h-full bg-zinc-900 dark:bg-zinc-100"
                      style={{ width: `${r.usagePct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

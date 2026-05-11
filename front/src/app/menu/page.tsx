import { PageHeader } from "@/components/PageHeader";
import { menu } from "@/lib/mockData";
import type { StepKind } from "@/lib/types";

const categoryLabels = {
  viande: "Viande",
  poisson: "Poisson",
  vegetarien: "Végétarien",
} as const;

const stepLabels: Record<StepKind, string> = {
  preparation: "Prép.",
  cuisson: "Cuisson",
  dressage: "Dressage",
};

const stepColor: Record<StepKind, string> = {
  preparation: "bg-blue-500",
  cuisson: "bg-amber-500",
  dressage: "bg-emerald-500",
};

export default function MenuPage() {
  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${menu.length} plats principaux — temps par étape et ressources requises`}
      />

      <div className="grid grid-cols-1 gap-4 p-8 md:grid-cols-2 xl:grid-cols-3">
        {menu.map((dish) => {
          const total = dish.steps.reduce((s, st) => s + st.durationMin, 0);
          return (
            <article
              key={dish.id}
              className="flex flex-col rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {dish.name}
                  </h2>
                  <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                    {categoryLabels[dish.category]}
                  </p>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs tabular-nums text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {total} min
                </span>
              </header>

              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {dish.description}
              </p>

              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                {dish.steps.map((step, i) => (
                  <div
                    key={i}
                    className={stepColor[step.kind]}
                    style={{ width: `${(step.durationMin / total) * 100}%` }}
                    title={`${stepLabels[step.kind]} — ${step.durationMin} min`}
                  />
                ))}
              </div>

              <dl className="mt-3 space-y-1 text-xs">
                {dish.steps.map((step, i) => (
                  <div key={i} className="flex justify-between">
                    <dt className="text-zinc-600 dark:text-zinc-400">
                      <span
                        className={`mr-2 inline-block h-2 w-2 rounded-sm ${stepColor[step.kind]}`}
                      />
                      {stepLabels[step.kind]} — {step.resourceKinds.join(", ")}
                    </dt>
                    <dd className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                      {step.durationMin} min
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useRecipes } from "@/components/RecipesProvider";
import {
  allResources,
  computeSchedule,
  validateRecipe,
} from "@/lib/recipes";
import type { Recipe, RecipeStep } from "@/lib/types";

type DraftStep = {
  uid: string;
  nom: string;
  ressource: string;
  duree: number;
  deps: string[];
};

let uidCounter = 0;
const nextUid = () => `s${++uidCounter}`;

const emptyDraft = (): DraftStep => ({
  uid: nextUid(),
  nom: "",
  ressource: "",
  duree: 5,
  deps: [],
});

export default function MenuPage() {
  const { recipes, addRecipe } = useRecipes();
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${recipes.length} plats — étapes, dépendances et ressources`}
        actions={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {showForm ? "Fermer" : "+ Nouveau plat"}
          </button>
        }
      />

      <div className="space-y-6 p-8">
        {showForm ? (
          <RecipeForm
            existingNames={recipes.map((r) => r.name)}
            onSubmit={(name, etapes) => {
              addRecipe(name, etapes);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </div>
    </>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { totalMin, timings } = useMemo(
    () => computeSchedule(recipe),
    [recipe],
  );
  const resourceKinds = allResources(recipe);

  return (
    <article className="flex flex-col rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {recipe.name}
          </h2>
          <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
            {resourceKinds.join(" · ")}
          </p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs tabular-nums text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {totalMin} min
        </span>
      </header>

      {/* Timeline visualizing parallelism: each step starts at its earliestStart */}
      <div className="relative mt-4 h-8 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
        {recipe.tasks.etapes.map((etape, i) => {
          const t = timings[i];
          const left = totalMin > 0 ? (t.startMin / totalMin) * 100 : 0;
          const width = totalMin > 0 ? (etape.duree / totalMin) * 100 : 100;
          return (
            <div
              key={i}
              className={`absolute top-1 flex h-6 items-center overflow-hidden rounded px-1 text-[10px] font-medium leading-none text-white shadow-sm ${barColor(i, recipe.tasks.etapes.length)}`}
              style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
              title={`${etape.nom} — ${etape.duree} min`}
            >
              <span className="truncate">{etape.nom}</span>
            </div>
          );
        })}
      </div>

      <ol className="mt-3 space-y-1 text-xs">
        {recipe.tasks.etapes.map((etape, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="text-zinc-700 dark:text-zinc-300">
              <span className="mr-1 font-mono text-zinc-400">#{i + 1}</span>
              {etape.nom}
              <span className="ml-1 text-zinc-500">
                ({etape.ressource.join(", ")})
              </span>
              {etape.deps.length > 0 ? (
                <span className="ml-1 text-zinc-400">
                  dép. {etape.deps.map((d) => `#${d}`).join(", ")}
                </span>
              ) : null}
            </span>
            <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
              {etape.duree} min
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function barColor(idx: number, total: number) {
  if (idx === 0) return "bg-blue-500/80";
  if (idx === total - 1) return "bg-emerald-500/80";
  return "bg-amber-500/80";
}

function RecipeForm({
  existingNames,
  onSubmit,
  onCancel,
}: {
  existingNames: string[];
  onSubmit: (name: string, etapes: RecipeStep[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([emptyDraft()]);
  const [errors, setErrors] = useState<string[]>([]);

  function updateStep(uid: string, patch: Partial<DraftStep>) {
    setSteps((prev) =>
      prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)),
    );
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyDraft()]);
  }

  function removeStep(uid: string) {
    setSteps((prev) =>
      prev
        .filter((s) => s.uid !== uid)
        .map((s) => ({ ...s, deps: s.deps.filter((d) => d !== uid) })),
    );
  }

  function toggleDep(stepUid: string, depUid: string) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              deps: s.deps.includes(depUid)
                ? s.deps.filter((d) => d !== depUid)
                : [...s.deps, depUid],
            }
          : s,
      ),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uidToIndex = new Map(steps.map((s, i) => [s.uid, i + 1]));
    const etapes: RecipeStep[] = steps.map((s) => ({
      nom: s.nom.trim(),
      ressource: s.ressource
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      duree: Number(s.duree),
      deps: s.deps
        .map((u) => uidToIndex.get(u))
        .filter((n): n is number => typeof n === "number")
        .sort((a, b) => a - b),
    }));

    const errs = validateRecipe(name, etapes, existingNames);
    setErrors(errs);
    if (errs.length === 0) onSubmit(name, etapes);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Nouveau plat
      </h2>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Nom du plat
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. : steak frites"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Étapes
          </span>
          <button
            type="button"
            onClick={addStep}
            className="text-xs font-medium text-zinc-700 hover:underline dark:text-zinc-300"
          >
            + Ajouter une étape
          </button>
        </div>

        {steps.map((step, i) => {
          const previousSteps = steps.slice(0, i);
          return (
            <div
              key={step.uid}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">
                  #{i + 1}
                </span>
                {steps.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeStep(step.uid)}
                    className="text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_80px]">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Nom de l&apos;étape
                  </span>
                  <input
                    value={step.nom}
                    onChange={(e) => updateStep(step.uid, { nom: e.target.value })}
                    placeholder="ex. : cuire steak"
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Ressources (séparées par virgule)
                  </span>
                  <input
                    value={step.ressource}
                    onChange={(e) =>
                      updateStep(step.uid, { ressource: e.target.value })
                    }
                    placeholder="commis, plaque"
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Durée (min)
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={step.duree}
                    onChange={(e) =>
                      updateStep(step.uid, { duree: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
              </div>

              {previousSteps.length > 0 ? (
                <div className="mt-3">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Dépend de
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {previousSteps.map((p, pi) => {
                      const checked = step.deps.includes(p.uid);
                      return (
                        <label
                          key={p.uid}
                          className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                            checked
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDep(step.uid, p.uid)}
                            className="sr-only"
                          />
                          #{pi + 1} {p.nom || "(sans nom)"}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {errors.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Enregistrer
        </button>
      </div>
    </form>
  );
}

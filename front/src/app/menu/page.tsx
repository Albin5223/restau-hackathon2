"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useRecipes } from "@/components/RecipesProvider";
import { RecipeGraphEditor } from "@/components/RecipeGraphEditor";
import { allResources, computeSchedule, validateRecipe } from "@/lib/recipes";
import { formatDuration } from "@/lib/format";
import type { Recipe, RecipeStep, ResourceTypeDto } from "@/lib/types";
import { api } from "@/lib/api";

// ─── Simple form types ────────────────────────────────────────────────────────

const KINDS = [
  { value: "preparation", label: "Préparation" },
  { value: "cuisson", label: "Cuisson" },
  { value: "dressage", label: "Dressage" },
  { value: "other", label: "Autre" },
];

type DraftStep = {
  uid: string;
  nom: string;
  ressource: string[];
  kind: string;
  duree: number;
  deps: string[];
};

let uidCounter = 0;
const nextUid = () => `s${++uidCounter}`;
const emptyDraft = (): DraftStep => ({
  uid: nextUid(),
  nom: "",
  ressource: [],
  kind: "preparation",
  duree: 5,
  deps: [],
});

// ─── Page ─────────────────────────────────────────────────────────────────────

type CreationMode = "simple" | "graph";

export default function MenuPage() {
  const { recipes, addRecipe } = useRecipes();
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<CreationMode>("simple");
  const [resourceTypes, setResourceTypes] = useState<ResourceTypeDto[]>([]);

  useEffect(() => {
    api.resources.list().then(setResourceTypes).catch(() => {});
  }, []);

  function handleClose() {
    setShowForm(false);
  }

  async function handleSubmit(name: string, etapes: RecipeStep[]) {
    await addRecipe(name, etapes);
    setShowForm(false);
  }

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

      <div className="space-y-4 p-8">
        {showForm ? (
          <div className="space-y-3">
            {/* Mode switcher */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-zinc-500">Mode de création :</span>
              <div className="flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
                {(["simple", "graph"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      mode === m
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    {m === "simple" ? "Formulaire simple" : "Éditeur graphique"}
                  </button>
                ))}
              </div>
            </div>

            {/* Form content */}
            {mode === "simple" ? (
              <RecipeForm
                key="simple"
                existingNames={recipes.map((r) => r.name)}
                resourceTypes={resourceTypes}
                onSubmit={handleSubmit}
                onCancel={handleClose}
              />
            ) : (
              <RecipeGraphEditor
                key="graph"
                existingNames={recipes.map((r) => r.name)}
                resourceTypes={resourceTypes}
                onSubmit={handleSubmit}
                onCancel={handleClose}
              />
            )}
          </div>
        ) : null}

        {recipes.length === 0 && !showForm ? (
          <p className="text-sm text-zinc-500">Chargement du menu…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── RecipeCard ───────────────────────────────────────────────────────────────

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { totalSec } = useMemo(() => computeSchedule(recipe), [recipe]);
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
          {formatDuration(totalSec)}
        </span>
      </header>

      <ol className="mt-3 space-y-1 text-xs">
        {recipe.tasks.etapes.map((etape, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="text-zinc-700 dark:text-zinc-300">
              <span className="mr-1 font-mono text-zinc-400">#{i + 1}</span>
              {etape.nom}
              <span className="ml-1 text-zinc-500">({etape.ressource.join(", ")})</span>
              {etape.deps.length > 0 ? (
                <span className="ml-1 text-zinc-400">
                  dép. {etape.deps.map((d) => `#${d}`).join(", ")}
                </span>
              ) : null}
            </span>
            <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatDuration(etape.duree)}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

// ─── RecipeForm (simple mode) ─────────────────────────────────────────────────

function RecipeForm({
  existingNames,
  resourceTypes,
  onSubmit,
  onCancel,
}: {
  existingNames: string[];
  resourceTypes: ResourceTypeDto[];
  onSubmit: (name: string, etapes: RecipeStep[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([emptyDraft()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function updateStep(uid: string, patch: Partial<DraftStep>) {
    setSteps((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  }

  function toggleResource(stepUid: string, resource: string) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              ressource: s.ressource.includes(resource)
                ? s.ressource.filter((r) => r !== resource)
                : [...s.ressource, resource],
            }
          : s,
      ),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uidToIndex = new Map(steps.map((s, i) => [s.uid, i + 1]));
    const etapes: RecipeStep[] = steps.map((s) => ({
      nom: s.nom.trim(),
      ressource: s.ressource,
      kind: s.kind,
      duree: Number(s.duree) * 60, // user enters minutes, backend stores seconds
      deps: s.deps
        .map((u) => uidToIndex.get(u))
        .filter((n): n is number => typeof n === "number")
        .sort((a, b) => a - b),
    }));

    const errs = validateRecipe(name, etapes, existingNames);
    setErrors(errs);
    if (errs.length > 0) return;

    setSaving(true);
    try {
      await onSubmit(name, etapes);
    } catch {
      setErrors(["Erreur lors de l'enregistrement. Réessayez."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
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
                <span className="font-mono text-xs text-zinc-500">#{i + 1}</span>
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
                    Type
                  </span>
                  <select
                    value={step.kind}
                    onChange={(e) => updateStep(step.uid, { kind: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Durée (min)
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={step.duree}
                    onChange={(e) => updateStep(step.uid, { duree: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
              </div>

              <div className="mt-3">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Ressources
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {resourceTypes.length === 0 ? (
                    <span className="text-xs text-zinc-400">Chargement…</span>
                  ) : (
                    resourceTypes.map((r) => {
                      const checked = step.ressource.includes(r.name);
                      return (
                        <button
                          key={r.name}
                          type="button"
                          onClick={() => toggleResource(step.uid, r.name)}
                          className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                            checked
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                          }`}
                        >
                          {r.name}
                          {r.capacity > 1 ? (
                            <span className="ml-1 opacity-60">×{r.capacity}</span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
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
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

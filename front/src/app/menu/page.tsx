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
  { value: "PREPARATION", label: "Préparation" },
  { value: "COOKING", label: "Cuisson" },
  { value: "PLATING", label: "Dressage" },
  { value: "OTHER", label: "Autre" },
];

type DraftStep = {
  uid: string;
  nom: string;
  resources: string[];
  kind: string;
  duration: number;
  dependencies: string[];
};

let uidCounter = 0;
const nextUid = () => `s${++uidCounter}`;
const emptyDraft = (): DraftStep => ({
  uid: nextUid(),
  nom: "",
  resources: [],
  kind: "PREPARATION",
  duration: 5,
  dependencies: [],
});

function recipeToDraftSteps(tasks: RecipeStep[]): DraftStep[] {
  const uids = tasks.map(() => nextUid());
  return tasks.map((step, i) => ({
    uid: uids[i],
    nom: step.nom,
    resources: step.resources,
    kind: step.kind ?? "OTHER",
    duration: Math.max(1, Math.round(step.duration / 60)),
    dependencies: step.dependencies
      .map((d) => uids[d])
      .filter((u): u is string => u !== undefined),
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type CreationMode = "simple" | "graph";

export default function MenuPage() {
  const { recipes, addRecipe, updateRecipe, deleteRecipe } = useRecipes();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [mode, setMode] = useState<CreationMode>("simple");
  const [resourceTypes, setResourceTypes] = useState<ResourceTypeDto[]>([]);

  useEffect(() => {
    api.resources.list().then(setResourceTypes).catch(() => {});
  }, []);

  function handleClose() {
    setShowForm(false);
  }

  async function handleSubmit(name: string, tasks: RecipeStep[]) {
    await addRecipe(name, tasks);
    setShowForm(false);
  }

  return (
    <>
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {editRecipe && (
        <EditModal
          recipe={editRecipe}
          existingNames={recipes.filter((r) => r.id !== editRecipe.id).map((r) => r.name)}
          resourceTypes={resourceTypes}
          onSubmit={async (name, tasks) => {
            await updateRecipe(editRecipe.id, name, tasks);
            setEditRecipe(null);
          }}
          onClose={() => setEditRecipe(null)}
        />
      )}
      <PageHeader
        title="Menu"
        subtitle={`${recipes.length} plats — étapes, dépendances et ressources`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Importer
            </button>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {showForm ? "Fermer" : "+ Nouveau plat"}
            </button>
          </div>
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
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onEdit={() => setEditRecipe(recipe)}
                onDelete={() => deleteRecipe(recipe.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── RecipeCard ───────────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const { totalSec } = useMemo(() => computeSchedule(recipe), [recipe]);
  const resourceKinds = allResources(recipe);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <article className="group flex flex-col rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {recipe.name}
          </h2>
          <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
            {resourceKinds.join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs tabular-nums text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {formatDuration(totalSec)}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              title="Modifier"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => { setConfirmDelete(true); setDeleteError(null); }}
              title="Supprimer"
              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <ol className="mt-3 space-y-1 text-xs">
        {recipe.tasks.map((etape, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="text-zinc-700 dark:text-zinc-300">
              <span className="mr-1 font-mono text-zinc-400">#{i + 1}</span>
              {etape.nom}
              {etape.resources.length > 0 && (
                <span className="ml-1 text-zinc-500">({etape.resources.join(", ")})</span>
              )}
              {etape.dependencies.length > 0 ? (
                <span className="ml-1 text-zinc-400">
                  dép. {etape.dependencies.map((d) => `#${d}`).join(", ")}
                </span>
              ) : null}
            </span>
            <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatDuration(etape.duration)}
            </span>
          </li>
        ))}
      </ol>

      {deleteError && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {deleteError}
        </p>
      )}

      {confirmDelete && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
          <span className="text-xs text-red-800 dark:text-red-300">
            Supprimer ce plat ?
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
            >
              {deleting ? "Suppression…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ─── ImportModal ──────────────────────────────────────────────────────────────

function ImportModal({ onClose }: { onClose: () => void }) {
  const { reloadRecipes } = useRecipes();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function pickFile(f: File) {
    setFile(f);
    setError(null);
    setSuccess(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  async function handleImport() {
    if (!file) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setError("Fichier JSON invalide — impossible de le parser.");
        return;
      }
      const dishList = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{
        name: string;
        tasks: Recipe["tasks"];
      }>;
      const imported = await api.dishes.importBatch(dishList);
      await reloadRecipes();
      setSuccess(
        `${imported.length} plat${imported.length > 1 ? "s" : ""} importé${imported.length > 1 ? "s" : ""} avec succès.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Importer des plats
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Format attendu : objet unique ou tableau JSON{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
            {"[{ name, tasks: { etapes: [...] } }]"}
          </code>
          . La durée (<code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">duree</code>) est en secondes.
        </p>

        {/* Drag & drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragging
              ? "border-zinc-900 bg-zinc-50 dark:border-zinc-400 dark:bg-zinc-900"
              : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mb-2 h-8 w-8 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Glissez un fichier JSON ici
          </p>
          <p className="my-1.5 text-xs text-zinc-400">ou</p>
          <label className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900">
            Parcourir…
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {file && (
            <p className="mt-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {file.name}
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
            {success}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {success ? "Fermer" : "Annuler"}
          </button>
          {!success && (
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || loading}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Import en cours…" : "Importer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({
  recipe,
  existingNames,
  resourceTypes,
  onSubmit,
  onClose,
}: {
  recipe: Recipe;
  existingNames: string[];
  resourceTypes: ResourceTypeDto[];
  onSubmit: (name: string, etapes: RecipeStep[]) => Promise<void>;
  onClose: () => void;
}) {
  const initialSteps = useMemo(() => recipeToDraftSteps(recipe.tasks), [recipe]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12">
      <div className="w-full max-w-2xl pb-12">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Modifier — {recipe.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-300 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <RecipeForm
          existingNames={existingNames}
          resourceTypes={resourceTypes}
          onSubmit={onSubmit}
          onCancel={onClose}
          initialName={recipe.name}
          initialSteps={initialSteps}
          submitLabel="Enregistrer les modifications"
        />
      </div>
    </div>
  );
}

// ─── RecipeForm (simple mode) ─────────────────────────────────────────────────

function RecipeForm({
  existingNames,
  resourceTypes,
  onSubmit,
  onCancel,
  initialName,
  initialSteps,
  submitLabel = "Enregistrer",
}: {
  existingNames: string[];
  resourceTypes: ResourceTypeDto[];
  onSubmit: (name: string, etapes: RecipeStep[]) => Promise<void>;
  onCancel: () => void;
  initialName?: string;
  initialSteps?: DraftStep[];
  submitLabel?: string;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(initialSteps ?? [emptyDraft()]);
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
              resources: s.resources.includes(resource)
                ? s.resources.filter((r) => r !== resource)
                : [...s.resources, resource],
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
        .map((s) => ({ ...s, deps: s.dependencies.filter((d) => d !== uid) })),
    );
  }

  function toggleDep(stepUid: string, depUid: string) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              dependencies: s.dependencies.includes(depUid)
                ? s.dependencies.filter((d) => d !== depUid)
                : [...s.dependencies, depUid],
            }
          : s,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uidToIndex = new Map(steps.map((s, i) => [s.uid, i]));
    const etapes: RecipeStep[] = steps.map((s) => ({
      nom: s.nom.trim(),
      resources: s.resources,
      kind: s.kind,
      duration: Number(s.duration) * 60, // user enters minutes, backend stores seconds
      dependencies: s.dependencies
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
                    value={step.duration}
                    onChange={(e) => updateStep(step.uid, { duration: Number(e.target.value) })}
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
                      const checked = step.resources.includes(r.name);
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
                      const checked = step.dependencies.includes(p.uid);
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
          {saving ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

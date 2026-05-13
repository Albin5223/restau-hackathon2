"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useResources } from "@/components/ResourcesProvider";
import { useRecipes } from "@/components/RecipesProvider";
import { missingResources } from "@/lib/recipes";
import type { ResourceTypeDto } from "@/lib/types";

export default function RessourcesPage() {
  const {
    resourceTypes,
    usage,
    reload,
    createType,
    deleteType,
    addInstance,
    removeInstance,
  } = useResources();
  const { recipes } = useRecipes();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyTypes, setBusyTypes] = useState<Set<string>>(new Set());

  // Plats impactés par chaque type : ceux qui en ont besoin
  const dishesUsingType = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const recipe of recipes) {
      for (const step of recipe.tasks.etapes) {
        for (const r of step.ressource) {
          const list = map.get(r) ?? [];
          if (!list.includes(recipe.name)) list.push(recipe.name);
          map.set(r, list);
        }
      }
    }
    return map;
  }, [recipes]);

  // Types référencés par les plats mais introuvables (ex : ressource renommée hors-page)
  const orphanRequiredTypes = useMemo(() => {
    const known = new Set(resourceTypes.map((t) => t.name));
    const orphans = new Set<string>();
    for (const r of recipes) {
      for (const step of r.tasks.etapes) {
        for (const res of step.ressource) {
          if (!known.has(res)) orphans.add(res);
        }
      }
    }
    return [...orphans];
  }, [recipes, resourceTypes]);

  const unavailableDishCount = useMemo(() => {
    return recipes.filter((r) => missingResources(r, resourceTypes).length > 0)
      .length;
  }, [recipes, resourceTypes]);

  function runForType(name: string, fn: () => Promise<void>) {
    return async () => {
      setError(null);
      setBusyTypes((prev) => new Set(prev).add(name));
      try {
        await fn();
        // Recharger l'usage : la mutation a pu changer ce qu'on peut faire ensuite.
        await reload().catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur.");
      } finally {
        setBusyTypes((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError(null);
    setCreating(true);
    try {
      await createType(trimmed);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de création.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ressources"
        subtitle={`${resourceTypes.length} type(s) · ${resourceTypes.reduce(
          (n, t) => n + t.capacity,
          0,
        )} instance(s) au total`}
      />

      <div className="space-y-6 p-8">
        {unavailableDishCount > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              {unavailableDishCount} plat
              {unavailableDishCount > 1 ? "s" : ""} actuellement indisponible
              {unavailableDishCount > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              Ajoutez les ressources manquantes ci-dessous pour les rendre
              servables.
            </p>
          </div>
        ) : null}

        {/* Création d'un nouveau type */}
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <label className="flex-1">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Nouveau type de ressource
            </span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ex. : pâtissier, mixeur, salamandre…"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {creating ? "Création…" : "+ Créer le type"}
          </button>
        </form>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {/* Liste des types */}
        {resourceTypes.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun type de ressource.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resourceTypes.map((type) => (
              <ResourceCard
                key={type.name}
                type={type}
                peakUsage={usage[type.name] ?? 0}
                usedByDishes={dishesUsingType.get(type.name) ?? []}
                busy={busyTypes.has(type.name)}
                onAdd={runForType(type.name, () => addInstance(type.name))}
                onRemove={runForType(type.name, () => removeInstance(type.name))}
                onDelete={runForType(type.name, () => deleteType(type.name))}
              />
            ))}
          </div>
        )}

        {/* Types orphelins : référencés par des plats mais inexistants */}
        {orphanRequiredTypes.length > 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Types référencés mais introuvables
            </h2>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              Des plats du menu exigent ces ressources qui n&apos;existent pas
              encore. Créez-les pour rendre ces plats servables.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {orphanRequiredTypes.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setNewName(name);
                    setError(null);
                  }}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-amber-900"
                >
                  + {name}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

function ResourceCard({
  type,
  peakUsage,
  usedByDishes,
  busy,
  onAdd,
  onRemove,
  onDelete,
}: {
  type: ResourceTypeDto;
  peakUsage: number;
  usedByDishes: string[];
  busy: boolean;
  onAdd: () => Promise<void>;
  onRemove: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const empty = type.capacity === 0;
  const dishesUsing = usedByDishes.length;
  const becomesUnavailable = empty && dishesUsing > 0;
  // On ne peut retirer une instance que si la capacité résultante reste ≥ demande crête.
  const removeLocked = type.capacity - 1 < peakUsage;
  // Le type ne peut être supprimé que si vide ET non utilisé par un planning actif.
  const deleteLocked = !empty || peakUsage > 0;

  return (
    <article className="flex flex-col rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold capitalize text-zinc-900 dark:text-zinc-50">
            {type.name}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {dishesUsing === 0
              ? "Utilisée par aucun plat"
              : `Utilisée par ${dishesUsing} plat${dishesUsing > 1 ? "s" : ""}`}
          </p>
        </div>
        {becomesUnavailable ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            indispo.
          </span>
        ) : null}
      </header>

      {/* Compteur avec +/- */}
      <div className="mt-4 flex items-center justify-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={onRemove}
          disabled={busy || empty || removeLocked}
          className="h-9 w-9 rounded-md border border-zinc-300 bg-white text-lg font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
          title={
            empty
              ? "Plus aucune instance"
              : removeLocked
                ? `Bloqué : ${peakUsage} tâche(s) active(s) utilisent ce type simultanément`
                : "Retirer une instance"
          }
        >
          −
        </button>
        <span className="min-w-[3rem] text-center font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
          {type.capacity}
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="h-9 w-9 rounded-md border border-zinc-300 bg-white text-lg font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
          title="Ajouter une instance"
        >
          +
        </button>
      </div>

      {/* Occupation actuelle */}
      <p className="mt-2 text-center text-[11px] text-zinc-500">
        {peakUsage > 0 ? (
          <>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {peakUsage}
            </span>{" "}
            en usage (crête planning actif)
          </>
        ) : (
          "Aucune utilisation active"
        )}
      </p>

      {dishesUsing > 0 ? (
        <p className="mt-3 text-[11px] text-zinc-500">
          {usedByDishes.slice(0, 3).join(", ")}
          {usedByDishes.length > 3 ? `, +${usedByDishes.length - 3} autre(s)` : ""}{" "}
          <Link
            href="/menu"
            className="ml-1 inline-block text-zinc-700 underline decoration-dotted hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            voir le menu
          </Link>
        </p>
      ) : null}

      {/* Suppression du type */}
      <div className="mt-4">
        {confirmDelete ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
            <span className="text-xs text-red-800 dark:text-red-300">
              Supprimer ce type ?
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
                onClick={async () => {
                  await onDelete();
                  setConfirmDelete(false);
                }}
                disabled={busy}
                className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                Confirmer
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteLocked}
            title={
              !empty
                ? "Retirez d'abord toutes les instances pour pouvoir supprimer le type"
                : peakUsage > 0
                  ? `Bloqué : ${peakUsage} tâche(s) active(s) référencent ce type`
                  : "Supprimer ce type de ressource"
            }
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Supprimer le type
          </button>
        )}
      </div>
    </article>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Recipe, RecipeStep } from "@/lib/types";
import { api } from "@/lib/api";

type RecipesContextValue = {
  recipes: Recipe[];
  addRecipe: (name: string, etapes: RecipeStep[]) => Promise<Recipe>;
  updateRecipe: (id: number, name: string, etapes: RecipeStep[]) => Promise<Recipe>;
  deleteRecipe: (id: number) => Promise<void>;
  getRecipe: (name: string) => Recipe | undefined;
  reloadRecipes: () => Promise<void>;
};

const RecipesContext = createContext<RecipesContextValue | null>(null);

export function RecipesProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    let mounted = true;
    function load() {
      api.dishes
        .list()
        .then((data) => { if (mounted) setRecipes(data); })
        .catch(() => { if (mounted) setTimeout(load, 5_000); });
    }
    load();
    return () => { mounted = false; };
  }, []);

  const addRecipe = useCallback(async (name: string, etapes: RecipeStep[]) => {
    const created = await api.dishes.create(name, { etapes });
    setRecipes((prev) => [...prev, created]);
    return created;
  }, []);

  const getRecipe = useCallback(
    (name: string) => recipes.find((r) => r.name === name),
    [recipes],
  );

  const updateRecipe = useCallback(async (id: number, name: string, etapes: RecipeStep[]) => {
    const updated = await api.dishes.update(id, name, { etapes });
    setRecipes((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const deleteRecipe = useCallback(async (id: number) => {
    await api.dishes.delete(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const reloadRecipes = useCallback(async () => {
    const data = await api.dishes.list();
    setRecipes(data);
  }, []);

  const value = useMemo(
    () => ({ recipes, addRecipe, updateRecipe, deleteRecipe, getRecipe, reloadRecipes }),
    [recipes, addRecipe, updateRecipe, deleteRecipe, getRecipe, reloadRecipes],
  );

  return (
    <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>
  );
}

export function useRecipes() {
  const ctx = useContext(RecipesContext);
  if (!ctx) throw new Error("useRecipes must be used inside <RecipesProvider>");
  return ctx;
}

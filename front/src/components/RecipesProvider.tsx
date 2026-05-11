"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Recipe, RecipeStep } from "@/lib/types";
import { initialRecipes } from "@/lib/mockData";

type RecipesContextValue = {
  recipes: Recipe[];
  addRecipe: (name: string, etapes: RecipeStep[]) => Recipe;
  getRecipe: (name: string) => Recipe | undefined;
};

const RecipesContext = createContext<RecipesContextValue | null>(null);

export function RecipesProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);

  const addRecipe = useCallback(
    (name: string, etapes: RecipeStep[]) => {
      const next: Recipe = {
        id:
          recipes.reduce((max, r) => Math.max(max, r.id), 0) + 1,
        name: name.trim(),
        tasks: { etapes },
      };
      setRecipes((prev) => [...prev, next]);
      return next;
    },
    [recipes],
  );

  const getRecipe = useCallback(
    (name: string) => recipes.find((r) => r.name === name),
    [recipes],
  );

  const value = useMemo(
    () => ({ recipes, addRecipe, getRecipe }),
    [recipes, addRecipe, getRecipe],
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

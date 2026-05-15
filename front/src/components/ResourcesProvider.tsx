"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ResourceTypeDto } from "@/lib/types";
import { api } from "@/lib/api";

type ResourcesContextValue = {
  resourceTypes: ResourceTypeDto[];
  /** Demande crête actuelle par nom de type (nombre de tâches actives en parallèle). */
  usage: Record<string, number>;
  reload: () => Promise<void>;
  createType: (name: string) => Promise<void>;
  deleteType: (name: string) => Promise<void>;
  addInstance: (name: string) => Promise<void>;
  removeInstance: (name: string) => Promise<void>;
};

const ResourcesContext = createContext<ResourcesContextValue | null>(null);

export function ResourcesProvider({ children }: { children: React.ReactNode }) {
  const [resourceTypes, setResourceTypes] = useState<ResourceTypeDto[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    const [types, u] = await Promise.all([
      api.resources.list(),
      api.resources.usage().catch(() => ({})),
    ]);
    setResourceTypes(types);
    setUsage(u);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const [types, u] = await Promise.all([
          api.resources.list(),
          api.resources.usage().catch(() => ({})),
        ]);
        if (!cancelled) {
          setResourceTypes(types);
          setUsage(u);
        }
      } catch {
        if (!cancelled) setTimeout(load, 5_000);
        return;
      }
      // Rafraîchir l'usage toutes les 5s pour suivre la progression des plannings
      if (!cancelled && timer === null) {
        timer = setInterval(async () => {
          try {
            const u = await api.resources.usage();
            if (!cancelled) setUsage(u);
          } catch {
            // ignore
          }
        }, 5_000);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const createType = useCallback(async (name: string) => {
    const next = await api.resources.createType(name);
    setResourceTypes(next);
  }, []);

  const deleteType = useCallback(async (name: string) => {
    const next = await api.resources.deleteType(name);
    setResourceTypes(next);
  }, []);

  const addInstance = useCallback(async (name: string) => {
    const next = await api.resources.addInstance(name);
    setResourceTypes(next);
  }, []);

  const removeInstance = useCallback(async (name: string) => {
    const next = await api.resources.removeInstance(name);
    setResourceTypes(next);
  }, []);

  const value = useMemo(
    () => ({
      resourceTypes,
      usage,
      reload,
      createType,
      deleteType,
      addInstance,
      removeInstance,
    }),
    [
      resourceTypes,
      usage,
      reload,
      createType,
      deleteType,
      addInstance,
      removeInstance,
    ],
  );

  return (
    <ResourcesContext.Provider value={value}>
      {children}
    </ResourcesContext.Provider>
  );
}

export function useResources() {
  const ctx = useContext(ResourcesContext);
  if (!ctx) throw new Error("useResources must be used inside <ResourcesProvider>");
  return ctx;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";

type TimeContextValue = {
  /** Décalage cumulé en millisecondes (positif = on a avancé dans le temps). */
  offsetMs: number;
  /** Vrai pendant la simulation automatique : les contrôles temporels sont alors verrouillés. */
  autoSimActive: boolean;
  /**
   * Compteur incrémenté à chaque décalage. Les pages qui dépendent
   * des horaires (Gantt, salle, cuisine) doivent l'inclure dans leurs
   * dépendances de useEffect pour rafraîchir leurs données immédiatement.
   */
  shiftVersion: number;
  /** Applique un décalage (en secondes, signé). */
  shift: (deltaSec: number) => Promise<void>;
  /** Revient au temps réel. */
  reset: () => Promise<void>;
  /** Rafraîchit le statut depuis le backend. */
  refresh: () => Promise<void>;
};

const TimeContext = createContext<TimeContextValue | null>(null);

export function TimeProvider({ children }: { children: React.ReactNode }) {
  const [offsetMs, setOffsetMs] = useState(0);
  const [autoSimActive, setAutoSimActive] = useState(false);
  const [shiftVersion, setShiftVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const s = await api.time.status();
      setOffsetMs((prev) => {
        // Si le backend a un offset différent (ex. auto-sim a fait reset),
        // on signale aux consommateurs un changement de "version".
        if (prev !== s.offsetMs) setShiftVersion((v) => v + 1);
        return s.offsetMs;
      });
      setAutoSimActive(s.autoSimulationActive);
    } catch {
      // backend indisponible — on garde l'état précédent
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const shift = useCallback(async (deltaSec: number) => {
    const s = await api.time.shift(deltaSec);
    setOffsetMs(s.offsetMs);
    setAutoSimActive(s.autoSimulationActive);
    setShiftVersion((v) => v + 1);
  }, []);

  const reset = useCallback(async () => {
    const s = await api.time.reset();
    setOffsetMs(s.offsetMs);
    setAutoSimActive(s.autoSimulationActive);
    setShiftVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({ offsetMs, autoSimActive, shiftVersion, shift, reset, refresh }),
    [offsetMs, autoSimActive, shiftVersion, shift, reset, refresh],
  );

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useTime() {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error("useTime must be used inside <TimeProvider>");
  return ctx;
}

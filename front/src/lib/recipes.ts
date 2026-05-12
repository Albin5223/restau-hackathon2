import type { Recipe, RecipeStep } from "./types";

// Compute earliest start/end for each step given the dependency DAG.
// `deps` are 1-based indices into etapes (matching the DB seed format).
// Returns the critical path total (minutes) and per-step timings.
export type StepTiming = {
  startMin: number;
  endMin: number;
};

export function computeSchedule(recipe: Recipe): {
  totalMin: number;
  timings: StepTiming[];
} {
  const { etapes } = recipe.tasks;
  const timings: StepTiming[] = etapes.map(() => ({ startMin: 0, endMin: 0 }));

  // Topological order isn't strictly required if we resolve recursively
  // with memoisation. We expect tiny DAGs (a few steps), so we'll loop
  // until a fixpoint to avoid an explicit topo sort.
  let changed = true;
  let safety = etapes.length * etapes.length + 10;
  while (changed && safety-- > 0) {
    changed = false;
    for (let i = 0; i < etapes.length; i++) {
      const step = etapes[i];
      const depEnds = step.deps.map((d) => timings[d - 1]?.endMin ?? 0);
      const start = depEnds.length ? Math.max(...depEnds) : 0;
      const end = start + step.duree;
      if (timings[i].startMin !== start || timings[i].endMin !== end) {
        timings[i] = { startMin: start, endMin: end };
        changed = true;
      }
    }
  }

  const totalMin = timings.reduce((m, t) => Math.max(m, t.endMin), 0);
  return { totalMin, timings };
}

export function assignTracks(
  timings: StepTiming[],
): { tracks: number[]; numTracks: number } {
  const tracks: number[] = [];
  const trackEnds: number[] = [];

  for (let i = 0; i < timings.length; i++) {
    const { startMin, endMin } = timings[i];
    let assigned = -1;
    for (let t = 0; t < trackEnds.length; t++) {
      if (trackEnds[t] <= startMin) {
        assigned = t;
        trackEnds[t] = endMin;
        break;
      }
    }
    if (assigned === -1) {
      assigned = trackEnds.length;
      trackEnds.push(endMin);
    }
    tracks[i] = assigned;
  }

  return { tracks, numTracks: Math.max(1, trackEnds.length) };
}

export function validateRecipe(
  name: string,
  steps: RecipeStep[],
  existingNames: string[],
): string[] {
  const errors: string[] = [];
  const trimmed = name.trim();

  if (!trimmed) errors.push("Le nom du plat est obligatoire.");
  else if (existingNames.includes(trimmed))
    errors.push("Un plat porte déjà ce nom.");

  if (steps.length === 0) errors.push("Au moins une étape est requise.");

  steps.forEach((step, i) => {
    const pos = i + 1;
    if (!step.nom.trim())
      errors.push(`Étape ${pos} : le nom est obligatoire.`);
    if (step.ressource.length === 0)
      errors.push(`Étape ${pos} : au moins une ressource.`);
    if (!(step.duree > 0))
      errors.push(`Étape ${pos} : la durée doit être > 0.`);
    for (const d of step.deps) {
      if (d < 1 || d > steps.length)
        errors.push(`Étape ${pos} : dépendance ${d} invalide.`);
      if (d === pos) errors.push(`Étape ${pos} : ne peut pas dépendre d'elle-même.`);
      if (d > pos)
        errors.push(
          `Étape ${pos} : ne peut dépendre que d'étapes antérieures.`,
        );
    }
  });

  return errors;
}

export function allResources(recipe: Recipe): string[] {
  const set = new Set<string>();
  for (const step of recipe.tasks.etapes) {
    for (const r of step.ressource) set.add(r);
  }
  return [...set];
}

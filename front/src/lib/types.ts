// Aligned with the SQL schema:
//   CREATE TABLE recipe_documents (id INTEGER PK, name TEXT UNIQUE, tasks JSON)
//   tasks = { etapes: [{ nom, ressource[], duree, deps[], kind }] }
// `deps` references step positions in `etapes` (1-based, like the seed data).
export type RecipeStep = {
  nom: string;
  ressource: string[];
  duree: number;
  deps: number[];
  kind?: string;
};

export type ResourceTypeDto = {
  name: string;
  capacity: number;
};

export type Recipe = {
  id: number;
  name: string;
  tasks: { etapes: RecipeStep[] };
};

export type TableStatus =
  | "libre"
  | "commande_passee"
  | "en_preparation"
  | "servie";

// Backend-aligned table (id is numeric from DB)
export type BackendTable = {
  id: number;
  number: number;
  seats: number;
  status: TableStatus;
  partySize: number | null;
  commandeId: string | null;
};

// StepKind used for Gantt colour coding
export type StepKind = "preparation" | "cuisson" | "dressage";

export type ScheduledStepStatus = "a_venir" | "en_cours" | "termine";

export type ScheduledStep = {
  id: string;
  orderId: string;
  tableNumber: number;
  recipeName: string;
  stepName: string;
  kind: StepKind;
  resourceId: string;
  resourceLabel: string;
  startAt: number;
  endAt: number;
  status: ScheduledStepStatus;
};

// Backend Gantt payload
export type BackendGanttTask = {
  id: string;
  commandeId: string;
  tableNumber: number;
  dishName: string;
  taskName: string;
  kind: StepKind;
  resourceName: string;
  startAt: number;
  endAt: number;
};

export type BackendGanttResponse = {
  tasks: BackendGanttTask[];
  generatedAt: number;
};

export type BackendCommandeResult = {
  commandeId: string;
  tableNumber: number;
  serviceTimeAt: number;
  scheduledTasks: BackendGanttTask[];
};

export type SimulationMetrics = {
  servedTables: number;
  refusedGroups: number;
  averageWaitMin: number;
  averageSyncSpreadSec: number;
  resourceUtilization: { resourceId: string; label: string; usagePct: number }[];
};

// Aligned with the SQL schema:
//   CREATE TABLE recipe_documents (id INTEGER PK, name TEXT UNIQUE, tasks JSON)
//   tasks = { etapes: [{ nom, ressource[], duree, deps[] }] }
// `deps` references step positions in `etapes` (1-based, like the seed data).
export type RecipeStep = {
  nom: string;
  ressource: string[];
  duree: number;
  deps: number[];
};

export type Recipe = {
  id: number;
  name: string;
  tasks: { etapes: RecipeStep[] };
};

export type ResourceKind = "commis" | "chef" | "plaque" | "four" | "friteuse";

export type Resource = {
  id: string;
  kind: ResourceKind;
  label: string;
};

export type TableStatus =
  | "libre"
  | "commande_passee"
  | "en_preparation"
  | "servie";

export type Table = {
  id: string;
  number: number;
  seats: number;
  status: TableStatus;
  partySize?: number;
  orderId?: string;
};

export type OrderItem = {
  recipeName: string;
  guest: string;
};

export type Order = {
  id: string;
  tableId: string;
  placedAt: number;
  targetServeAt: number;
  items: OrderItem[];
};

// StepKind kept only for the scheduled / Gantt view colour coding —
// not part of the persisted recipe schema. The planner labels each
// scheduled step with one of these kinds when it emits a plan.
export type StepKind = "preparation" | "cuisson" | "dressage";

export type ScheduledStepStatus = "a_venir" | "en_cours" | "termine";

export type ScheduledStep = {
  id: string;
  orderId: string;
  tableNumber: number;
  recipeName: string;
  kind: StepKind;
  resourceId: string;
  resourceLabel: string;
  startAt: number;
  endAt: number;
  status: ScheduledStepStatus;
};

export type SimulationMetrics = {
  servedTables: number;
  refusedGroups: number;
  averageWaitMin: number;
  averageSyncSpreadSec: number;
  resourceUtilization: { resourceId: string; label: string; usagePct: number }[];
};

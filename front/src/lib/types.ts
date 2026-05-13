// Aligned with the new backend (post commande→order, post ID refactor).
//
// Backend `Dish` table:
//   CREATE TABLE dish (id INTEGER PK, name TEXT UNIQUE, tasks JSON)
//   tasks = [{ nom, resources[], duration, dependencies[], type }]
//
// `dependencies` are 0-based indices into the flat tasks list.
//
// Wire shape for IDs is `{ value: ... }` (Java records). The `api` layer
// unwraps to flat scalars so component code stays simple.
export type RecipeStep = {
  nom: string;
  resources: string[];
  duration: number;
  dependencies: number[];
  type?: string;
};

export type ResourceTypeDto = {
  name: string;
  capacity: number;
};

export type Recipe = {
  id: number;
  name: string;
  tasks: RecipeStep[];
};

export type TableStatus =
  | "libre"
  | "commande_passee"
  | "en_preparation"
  | "servie";

// Flat after api-layer unwrap
export type BackendTable = {
  id: number;
  number: number;
  seats: number;
  status: TableStatus;
  partySize: number | null;
  orderId: string | null;
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

// Flat after api-layer unwrap (raw backend has orderId: { value: string })
export type BackendGanttTask = {
  id: string;
  orderId: string;
  tableNumber: number;
  dishName: string;
  taskName: string;
  kind: StepKind;
  resourceNames: string[];
  startAt: number;
  endAt: number;
};

export type BackendGanttResponse = {
  tasks: BackendGanttTask[];
  generatedAt: number;
};

export type BackendOrderResult = {
  orderId: string;
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

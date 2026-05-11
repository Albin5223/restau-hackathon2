export type ResourceKind = "commis" | "chef" | "plaque" | "four";

export type Resource = {
  id: string;
  kind: ResourceKind;
  label: string;
};

export type StepKind = "preparation" | "cuisson" | "dressage";

export type DishStep = {
  kind: StepKind;
  durationMin: number;
  resourceKinds: ResourceKind[];
};

export type Dish = {
  id: string;
  name: string;
  category: "viande" | "poisson" | "vegetarien";
  description: string;
  steps: DishStep[];
};

export type TableStatus = "libre" | "commande_passee" | "en_preparation" | "servie";

export type Table = {
  id: string;
  number: number;
  seats: number;
  status: TableStatus;
  partySize?: number;
  orderId?: string;
};

export type OrderItem = {
  dishId: string;
  guest: string;
};

export type Order = {
  id: string;
  tableId: string;
  placedAt: number;
  targetServeAt: number;
  items: OrderItem[];
};

export type ScheduledStepStatus = "a_venir" | "en_cours" | "termine";

export type ScheduledStep = {
  id: string;
  orderId: string;
  tableNumber: number;
  dishId: string;
  dishName: string;
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

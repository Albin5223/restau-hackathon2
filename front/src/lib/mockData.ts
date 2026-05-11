import type {
  Dish,
  Order,
  Resource,
  ScheduledStep,
  SimulationMetrics,
  Table,
} from "./types";

export const SERVICE_START = new Date();
SERVICE_START.setHours(12, 0, 0, 0);

const min = (m: number) => m * 60_000;
const t = (offsetMin: number) => SERVICE_START.getTime() + min(offsetMin);

export const resources: Resource[] = [
  { id: "commis-1", kind: "commis", label: "Commis 1" },
  { id: "commis-2", kind: "commis", label: "Commis 2" },
  { id: "chef-1", kind: "chef", label: "Chef" },
  { id: "plaque-1", kind: "plaque", label: "Plaque feu 1" },
  { id: "plaque-2", kind: "plaque", label: "Plaque feu 2" },
  { id: "plaque-3", kind: "plaque", label: "Plaque feu 3" },
  { id: "four-1", kind: "four", label: "Four" },
];

export const menu: Dish[] = [
  {
    id: "magret",
    name: "Magret de canard",
    category: "viande",
    description: "Magret rosé, jus à l'orange, écrasé de pommes de terre",
    steps: [
      { kind: "preparation", durationMin: 6, resourceKinds: ["commis"] },
      { kind: "cuisson", durationMin: 9, resourceKinds: ["plaque"] },
      { kind: "dressage", durationMin: 2, resourceKinds: ["chef"] },
    ],
  },
  {
    id: "saint-jacques",
    name: "Coquilles Saint-Jacques",
    category: "poisson",
    description: "Saint-Jacques snackées, mousseline de panais",
    steps: [
      { kind: "preparation", durationMin: 5, resourceKinds: ["commis"] },
      { kind: "cuisson", durationMin: 2, resourceKinds: ["plaque"] },
      { kind: "dressage", durationMin: 2, resourceKinds: ["chef"] },
    ],
  },
  {
    id: "boeuf-bourguignon",
    name: "Bœuf bourguignon",
    category: "viande",
    description: "Joue de bœuf braisée, carottes glacées, pommes vapeur",
    steps: [
      { kind: "preparation", durationMin: 4, resourceKinds: ["commis"] },
      { kind: "cuisson", durationMin: 12, resourceKinds: ["four"] },
      { kind: "dressage", durationMin: 2, resourceKinds: ["chef"] },
    ],
  },
  {
    id: "risotto",
    name: "Risotto à la truffe",
    category: "vegetarien",
    description: "Risotto carnaroli, copeaux de truffe noire, parmesan 24 mois",
    steps: [
      { kind: "preparation", durationMin: 3, resourceKinds: ["commis"] },
      { kind: "cuisson", durationMin: 7, resourceKinds: ["plaque"] },
      { kind: "dressage", durationMin: 2, resourceKinds: ["chef"] },
    ],
  },
  {
    id: "loup",
    name: "Loup en croûte de sel",
    category: "poisson",
    description: "Loup entier, croûte de sel aux herbes, légumes vapeur",
    steps: [
      { kind: "preparation", durationMin: 8, resourceKinds: ["commis"] },
      { kind: "cuisson", durationMin: 15, resourceKinds: ["four"] },
      { kind: "dressage", durationMin: 3, resourceKinds: ["chef"] },
    ],
  },
];

export const tables: Table[] = [
  { id: "t1", number: 1, seats: 2, status: "servie", partySize: 2, orderId: "o-101" },
  { id: "t2", number: 2, seats: 2, status: "libre" },
  { id: "t3", number: 3, seats: 4, status: "en_preparation", partySize: 4, orderId: "o-102" },
  { id: "t4", number: 4, seats: 4, status: "commande_passee", partySize: 3, orderId: "o-103" },
  { id: "t5", number: 5, seats: 6, status: "libre" },
  { id: "t6", number: 6, seats: 2, status: "en_preparation", partySize: 2, orderId: "o-104" },
  { id: "t7", number: 7, seats: 4, status: "libre" },
  { id: "t8", number: 8, seats: 8, status: "commande_passee", partySize: 6, orderId: "o-105" },
];

export const orders: Order[] = [
  {
    id: "o-101",
    tableId: "t1",
    placedAt: t(-25),
    targetServeAt: t(-10),
    items: [
      { dishId: "magret", guest: "Couvert 1" },
      { dishId: "saint-jacques", guest: "Couvert 2" },
    ],
  },
  {
    id: "o-102",
    tableId: "t3",
    placedAt: t(-8),
    targetServeAt: t(6),
    items: [
      { dishId: "magret", guest: "Couvert 1" },
      { dishId: "magret", guest: "Couvert 2" },
      { dishId: "saint-jacques", guest: "Couvert 3" },
      { dishId: "risotto", guest: "Couvert 4" },
    ],
  },
  {
    id: "o-103",
    tableId: "t4",
    placedAt: t(-2),
    targetServeAt: t(14),
    items: [
      { dishId: "boeuf-bourguignon", guest: "Couvert 1" },
      { dishId: "loup", guest: "Couvert 2" },
      { dishId: "risotto", guest: "Couvert 3" },
    ],
  },
  {
    id: "o-104",
    tableId: "t6",
    placedAt: t(-5),
    targetServeAt: t(5),
    items: [
      { dishId: "saint-jacques", guest: "Couvert 1" },
      { dishId: "risotto", guest: "Couvert 2" },
    ],
  },
  {
    id: "o-105",
    tableId: "t8",
    placedAt: t(-1),
    targetServeAt: t(18),
    items: [
      { dishId: "magret", guest: "Couvert 1" },
      { dishId: "magret", guest: "Couvert 2" },
      { dishId: "boeuf-bourguignon", guest: "Couvert 3" },
      { dishId: "boeuf-bourguignon", guest: "Couvert 4" },
      { dishId: "loup", guest: "Couvert 5" },
      { dishId: "risotto", guest: "Couvert 6" },
    ],
  },
];

// Planning précalculé pour le diagramme de Gantt — fictif mais cohérent avec
// la contrainte « tous les plats d'une table servis ensemble ».
export const scheduledSteps: ScheduledStep[] = [
  // Table 3 — service prévu à t+6, on remonte à partir du plus long (magret 9 min cuisson)
  step("o-102", 3, "magret", "Magret de canard", "preparation", "commis-1", -9, -3),
  step("o-102", 3, "magret", "Magret de canard", "preparation", "commis-2", -9, -3),
  step("o-102", 3, "saint-jacques", "Coquilles Saint-Jacques", "preparation", "commis-1", -3, 2),
  step("o-102", 3, "risotto", "Risotto à la truffe", "preparation", "commis-2", -3, 0),
  step("o-102", 3, "magret", "Magret de canard", "cuisson", "plaque-1", -5, 4),
  step("o-102", 3, "magret", "Magret de canard", "cuisson", "plaque-2", -5, 4),
  step("o-102", 3, "saint-jacques", "Coquilles Saint-Jacques", "cuisson", "plaque-3", 2, 4),
  step("o-102", 3, "risotto", "Risotto à la truffe", "cuisson", "plaque-3", -3, 4),
  step("o-102", 3, "magret", "Magret de canard", "dressage", "chef-1", 4, 6),

  // Table 6 — service prévu à t+5
  step("o-104", 6, "risotto", "Risotto à la truffe", "preparation", "commis-1", -4, -1),
  step("o-104", 6, "saint-jacques", "Coquilles Saint-Jacques", "preparation", "commis-2", -1, 4),
  step("o-104", 6, "risotto", "Risotto à la truffe", "cuisson", "plaque-1", -1, 3),
  step("o-104", 6, "saint-jacques", "Coquilles Saint-Jacques", "cuisson", "plaque-2", 1, 3),
  step("o-104", 6, "risotto", "Risotto à la truffe", "dressage", "chef-1", 3, 5),

  // Table 4 — service prévu à t+14
  step("o-103", 4, "boeuf-bourguignon", "Bœuf bourguignon", "preparation", "commis-1", 0, 4),
  step("o-103", 4, "loup", "Loup en croûte de sel", "preparation", "commis-2", -1, 7),
  step("o-103", 4, "risotto", "Risotto à la truffe", "preparation", "commis-1", 4, 7),
  step("o-103", 4, "boeuf-bourguignon", "Bœuf bourguignon", "cuisson", "four-1", -1, 11),
  step("o-103", 4, "loup", "Loup en croûte de sel", "cuisson", "four-1", -3, 12),
  step("o-103", 4, "risotto", "Risotto à la truffe", "cuisson", "plaque-1", 5, 12),
  step("o-103", 4, "boeuf-bourguignon", "Bœuf bourguignon", "dressage", "chef-1", 12, 14),

  // Table 8 — service prévu à t+18
  step("o-105", 8, "magret", "Magret de canard", "preparation", "commis-1", 7, 13),
  step("o-105", 8, "boeuf-bourguignon", "Bœuf bourguignon", "preparation", "commis-2", 7, 11),
  step("o-105", 8, "loup", "Loup en croûte de sel", "preparation", "commis-1", 13, 17),
  step("o-105", 8, "risotto", "Risotto à la truffe", "preparation", "commis-2", 11, 14),
  step("o-105", 8, "magret", "Magret de canard", "cuisson", "plaque-2", 9, 18),
  step("o-105", 8, "boeuf-bourguignon", "Bœuf bourguignon", "cuisson", "four-1", 13, 18),
  step("o-105", 8, "loup", "Loup en croûte de sel", "cuisson", "four-1", 13, 18),
  step("o-105", 8, "risotto", "Risotto à la truffe", "cuisson", "plaque-3", 14, 18),
  step("o-105", 8, "magret", "Magret de canard", "dressage", "chef-1", 16, 18),
];

function step(
  orderId: string,
  tableNumber: number,
  dishId: string,
  dishName: string,
  kind: "preparation" | "cuisson" | "dressage",
  resourceId: string,
  startOffsetMin: number,
  endOffsetMin: number,
): ScheduledStep {
  const resource = resources.find((r) => r.id === resourceId)!;
  const startAt = t(startOffsetMin);
  const endAt = t(endOffsetMin);
  const now = SERVICE_START.getTime();
  let status: ScheduledStep["status"] = "a_venir";
  if (endAt < now) status = "termine";
  else if (startAt <= now) status = "en_cours";
  return {
    id: `${orderId}-${dishId}-${kind}-${resourceId}-${startOffsetMin}`,
    orderId,
    tableNumber,
    dishId,
    dishName,
    kind,
    resourceId,
    resourceLabel: resource.label,
    startAt,
    endAt,
    status,
  };
}

export const simulationMetrics: SimulationMetrics = {
  servedTables: 42,
  refusedGroups: 4,
  averageWaitMin: 18.4,
  averageSyncSpreadSec: 38,
  resourceUtilization: [
    { resourceId: "commis-1", label: "Commis 1", usagePct: 78 },
    { resourceId: "commis-2", label: "Commis 2", usagePct: 71 },
    { resourceId: "chef-1", label: "Chef", usagePct: 64 },
    { resourceId: "plaque-1", label: "Plaque feu 1", usagePct: 82 },
    { resourceId: "plaque-2", label: "Plaque feu 2", usagePct: 69 },
    { resourceId: "plaque-3", label: "Plaque feu 3", usagePct: 47 },
    { resourceId: "four-1", label: "Four", usagePct: 88 },
  ],
};

export function getDish(id: string) {
  return menu.find((d) => d.id === id);
}

export function getTable(id: string) {
  return tables.find((t) => t.id === id);
}

export function getOrder(id: string) {
  return orders.find((o) => o.id === id);
}

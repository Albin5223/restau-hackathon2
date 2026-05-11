import type {
  Order,
  Recipe,
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

// Aligned with the recipe_documents table.
// `deps` are 1-based positions in `etapes` (cf. seed `steak frites`).
export const initialRecipes: Recipe[] = [
  {
    id: 1,
    name: "Magret de canard",
    tasks: {
      etapes: [
        { nom: "Préparer magret", ressource: ["commis"], duree: 6, deps: [] },
        { nom: "Préparer écrasé", ressource: ["commis"], duree: 4, deps: [] },
        { nom: "Cuire magret", ressource: ["plaque"], duree: 9, deps: [1] },
        { nom: "Cuire écrasé", ressource: ["plaque"], duree: 5, deps: [2] },
        { nom: "Dresser l'assiette", ressource: ["chef"], duree: 2, deps: [3, 4] },
      ],
    },
  },
  {
    id: 2,
    name: "Coquilles Saint-Jacques",
    tasks: {
      etapes: [
        { nom: "Préparer Saint-Jacques", ressource: ["commis"], duree: 5, deps: [] },
        { nom: "Snacker Saint-Jacques", ressource: ["plaque"], duree: 2, deps: [1] },
        { nom: "Dresser l'assiette", ressource: ["chef"], duree: 2, deps: [2] },
      ],
    },
  },
  {
    id: 3,
    name: "Bœuf bourguignon",
    tasks: {
      etapes: [
        { nom: "Préparer joue de bœuf", ressource: ["commis"], duree: 4, deps: [] },
        { nom: "Braiser au four", ressource: ["four"], duree: 12, deps: [1] },
        { nom: "Dresser l'assiette", ressource: ["chef"], duree: 2, deps: [2] },
      ],
    },
  },
  {
    id: 4,
    name: "Risotto à la truffe",
    tasks: {
      etapes: [
        { nom: "Préparer riz et bouillon", ressource: ["commis"], duree: 3, deps: [] },
        { nom: "Cuire risotto", ressource: ["plaque"], duree: 7, deps: [1] },
        { nom: "Dresser l'assiette", ressource: ["chef"], duree: 2, deps: [2] },
      ],
    },
  },
  {
    id: 5,
    name: "Loup en croûte de sel",
    tasks: {
      etapes: [
        { nom: "Préparer loup", ressource: ["commis"], duree: 8, deps: [] },
        { nom: "Cuire au four", ressource: ["four"], duree: 15, deps: [1] },
        { nom: "Dresser l'assiette", ressource: ["chef"], duree: 3, deps: [2] },
      ],
    },
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
      { recipeName: "Magret de canard", guest: "Couvert 1" },
      { recipeName: "Coquilles Saint-Jacques", guest: "Couvert 2" },
    ],
  },
  {
    id: "o-102",
    tableId: "t3",
    placedAt: t(-8),
    targetServeAt: t(6),
    items: [
      { recipeName: "Magret de canard", guest: "Couvert 1" },
      { recipeName: "Magret de canard", guest: "Couvert 2" },
      { recipeName: "Coquilles Saint-Jacques", guest: "Couvert 3" },
      { recipeName: "Risotto à la truffe", guest: "Couvert 4" },
    ],
  },
  {
    id: "o-103",
    tableId: "t4",
    placedAt: t(-2),
    targetServeAt: t(14),
    items: [
      { recipeName: "Bœuf bourguignon", guest: "Couvert 1" },
      { recipeName: "Loup en croûte de sel", guest: "Couvert 2" },
      { recipeName: "Risotto à la truffe", guest: "Couvert 3" },
    ],
  },
  {
    id: "o-104",
    tableId: "t6",
    placedAt: t(-5),
    targetServeAt: t(5),
    items: [
      { recipeName: "Coquilles Saint-Jacques", guest: "Couvert 1" },
      { recipeName: "Risotto à la truffe", guest: "Couvert 2" },
    ],
  },
  {
    id: "o-105",
    tableId: "t8",
    placedAt: t(-1),
    targetServeAt: t(18),
    items: [
      { recipeName: "Magret de canard", guest: "Couvert 1" },
      { recipeName: "Magret de canard", guest: "Couvert 2" },
      { recipeName: "Bœuf bourguignon", guest: "Couvert 3" },
      { recipeName: "Bœuf bourguignon", guest: "Couvert 4" },
      { recipeName: "Loup en croûte de sel", guest: "Couvert 5" },
      { recipeName: "Risotto à la truffe", guest: "Couvert 6" },
    ],
  },
];

// Planning précalculé pour le diagramme de Gantt — fictif mais cohérent avec
// la contrainte « tous les plats d'une table servis ensemble ».
export const scheduledSteps: ScheduledStep[] = [
  // Table 3 — service prévu à t+6
  step("o-102", 3, "Magret de canard", "preparation", "commis-1", -9, -3),
  step("o-102", 3, "Magret de canard", "preparation", "commis-2", -9, -3),
  step("o-102", 3, "Coquilles Saint-Jacques", "preparation", "commis-1", -3, 2),
  step("o-102", 3, "Risotto à la truffe", "preparation", "commis-2", -3, 0),
  step("o-102", 3, "Magret de canard", "cuisson", "plaque-1", -5, 4),
  step("o-102", 3, "Magret de canard", "cuisson", "plaque-2", -5, 4),
  step("o-102", 3, "Coquilles Saint-Jacques", "cuisson", "plaque-3", 2, 4),
  step("o-102", 3, "Risotto à la truffe", "cuisson", "plaque-3", -3, 4),
  step("o-102", 3, "Magret de canard", "dressage", "chef-1", 4, 6),

  // Table 6 — service prévu à t+5
  step("o-104", 6, "Risotto à la truffe", "preparation", "commis-1", -4, -1),
  step("o-104", 6, "Coquilles Saint-Jacques", "preparation", "commis-2", -1, 4),
  step("o-104", 6, "Risotto à la truffe", "cuisson", "plaque-1", -1, 3),
  step("o-104", 6, "Coquilles Saint-Jacques", "cuisson", "plaque-2", 1, 3),
  step("o-104", 6, "Risotto à la truffe", "dressage", "chef-1", 3, 5),

  // Table 4 — service prévu à t+14
  step("o-103", 4, "Bœuf bourguignon", "preparation", "commis-1", 0, 4),
  step("o-103", 4, "Loup en croûte de sel", "preparation", "commis-2", -1, 7),
  step("o-103", 4, "Risotto à la truffe", "preparation", "commis-1", 4, 7),
  step("o-103", 4, "Bœuf bourguignon", "cuisson", "four-1", -1, 11),
  step("o-103", 4, "Loup en croûte de sel", "cuisson", "four-1", -3, 12),
  step("o-103", 4, "Risotto à la truffe", "cuisson", "plaque-1", 5, 12),
  step("o-103", 4, "Bœuf bourguignon", "dressage", "chef-1", 12, 14),

  // Table 8 — service prévu à t+18
  step("o-105", 8, "Magret de canard", "preparation", "commis-1", 7, 13),
  step("o-105", 8, "Bœuf bourguignon", "preparation", "commis-2", 7, 11),
  step("o-105", 8, "Loup en croûte de sel", "preparation", "commis-1", 13, 17),
  step("o-105", 8, "Risotto à la truffe", "preparation", "commis-2", 11, 14),
  step("o-105", 8, "Magret de canard", "cuisson", "plaque-2", 9, 18),
  step("o-105", 8, "Bœuf bourguignon", "cuisson", "four-1", 13, 18),
  step("o-105", 8, "Loup en croûte de sel", "cuisson", "four-1", 13, 18),
  step("o-105", 8, "Risotto à la truffe", "cuisson", "plaque-3", 14, 18),
  step("o-105", 8, "Magret de canard", "dressage", "chef-1", 16, 18),
];

function step(
  orderId: string,
  tableNumber: number,
  recipeName: string,
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
    id: `${orderId}-${recipeName}-${kind}-${resourceId}-${startOffsetMin}`,
    orderId,
    tableNumber,
    recipeName,
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

export function findRecipeByName(recipes: Recipe[], name: string) {
  return recipes.find((r) => r.name === name);
}

export function getOrder(id: string) {
  return orders.find((o) => o.id === id);
}

export function getTable(id: string) {
  return tables.find((t) => t.id === id);
}

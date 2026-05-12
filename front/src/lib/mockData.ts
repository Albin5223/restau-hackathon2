// Données fictives conservées comme référence de structure.
// Ce fichier n'est plus utilisé par aucune page — le frontend est connecté au backend.

import type { Recipe, ScheduledStep, SimulationMetrics } from "./types";

// Types locaux (ne sont plus dans types.ts car alignés sur le backend)
type Resource = { id: string; kind: string; label: string };
type OrderItem = { recipeName: string; guest: string };
type Order = { id: string; tableId: string; placedAt: number; targetServeAt: number; items: OrderItem[] };
type MockTable = { id: string; number: number; seats: number; status: string; partySize?: number; orderId?: string };

export const SERVICE_START = new Date();
SERVICE_START.setHours(12, 0, 0, 0);

const min = (m: number) => m * 60_000;
const t = (offsetMin: number) => SERVICE_START.getTime() + min(offsetMin);

export const resources: Resource[] = [
  { id: "commis-1", kind: "commis", label: "Commis 1" },
  { id: "commis-2", kind: "commis", label: "Commis 2" },
  { id: "chef-1",   kind: "chef",   label: "Chef" },
  { id: "plaque-1", kind: "plaque", label: "Plaque feu 1" },
  { id: "plaque-2", kind: "plaque", label: "Plaque feu 2" },
  { id: "plaque-3", kind: "plaque", label: "Plaque feu 3" },
  { id: "four-1",   kind: "four",   label: "Four" },
];

export const initialRecipes: Recipe[] = [
  { id: 1, name: "Magret de canard",      tasks: { etapes: [
    { nom: "Préparer magret",    ressource: ["commis"], duree: 6,  deps: [] },
    { nom: "Préparer écrasé",    ressource: ["commis"], duree: 4,  deps: [] },
    { nom: "Cuire magret",       ressource: ["plaque"], duree: 9,  deps: [1] },
    { nom: "Cuire écrasé",       ressource: ["plaque"], duree: 5,  deps: [2] },
    { nom: "Dresser l'assiette", ressource: ["chef"],   duree: 2,  deps: [3, 4] },
  ]}},
  { id: 2, name: "Coquilles Saint-Jacques", tasks: { etapes: [
    { nom: "Préparer Saint-Jacques", ressource: ["commis"], duree: 5, deps: [] },
    { nom: "Snacker Saint-Jacques",  ressource: ["plaque"], duree: 2, deps: [1] },
    { nom: "Dresser l'assiette",     ressource: ["chef"],   duree: 2, deps: [2] },
  ]}},
];

export const tables: MockTable[] = [
  { id: "t1", number: 1, seats: 2, status: "servie",        partySize: 2, orderId: "o-101" },
  { id: "t2", number: 2, seats: 2, status: "libre" },
  { id: "t3", number: 3, seats: 4, status: "en_preparation", partySize: 4, orderId: "o-102" },
  { id: "t4", number: 4, seats: 4, status: "commande_passee", partySize: 3 },
  { id: "t5", number: 5, seats: 6, status: "libre" },
  { id: "t6", number: 6, seats: 2, status: "libre" },
  { id: "t7", number: 7, seats: 4, status: "libre" },
  { id: "t8", number: 8, seats: 8, status: "libre" },
];

export const orders: Order[] = [
  { id: "o-101", tableId: "t1", placedAt: t(-25), targetServeAt: t(-10),
    items: [{ recipeName: "Magret de canard", guest: "Couvert 1" }] },
  { id: "o-102", tableId: "t3", placedAt: t(-8),  targetServeAt: t(6),
    items: [{ recipeName: "Magret de canard", guest: "Couvert 1" }, { recipeName: "Coquilles Saint-Jacques", guest: "Couvert 2" }] },
];

export const scheduledSteps: ScheduledStep[] = [];

export const simulationMetrics: SimulationMetrics = {
  servedTables: 0,
  refusedGroups: 0,
  averageWaitMin: 0,
  averageSyncSpreadSec: 0,
  resourceUtilization: [],
};

export function findRecipeByName(recipes: Recipe[], name: string) {
  return recipes.find((r) => r.name === name);
}

export function getOrder(id: string) {
  return orders.find((o) => o.id === id);
}

export function getTable(id: string) {
  return tables.find((tbl) => tbl.id === id);
}

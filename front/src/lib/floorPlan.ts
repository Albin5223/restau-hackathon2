import type { StepKind, TableStatus } from "./types";

export const FLOOR_WIDTH = 1000;
export const FLOOR_HEIGHT = 600;

export const KITCHEN_AREA = {
  x: 60,
  y: 30,
  width: FLOOR_WIDTH - 120,
  height: 140,
} as const;

export const TABLE_RADIUS = 38;

export type TablePosition = { x: number; y: number };

export const TABLE_POSITIONS: Record<number, TablePosition> = {
  1: { x: 180, y: 260 },
  2: { x: 380, y: 260 },
  3: { x: 580, y: 260 },
  4: { x: 800, y: 260 },
  5: { x: 180, y: 420 },
  6: { x: 380, y: 420 },
  7: { x: 580, y: 420 },
  8: { x: 800, y: 420 },
};

export type KitchenStation = {
  id: string;
  label: string;
  /** matches the prefix of `resourceNames` from BackendGanttTask */
  resourceMatch: (resourceName: string) => boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

const KITCHEN_INNER_TOP = KITCHEN_AREA.y + 32;
const KITCHEN_INNER_HEIGHT = KITCHEN_AREA.height - 48;
const stationWidth = 140;
const stationGap = 24;
const stationsStartX =
  KITCHEN_AREA.x +
  (KITCHEN_AREA.width - (4 * stationWidth + 3 * stationGap)) / 2;

function stationBox(slot: number) {
  return {
    x: stationsStartX + slot * (stationWidth + stationGap),
    y: KITCHEN_INNER_TOP,
    width: stationWidth,
    height: KITCHEN_INNER_HEIGHT,
  };
}

export const KITCHEN_STATIONS: KitchenStation[] = [
  {
    id: "commis",
    label: "Commis",
    resourceMatch: (n) => n.toLowerCase().startsWith("commis"),
    ...stationBox(0),
  },
  {
    id: "chef",
    label: "Chef",
    resourceMatch: (n) => n.toLowerCase().startsWith("chef"),
    ...stationBox(1),
  },
  {
    id: "plaque",
    label: "Plaques",
    resourceMatch: (n) => n.toLowerCase().startsWith("plaque"),
    ...stationBox(2),
  },
  {
    id: "four",
    label: "Four",
    resourceMatch: (n) => n.toLowerCase().startsWith("four"),
    ...stationBox(3),
  },
];

export const TABLE_STATUS_FILL: Record<TableStatus, string> = {
  libre: "#e4e4e7",
  commande_passee: "#60a5fa",
  en_preparation: "#fbbf24",
  servie: "#34d399",
};

export const TABLE_STATUS_STROKE: Record<TableStatus, string> = {
  libre: "#a1a1aa",
  commande_passee: "#2563eb",
  en_preparation: "#d97706",
  servie: "#059669",
};

export const STEP_KIND_FILL: Record<StepKind, string> = {
  preparation: "#60a5fa",
  cuisson: "#fbbf24",
  dressage: "#34d399",
};

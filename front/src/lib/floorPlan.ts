import type { StepKind, TableStatus, ResourceTypeDto } from "./types";

export const FLOOR_WIDTH = 1000;

export const KITCHEN_AREA = {
  x: 60,
  y: 30,
  width: FLOOR_WIDTH - 120,
  height: 140,
} as const;

export const TABLE_RADIUS = 38;

export type TablePosition = { x: number; y: number };

const GRID_COLS = 4;
const GRID_X = [180, 380, 580, 800] as const;
const GRID_Y_START = 260;
const GRID_ROW_GAP = 160;

export function getTablePosition(tableNumber: number): TablePosition {
  const slot = tableNumber - 1;
  const col = slot % GRID_COLS;
  const row = Math.floor(slot / GRID_COLS);
  return { x: GRID_X[col], y: GRID_Y_START + row * GRID_ROW_GAP };
}

export function computeFloorHeight(maxSlotNumber: number): number {
  const rows = Math.ceil(maxSlotNumber / GRID_COLS);
  return Math.max(560, GRID_Y_START + rows * GRID_ROW_GAP + 60);
}

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
const MAX_STATION_WIDTH = 140;
const STATION_GAP = 24;

export function buildKitchenStations(resourceTypes: ResourceTypeDto[]): KitchenStation[] {
  const count = resourceTypes.length;
  if (count === 0) return [];

  const available = KITCHEN_AREA.width - 40;
  const totalGap = (count - 1) * STATION_GAP;
  const width = Math.min(MAX_STATION_WIDTH, Math.max(60, (available - totalGap) / count));
  const totalWidth = count * width + totalGap;
  const startX = KITCHEN_AREA.x + (KITCHEN_AREA.width - totalWidth) / 2;

  return resourceTypes.map((rt, i) => ({
    id: rt.name,
    label: rt.name.charAt(0).toUpperCase() + rt.name.slice(1),
    resourceMatch: (n: string) => n.toLowerCase().startsWith(rt.name.toLowerCase()),
    x: startX + i * (width + STATION_GAP),
    y: KITCHEN_INNER_TOP,
    width,
    height: KITCHEN_INNER_HEIGHT,
  }));
}

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

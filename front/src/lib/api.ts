import type {
  BackendCommandeResult,
  BackendGanttResponse,
  BackendTable,
  Recipe,
  ResourceTypeDto,
} from "./types";

export type AutoSimLog = {
  timestamp: number;
  type: "arrival" | "rejected" | "order" | "served" | "left" | "info" | "error";
  message: string;
};

export type WaitEntry = {
  tableNumber: number;
  partySize: number;
  waitTimeSec: number;
  elapsedSimSec: number;
};

export type SimTimePoint = {
  elapsedSimSec: number;
  arrivals: number;
  ordersPlaced: number;
  tablesServed: number;
  rejected: number;
  avgWaitSec: number;
};

export type SimulationStats = {
  totalArrivals: number;
  totalRejected: number;
  totalOrdersPlaced: number;
  totalTablesServed: number;
  totalClientsServed: number;
  avgWaitTimeSec: number;
  rejectionRate: number;
  rejectionReasons: Record<string, number>;
  resourceUsageSeconds: Record<string, number>;
  recentWaitTimes: WaitEntry[];
  timeSeries: SimTimePoint[];
};

export type AutoSimStatus = {
  active: boolean;
  logs: AutoSimLog[];
  stats: SimulationStats;
};

export type TimeStatus = {
  offsetMs: number;
  autoSimulationActive: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  path: string;

  constructor(path: string, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    headers,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      path,
      res.status,
      `API ${path} → ${res.status}${text ? ": " + text : ""}`,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  dishes: {
    list: () => request<Recipe[]>("/api/dishes"),
    create: (name: string, tasks: Recipe["tasks"]) =>
      request<Recipe>("/api/dishes", {
        method: "POST",
        body: JSON.stringify({ name, tasks }),
      }),
    update: (id: number, name: string, tasks: Recipe["tasks"]) =>
      request<Recipe>(`/api/dishes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name, tasks }),
      }),
    delete: (id: number) =>
      request<void>(`/api/dishes/${id}`, { method: "DELETE" }),
    importBatch: async (dishList: Array<{ name: string; tasks: Recipe["tasks"] }>) => {
      const res = await fetch(`${API}/api/dishes/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dishList),
      });
      if (!res.ok) {
        let message = `Erreur ${res.status}`;
        try {
          const json = await res.json() as { message?: string };
          if (json.message) message = json.message;
        } catch {
          const text = await res.text().catch(() => "");
          if (text) message = text;
        }
        throw new Error(message);
      }
      return res.json() as Promise<Recipe[]>;
    },
  },
  tables: {
    list: () => request<BackendTable[]>("/api/tables"),
    create: (seats: number) =>
      request<BackendTable>("/api/tables", {
        method: "POST",
        body: JSON.stringify({ seats }),
      }),
    updateSeats: (id: number, seats: number) =>
      request<BackendTable>(`/api/tables/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ seats }),
      }),
    delete: (id: number) =>
      request<void>(`/api/tables/${id}`, { method: "DELETE" }),
    install: (id: number, partySize: number) =>
      request<BackendTable>(`/api/tables/${id}/install`, {
        method: "POST",
        body: JSON.stringify({ partySize }),
      }),
    release: (id: number) =>
      request<BackendTable>(`/api/tables/${id}/release`, { method: "POST" }),
    serve: (id: number) =>
      request<BackendTable>(`/api/tables/${id}/serve`, { method: "POST" }),
  },
  orders: {
    place: (tableId: number, dishIds: number[], speedMultiplier?: number) =>
      request<BackendCommandeResult>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ tableId, dishIds, speedMultiplier }),
      }),
  },
  cuisine: {
    gantt: () => request<BackendGanttResponse>("/api/cuisine/gantt"),
    delayTask: (ganttTaskId: string, additionalSeconds: number) =>
      request<void>("/api/cuisine/gantt/delay", {
        method: "POST",
        body: JSON.stringify({ ganttTaskId, additionalSeconds }),
      }),
  },
  resources: {
    list: () => request<ResourceTypeDto[]>("/api/resources"),
    usage: () => request<Record<string, number>>("/api/resources/usage"),
    createType: (name: string) =>
      request<ResourceTypeDto[]>("/api/resources", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    deleteType: (name: string) =>
      request<ResourceTypeDto[]>(`/api/resources/${encodeURIComponent(name)}`, {
        method: "DELETE",
      }),
    addInstance: (name: string) =>
      request<ResourceTypeDto[]>(
        `/api/resources/${encodeURIComponent(name)}/instances`,
        { method: "POST" },
      ),
    removeInstance: (name: string) =>
      request<ResourceTypeDto[]>(
        `/api/resources/${encodeURIComponent(name)}/instances`,
        { method: "DELETE" },
      ),
  },
  time: {
    status: () => request<TimeStatus>("/api/time"),
    shift: (deltaSec: number) =>
      request<TimeStatus>("/api/time/shift", {
        method: "POST",
        body: JSON.stringify({ deltaSec }),
      }),
    reset: () =>
      request<TimeStatus>("/api/time/reset", { method: "POST" }),
  },
  simulation: {
    status: () => request<AutoSimStatus>("/api/simulation/auto/status"),
    start: (params: {
      durationMin: number;
      arrivalRatePerHour: number;
      avgPartySize: number;
      speedMultiplier: number;
    }) =>
      request<void>("/api/simulation/auto/start", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    stop: () => request<void>("/api/simulation/auto/stop", { method: "POST" }),
  },
};

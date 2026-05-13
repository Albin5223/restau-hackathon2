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

export type AutoSimStatus = {
  active: boolean;
  logs: AutoSimLog[];
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    headers,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status}${text ? ": " + text : ""}`);
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
    delete: async (id: number) => {
      const res = await fetch(`${API}/api/dishes/${id}`, { method: "DELETE" });
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
    },
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
  },
  resources: {
    list: () => request<ResourceTypeDto[]>("/api/resources"),
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

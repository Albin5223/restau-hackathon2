import type {
  BackendCommandeResult,
  BackendGanttResponse,
  BackendTable,
  Recipe,
  ResourceTypeDto,
} from "./types";

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
  return res.json() as Promise<T>;
}

export const api = {
  dishes: {
    list: () => request<Recipe[]>("/api/dishes"),
    create: (name: string, tasks: Recipe["tasks"]) =>
      request<Recipe>("/api/dishes", {
        method: "POST",
        body: JSON.stringify({ name, tasks }),
      }),
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
  commandes: {
    place: (tableId: number, dishIds: number[], speedMultiplier?: number) =>
      request<BackendCommandeResult>("/api/commandes", {
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
};

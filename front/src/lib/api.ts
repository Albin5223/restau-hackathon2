import type {
  BackendGanttResponse,
  BackendGanttTask,
  BackendOrderResult,
  BackendTable,
  Recipe,
  RecipeStep,
  ResourceTypeDto,
  TableStatus,
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

// ── Raw backend shapes (Jackson serializes record-typed IDs as { value: ... }) ──

type RawId<T> = { value: T };

type RawTable = {
  id: RawId<number>;
  number: number;
  seats: number;
  status: TableStatus;
  partySize: number | null;
  orderId: RawId<string> | null;
};

type RawGanttTask = {
  id: string;
  orderId: RawId<string>;
  tableNumber: number;
  dishName: string;
  taskName: string;
  kind: BackendGanttTask["kind"];
  resourceNames: string[];
  startAt: number;
  endAt: number;
};

type RawGanttResponse = {
  tasks: RawGanttTask[];
  generatedAt: number;
};

type RawOrderResult = {
  orderId: RawId<string>;
  tableNumber: number;
  serviceTimeAt: number;
  scheduledTasks: RawGanttTask[];
};

type RawDishDto = {
  value: number;
  name: string;
  tasks: RecipeStep[];
};

type LongIdResponse = { id: number };

// ── Unwrap mappers ────────────────────────────────────────────────────────────

function unwrapTable(raw: RawTable): BackendTable {
  return {
    id: raw.id.value,
    number: raw.number,
    seats: raw.seats,
    status: raw.status,
    partySize: raw.partySize,
    orderId: raw.orderId?.value ?? null,
  };
}

function unwrapGanttTask(raw: RawGanttTask): BackendGanttTask {
  return {
    id: raw.id,
    orderId: raw.orderId.value,
    tableNumber: raw.tableNumber,
    dishName: raw.dishName,
    taskName: raw.taskName,
    kind: raw.kind,
    resourceNames: raw.resourceNames,
    startAt: raw.startAt,
    endAt: raw.endAt,
  };
}

function unwrapGanttResponse(raw: RawGanttResponse): BackendGanttResponse {
  return {
    tasks: raw.tasks.map(unwrapGanttTask),
    generatedAt: raw.generatedAt,
  };
}

function unwrapOrderResult(raw: RawOrderResult): BackendOrderResult {
  return {
    orderId: raw.orderId.value,
    tableNumber: raw.tableNumber,
    serviceTimeAt: raw.serviceTimeAt,
    scheduledTasks: raw.scheduledTasks.map(unwrapGanttTask),
  };
}

function unwrapDish(raw: RawDishDto): Recipe {
  return {
    id: raw.value,
    name: raw.name,
    tasks: raw.tasks,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const api = {
  dishes: {
    list: async (): Promise<Recipe[]> => {
      const raw = await request<RawDishDto[]>("/api/dishes");
      return raw.map(unwrapDish);
    },
    create: async (name: string, tasks: RecipeStep[]): Promise<Recipe> => {
      const res = await request<LongIdResponse>("/api/dishes", {
        method: "POST",
        body: JSON.stringify({ name, tasks }),
      });
      return { id: res.id, name, tasks };
    },
    importBatch: async (
      dishList: Array<{ name: string; tasks: RecipeStep[] }>,
    ): Promise<number[]> => {
      const res = await fetch(`${API}/api/dishes/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dishList),
      });
      if (!res.ok) {
        let message = `Erreur ${res.status}`;
        try {
          const json = (await res.json()) as { message?: string };
          if (json.message) message = json.message;
        } catch {
          const text = await res.text().catch(() => "");
          if (text) message = text;
        }
        throw new Error(message);
      }
      return (await res.json()) as number[];
    },
  },
  tables: {
    list: async (): Promise<BackendTable[]> => {
      const raw = await request<RawTable[]>("/api/tables");
      return raw.map(unwrapTable);
    },
    install: async (id: number, partySize: number): Promise<BackendTable> => {
      const raw = await request<RawTable>(`/api/tables/${id}/install`, {
        method: "POST",
        body: JSON.stringify({ partySize }),
      });
      return unwrapTable(raw);
    },
    release: async (id: number): Promise<BackendTable> => {
      const raw = await request<RawTable>(`/api/tables/${id}/release`, {
        method: "POST",
      });
      return unwrapTable(raw);
    },
    serve: async (id: number): Promise<BackendTable> => {
      const raw = await request<RawTable>(`/api/tables/${id}/serve`, {
        method: "POST",
      });
      return unwrapTable(raw);
    },
  },
  orders: {
    place: async (
      tableId: number,
      dishIds: number[],
      speedMultiplier?: number,
    ): Promise<BackendOrderResult> => {
      const raw = await request<RawOrderResult>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ tableId, dishIds, speedMultiplier }),
      });
      return unwrapOrderResult(raw);
    },
  },
  cuisine: {
    gantt: async (): Promise<BackendGanttResponse> => {
      const raw = await request<RawGanttResponse>("/api/cuisine/gantt");
      return unwrapGanttResponse(raw);
    },
  },
  resources: {
    list: () => request<ResourceTypeDto[]>("/api/resources"),
  },
};

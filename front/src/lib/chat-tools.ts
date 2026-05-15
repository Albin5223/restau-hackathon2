const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string; items?: unknown }>;
      required?: string[];
    };
  };
};

export const TOOL_DEFS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_tables",
      description:
        "Liste l'état actuel de toutes les tables du restaurant (numéro, places, statut: libre/commande_passee/en_preparation/servie, partySize, orderId).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_gantt",
      description:
        "Renvoie toutes les tâches de cuisine actuellement planifiées ou en cours (Gantt) avec table, plat, étape, ressources, startAt, endAt en ms epoch.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dishes",
      description: "Liste tous les plats du menu (id, nom, étapes/tâches avec durées et ressources).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_resources",
      description: "Liste les types de ressources de cuisine et leur capacité (nombre d'instances).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_simulation_status",
      description: "État de la simulation automatique : active ou non + logs récents.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description:
        "Passe une commande sur une table libre ou en COMMANDE_PASSEE. Refusé si simulation auto active.",
      parameters: {
        type: "object",
        properties: {
          tableId: { type: "number", description: "ID numérique de la table." },
          dishIds: {
            type: "array",
            items: { type: "number" },
            description: "IDs des plats à commander (un par convive).",
          },
        },
        required: ["tableId", "dishIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "release_table",
      description:
        "Libère une table (clôture la commande en cours si présente). Refusé si simulation auto active.",
      parameters: {
        type: "object",
        properties: {
          tableId: { type: "number", description: "ID numérique de la table à libérer." },
        },
        required: ["tableId"],
      },
    },
  },
];

const TS_FIELD_REGEX = /^(?:startAt|endAt|placedAt|serviceTimeAt|generatedAt|timestamp)$/i;

function formatEpochMs(ms: number): string {
  const date = new Date(ms);
  const time = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const deltaSec = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(deltaSec);
  let relative: string;
  if (abs < 60) relative = `${deltaSec >= 0 ? "dans " : "il y a "}${abs}s`;
  else if (abs < 3600) relative = `${deltaSec >= 0 ? "dans " : "il y a "}${Math.round(abs / 60)} min`;
  else relative = `${deltaSec >= 0 ? "dans " : "il y a "}${(abs / 3600).toFixed(1)} h`;
  return `${time} (${relative})`;
}

function enrichTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(enrichTimestamps);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === "number" && v > 1e12 && TS_FIELD_REGEX.test(key)) {
        out[key] = v;
        out[`${key}Formatted`] = formatEpochMs(v);
      } else {
        out[key] = enrichTimestamps(v);
      }
    }
    return out;
  }
  return value;
}

function enrichJsonString(text: string): string {
  try {
    return JSON.stringify(enrichTimestamps(JSON.parse(text)));
  } catch {
    return text;
  }
}

async function callApi(path: string, init?: RequestInit): Promise<string> {
  const url = `${API}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`[chat-tools] ${init?.method ?? "GET"} ${url} → ${res.status}: ${text.slice(0, 200)}`);
      return JSON.stringify({ error: true, status: res.status, body: text });
    }
    return enrichJsonString(text || "{}");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[chat-tools] fetch failed ${url}: ${msg}`);
    return JSON.stringify({ error: true, message: `Backend inaccessible (${url}): ${msg}` });
  }
}

export async function executeTool(name: string, rawArgs: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return JSON.stringify({ error: true, message: "Arguments JSON invalides." });
  }

  switch (name) {
    case "get_tables":
      return callApi("/api/tables");
    case "get_gantt":
      return callApi("/api/cuisine/gantt");
    case "get_dishes":
      return callApi("/api/dishes");
    case "get_resources":
      return callApi("/api/resources");
    case "get_simulation_status":
      return callApi("/api/simulation/auto/status");
    case "place_order": {
      const tableId = typeof args.tableId === "number" ? args.tableId : null;
      const dishIds = Array.isArray(args.dishIds) ? args.dishIds.filter((d): d is number => typeof d === "number") : [];
      if (tableId === null || dishIds.length === 0) {
        return JSON.stringify({ error: true, message: "tableId numérique et dishIds non-vide requis." });
      }
      return callApi("/api/orders", {
        method: "POST",
        body: JSON.stringify({ tableId, dishIds }),
      });
    }
    case "release_table": {
      const tableId = typeof args.tableId === "number" ? args.tableId : null;
      if (tableId === null) {
        return JSON.stringify({ error: true, message: "tableId numérique requis." });
      }
      return callApi(`/api/tables/${tableId}/release`, { method: "POST" });
    }
    default:
      return JSON.stringify({ error: true, message: `Outil inconnu : ${name}` });
  }
}

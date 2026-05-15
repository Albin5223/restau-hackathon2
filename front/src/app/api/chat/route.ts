import { NextResponse } from "next/server";
import { TOOL_DEFS, executeTool } from "@/lib/chat-tools";

export const runtime = "nodejs";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MODEL = "mistral-small-latest";
const MAX_TOOL_ROUNDS = 6;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;

type DisabledReason = "no_key" | "auth_failed" | "quota_exceeded" | "rate_limited";

let disabledReason: DisabledReason | null = null;
let disabledUntil: number | null = null;

type IncomingMessage = { role: "user" | "assistant"; content: string };

type MistralToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type MistralMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: MistralToolCall[];
  tool_call_id?: string;
  name?: string;
};

type MistralChoice = {
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: MistralToolCall[];
  };
  finish_reason: string;
};

type MistralResponse = {
  choices: MistralChoice[];
};

class MistralHttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Mistral API ${status}: ${body.slice(0, 200)}`);
    this.name = "MistralHttpError";
    this.status = status;
    this.body = body;
  }
}

const SYSTEM_PROMPT = `Tu es l'assistant du jumeau numérique de restaurant "Restoptim".
Tu réponds en français, de façon concise et factuelle.

Tu disposes d'outils pour interroger l'état du restaurant et déclencher des actions :
- get_tables, get_gantt, get_dishes, get_resources, get_simulation_status : lecture seule, utilise-les avant de répondre à toute question chiffrée.
- place_order : passe une commande sur une table. Demande confirmation à l'utilisateur AVANT d'appeler cet outil si la consigne n'est pas explicite (ex. plat ambigu, table non précisée).
- release_table : libère une table. Demande confirmation si la table a un service en cours (status ≠ "libre").

Règles :
- N'invente pas de chiffres, de tables ou de plats : appelle les outils.
- Si la simulation automatique est active, indique que les commandes/libérations manuelles sont bloquées.
- Pour identifier un plat à partir d'un nom partiel, utilise get_dishes puis correspond sur le nom (insensible à la casse).
- Réponds en 1 à 3 phrases sauf si l'utilisateur demande un détail.

Formatage des dates et heures :
- Les outils renvoient des timestamps en millisecondes (\`startAt\`, \`endAt\`, \`placedAt\`, \`serviceTimeAt\`, \`generatedAt\`, \`timestamp\`).
- Pour CHACUN de ces champs, l'outil ajoute un champ \`<nom>Formatted\` au format "HH:mm:ss (dans X min)".
- N'AFFICHE JAMAIS les timestamps bruts en millisecondes dans tes réponses à l'utilisateur. Utilise toujours la version \`Formatted\`.
- Si un champ \`Formatted\` est absent, convertis toi-même en heure lisible (HH:mm) sans afficher le nombre brut.
- N'affiche pas non plus les IDs internes (orderId style "cmd_xxx") sauf si l'utilisateur les demande explicitement.`;

function checkAvailability(): { available: boolean; reason: DisabledReason | null } {
  if (!process.env.MISTRAL_API_KEY) {
    return { available: false, reason: "no_key" };
  }
  if (disabledReason !== null) {
    if (disabledUntil === null || Date.now() < disabledUntil) {
      return { available: false, reason: disabledReason };
    }
    disabledReason = null;
    disabledUntil = null;
  }
  return { available: true, reason: null };
}

function markDisabled(status: number) {
  if (status === 401 || status === 403) {
    disabledReason = "auth_failed";
    disabledUntil = null;
  } else if (status === 402) {
    disabledReason = "quota_exceeded";
    disabledUntil = null;
  } else if (status === 429) {
    disabledReason = "rate_limited";
    disabledUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  }
  if (disabledReason) {
    console.warn(`[chat] chatbot désactivé (${disabledReason}) — status ${status}`);
  }
}

function isValidIncomingMessages(value: unknown): value is IncomingMessage[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (m) =>
      m &&
      typeof m === "object" &&
      (m as { role?: unknown }).role !== undefined &&
      ((m as { role: string }).role === "user" || (m as { role: string }).role === "assistant") &&
      typeof (m as { content?: unknown }).content === "string",
  );
}

async function callMistral(apiKey: string, messages: MistralMessage[]): Promise<MistralChoice> {
  const res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOL_DEFS,
      tool_choice: "auto",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MistralHttpError(res.status, text);
  }

  const data = (await res.json()) as MistralResponse;
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Mistral API: réponse sans choix.");
  }
  return data.choices[0];
}

export async function GET() {
  const state = checkAvailability();
  return NextResponse.json({
    available: state.available,
    reason: state.reason,
    retryAt: disabledUntil,
  });
}

export async function POST(req: Request) {
  const availability = checkAvailability();
  if (!availability.available) {
    return NextResponse.json(
      { error: "Chatbot indisponible.", reason: availability.reason, available: false },
      { status: 503 },
    );
  }

  const apiKey = process.env.MISTRAL_API_KEY!;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const incoming = (body as { messages?: unknown })?.messages;
  if (!isValidIncomingMessages(incoming)) {
    return NextResponse.json(
      { error: "Format messages invalide. Attendu: [{role, content}]" },
      { status: 400 },
    );
  }

  const conversation: MistralMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...incoming.map<MistralMessage>((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const choice = await callMistral(apiKey, conversation);
      const assistantMsg = choice.message;
      const toolCalls = assistantMsg.tool_calls ?? [];

      if (toolCalls.length === 0) {
        return NextResponse.json({
          message: { role: "assistant", content: assistantMsg.content ?? "" },
        });
      }

      conversation.push({
        role: "assistant",
        content: assistantMsg.content,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        console.log(`[chat] tool call: ${call.function.name}(${call.function.arguments})`);
        const result = await executeTool(call.function.name, call.function.arguments);
        console.log(`[chat] tool result (${call.function.name}): ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`);
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }
    }

    return NextResponse.json(
      { error: `Limite d'itérations d'outils atteinte (${MAX_TOOL_ROUNDS}).` },
      { status: 504 },
    );
  } catch (e) {
    if (e instanceof MistralHttpError) {
      markDisabled(e.status);
      const state = checkAvailability();
      if (!state.available) {
        return NextResponse.json(
          { error: "Chatbot indisponible.", reason: state.reason, available: false },
          { status: 503 },
        );
      }
    }
    const msg = e instanceof Error ? e.message : "Erreur inconnue.";
    console.error("[chat] erreur:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { requireFarmer, AuthError } from "@/lib/auth/require-farmer";
import {
  getOrCreateConversation,
  appendMessage,
  logAgentRun,
} from "@/lib/db/repo";
import type {
  FarmerAgentRequest,
  FarmerAgentResponse,
  FarmerAgentReply,
  Language,
  ApiError,
} from "@/lib/ai/types";

/**
 * POST /api/farmer/agent — the farmer AI co-pilot entry point.
 *
 * Contract (see docs/api-contract.md):
 *   Request:  { message, sessionId, imageKey?, language? }
 *   Response: { conversationId, reply: { role, content, intent, data? } }
 *
 * PHASE 2 STATUS: PERSISTED, but the reply is still mock.
 * The conversation, both turns, and an agent_runs entry are now written to
 * Postgres, and `conversationId` is a real, re-fetchable row. The reply text
 * itself is still canned — the supervisor → pricing/advisory LangGraph
 * orchestration (Gemini→Groq→OpenAI fallback, Shamba Records tools) replaces
 * the generation step in Phase 3, writing richer agent_runs metadata
 * (graph_used, model_used, tool_calls) through the same log call.
 *
 * Persistence failures intentionally surface as 500 rather than being
 * swallowed: agent_runs is the refinement dataset, so silent loss is worse
 * than a failed request.
 */

/** Languages the contract supports. Mirrors the `Language` union. */
const SUPPORTED_LANGUAGES: readonly Language[] = ["en", "sw"] as const;

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Naive keyword heuristic standing in for the real supervisor intent router. */
function classifyIntent(message: string): "pricing" | "advisory" {
  const priceSignals = ["price", "worth", "sell", "rate", "bei", "kg", "kilo", "bag"];
  const lower = message.toLowerCase();
  return priceSignals.some((s) => lower.includes(s)) ? "pricing" : "advisory";
}

function mockPricingReply(language: Language): FarmerAgentReply {
  const content =
    language === "sw"
      ? "Kulingana na data ya hivi karibuni ya Soko la Gikomba, bei ya haki ya mahindi yako " +
        "ni takriban KES 50 kwa kilo (rejea ya jumla: KES 4,500 kwa gunia la kilo 90). " +
        "Bei zinapanda wiki hii."
      : "Based on recent Gikomba Market data, a fair rate for your maize is about " +
        "KES 50 per kg (wholesale reference: KES 4,500 per 90kg bag). Prices are trending up this week.";

  return {
    role: "assistant",
    intent: "pricing",
    content,
    data: {
      produce: "Maize",
      pricePerKg: 50,
      unit: "90kg bag",
      currency: "KES",
      market: "Gikomba Market",
      trend: "up",
    },
  };
}

function mockAdvisoryReply(language: Language): FarmerAgentReply {
  const content =
    language === "sw"
      ? "Kwa msimu ujao wa mvua fupi, maharagwe na sukuma wiki ni chaguo nzuri — hukomaa " +
        "haraka na mahitaji ni thabiti. Badilisha kutoka mahindi katika shamba hilo ili " +
        "kupunguza wadudu, na andaa udongo kwa mbolea ya samadi kabla ya kupanda."
      : "For the coming short-rains season, beans and sukuma wiki are good choices — " +
        "they mature quickly and demand is steady. Rotate away from maize on that plot " +
        "to reduce pest pressure, and prepare the soil with well-rotted manure before planting.";

  return {
    role: "assistant",
    intent: "advisory",
    content,
  };
}

export async function POST(
  request: Request,
): Promise<NextResponse<FarmerAgentResponse | ApiError>> {
  try {
    await requireFarmer();

    let body: Partial<FarmerAgentRequest>;
    try {
      body = (await request.json()) as Partial<FarmerAgentRequest>;
    } catch {
      return NextResponse.json(
        { error: { code: "invalid_json", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }

    const { message, sessionId } = body;
    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: { code: "missing_message", message: "A non-empty 'message' is required." } },
        { status: 400 },
      );
    }
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      return NextResponse.json(
        { error: { code: "missing_session", message: "A 'sessionId' is required." } },
        { status: 400 },
      );
    }
    if (body.language !== undefined && !isLanguage(body.language)) {
      return NextResponse.json(
        {
          error: {
            code: "unsupported_language",
            message: `Unsupported 'language'. Supported: ${SUPPORTED_LANGUAGES.join(", ")}.`,
          },
        },
        { status: 400 },
      );
    }
    const language: Language = body.language ?? "en";
    const imageKey = typeof body.imageKey === "string" ? body.imageKey : undefined;

    // One conversation per sessionId; repeat calls append to the same thread.
    const conversation = await getOrCreateConversation(sessionId, language);

    await appendMessage({
      conversationId: conversation.id,
      role: "user",
      content: message,
      imageKey,
    });

    // TODO(Phase 3): replace this block with the supervisor graph run and
    // record graph_used / model_used / tool_calls on the agent run below.
    const startedAt = Date.now();
    const intent = classifyIntent(message);
    const reply =
      intent === "pricing" ? mockPricingReply(language) : mockAdvisoryReply(language);
    const latencyMs = Date.now() - startedAt;

    const assistantMessageId = await appendMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: reply.content,
      data: reply.data,
    });

    await logAgentRun({
      conversationId: conversation.id,
      messageId: assistantMessageId,
      intent,
      structuredOutput: reply.data,
      latencyMs,
    });

    return NextResponse.json(
      { conversationId: conversation.id, reply },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Agent failed to respond." } },
      { status: 500 },
    );
  }
}

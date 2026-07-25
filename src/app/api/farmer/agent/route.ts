import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireFarmer, AuthError } from "@/lib/auth/require-farmer";
import type {
  FarmerAgentRequest,
  FarmerAgentResponse,
  FarmerAgentReply,
  ApiError,
} from "@/lib/ai/types";

/**
 * POST /api/farmer/agent — the farmer AI co-pilot entry point.
 *
 * Contract (see docs/api-contract.md):
 *   Request:  { message, sessionId, imageKey?, language? }
 *   Response: { conversationId, reply: { role, content, intent, data? } }
 *
 * PHASE 1 STATUS: STUBBED. Returns well-shaped mock pricing/advisory replies
 * so the Android team can build against the contract. The real supervisor →
 * pricing/advisory LangGraph orchestration (Gemini→Groq→OpenAI fallback,
 * Shamba Records tools) replaces this body in Phase 3.
 */

/** Naive keyword heuristic standing in for the real supervisor intent router. */
function classifyIntent(message: string): "pricing" | "advisory" {
  const priceSignals = ["price", "worth", "sell", "rate", "bei", "kg", "kilo", "bag"];
  const lower = message.toLowerCase();
  return priceSignals.some((s) => lower.includes(s)) ? "pricing" : "advisory";
}

function mockPricingReply(): FarmerAgentReply {
  return {
    role: "assistant",
    intent: "pricing",
    content:
      "Based on recent Gikomba Market data, a fair rate for your maize is about " +
      "KES 50 per kg (wholesale reference: KES 4,500 per 90kg bag). Prices are trending up this week.",
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

function mockAdvisoryReply(): FarmerAgentReply {
  return {
    role: "assistant",
    intent: "advisory",
    content:
      "For the coming short-rains season, beans and sukuma wiki are good choices — " +
      "they mature quickly and demand is steady. Rotate away from maize on that plot " +
      "to reduce pest pressure, and prepare the soil with well-rotted manure before planting.",
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

    // TODO(Phase 3): run the supervisor graph; TODO(Phase 2): persist the
    // conversation + messages and log the run to agent_runs.
    const intent = classifyIntent(message);
    const reply = intent === "pricing" ? mockPricingReply() : mockAdvisoryReply();

    return NextResponse.json(
      { conversationId: randomUUID(), reply },
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

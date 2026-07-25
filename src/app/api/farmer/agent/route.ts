import { NextResponse } from "next/server";
import { requireFarmer, AuthError } from "@/lib/auth/require-farmer";
import {
  getOrCreateConversation,
  appendMessage,
  logAgentRun,
} from "@/lib/db/repo";
import { runSupervisor } from "@/lib/ai/graphs/supervisor";
import type {
  FarmerAgentRequest,
  FarmerAgentResponse,
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
 * PHASE 3 STATUS: REAL. The supervisor agent classifies intent and routes to
 * the pricing graph (Shamba Records + LLM) or an advisory LLM reply, with a
 * heuristic fallback when the AI is unavailable. Both turns and a fully
 * populated agent_runs row (graph_used, model_used, tool_calls) are persisted.
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

    // Run the supervisor agent (intent → pricing graph or advisory LLM).
    const startedAt = Date.now();
    const result = await runSupervisor(message, language);
    const latencyMs = Date.now() - startedAt;
    const reply = result.reply;

    const assistantMessageId = await appendMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: reply.content,
      data: reply.data,
    });

    await logAgentRun({
      conversationId: conversation.id,
      messageId: assistantMessageId,
      intent: result.intent,
      graphUsed: result.intent,
      modelUsed: result.model ?? result.source,
      toolCalls: result.toolCalls.length ? result.toolCalls : undefined,
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

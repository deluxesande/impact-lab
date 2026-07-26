import { NextResponse } from "next/server";
import { requireFarmer, AuthError } from "@/lib/auth/require-farmer";
import {
  getOrCreateConversation,
  appendMessage,
  logAgentRun,
} from "@/lib/db/repo";
import { runSupervisor } from "@/lib/ai/graphs/supervisor";
import { withTimeout, AI_TIMEOUTS, TimeoutError } from "@/lib/ai/timeout";
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

/** Upper bound on a farmer message, to bound token cost and flooding. */
const MAX_MESSAGE_LENGTH = 2000;

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
    // Cap message length: an oversized message inflates token cost and is a
    // vector for prompt-flooding. 2000 chars is ample for a farmer's question.
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: {
            code: "message_too_long",
            message: `'message' must be at most ${MAX_MESSAGE_LENGTH} characters.`,
          },
        },
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

    // Run the supervisor agent (intent → pricing graph or advisory LLM), under
    // an overall budget. A timeout degrades to a graceful reply rather than a
    // 500 — the farmer always gets an answer, and the run is still logged.
    // Attach late-completion observers so the result is still observable even
    // after the timeout path is taken.
    const startedAt = Date.now();
    const supervisorPromise = runSupervisor(message, language);
    supervisorPromise.then(
      (lateResult) => {
        console.warn("[agent] supervisor completed after timeout", {
          latencyMs: Date.now() - startedAt,
          source: lateResult.source,
        });
      },
      (lateError) => {
        console.warn("[agent] supervisor failed after timeout", {
          error: String(lateError).slice(0, 200),
        });
      },
    );
    let result;
    try {
      result = await withTimeout(
        supervisorPromise,
        AI_TIMEOUTS.agent,
        "agent",
      );
    } catch (err) {
      if (err instanceof TimeoutError) {
        result = {
          intent: "advisory" as const,
          source: "timeout",
          model: undefined,
          toolCalls: [{ error: "agent budget exceeded" }],
          reply: {
            role: "assistant" as const,
            intent: "advisory" as const,
            content:
              language === "sw"
                ? "Samahani, imechukua muda mrefu kujibu. Tafadhali jaribu tena."
                : "Sorry, that took too long to answer. Please try again.",
          },
        };
      } else {
        throw err;
      }
    }
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

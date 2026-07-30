import { runSupervisor, type SupervisorResult } from "@/lib/ai/graphs/supervisor";
import { withTimeout, AI_TIMEOUTS, TimeoutError } from "@/lib/ai/timeout";
import type { Language } from "@/lib/ai/types";

/**
 * Run the supervisor agent under the overall agent budget.
 *
 * Shared by POST /api/farmer/agent (Android contract) and the web
 * `askAdvisorAction` Server Action, which previously carried byte-identical
 * copies of this timeout/fallback dance. Consolidating it keeps the degrade
 * behaviour — and the `logAgentRun` payload derived from `result` — in lockstep
 * across both callers.
 *
 * On timeout the returned promise does NOT reject: it degrades to a graceful,
 * bilingual `source: "timeout"` reply so the farmer always gets an answer and
 * the turn is still logged. Late-completion observers attach only on the timeout
 * branch (so fast-path calls skip the console.warn overhead) and, crucially,
 * observe the abandoned promise so a later settlement can't surface as an
 * unhandled rejection. Any non-timeout error is re-thrown for the caller's own
 * error handling.
 */
export async function runSupervisorWithBudget(
  message: string,
  language: Language,
): Promise<{ result: SupervisorResult; latencyMs: number }> {
  const startedAt = Date.now();
  const supervisorPromise = runSupervisor(message, language);

  try {
    const result = await withTimeout(supervisorPromise, AI_TIMEOUTS.agent, "agent");
    return { result, latencyMs: Date.now() - startedAt };
  } catch (err) {
    if (!(err instanceof TimeoutError)) throw err;

    // The abandoned run may still settle; observe it so it can't become an
    // unhandled rejection, and log its eventual outcome for latency insight.
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

    const result: SupervisorResult = {
      intent: "advisory",
      source: "timeout",
      model: undefined,
      toolCalls: [{ error: "agent budget exceeded" }],
      reply: {
        role: "assistant",
        intent: "advisory",
        content:
          language === "sw"
            ? "Samahani, imechukua muda mrefu kujibu. Tafadhali jaribu tena."
            : "Sorry, that took too long to answer. Please try again.",
      },
    };
    return { result, latencyMs: Date.now() - startedAt };
  }
}

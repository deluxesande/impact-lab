/**
 * Optional `_debug` block for AI responses.
 *
 * Only emitted outside production AND when AUTH_DEV_BYPASS=1 — i.e. the same
 * local/CI context where identity comes from headers. This lets you see which
 * path an AI call took (shamba+llm | llm | heuristic) and which model won,
 * without leaking internals in production responses.
 */

export interface AiDebug {
  source: string;
  model?: string;
  toolCalls?: unknown;
}

export function debugEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "1";
}

/** Attach a `_debug` field to a response body when debugging is enabled. */
export function withDebug<T extends object>(body: T, debug: AiDebug): T & { _debug?: AiDebug } {
  return debugEnabled() ? { ...body, _debug: debug } : body;
}

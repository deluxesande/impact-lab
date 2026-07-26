/**
 * Deadline helpers for the AI layer.
 *
 * The single biggest reliability risk in the agent is an upstream call (a model
 * provider or Shamba) hanging indefinitely and freezing the whole request. Every
 * external call is wrapped so a stall becomes a fast, catchable failure that the
 * fallback logic can move past.
 */

export class TimeoutError extends Error {
  constructor(public readonly label: string, public readonly ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** Default budgets (ms). Overridable via env for slow demo environments. */
export const AI_TIMEOUTS = {
  model: Number(process.env.AI_MODEL_TIMEOUT_MS ?? 8000),
  shamba: Number(process.env.AI_SHAMBA_TIMEOUT_MS ?? 5000),
  /** Whole-agent budget, enforced by the route/supervisor. Exceeds worst-case serialized pricing + provider-retry paths. */
  agent: Number(process.env.AI_AGENT_TIMEOUT_MS ?? 30000),
} as const;

/**
 * Race a promise against a timeout.
 *
 * On timeout the returned promise rejects with a TimeoutError; the underlying
 * work is NOT cancelled (JS promises aren't cancellable), it's just abandoned.
 * If `signal` is provided it's aborted on timeout so fetch-based callers can
 * actually stop the network request.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  signal?: AbortController,
): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.abort();
      reject(new TimeoutError(label, ms));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** A monotonic deadline: create once, check `remaining()`/`expired()` as you go. */
export class Deadline {
  private readonly end: number;
  constructor(budgetMs: number) {
    this.end = Date.now() + budgetMs;
  }
  remaining(): number {
    return Math.max(0, this.end - Date.now());
  }
  expired(): boolean {
    return this.remaining() <= 0;
  }
  /** Clamp a per-call timeout to what's left in the overall budget. */
  clamp(perCallMs: number): number {
    return Math.max(1, Math.min(perCallMs, this.remaining()));
  }
}

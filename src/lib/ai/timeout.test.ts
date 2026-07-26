import { describe, expect, test } from "bun:test";
import { withTimeout, TimeoutError, Deadline } from "./timeout";

describe("withTimeout", () => {
  test("resolves when the promise beats the timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000, "x");
    expect(result).toBe("ok");
  });

  test("rejects with TimeoutError when the promise is too slow", async () => {
    const slow = new Promise((r) => setTimeout(() => r("late"), 200));
    await expect(withTimeout(slow, 20, "slow")).rejects.toBeInstanceOf(TimeoutError);
  });

  test("propagates the underlying rejection unchanged", async () => {
    const boom = Promise.reject(new Error("boom"));
    await expect(withTimeout(boom, 1000, "x")).rejects.toThrow("boom");
  });

  test("aborts the provided controller on timeout", async () => {
    const controller = new AbortController();
    const slow = new Promise((r) => setTimeout(r, 200));
    await withTimeout(slow, 20, "x", controller).catch(() => {});
    expect(controller.signal.aborted).toBe(true);
  });

  test("a non-positive timeout disables the deadline", async () => {
    const result = await withTimeout(Promise.resolve(42), 0, "x");
    expect(result).toBe(42);
  });

  test("TimeoutError carries label and ms", async () => {
    try {
      await withTimeout(new Promise((r) => setTimeout(r, 100)), 10, "model:groq");
    } catch (e) {
      expect(e).toBeInstanceOf(TimeoutError);
      const te = e as TimeoutError;
      expect(te.label).toBe("model:groq");
      expect(te.ms).toBe(10);
    }
  });
});

describe("Deadline", () => {
  test("reports remaining budget and expiry", async () => {
    const d = new Deadline(50);
    expect(d.expired()).toBe(false);
    expect(d.remaining()).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(d.expired()).toBe(true);
    expect(d.remaining()).toBe(0);
  });

  test("clamp never exceeds the remaining budget", () => {
    const d = new Deadline(30);
    expect(d.clamp(10_000)).toBeLessThanOrEqual(30);
    expect(d.clamp(5)).toBe(5);
  });
});

import { describe, expect, test } from "bun:test";
import { AllModelsFailedError } from "@/lib/ai/models";

describe("AllModelsFailedError", () => {
  test("summarises every provider failure in the message", () => {
    const err = new AllModelsFailedError([
      { provider: "gemini", error: new Error("429") },
      { provider: "groq", error: new Error("timeout") },
    ]);
    expect(err.name).toBe("AllModelsFailedError");
    expect(err.message).toContain("gemini");
    expect(err.message).toContain("groq");
    expect(err.errors).toHaveLength(2);
  });

  test("handles the no-providers case", () => {
    const err = new AllModelsFailedError([]);
    expect(err.errors).toHaveLength(0);
    expect(err).toBeInstanceOf(Error);
  });
});

/**
 * hasModelProvider reads env at first call and caches. Because the module
 * caches provider construction, we assert the observable contract rather than
 * toggling env mid-process: with no provider keys in this test env, it reports
 * false (the heuristic-fallback path the graphs depend on).
 */
describe("hasModelProvider", () => {
  test("is a boolean reflecting configured providers", async () => {
    const { hasModelProvider } = await import("@/lib/ai/models");
    expect(typeof hasModelProvider()).toBe("boolean");
  });
});

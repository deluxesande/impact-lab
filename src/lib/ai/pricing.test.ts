import { describe, expect, test } from "bun:test";
import { recommendPrice, normalizeProduce, canonicalProduce } from "@/lib/ai/pricing";

describe("normalizeProduce", () => {
  test("trims and lowercases", () => {
    expect(normalizeProduce("  Tomatoes ")).toBe("tomatoes");
  });
});

describe("canonicalProduce", () => {
  test("maps irregular plurals via the alias map", () => {
    expect(canonicalProduce("Tomatoes")).toBe("tomato");
    expect(canonicalProduce("onions")).toBe("onion");
    expect(canonicalProduce("potatoes")).toBe("potato");
  });

  test("maps sukuma variants", () => {
    expect(canonicalProduce("sukuma wiki")).toBe("sukuma");
    expect(canonicalProduce("sukuma-wiki")).toBe("sukuma");
  });

  test("singular and plural resolve to the same key", () => {
    expect(canonicalProduce("tomato")).toBe(canonicalProduce("tomatoes"));
    expect(canonicalProduce("bean")).toBe(canonicalProduce("beans"));
  });

  test("passes through an unknown produce normalized", () => {
    expect(canonicalProduce("Managu")).toBe("managu");
  });

  test("does not return inherited prototype values", () => {
    for (const key of ["constructor", "__proto__", "toString", "valueOf", "prototype"]) {
      const result = canonicalProduce(key);
      expect(typeof result).toBe("string");
      expect(result).not.toContain("function");
      expect(result).not.toContain("Object");
    }
  });
});

describe("recommendPrice", () => {
  test("returns a known rate for a canonical produce", () => {
    const p = recommendPrice({ produceType: "maize" });
    expect(p.pricePerKg).toBe(50);
    expect(p.currency).toBe("KES");
    expect(p.unit).toBe("kg");
  });

  test("resolves plural aliases to the same rate as the singular", () => {
    expect(recommendPrice({ produceType: "tomatoes" }).pricePerKg).toBe(
      recommendPrice({ produceType: "tomato" }).pricePerKg,
    );
    expect(recommendPrice({ produceType: "onions" }).pricePerKg).toBe(
      recommendPrice({ produceType: "onion" }).pricePerKg,
    );
    expect(recommendPrice({ produceType: "potatoes" }).pricePerKg).toBe(
      recommendPrice({ produceType: "potato" }).pricePerKg,
    );
  });

  test("resolves the multi-word 'sukuma wiki' alias", () => {
    expect(recommendPrice({ produceType: "sukuma wiki" }).pricePerKg).toBe(
      recommendPrice({ produceType: "sukuma" }).pricePerKg,
    );
  });

  test("falls back to a default rate for unknown produce", () => {
    const p = recommendPrice({ produceType: "dragonfruit" });
    expect(p.pricePerKg).toBe(55);
    expect(p.trend).toBe("stable");
  });

  test("uses the region in the market label when provided", () => {
    expect(recommendPrice({ produceType: "maize", region: "Kisumu" }).market).toContain("Kisumu");
    expect(recommendPrice({ produceType: "maize" }).market).toBe("Nairobi market");
  });

  test("is case-insensitive on the produce name", () => {
    expect(recommendPrice({ produceType: "MAIZE" }).pricePerKg).toBe(50);
  });
});

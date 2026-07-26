import { describe, expect, test } from "bun:test";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  test("accepts a valid v4 uuid", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  test.each([
    "not-a-uuid",
    "",
    "550e8400e29b41d4a716446655440000", // no hyphens
    "550e8400-e29b-41d4-a716", // too short
    "zzzz8400-e29b-41d4-a716-446655440000", // non-hex
  ])("rejects malformed input %p", (bad) => {
    expect(isUuid(bad)).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { buildSignatureString, computeSignature } from "./shamba-client";

/**
 * These lock the HMAC signing to the format the Shamba API documents:
 *   METHOD\nPATH\nQUERY\nTIMESTAMP\nBODY
 * A regression here silently breaks every request with AUTH_INVALID_SIGNATURE.
 */
describe("Shamba signature string", () => {
  test("GET: five newline-joined parts, empty body", () => {
    const s = buildSignatureString("GET", "/api/v1/prices/latest", "product=maize", "1706000000", "");
    expect(s).toBe("GET\n/api/v1/prices/latest\nproduct=maize\n1706000000\n");
    expect(s.split("\n")).toHaveLength(5);
  });

  test("POST: empty query is preserved as an empty line", () => {
    const body = '{"limit":5}';
    const s = buildSignatureString("POST", "/api/v1/prices/latest", "", "1706000000", body);
    expect(s.split("\n")).toHaveLength(5);
    expect(s.split("\n")[2]).toBe(""); // QUERY line empty
    expect(s.split("\n")[4]).toBe(body); // BODY line intact
  });

  test("method is uppercased", () => {
    const s = buildSignatureString("post", "/x", "", "1", "");
    expect(s.startsWith("POST\n")).toBe(true);
  });

  test("computeSignature matches a direct HMAC-SHA256 hex digest", () => {
    const secret = "sr_sec_test";
    const s = buildSignatureString("GET", "/api/v1/markets", "", "1706000000", "");
    const expected = createHmac("sha256", secret).update(s).digest("hex");
    expect(computeSignature(secret, s)).toBe(expected);
  });

  test("different secrets produce different signatures", () => {
    const s = buildSignatureString("GET", "/x", "", "1", "");
    expect(computeSignature("a", s)).not.toBe(computeSignature("b", s));
  });
});

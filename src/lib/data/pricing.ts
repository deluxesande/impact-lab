import { headers } from "next/headers";
import type { FarmerAgentResponse } from "@/lib/ai/types";
import { produceBySlug } from "./produce";
import type { PriceSuggestion } from "./types";

/**
 * Price suggestion for a farmer's listing.
 *
 * Calls the backend's real `POST /api/farmer/agent` rather than duplicating an AI
 * surface — see docs/frontend-discovery.md §5.1. That endpoint already routes
 * pricing intent and returns structured `PricingData`.
 *
 * ⚠️ **The agent is a Phase 1 stub and always answers "Maize, KES 50 / kg"**
 * regardless of the produce asked about (`mockPricingReply` in
 * `src/app/api/farmer/agent/route.ts`). Taken at face value, a farmer listing
 * tomatoes would be told their crop is maize worth 50 — visibly wrong on stage.
 *
 * So we verify the reply is *about the produce we asked about* and fall back to
 * the catalogue's reference price when it isn't. Either way the UI shows which
 * source was used; we never present a reference price as an AI answer. When the
 * backend's real pricing graph lands in Phase 3 the reply will match and this
 * path becomes a no-op.
 */

/** Absolute base URL for server-side fetches back into this app. */
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  // `x-forwarded-proto` is set behind a proxy; localhost is plain http.
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function suggestPrice(input: {
  produceSlug: string;
  quantityKg: number;
  language?: "en" | "sw";
  sessionId: string;
}): Promise<PriceSuggestion> {
  const produce = produceBySlug(input.produceSlug);
  if (!produce) throw new Error(`Unknown produce: ${input.produceSlug}`);

  const fallback: PriceSuggestion = {
    pricePerKg: produce.referencePricePerKg,
    source: "reference",
  };

  try {
    const res = await fetch(`${await baseUrl()}/api/farmer/agent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // Phrased to hit the agent's pricing keywords ("kg", "worth").
        message: `I have ${input.quantityKg}kg of ${produce.name}. What is it worth per kg?`,
        sessionId: input.sessionId,
        language: input.language ?? "en",
      }),
      cache: "no-store",
    });

    if (!res.ok) return fallback;

    const data = (await res.json()) as FarmerAgentResponse;
    const reply = data?.reply;
    const priced = reply?.data;

    if (reply?.intent !== "pricing" || typeof priced?.pricePerKg !== "number") {
      return fallback;
    }

    // Guard against the stub's fixed "Maize" answer. Only trust a price that is
    // explicitly about the produce we asked about.
    const answered = priced.produce?.trim().toLowerCase();
    const asked = produce.name.toLowerCase();
    if (answered && answered !== asked) return fallback;

    return {
      pricePerKg: Math.round(priced.pricePerKg),
      source: "agent",
      rationale: reply.content,
      market: priced.market,
      trend: priced.trend,
    };
  } catch {
    // Network/JSON failure — the farmer still gets a usable price.
    return fallback;
  }
}

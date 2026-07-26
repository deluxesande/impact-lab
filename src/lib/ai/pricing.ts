import type { PriceRequest, PricingData } from "./types";

/**
 * Fair-price recommendation.
 *
 * PHASE 3b STATUS: MOCK. Returns a plausible KES/kg rate per produce so the
 * marketplace endpoints (listing, cart, /api/ai/price) are fully wireable. The
 * real implementation swaps this body for the LangGraph pricing graph
 * (Shamba Records market data + Gemini→Groq→OpenAI fallback) behind the same
 * signature — callers won't change.
 */

/** One canonical rate per produce, keyed by a canonical normalized name. */
const MOCK_RATES: Record<string, { pricePerKg: number; trend: PricingData["trend"] }> = {
  maize: { pricePerKg: 50, trend: "up" },
  tomato: { pricePerKg: 45, trend: "up" },
  sukuma: { pricePerKg: 30, trend: "stable" },
  kale: { pricePerKg: 30, trend: "stable" },
  onion: { pricePerKg: 60, trend: "down" },
  cabbage: { pricePerKg: 25, trend: "stable" },
  beans: { pricePerKg: 120, trend: "up" },
  potato: { pricePerKg: 40, trend: "stable" },
};

/** Map plural/variant produce names onto their canonical key. */
const PRODUCE_ALIASES: Record<string, string> = {
  tomatoes: "tomato",
  onions: "onion",
  potatoes: "potato",
  "sukuma wiki": "sukuma",
  "sukuma-wiki": "sukuma",
};

const DEFAULT_RATE = { pricePerKg: 55, trend: "stable" as const };

export function normalizeProduce(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Canonical produce key: normalized, then resolved through the alias map, then
 * a naive regular-plural stem as a last resort. This is the one place produce
 * names are reconciled, so pricing and cart matching agree on identity
 * (e.g. "Tomatoes", "tomato", "tomatoes" all → "tomato").
 */
export function canonicalProduce(name: string): string {
  const normalized = normalizeProduce(name);
  if (PRODUCE_ALIASES[normalized]) return PRODUCE_ALIASES[normalized];
  // Regular plural fallback ("mangoes" → "mango" won't work, but "beans" → "bean").
  const stem = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
  return PRODUCE_ALIASES[stem] ?? stem;
}

/** Recommend a fair price for a produce type. */
export function recommendPrice(req: PriceRequest): PricingData {
  const key = canonicalProduce(req.produceType);
  const match = MOCK_RATES[key] ?? DEFAULT_RATE;
  return {
    produce: key,
    pricePerKg: match.pricePerKg,
    unit: "kg",
    currency: "KES",
    market: req.region ? `${req.region} market` : "Nairobi market",
    trend: match.trend,
  };
}

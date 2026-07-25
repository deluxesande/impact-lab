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

/** Indicative KES/kg farm-gate rates, keyed by normalized produce name. */
const MOCK_RATES: Record<string, { pricePerKg: number; trend: PricingData["trend"] }> = {
  maize: { pricePerKg: 50, trend: "up" },
  tomatoes: { pricePerKg: 45, trend: "up" },
  tomato: { pricePerKg: 45, trend: "up" },
  sukuma: { pricePerKg: 30, trend: "stable" },
  "sukuma wiki": { pricePerKg: 30, trend: "stable" },
  kale: { pricePerKg: 30, trend: "stable" },
  onions: { pricePerKg: 60, trend: "down" },
  onion: { pricePerKg: 60, trend: "down" },
  cabbage: { pricePerKg: 25, trend: "stable" },
  beans: { pricePerKg: 120, trend: "up" },
  potatoes: { pricePerKg: 40, trend: "stable" },
  potato: { pricePerKg: 40, trend: "stable" },
};

const DEFAULT_RATE = { pricePerKg: 55, trend: "stable" as const };

export function normalizeProduce(name: string): string {
  return name.trim().toLowerCase();
}

/** Recommend a fair price for a produce type. */
export function recommendPrice(req: PriceRequest): PricingData {
  const key = normalizeProduce(req.produceType);
  const match = MOCK_RATES[key] ?? DEFAULT_RATE;
  return {
    produce: req.produceType.trim(),
    pricePerKg: match.pricePerKg,
    unit: "kg",
    currency: "KES",
    market: req.region ? `${req.region} market` : "Nairobi market",
    trend: match.trend,
  };
}

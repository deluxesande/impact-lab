import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { recommendPrice } from "@/lib/ai/pricing";
import { PriceReasoningSchema } from "@/lib/ai/schemas";
import { invokeStructured, hasModelProvider } from "@/lib/ai/models";
import {
  isShambaConfigured,
  searchProducts,
  getLatestPrices,
  type ShambaPrice,
} from "@/lib/ai/shamba-client";
import type { PriceRequest, PricingData } from "@/lib/ai/types";

/**
 * Pricing graph: produce a fair KES/kg price, grounded in real market data.
 *
 * Pipeline:
 *   1. resolve  — Shamba products/search → product UUID
 *   2. fetch    — Shamba prices/latest for that product
 *   3. reason   — LLM turns market prices into a fair farm-gate rate
 *
 * Every step degrades gracefully: if Shamba is unconfigured/returns nothing, or
 * no model provider is available, or the LLM fails, we fall back to the
 * deterministic heuristic (recommendPrice). The returned `source` records which
 * path ran, for the agent_runs refinement log.
 */

export interface PricingGraphResult {
  data: PricingData;
  /** 'shamba+llm' | 'llm' | 'heuristic' — how the price was derived. */
  source: string;
  /** Which model provider produced it, when an LLM ran. */
  model?: string;
  /** Compact record of tool calls for observability. */
  toolCalls: unknown[];
}

/** Convert a Shamba price row to an approximate per-kg figure. */
function toPerKg(p: ShambaPrice): number | null {
  const unit = (p.unit ?? "").toLowerCase();
  const kgMatch = unit.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) {
    const kg = Number(kgMatch[1]);
    if (kg > 0) return p.price / kg;
  }
  if (unit.includes("kg")) return p.price; // "kg" / "per kg"
  return null; // unknown unit — skip for per-kg reasoning
}

export async function runPricingGraph(req: PriceRequest): Promise<PricingGraphResult> {
  const heuristic = recommendPrice(req);
  const toolCalls: unknown[] = [];

  // No AI available at all → heuristic.
  if (!hasModelProvider()) {
    return { data: heuristic, source: "heuristic", toolCalls };
  }

  // 1 + 2: gather market context from Shamba, if configured. Treated as
  // best-effort ENRICHMENT — any failure (rate limit, no UUID, timeout) simply
  // leaves marketLines empty and the LLM reasons from general knowledge.
  let marketLines: string[] = [];
  if (isShambaConfigured()) {
    try {
      const products = await searchProducts(req.produceType);
      toolCalls.push({ tool: "searchProducts", query: req.produceType, count: products.length });

      // The API's product search does not always return a UUID; without one we
      // cannot fetch prices, so skip that call rather than sending [undefined].
      const match = products.find((p) => typeof p.uuid === "string" && p.uuid.length > 0);
      if (match) {
        const prices = await getLatestPrices([match.uuid], undefined, 5);
        toolCalls.push({ tool: "getLatestPrices", product: match.name, count: prices.length });
        marketLines = prices
          .map((p) => {
            const perKg = toPerKg(p);
            const where = p.market?.name ?? p.county?.name ?? "market";
            const name = p.product?.name ?? match.name;
            const when = p.recorded_at ? p.recorded_at.slice(0, 10) : "recent";
            return perKg
              ? `${name} at ${where}: ~KES ${perKg.toFixed(1)}/kg (${p.unit}), ${when}`
              : `${name} at ${where}: KES ${p.price} per ${p.unit}, ${when}`;
          })
          .filter(Boolean);
      } else if (products.length > 0) {
        toolCalls.push({ tool: "getLatestPrices", skipped: "no product uuid in search results" });
      }
    } catch (err) {
      toolCalls.push({ tool: "shamba", error: String(err).slice(0, 160) });
      // fall through — reason without market data or hit heuristic below
    }
  }

  // 3: reason to a structured price.
  try {
    const system = new SystemMessage(
      "You are an agricultural pricing assistant for Kenyan farmers. Recommend a FAIR farm-gate " +
        "price per kilogram in KES that protects the farmer from broker exploitation. Base it on the " +
        "market data provided when available; otherwise use reasonable Kenyan market knowledge. " +
        "Return only the structured fields.",
    );
    const dataBlock = marketLines.length
      ? `Recent market data:\n${marketLines.join("\n")}`
      : "No live market data available; use typical Kenyan farm-gate levels.";
    const human = new HumanMessage(
      `Produce: ${req.produceType}\nRegion: ${req.region ?? "Kenya (national)"}\n${dataBlock}`,
    );

    const { data, provider } = await invokeStructured(PriceReasoningSchema, [system, human], { runName: "pricing.reason", tags: ["graph:pricing"] });

    return {
      data: {
        produce: req.produceType.trim(),
        pricePerKg: Math.round(data.pricePerKg * 100) / 100,
        unit: "kg",
        currency: "KES",
        market: req.region ? `${req.region} market` : marketLines.length ? "Shamba market data" : "Kenya (est.)",
        trend: data.trend,
      },
      source: marketLines.length ? "shamba+llm" : "llm",
      model: provider,
      toolCalls,
    };
  } catch (err) {
    toolCalls.push({ step: "reason", error: String(err).slice(0, 160) });
    return { data: heuristic, source: "heuristic", toolCalls };
  }
}

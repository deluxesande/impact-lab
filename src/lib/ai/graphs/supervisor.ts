import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { IntentSchema } from "@/lib/ai/schemas";
import { invokeStructured, invokeText, hasModelProvider } from "@/lib/ai/models";
import { runPricingGraph } from "@/lib/ai/graphs/pricing";
import { canonicalProduce } from "@/lib/ai/pricing";
import type { FarmerAgentReply, Language, PricingData } from "@/lib/ai/types";

/**
 * Supervisor agent for /api/farmer/agent.
 *
 * Classifies the farmer's message, then routes:
 *   pricing  → pricing graph, phrased conversationally (+ structured data)
 *   advisory → LLM answers a farming question from general knowledge
 *
 * Falls back to a keyword classifier + templated reply when no model provider
 * is configured, so the endpoint always responds.
 */

export interface SupervisorResult {
  reply: FarmerAgentReply;
  intent: "pricing" | "advisory";
  source: string;
  model?: string;
  toolCalls: unknown[];
}

function keywordIntent(message: string): "pricing" | "advisory" {
  const signals = ["price", "worth", "sell", "rate", "bei", "kg", "kilo", "bag"];
  const lower = message.toLowerCase();
  return signals.some((s) => lower.includes(s)) ? "pricing" : "advisory";
}

function langInstruction(language: Language): string {
  return language === "sw" ? " Respond in Swahili (Kiswahili)." : "";
}

/** Extract a produce name from a pricing message; fallback to the whole message. */
function produceFrom(message: string): string {
  const m = message.match(/\b(maize|tomato(?:es)?|sukuma|kale|onion(?:s)?|cabbage|beans?|potato(?:es)?)\b/i);
  return m ? m[1] : message.trim();
}

export async function runSupervisor(
  message: string,
  language: Language = "en",
): Promise<SupervisorResult> {
  const toolCalls: unknown[] = [];

  // No LLM available: still answer pricing from the heuristic (it needs no
  // model), and give a graceful message for advisory (which does need one).
  if (!hasModelProvider()) {
    const intent = keywordIntent(message);
    if (intent === "pricing") {
      const priced = await runPricingGraph({ produceType: produceFrom(message) });
      return {
        intent,
        source: priced.source,
        toolCalls: priced.toolCalls,
        reply: {
          role: "assistant",
          intent,
          content: defaultPricingText(priced.data, language),
          data: priced.data,
        },
      };
    }
    return {
      intent,
      source: "heuristic",
      toolCalls,
      reply: {
        role: "assistant",
        intent,
        content:
          "I can help with farming advice, but the assistant is offline right now. Please try again shortly.",
      },
    };
  }

  // Classify intent AND extract the produce in one call.
  let intent: "pricing" | "advisory";
  let produce: string | null = null;
  let model: string | undefined;
  try {
    const cls = await invokeStructured(
      IntentSchema,
      [
        new SystemMessage(
          "Classify the farmer's message intent and, for pricing, extract the produce being priced.",
        ),
        new HumanMessage(message),
      ],
      { runName: "supervisor.classify", tags: ["graph:supervisor"] },
    );
    intent = cls.data.intent;
    produce = cls.data.produce;
    model = cls.provider;
  } catch {
    intent = keywordIntent(message);
  }

  if (intent === "pricing") {
    // Prefer the LLM-extracted produce; fall back to a keyword scan of the
    // message, then the raw message as a last resort.
    const canonical = produce?.trim() ? canonicalProduce(produce.trim()) : null;
    const produceType = canonical || produceFrom(message);
    const priced = await runPricingGraph({ produceType });
    toolCalls.push(...priced.toolCalls);
    const data: PricingData = priced.data;
    const phrased = await phrasePricing(data, language).catch(() => defaultPricingText(data, language));
    return {
      intent,
      source: priced.source,
      model: priced.model ?? model,
      toolCalls,
      reply: { role: "assistant", intent, content: phrased, data },
    };
  }

  // Advisory: general farming knowledge.
  try {
    const { text, provider } = await invokeText(
      [
        new SystemMessage(
          "You are an agricultural extension assistant for smallholder Kenyan farmers. Give practical, " +
            "concise advice (planting, spacing, pests, storage, seasonality)." + langInstruction(language),
        ),
        new HumanMessage(message),
      ],
      { runName: "supervisor.advisory", tags: ["graph:supervisor"] },
    );
    return {
      intent,
      source: "llm",
      model: provider,
      toolCalls,
      reply: { role: "assistant", intent, content: text.trim() },
    };
  } catch {
    return {
      intent,
      source: "heuristic",
      model,
      toolCalls,
      reply: {
        role: "assistant",
        intent,
        content: "I'm having trouble answering right now. Please try again shortly.",
      },
    };
  }
}

function defaultPricingText(data: PricingData, language: Language): string {
  const price = `${data.currency} ${data.pricePerKg}/kg`;
  return language === "sw"
    ? `Bei ya haki ya ${data.produce} ni takriban ${price} (mwelekeo: ${data.trend}).`
    : `A fair rate for your ${data.produce} is about ${price} (trend: ${data.trend}).`;
}

async function phrasePricing(data: PricingData, language: Language): Promise<string> {
  const { text } = await invokeText(
    [
      new SystemMessage(
        "Phrase this produce price as one short, friendly sentence for a farmer." +
          langInstruction(language),
      ),
      new HumanMessage(
        `Produce: ${data.produce}, price: ${data.currency} ${data.pricePerKg}/kg, trend: ${data.trend}, market: ${data.market}`,
      ),
    ],
    { runName: "supervisor.phrase", tags: ["graph:supervisor"] },
  );
  return text.trim();
}

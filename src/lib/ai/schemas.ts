import { z } from "zod";

/**
 * Zod schemas for LLM structured output.
 *
 * These constrain what the model returns (via withStructuredOutput) and are
 * mapped into the API contract types in src/lib/ai/types.ts. Kept separate from
 * the contract types because the model-facing shape is allowed to differ (e.g.
 * looser fields the graph then normalizes).
 */

export const PriceReasoningSchema = z.object({
  pricePerKg: z.number().describe("Fair farm-gate price per kilogram, in KES"),
  trend: z
    .enum(["up", "down", "stable"])
    .describe("Recent price trend for this produce"),
  reasoning: z
    .string()
    .describe("One short sentence explaining the price, grounded in the market data provided"),
});
export type PriceReasoning = z.infer<typeof PriceReasoningSchema>;

export const CartExtractionSchema = z.object({
  items: z
    .array(
      z.object({
        produce: z.string().describe("Produce name, singular, lowercase"),
        quantityKg: z
          .number()
          .nullable()
          .describe("Requested kilograms if stated, else null"),
      }),
    )
    .describe("Produce items the user wants"),
  servings: z
    .number()
    .nullable()
    .describe("Number of people to cook for, if stated, else null"),
});
export type CartExtraction = z.infer<typeof CartExtractionSchema>;

export const IntentSchema = z.object({
  intent: z
    .enum(["pricing", "advisory"])
    .describe(
      "pricing = the farmer wants a price/valuation for produce; advisory = a farming question or general advice",
    ),
  produce: z
    .string()
    .nullable()
    .describe(
      "For pricing intent, the produce being priced (singular, lowercase, e.g. 'tomato', 'maize'); null if none or advisory",
    ),
});
export type IntentResult = z.infer<typeof IntentSchema>;

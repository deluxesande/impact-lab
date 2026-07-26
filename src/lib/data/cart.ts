import { PRODUCE, type Produce } from "./produce";
import { cheapestListingFor } from "./store";
import type { CartItem } from "./types";

/**
 * Natural-language cart builder — "I want tomatoes and sukuma for 4 people".
 *
 * ⚠️ **This is a deterministic stand-in, not an AI call.** `mvp.md` specifies
 * `POST /api/ai/cart` and `/api/consumer/*` currently returns `501`, so there is
 * no cart endpoint to call and AI orchestration belongs to a teammate
 * (docs/consumer-ai.md). Rather than block the consumer surface, this resolves
 * produce by alias and infers quantity from head-count or explicit weights.
 *
 * Swapping it for the real model call means replacing `buildCart` alone — the
 * screens depend only on its `CartItem[]` return type. **Do not describe this as
 * AI in the demo** until that swap happens; describe it as the ordering flow.
 *
 * It does handle the demo script's phrasings, including Swahili produce names.
 */

/** Default heads when a request implies a meal but names no number. */
const DEFAULT_PEOPLE = 2;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  // Swahili numerals — the farmer surface is bilingual, so consumers may type
  // Swahili too even though our chrome is English.
  moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8,
};

export type CartBuildResult = {
  items: CartItem[];
  /** Produce we recognised but have no stock for — surfaced, never silent. */
  unavailable: string[];
  /** How many people the quantities were sized for, when inferred. */
  people?: number;
};

/**
 * Head-count from phrases like "for 4 people", "for four people", "4 pax".
 *
 * Handles both word orders, because Swahili puts the numeral *after* the noun:
 * English "three people" vs Swahili "watu tatu". Matching only numeral-first
 * silently ignored every Swahili head-count.
 */
function parsePeople(text: string): number | undefined {
  const clamp = (n: number) => (n > 0 && n <= 50 ? n : undefined);
  const toNumber = (token: string) =>
    /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token.toLowerCase()];

  const NOUNS = "people|person|pax|watu";

  // "… 4 people" / "… four people" / "watu" preceded by a count.
  const before = text.match(new RegExp(`(?:for\\s+)?(\\d+|[a-z]+)\\s*(?:${NOUNS})`, "i"));
  if (before) {
    const n = toNumber(before[1]);
    if (n) return clamp(n);
  }

  // "watu tatu" / "watu 3" — noun first, count second.
  const after = text.match(new RegExp(`(?:${NOUNS})\\s+(\\d+|[a-z]+)`, "i"));
  if (after) {
    const n = toNumber(after[1]);
    if (n) return clamp(n);
  }

  return undefined;
}

/**
 * An explicit weight attached to a produce mention, e.g. "2kg of tomatoes".
 * Searched in a window before the produce name so "2kg tomatoes and sukuma"
 * doesn't apply the 2kg to sukuma as well.
 */
function parseExplicitKg(text: string, produce: Produce): number | undefined {
  const terms = [produce.name, ...produce.aliases]
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pattern = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(?:kgs?|kilos?|kilograms?)\\s*(?:of\\s+)?(?:${terms})`,
    "i",
  );
  const match = text.match(pattern);
  if (!match) return undefined;
  const kg = Number(match[1]);
  return kg > 0 && kg <= 500 ? kg : undefined;
}

/** Every produce mentioned, in the order they appear in the text. */
function mentioned(text: string): Produce[] {
  const haystack = text.toLowerCase();
  const hits: Array<{ produce: Produce; at: number }> = [];

  for (const produce of PRODUCE) {
    let earliest = Infinity;
    for (const alias of [produce.name.toLowerCase(), ...produce.aliases]) {
      const at = haystack.indexOf(alias);
      if (at !== -1 && at < earliest) earliest = at;
    }
    if (earliest !== Infinity) hits.push({ produce, at: earliest });
  }

  return hits.sort((a, b) => a.at - b.at).map((h) => h.produce);
}

export function buildCart(text: string): CartBuildResult {
  const trimmed = text.trim();
  if (!trimmed) return { items: [], unavailable: [] };

  const people = parsePeople(trimmed);
  const found = mentioned(trimmed);

  const items: CartItem[] = [];
  const unavailable: string[] = [];

  for (const produce of found) {
    const listing = cheapestListingFor(produce.slug);
    if (!listing) {
      unavailable.push(produce.name);
      continue;
    }

    const explicit = parseExplicitKg(trimmed, produce);
    const headcount = people ?? DEFAULT_PEOPLE;
    // Round up to the nearest 0.5 kg — nobody sells 0.3 kg of kale at market.
    const sized = Math.max(0.5, Math.ceil(produce.kgPerPerson * headcount * 2) / 2);
    const wanted = explicit ?? sized;

    // Never promise more than is in stock.
    const quantityKg = Math.min(wanted, listing.quantityKg);
    if (quantityKg <= 0) {
      unavailable.push(produce.name);
      continue;
    }

    items.push({
      listingId: listing.id,
      produceSlug: produce.slug,
      quantityKg,
      pricePerKg: listing.pricePerKg,
    });
  }

  return { items, unavailable, people };
}

/**
 * Produce catalogue.
 *
 * This is reference data, not user data — it never changes at runtime. It holds
 * the two prices the product's entire claim rests on:
 *
 *   `referencePricePerKg` — what a farmer should fairly get. Seeds the price
 *                           suggestion and is the fallback when the AI agent
 *                           can't be reached (see pricing.ts).
 *   `mallPricePerKg`      — what the same produce costs in a supermarket. This
 *                           is the number behind "KES 120 vs KES 210 at the
 *                           mall", so it must be plausible or the pitch falls
 *                           apart under questioning.
 *
 * Figures are indicative Nairobi retail rates for the demo. **They are not
 * sourced** — if a judge asks where they come from, the honest answer is
 * "illustrative". Replacing them with Shamba Records data is the backend's
 * Phase 3 work.
 *
 * No per-produce colours on purpose: the palette is one primary plus neutrals
 * and semantics, so produce is distinguished by name and photo, never by hue.
 */

export type Produce = {
  /** URL-safe id, also the fixture photo filename. */
  slug: string;
  name: string;
  /** Swahili name — shown alongside English on the farmer surface (§6.1). */
  nameSw: string;
  /** Fair farm-gate rate per kg, KES. */
  referencePricePerKg: number;
  /** Typical supermarket rate per kg, KES. Always above the reference. */
  mallPricePerKg: number;
  /** Rough kg one adult eats per meal — powers "sukuma for 4 people". */
  kgPerPerson: number;
  /** Match terms for the cart builder: Swahili, Sheng, plurals, common typos. */
  aliases: string[];
};

export const PRODUCE: Produce[] = [
  {
    slug: "tomatoes",
    name: "Tomatoes",
    nameSw: "Nyanya",
    referencePricePerKg: 45,
    mallPricePerKg: 90,
    kgPerPerson: 0.25,
    aliases: ["tomato", "tomatoes", "nyanya"],
  },
  {
    slug: "sukuma-wiki",
    name: "Sukuma wiki",
    nameSw: "Sukuma wiki",
    referencePricePerKg: 30,
    mallPricePerKg: 70,
    kgPerPerson: 0.2,
    aliases: ["sukuma", "sukuma wiki", "kale", "collard", "greens", "mboga"],
  },
  {
    slug: "maize",
    name: "Maize",
    nameSw: "Mahindi",
    referencePricePerKg: 50,
    mallPricePerKg: 95,
    kgPerPerson: 0.3,
    aliases: ["maize", "corn", "mahindi", "unga"],
  },
  {
    slug: "potatoes",
    name: "Potatoes",
    nameSw: "Viazi",
    referencePricePerKg: 55,
    mallPricePerKg: 110,
    kgPerPerson: 0.3,
    aliases: ["potato", "potatoes", "viazi"],
  },
  {
    slug: "onions",
    name: "Onions",
    nameSw: "Vitunguu",
    referencePricePerKg: 70,
    mallPricePerKg: 140,
    kgPerPerson: 0.1,
    aliases: ["onion", "onions", "vitunguu"],
  },
  {
    slug: "cabbage",
    name: "Cabbage",
    nameSw: "Kabichi",
    referencePricePerKg: 35,
    mallPricePerKg: 75,
    kgPerPerson: 0.25,
    aliases: ["cabbage", "kabichi"],
  },
  {
    slug: "spinach",
    name: "Spinach",
    nameSw: "Mchicha",
    referencePricePerKg: 40,
    mallPricePerKg: 95,
    kgPerPerson: 0.2,
    aliases: ["spinach", "mchicha"],
  },
  {
    slug: "beans",
    name: "Beans",
    nameSw: "Maharagwe",
    referencePricePerKg: 130,
    mallPricePerKg: 220,
    kgPerPerson: 0.15,
    aliases: ["beans", "maharagwe", "nduma"],
  },
];

const BY_SLUG = new Map(PRODUCE.map((p) => [p.slug, p]));

export function produceBySlug(slug: string): Produce | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Resolve free text to a produce item — "nyanya", "Tomatoes", "sukuma" all hit.
 * Longest alias wins so "sukuma wiki" beats a bare "sukuma", and both beat a
 * substring match on some other entry.
 */
export function matchProduce(text: string): Produce | undefined {
  const haystack = text.toLowerCase();
  let best: { produce: Produce; length: number } | undefined;

  for (const produce of PRODUCE) {
    for (const alias of [produce.name.toLowerCase(), ...produce.aliases]) {
      if (haystack.includes(alias) && (!best || alias.length > best.length)) {
        best = { produce, length: alias.length };
      }
    }
  }

  return best?.produce;
}

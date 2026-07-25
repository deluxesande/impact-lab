/**
 * Number and currency formatting.
 *
 * Every price in the app goes through here. The consumer surface leans on a
 * price comparison ("KES 120 vs KES 210 at the mall"), so inconsistent
 * formatting between two numbers sitting side by side is immediately visible.
 *
 * Pair these with the `figure` utility class — Poppins' digits are wide and
 * non-tabular, so numbers drift as values change. See docs/frontend-discovery.md §3.3.
 */

const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  currencyDisplay: "code",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a whole-shilling amount, e.g. `formatKES(4500)` → `"KES 4,500"`.
 *
 * Produce prices are quoted in whole shillings, so fractions are rounded away
 * rather than shown — a "KES 45.00/kg" reads as false precision for a rate the
 * AI has estimated. `currencyDisplay: "code"` gives us "KES" rather than the
 * "Ksh"/"KSh" symbol variants, matching how the API and docs quote prices.
 */
export function formatKES(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  // Intl inserts a non-breaking space after the code; normalise it so the
  // string is predictable to test against and safe to split on.
  return KES.format(Math.round(amount)).replace(/ /g, " ");
}

/** Per-kilogram rate, e.g. `"KES 50 / kg"`. */
export function formatRate(pricePerKg: number): string {
  return `${formatKES(pricePerKg)} / kg`;
}

/**
 * Format a weight. Whole numbers stay whole (`"200 kg"`); fractions keep one
 * decimal (`"2.5 kg"`) because part-kilo quantities are real at market.
 */
export function formatKg(kg: number): string {
  if (!Number.isFinite(kg)) return "—";
  const rounded = Math.round(kg * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} kg`;
}

/**
 * Saving of our price against a reference (mall) price, as a whole percent.
 * Returns null when there is no saving to claim — the caller should then show
 * nothing rather than "0% cheaper", and we never advertise a negative saving.
 */
export function savingPercent(ourPrice: number, mallPrice: number): number | null {
  if (!Number.isFinite(ourPrice) || !Number.isFinite(mallPrice)) return null;
  if (mallPrice <= 0 || ourPrice >= mallPrice) return null;
  return Math.round(((mallPrice - ourPrice) / mallPrice) * 100);
}

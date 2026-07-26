import { matchProduce, type Produce } from "./produce";
import { savingPercent } from "@/lib/format";
import type { Listing, Order } from "@/lib/ai/types";

/**
 * View models — the seam between the backend's contract and what screens render.
 *
 * The backend's `Listing.produceType` is **free text** (whatever a farmer typed),
 * while the UI needs a display name, a supermarket reference price, a portion
 * size, and a placeholder image. Those live in our produce catalogue, so this
 * module resolves one to the other with `matchProduce()` and degrades gracefully
 * when a farmer lists something the catalogue has never heard of.
 *
 * Doing this in one place means no screen has to know that `produceType` is
 * unreliable, and an unmatched produce shows the farmer's own wording rather
 * than a blank or a crash.
 */

export type ListingView = {
  /** The backend record, unchanged. */
  listing: Listing;
  /** Catalogue match, when the free-text produceType resolved to one. */
  produce?: Produce;
  /** Display name: catalogue name when matched, else the farmer's own wording. */
  name: string;
  /** Supermarket reference per kg — only when the catalogue knows this produce. */
  mallPricePerKg?: number;
  /** Whole-percent saving vs the supermarket, or null when there's none to claim. */
  saving: number | null;
  /** Sensible one-tap quantity, clamped to available stock. */
  defaultKg: number;
};

export function toListingView(listing: Listing): ListingView {
  const produce = matchProduce(listing.produceType);
  const mallPricePerKg = produce?.mallPricePerKg;

  return {
    listing,
    produce,
    // Prefer the catalogue's canonical casing; fall back to the farmer's text so
    // an unmatched listing still reads correctly rather than showing a slug.
    name: produce?.name ?? listing.produceType,
    mallPricePerKg,
    saving: mallPricePerKg ? savingPercent(listing.pricePerKg, mallPricePerKg) : null,
    defaultKg: Math.min(
      listing.quantityKg,
      // Two servings, rounded up to the nearest half kilo. Nobody sells 0.3 kg.
      Math.max(0.5, Math.ceil((produce?.kgPerPerson ?? 0.25) * 2 * 2) / 2),
    ),
  };
}

export function toListingViews(listings: Listing[]): ListingView[] {
  return listings.map(toListingView);
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The backend models **one order per listing** (`CreateOrderRequest` is
 * `{ listingId, quantityKg }`), so a shopper's three-item basket becomes three
 * `Order` rows. The UI still needs to present that as one purchase, so a basket
 * is a group of orders placed together.
 */
export type OrderView = {
  order: Order;
  /** Display name resolved from the listing's produceType, when available. */
  name: string;
  produce?: Produce;
  /** Supermarket cost of the same quantity — drives the savings line. */
  mallPrice?: number;
};

export function toOrderView(order: Order, produceType: string | undefined): OrderView {
  const produce = produceType ? matchProduce(produceType) : undefined;
  return {
    order,
    name: produce?.name ?? produceType ?? "Produce",
    produce,
    mallPrice: produce ? Math.round(produce.mallPricePerKg * order.quantityKg) : undefined,
  };
}

/** Totals for a set of orders presented as one basket. */
export function basketTotals(views: OrderView[]): {
  total: number;
  mallTotal: number;
  saving: number | null;
} {
  const total = views.reduce((sum, v) => sum + v.order.totalPrice, 0);
  // Fall back to our own price for unmatched produce so the mall total is never
  // *understated* — that would invent a saving we can't stand behind.
  const mallTotal = views.reduce((sum, v) => sum + (v.mallPrice ?? v.order.totalPrice), 0);
  return { total, mallTotal, saving: savingPercent(total, mallTotal) };
}

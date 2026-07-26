import { randomUUID } from "node:crypto";
import { PRODUCE, produceBySlug } from "./produce";
import type { CartItem, Listing, Order, OrderItem } from "./types";

/**
 * In-memory data store — the demo's only persistence.
 *
 * Pinned to `globalThis` because Next's dev server re-evaluates modules on every
 * hot reload; a plain module-level `const` would silently reset the farmer's
 * listings mid-demo the moment a file was saved.
 *
 * **Scope, stated plainly (docs/frontend-discovery.md §5.2):** the demo runs from
 * localhost as a single persistent Node process, which is the only reason this is
 * sufficient. State is lost on server restart, and this would break across
 * instances on serverless. Do not deploy this expecting durability — swapping in
 * the backend's Postgres is the intended path.
 */

type Db = { listings: Listing[]; orders: Order[] };

const globalForDb = globalThis as unknown as { __impactLabDb?: Db };

function seed(): Db {
  const now = Date.now();
  // Pre-existing listings from other farmers, so the consumer grid is populated
  // before the demo's farmer step runs. Without these, a judge's first view of
  // /consumer would be an empty state.
  const seeded: Array<[string, string, number, number]> = [
    ["tomatoes", "Wanjiku M.", 120, 45],
    ["sukuma-wiki", "Otieno K.", 80, 30],
    ["potatoes", "Njeri W.", 200, 55],
    ["onions", "Kamau N.", 60, 70],
    ["cabbage", "Achieng O.", 150, 35],
    ["spinach", "Mutiso D.", 45, 40],
  ];

  return {
    listings: seeded.map(([produceSlug, farmerName, quantityKg, pricePerKg], i) => ({
      id: `seed-${produceSlug}`,
      farmerId: `seed-farmer-${i}`,
      farmerName,
      produceSlug,
      quantityKg,
      pricePerKg,
      active: true,
      // Stagger timestamps so "newest first" ordering is stable and meaningful.
      createdAt: new Date(now - (i + 1) * 3_600_000).toISOString(),
    })),
    orders: [],
  };
}

function db(): Db {
  globalForDb.__impactLabDb ??= seed();
  return globalForDb.__impactLabDb;
}

/* --------------------------------- reads --------------------------------- */

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt);

/**
 * Every read below returns **copies**, never the stored objects.
 *
 * Without this, `getListing(id).quantityKg = 0` from any component would
 * silently rewrite the store, and a caller holding a listing would see it
 * change underneath them when an order was placed. Since this store is plain
 * mutable objects rather than a database, that boundary has to be explicit.
 * Orders need their `items` copied too — a shallow spread would still share the
 * nested array.
 */
const copyListing = (l: Listing): Listing => ({ ...l });
const copyOrder = (o: Order): Order => ({ ...o, items: o.items.map((i) => ({ ...i })) });

/** Live reference for internal mutation only. Never leaves this module. */
function findListing(id: string): Listing | undefined {
  return db().listings.find((l) => l.id === id);
}

/** Every active listing with stock left — the consumer grid. */
export function activeListings(): Listing[] {
  return db()
    .listings.filter((l) => l.active && l.quantityKg > 0)
    .sort(newestFirst)
    .map(copyListing);
}

/** One farmer's listings, including sold-out and inactive ones. */
export function listingsByFarmer(farmerId: string): Listing[] {
  return db()
    .listings.filter((l) => l.farmerId === farmerId)
    .sort(newestFirst)
    .map(copyListing);
}

export function getListing(id: string): Listing | undefined {
  const found = findListing(id);
  return found ? copyListing(found) : undefined;
}

/** Orders containing at least one of this farmer's listings. */
export function ordersForFarmer(farmerId: string): Order[] {
  const mine = new Set(db().listings.filter((l) => l.farmerId === farmerId).map((l) => l.id));
  return db()
    .orders.filter((o) => o.items.some((i) => mine.has(i.listingId)))
    .sort(newestFirst)
    .map(copyOrder);
}

export function ordersForConsumer(consumerId: string): Order[] {
  return db()
    .orders.filter((o) => o.consumerId === consumerId)
    .sort(newestFirst)
    .map(copyOrder);
}

export function getOrder(id: string): Order | undefined {
  const found = db().orders.find((o) => o.id === id);
  return found ? copyOrder(found) : undefined;
}

/* ------------------------------- mutations ------------------------------- */

export function createListing(input: {
  farmerId: string;
  farmerName: string;
  produceSlug: string;
  quantityKg: number;
  pricePerKg: number;
  photo?: string;
}): Listing {
  if (!produceBySlug(input.produceSlug)) {
    throw new Error(`Unknown produce: ${input.produceSlug}`);
  }
  if (!(input.quantityKg > 0)) throw new Error("Quantity must be greater than zero.");
  if (!(input.pricePerKg > 0)) throw new Error("Price must be greater than zero.");

  const listing: Listing = {
    id: randomUUID(),
    ...input,
    active: true,
    createdAt: new Date().toISOString(),
  };

  // Unshift so a freshly published listing is first even if two land in the
  // same millisecond and the timestamp sort can't separate them.
  db().listings.unshift(listing);
  return listing;
}

/**
 * Place an order, decrementing stock.
 *
 * Validates every line *before* mutating anything, so a partly-invalid cart
 * can't leave the store with some stock decremented and no order recorded.
 * Quantities are clamped to available stock rather than rejected — a consumer
 * asking for 5 kg when 4 remain should get 4 kg, not an error mid-demo.
 */
export function placeOrder(input: {
  consumerId: string;
  items: CartItem[];
}): Order {
  if (input.items.length === 0) throw new Error("Cart is empty.");

  const resolved: OrderItem[] = input.items.map((item) => {
    const listing = findListing(item.listingId);
    if (!listing) throw new Error(`Listing no longer available: ${item.listingId}`);
    if (!listing.active || listing.quantityKg <= 0) {
      throw new Error(`Sold out: ${listing.produceSlug}`);
    }

    const produce = produceBySlug(listing.produceSlug);
    const quantityKg = Math.min(item.quantityKg, listing.quantityKg);
    if (!(quantityKg > 0)) throw new Error("Quantity must be greater than zero.");

    return {
      listingId: listing.id,
      produceSlug: listing.produceSlug,
      quantityKg,
      pricePerKg: listing.pricePerKg,
      mallPrice: Math.round((produce?.mallPricePerKg ?? listing.pricePerKg) * quantityKg),
      lineTotal: Math.round(listing.pricePerKg * quantityKg),
    };
  });

  // All lines valid — now apply, against live references.
  for (const item of resolved) {
    const listing = findListing(item.listingId)!;
    listing.quantityKg = Math.max(0, listing.quantityKg - item.quantityKg);
    if (listing.quantityKg === 0) listing.active = false;
  }

  const order: Order = {
    id: randomUUID(),
    consumerId: input.consumerId,
    items: resolved,
    totalPrice: resolved.reduce((sum, i) => sum + i.lineTotal, 0),
    // Delivery is mocked for the MVP — the order never leaves this state.
    status: "placed",
    createdAt: new Date().toISOString(),
  };

  db().orders.unshift(order);
  return order;
}

/** Total supermarket cost of an order, for the savings line. */
export function orderMallTotal(order: Order): number {
  return order.items.reduce((sum, i) => sum + i.mallPrice, 0);
}

/**
 * Cheapest active listing for a produce type. The cart builder resolves a
 * produce name to an actual listing this way, so the consumer always gets the
 * best available price without choosing a farmer manually.
 */
export function cheapestListingFor(produceSlug: string): Listing | undefined {
  return activeListings()
    .filter((l) => l.produceSlug === produceSlug)
    .sort((a, b) => a.pricePerKg - b.pricePerKg)[0];
}

/** Test/demo helper — reset to seed state. Not called by the app. */
export function resetStore(): void {
  globalForDb.__impactLabDb = seed();
}

/** Re-exported so screens have one import for data plus catalogue. */
export { PRODUCE, produceBySlug };

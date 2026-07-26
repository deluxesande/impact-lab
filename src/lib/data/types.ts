/**
 * Domain types for the web surface.
 *
 * Shapes follow `docs/mvp.md` §"Data Model (minimal)" so that if the backend
 * later persists these in Postgres, the field names already agree. Two additions
 * beyond that model, both required by screens the demo actually shows:
 *   - `createdAt` on both entities, so dashboards can sort newest-first.
 *   - `farmerName` on Order, so a consumer's confirmation can name the farmer.
 *
 * Note these are *frontend* types, distinct from `src/lib/ai/types.ts`, which is
 * the backend's Android-facing API contract. They are allowed to diverge.
 */

export type OrderStatus = "placed" | "mocked-delivered";

export type Listing = {
  id: string;
  /** Clerk user id of the farmer who published it. */
  farmerId: string;
  /** Display name for the consumer grid — Clerk's name, or "A farmer". */
  farmerName: string;
  /** `Produce.slug`. */
  produceSlug: string;
  /**
   * Optional image reference. Currently always undefined: `POST /api/upload` is
   * a Phase 1 mock that discards the file and returns a key resolving to
   * nothing, so an uploaded photo can never be displayed. Cards fall back to a
   * generated placeholder. Real MinIO storage is backend Phase 2.5.
   */
  photo?: string;
  quantityKg: number;
  pricePerKg: number;
  active: boolean;
  createdAt: string;
};

export type Order = {
  id: string;
  consumerId: string;
  /** Line items, each against a live listing. */
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  createdAt: string;
};

export type OrderItem = {
  listingId: string;
  produceSlug: string;
  quantityKg: number;
  pricePerKg: number;
  /** Supermarket price for the same quantity — powers the savings line. */
  mallPrice: number;
  lineTotal: number;
};

/**
 * A cart line before an order exists. Produced by the cart builder from natural
 * language and held in client state until checkout.
 */
export type CartItem = {
  listingId: string;
  produceSlug: string;
  quantityKg: number;
  pricePerKg: number;
};

/** Where a suggested price came from — surfaced in the UI, never hidden. */
export type PriceSource = "agent" | "reference";

export type PriceSuggestion = {
  pricePerKg: number;
  source: PriceSource;
  /** The agent's prose reply, when we got one. */
  rationale?: string;
  market?: string;
  trend?: "up" | "down" | "stable";
};

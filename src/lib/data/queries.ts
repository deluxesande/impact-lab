import {
  getConversationBySession,
  getListing,
  listActiveListings,
  listFarmerListings,
  listOrdersForFarmer,
} from "@/lib/db/repo";
import { presentListings } from "@/lib/api/present-listing";
import { toListingViews, toOrderView, type ListingView, type OrderView } from "./view";
import type { ConversationMessage, Order } from "@/lib/ai/types";

/**
 * Read side of the web surface.
 *
 * Replaces the `globalThis` in-memory store: data now comes from Postgres via the
 * backend's `repo.ts`, imported **in-process** rather than over HTTP. Same
 * runtime, so an HTTP hop would only add absolute-URL construction, Clerk cookie
 * forwarding, and a second auth check for nothing. The backend's route handlers
 * remain the contract for the Android client.
 *
 * Every listing read goes through `presentListings()` — the backend's own
 * presenter — which swaps private MinIO object keys for short-lived presigned GET
 * URLs. Using theirs rather than reimplementing it means presigning behaves
 * identically on web and on Android.
 *
 * ⚠️ Presigned URLs **expire**, so any page rendering these must not be
 * statically cached or images will 403 for later visitors. Our pages are
 * already dynamic because they call `auth()`, but that's incidental — don't add
 * `revalidate` to them.
 */

/** Every active listing, for the consumer grid. */
export async function activeListingViews(): Promise<ListingView[]> {
  const records = await listActiveListings();
  return toListingViews(await presentListings(records));
}

/** One farmer's listings, newest first, including sold-out ones. */
export async function farmerListingViews(farmerId: string): Promise<ListingView[]> {
  const records = await listFarmerListings(farmerId);
  return toListingViews(await presentListings(records));
}

/**
 * Orders against a farmer's listings, each resolved to a display name.
 *
 * `Order` carries only `listingId`, so the produce name needs a listing lookup.
 * Those are fetched once per distinct listing and reused, rather than per order —
 * a farmer with twenty orders against three listings does three queries, not
 * twenty.
 */
export async function farmerOrderViews(farmerId: string): Promise<OrderView[]> {
  const orders = await listOrdersForFarmer(farmerId);
  return withProduceNames(orders);
}

/**
 * Prior advisory-chat turns for a farmer's session, oldest first.
 *
 * The caller passes the **user-scoped** session key (`advice:<userId>:<clientId>`,
 * the same one `askAdvisorAction` writes under), so one farmer can never load
 * another's thread. Returns `[]` for a session with no history yet.
 *
 * Advisory turns never carry images, so `imageKey` is simply dropped — no MinIO
 * presigning is needed here, unlike the listing read path.
 */
export async function advisorHistory(
  sessionKey: string,
): Promise<ConversationMessage[]> {
  const record = await getConversationBySession(sessionKey);
  if (!record) return [];
  // Drop the private `imageKey` (advisory turns carry none anyway) by projecting
  // only the fields the client contract exposes.
  return record.messages.map(
    (m): ConversationMessage => ({
      id: m.id,
      role: m.role,
      content: m.content,
      ...(m.data ? { data: m.data } : {}),
      createdAt: m.createdAt,
    }),
  );
}

/** Resolve produce names for a set of orders, de-duplicating listing lookups. */
export async function withProduceNames(orders: Order[]): Promise<OrderView[]> {
  const ids = [...new Set(orders.map((o) => o.listingId))];
  const entries = await Promise.all(
    ids.map(async (id) => [id, (await getListing(id))?.produceType] as const),
  );
  const produceTypeById = new Map(entries);
  return orders.map((o) => toOrderView(o, produceTypeById.get(o.listingId)));
}

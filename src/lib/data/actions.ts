"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/roles";
import { buildCart, type CartBuildResult } from "./cart";
import { suggestPrice } from "./pricing";
import { produceBySlug } from "./produce";
import { createListing, placeOrder } from "./store";
import type { CartItem, Listing, Order, PriceSuggestion } from "./types";

/**
 * Server Actions — the web surface's entire write path (no HTTP routes, §5.1).
 *
 * Every action re-authorises with `requireRole()`. A Server Action is a public
 * POST endpoint under the hood, so trusting a role the client sent, or one
 * checked only when the page rendered, would be a real hole.
 *
 * `requireRole()` is deliberately called **outside** each try/catch. It signals
 * failure with `redirect()`, which works by throwing — catching that would turn
 * a redirect into a silent error toast. Keeping it outside means no dependency on
 * Next's internal redirect-digest format.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Display name for listings. Falls back rather than exposing an email. */
async function farmerDisplayName(): Promise<string> {
  const user = await currentUser();
  const name = user?.firstName?.trim() || user?.username?.trim() || "";
  // Deliberately never the email address — it would appear publicly on the
  // consumer grid next to their produce.
  return name || "A farmer";
}

/**
 * Ask for a price before publishing. Returns the suggestion *and* its source, so
 * the UI can distinguish an AI answer from a market reference (see pricing.ts).
 */
export async function suggestPriceAction(
  produceSlug: string,
  quantityKg: number,
  language: "en" | "sw" = "en",
): Promise<ActionResult<PriceSuggestion>> {
  const { userId } = await requireRole("farmer");

  if (!produceBySlug(produceSlug)) {
    return { ok: false, error: "Pick a produce type first." };
  }
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
    return { ok: false, error: "Enter a quantity greater than zero." };
  }

  try {
    const suggestion = await suggestPrice({
      produceSlug,
      quantityKg,
      language,
      // Scoping the conversation to the farmer keeps their turns together once
      // the backend starts persisting conversations (Phase 2).
      sessionId: `farmer-${userId}`,
    });
    return { ok: true, data: suggestion };
  } catch {
    return { ok: false, error: "Couldn’t reach the pricing model. Try again." };
  }
}

/** Publish a listing. */
export async function createListingAction(input: {
  produceSlug: string;
  quantityKg: number;
  pricePerKg: number;
  /**
   * Downscaled JPEG data URL, when the farmer attached a photo. Not an
   * `objectKey` — the upload endpoint is a mock that discards files, so a key
   * can't be resolved back to an image (see src/lib/image.ts).
   */
  photo?: string;
}): Promise<ActionResult<Listing>> {
  const { userId } = await requireRole("farmer");
  const farmerName = await farmerDisplayName();

  // Guard the store against an unbounded string: this ends up inline in the HTML
  // of every page that renders the card. The client downscales to ~40 KB; anything
  // far larger means it bypassed that path, so drop it rather than ship it.
  const photo =
    input.photo?.startsWith("data:image/") && input.photo.length < 400_000
      ? input.photo
      : undefined;

  try {
    const listing = createListing({
      farmerId: userId,
      farmerName,
      produceSlug: input.produceSlug,
      quantityKg: input.quantityKg,
      pricePerKg: input.pricePerKg,
      photo,
    });

    // The dashboard and the consumer grid both now show stale data.
    revalidatePath("/farmer");
    revalidatePath("/consumer");

    return { ok: true, data: listing };
  } catch (err) {
    return { ok: false, error: message(err, "Couldn’t publish that listing.") };
  }
}

/** Turn free text into a cart. Read-only — it does not reserve stock. */
export async function buildCartAction(
  text: string,
): Promise<ActionResult<CartBuildResult>> {
  await requireRole("consumer");

  if (!text.trim()) {
    return { ok: false, error: "Tell us what you’d like to order." };
  }

  try {
    const result = buildCart(text);
    if (result.items.length === 0) {
      return {
        ok: false,
        error:
          result.unavailable.length > 0
            ? `${result.unavailable.join(" and ")} — out of stock right now.`
            : "Couldn’t find that produce. Try “tomatoes and sukuma for 4 people”.",
      };
    }
    return { ok: true, data: result };
  } catch {
    return { ok: false, error: "Couldn’t build your cart. Try again." };
  }
}

/** Place the order. Decrements stock; delivery is mocked. */
export async function placeOrderAction(
  items: CartItem[],
): Promise<ActionResult<Order>> {
  const { userId } = await requireRole("consumer");

  try {
    const order = placeOrder({ consumerId: userId, items });

    // The farmer's dashboard must show this immediately — it's the demo's
    // closing beat.
    revalidatePath("/farmer");
    revalidatePath("/consumer");

    return { ok: true, data: order };
  } catch (err) {
    return { ok: false, error: message(err, "Couldn’t place that order.") };
  }
}

function message(err: unknown, fallback: string): string {
  // Store validation errors ("Sold out: tomatoes") are written for humans, so
  // they're safe and useful to surface directly.
  return err instanceof Error && err.message ? err.message : fallback;
}

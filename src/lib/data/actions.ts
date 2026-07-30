"use server";

import { revalidatePath } from "next/cache";
import { requireUserRow } from "@/lib/auth/current-user-row";
import {
  appendMessage,
  createListing,
  createOrder,
  getListing,
  getOrCreateConversation,
  listActiveListings,
  logAgentRun,
} from "@/lib/db/repo";
import { runCartGraph } from "@/lib/ai/graphs/cart";
import { runPricingGraph } from "@/lib/ai/graphs/pricing";
import { runSupervisor } from "@/lib/ai/graphs/supervisor";
import { AI_TIMEOUTS, TimeoutError, withTimeout } from "@/lib/ai/timeout";
import { withProduceNames } from "./queries";
import { matchProduce } from "./produce";
import type { CartItem, FarmerAgentReply, Language, Order, PricingData } from "@/lib/ai/types";
import type { OrderView } from "./view";

/**
 * Write side of the web surface — Server Actions only, no HTTP route handlers
 * (docs/frontend-discovery.md §5.1). These now call the backend's `repo.ts` and
 * LangGraph entry points **in-process**, replacing the fixture store and the
 * deterministic stand-ins that stood in while those did not exist.
 *
 * Every action re-authorises with `requireUserRow()`, which is also where the
 * Clerk id becomes a `users.id` uuid. A Server Action is a public POST endpoint
 * under the hood, so a role checked when the page rendered is not a guarantee.
 *
 * `requireUserRow()` is called **outside** each try/catch: it signals failure via
 * `redirect()`, which works by throwing, and catching that would turn a redirect
 * into a silent error toast.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Whether an answer came from a model or the built-in fallback. Never hidden. */
export type PriceSource = "model" | "heuristic";

export type PriceSuggestion = {
  pricePerKg: number;
  source: PriceSource;
  currency: string;
  market?: string;
  trend?: PricingData["trend"];
  /** The model's prose explanation, in the requested language. */
  rationale?: string;
};

/**
 * Suggest a fair rate before publishing.
 *
 * Goes through `runSupervisor` rather than `runPricingGraph` directly, for one
 * reason: **language**. The supervisor routes pricing through the same pricing
 * graph but then phrases the answer in the requested language, and the backend's
 * `PriceRequest` has no `language` field. Calling the graph directly would have
 * silently killed the EN/SW toggle (§6.1) — a toggle that does nothing is worse
 * than no toggle.
 *
 * It also retires the guard we previously needed: the Phase 1 stub answered
 * "Maize, KES 50" for any produce, so we had to detect mismatches and fall back
 * to the catalogue. The real graph is produce-aware, so that defence is gone.
 *
 * Still falls back to a heuristic with no model key configured, and `source`
 * reports which, so the UI keeps labelling it honestly.
 */
export async function suggestPriceAction(
  produceType: string,
  quantityKg: number,
  language: Language = "en",
): Promise<ActionResult<PriceSuggestion>> {
  await requireUserRow("farmer");

  if (!produceType.trim()) {
    return { ok: false, error: "Pick a produce type first." };
  }
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
    return { ok: false, error: "Enter a quantity greater than zero." };
  }

  try {
    // Phrased to route to the supervisor's pricing intent ("worth", "kg").
    const { reply, source } = await runSupervisor(
      `I have ${quantityKg}kg of ${produceType}. What is it worth per kg?`,
      language,
    );

    const data = reply.data;
    if (typeof data?.pricePerKg !== "number") {
      // Pricing intent didn't produce a number — fall back to the graph directly
      // so the farmer still gets a usable rate rather than a dead end.
      const direct = await runPricingGraph({ produceType, quantityKg, region: "Nairobi" });
      if (typeof direct.data.pricePerKg !== "number") {
        return { ok: false, error: "Couldn’t work out a rate for that. Try again." };
      }
      return {
        ok: true,
        data: {
          pricePerKg: Math.round(direct.data.pricePerKg),
          source: direct.source === "heuristic" ? "heuristic" : "model",
          currency: direct.data.currency ?? "KES",
          market: direct.data.market,
          trend: direct.data.trend,
        },
      };
    }

    return {
      ok: true,
      data: {
        pricePerKg: Math.round(data.pricePerKg),
        source: source === "heuristic" ? "heuristic" : "model",
        currency: data.currency ?? "KES",
        market: data.market,
        trend: data.trend,
        rationale: reply.content,
      },
    };
  } catch {
    return { ok: false, error: "Couldn’t reach the pricing model. Try again." };
  }
}

/** Publish a listing. */
export async function createListingAction(input: {
  produceType: string;
  quantityKg: number;
  pricePerKg: number;
  /** MinIO object key from POST /api/upload — now a real, retrievable object. */
  imageKey?: string;
}): Promise<ActionResult<{ id: string }>> {
  const { row } = await requireUserRow("farmer");

  try {
    const listing = await createListing({
      // The uuid, never the Clerk id — see current-user-row.ts.
      farmerId: row.id,
      produceType: input.produceType,
      quantityKg: input.quantityKg,
      pricePerKg: input.pricePerKg,
      imageKey: input.imageKey,
    });

    revalidatePath("/farmer");
    revalidatePath("/consumer");

    return { ok: true, data: { id: listing.id } };
  } catch (err) {
    return { ok: false, error: message(err, "Couldn’t publish that listing.") };
  }
}

export type CartResult = {
  items: CartItem[];
  total: number;
  currency: string;
  /** False when the graph fell back to its keyword matcher. */
  aiBacked: boolean;
};

/**
 * ⚠️ **Two sources of supermarket pricing exist, and they disagree.**
 *
 * The cart graph returns `mallComparison` computed as a flat 1.75× markup on the
 * basket. Our produce catalogue instead holds a per-produce `mallPricePerKg`
 * (onions are marked up harder than kale, which is closer to reality). For a
 * 2 kg tomatoes + 2 kg sukuma basket that's 262.5 vs 320 — a visible gap.
 *
 * The web UI uses the **catalogue** throughout, for one unavoidable reason: the
 * backend's `Listing` carries no mall price, so per-card comparisons can only come
 * from the catalogue. Taking the basket total from the graph would make each card
 * disagree with the basket it adds up to, which is worse than disagreeing with
 * another client.
 *
 * Consequence: **web and Android will quote different savings for the same
 * basket.** The fix is one source of truth — moving the catalogue's per-produce
 * mall prices into the backend's pricing layer. Logged for the team; not
 * something to paper over on one client.
 */

/**
 * Turn free text into a cart.
 *
 * The backend's cart graph extracts wants with an LLM but matches and prices
 * against real `listings` rows in code, so a cart is always orderable and totals
 * are never hallucinated. It degrades to a keyword matcher with no model key set;
 * `aiBacked` reports which, so the UI never claims AI it did not use.
 */
export async function buildCartAction(text: string): Promise<ActionResult<CartResult>> {
  await requireUserRow("consumer");

  if (!text.trim()) {
    return { ok: false, error: "Tell us what you’d like to order." };
  }

  try {
    const listings = await listActiveListings();
    if (listings.length === 0) {
      return { ok: false, error: "Nothing is listed right now — check back shortly." };
    }

    const { response, source } = await runCartGraph(text.trim(), listings);

    if (response.items.length === 0) {
      return {
        ok: false,
        error: "Couldn’t find that produce in stock. Try “tomatoes and sukuma for 4 people”.",
      };
    }

    return {
      ok: true,
      data: {
        items: response.items,
        total: response.total,
        currency: response.currency,
        aiBacked: source !== "heuristic",
      },
    };
  } catch {
    return { ok: false, error: "Couldn’t build your cart. Try again." };
  }
}

/**
 * Place an order for every line in the basket.
 *
 * ⚠️ The backend models **one order per listing** (`CreateOrderRequest` is
 * `{ listingId, quantityKg }`), so an N-item basket becomes N `Order` rows that
 * the UI then presents as a single purchase.
 *
 * There is therefore no one transaction spanning the basket. To keep the window
 * small, every line is re-checked against live stock *before* any write, and
 * quantities are clamped rather than rejected — a shopper asking for 5 kg when 4
 * remain should get 4 kg, not an error mid-demo. A line can still fail after an
 * earlier one succeeded (someone else buying the last of something in between),
 * so the caller is told exactly which lines failed instead of being shown a false
 * all-or-nothing result.
 */
export async function placeOrderAction(
  items: CartItem[],
): Promise<ActionResult<{ orders: OrderView[]; failed: string[] }>> {
  const { row } = await requireUserRow("consumer");

  if (items.length === 0) {
    return { ok: false, error: "Your basket is empty." };
  }

  const label = (produceType: string) => matchProduce(produceType)?.name ?? produceType;

  try {
    // Pre-flight: resolve live stock for every line before writing anything.
    const planned: Array<{ item: CartItem; quantityKg: number; pricePerKg: number }> = [];
    const failed: string[] = [];

    for (const item of items) {
      const listing = await getListing(item.listingId);

      if (!listing || !listing.active || listing.quantityKg <= 0) {
        failed.push(label(item.produceType));
        continue;
      }
      const quantityKg = Math.min(item.quantityKg, listing.quantityKg);
      if (!(quantityKg > 0)) {
        failed.push(label(item.produceType));
        continue;
      }
      // Bill at the listing's current price, not the one cached in the cart.
      planned.push({ item, quantityKg, pricePerKg: listing.pricePerKg });
    }

    if (planned.length === 0) {
      return {
        ok: false,
        error: `${failed.join(" and ")} — no longer available. Nothing was charged.`,
      };
    }

    const placed: Order[] = [];
    for (const { item, quantityKg, pricePerKg } of planned) {
      try {
        placed.push(
          await createOrder({
            consumerId: row.id,
            listingId: item.listingId,
            quantityKg,
            pricePerKg,
          }),
        );
      } catch {
        failed.push(label(item.produceType));
      }
    }

    if (placed.length === 0) {
      return { ok: false, error: "Couldn’t place that order. Nothing was charged." };
    }

    // The farmer dashboard must show these immediately — the demo's closing beat.
    revalidatePath("/farmer");
    revalidatePath("/consumer");

    return { ok: true, data: { orders: await withProduceNames(placed), failed } };
  } catch (err) {
    return { ok: false, error: message(err, "Couldn’t place that order.") };
  }
}

/* -------------------------------------------------------------------------- */
/* Farmer advisory chat                                                       */
/* -------------------------------------------------------------------------- */

/** Same cap the /api/farmer/agent route enforces — bounds token cost + flooding. */
const MAX_ADVISOR_MESSAGE = 2000;

export type AdvisorTurn = {
  /** Conversation this exchange was persisted under. */
  conversationId: string;
  reply: FarmerAgentReply;
  /**
   * Whether a real model produced the reply. False when the supervisor fell back
   * to its heuristic (no provider key) or the run timed out. The UI must label
   * honestly and never claim AI it did not use — see price-card.tsx.
   */
  aiBacked: boolean;
};

/**
 * Ask the farming advisor a question — the web co-pilot's advisory chat.
 *
 * Mirrors POST /api/farmer/agent (the Android contract) but runs `runSupervisor`
 * **in-process**, the same way every other web Server Action reaches the graphs.
 * It persists both turns and an `agent_runs` row so history survives reloads and
 * the refinement dataset keeps growing, identical to the route.
 *
 * SECURITY — the conversation key is namespaced to the authenticated user
 * (`advice:<users.id>:<clientSessionId>`), not the raw client value. Conversations
 * are keyed only by `session_id` and `getConversation` is not user-scoped, so a
 * bare client id would let one farmer append to — or later read — another's
 * thread just by guessing it. Binding the key to `row.id` closes that.
 *
 * `requireUserRow("farmer")` runs **outside** the try/catch: it signals failure by
 * throwing `redirect()`, and catching that would swallow the redirect. A Server
 * Action is a public POST under the hood, so re-authorising here is not optional.
 */
export async function askAdvisorAction(
  clientSessionId: string,
  rawMessage: string,
  language: Language = "en",
): Promise<ActionResult<AdvisorTurn>> {
  const { row } = await requireUserRow("farmer");

  const messageText = rawMessage.trim();
  if (!messageText) {
    return { ok: false, error: "Type a question first." };
  }
  if (messageText.length > MAX_ADVISOR_MESSAGE) {
    return {
      ok: false,
      error: `Keep it under ${MAX_ADVISOR_MESSAGE} characters.`,
    };
  }
  if (typeof clientSessionId !== "string" || clientSessionId.length === 0) {
    return { ok: false, error: "Missing chat session. Reload and try again." };
  }

  // Namespace the thread to this farmer. Never trust the client id alone.
  const sessionKey = `advice:${row.id}:${clientSessionId}`;

  try {
    const conversation = await getOrCreateConversation(sessionKey, language);

    await appendMessage({
      conversationId: conversation.id,
      role: "user",
      content: messageText,
    });

    // Bound the whole agent run. A timeout degrades to a friendly reply rather
    // than an error — the farmer always gets an answer, and the turn is logged.
    const startedAt = Date.now();
    const supervisorPromise = runSupervisor(messageText, language);
    let result;
    try {
      result = await withTimeout(supervisorPromise, AI_TIMEOUTS.agent, "agent");
    } catch (err) {
      if (!(err instanceof TimeoutError)) throw err;
      // Don't leave a rejected promise unobserved if it later settles.
      supervisorPromise.catch(() => {});
      result = {
        intent: "advisory" as const,
        source: "timeout",
        model: undefined,
        toolCalls: [{ error: "agent budget exceeded" }] as unknown[],
        reply: {
          role: "assistant" as const,
          intent: "advisory" as const,
          content:
            language === "sw"
              ? "Samahani, imechukua muda mrefu kujibu. Tafadhali jaribu tena."
              : "Sorry, that took too long to answer. Please try again.",
        },
      };
    }

    const latencyMs = Date.now() - startedAt;
    const reply = result.reply;

    const assistantMessageId = await appendMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: reply.content,
      data: reply.data,
    });

    await logAgentRun({
      conversationId: conversation.id,
      messageId: assistantMessageId,
      intent: result.intent,
      graphUsed: result.intent,
      modelUsed: result.model ?? result.source,
      toolCalls: result.toolCalls.length ? result.toolCalls : undefined,
      structuredOutput: reply.data,
      latencyMs,
    });

    return {
      ok: true,
      data: {
        conversationId: conversation.id,
        reply,
        aiBacked: result.source !== "heuristic" && result.source !== "timeout",
      },
    };
  } catch {
    // Generic message only — never leak a stack trace or DB error to the client.
    return { ok: false, error: "Couldn’t reach the advisor. Try again." };
  }
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

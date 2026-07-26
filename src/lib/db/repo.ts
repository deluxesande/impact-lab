import { getSql } from "./client";
import type {
  Conversation,
  ConversationMessage,
  FarmerIntent,
  Language,
  Listing,
  Order,
  OrderStatus,
  PricingData,
  UserRole,
} from "@/lib/ai/types";


/**
 * Data access for the farmer surface.
 *
 * Plain parameterized SQL via porsager/postgres — no ORM. Every value is
 * interpolated through the tagged template, which parameterizes rather than
 * concatenates, so these are injection-safe.
 */

/**
 * Wrap a value for a jsonb column.
 *
 * porsager/postgres types `sql.json()` against a `JSONValue` that requires an
 * index signature, which plain interfaces like PricingData don't have. The
 * values we pass are genuinely JSON-serialisable, so this narrow cast is
 * localised here instead of being repeated at every call site.
 */
function toJsonb(sql: ReturnType<typeof getSql>, value: unknown) {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

/* -------------------------------------------------------------------------- */
/* Row shapes (snake_case as stored)                                          */
/* -------------------------------------------------------------------------- */

interface ConversationRow {
  id: string;
  session_id: string;
  language: Language;
}

interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_key: string | null;
  data: PricingData | null;
  created_at: Date;
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the conversation for a session, creating it on first contact.
 *
 * One conversation per `sessionId` (enforced by a unique index), so repeat
 * calls append to the same thread. The upsert also refreshes `language` and
 * `updated_at` when the client switches language mid-thread.
 */
export async function getOrCreateConversation(
  sessionId: string,
  language: Language,
): Promise<ConversationRow> {
  const sql = getSql();
  const [row] = await sql<ConversationRow[]>`
    INSERT INTO conversations (session_id, language)
    VALUES (${sessionId}, ${language})
    ON CONFLICT (session_id) DO UPDATE
      SET language = EXCLUDED.language,
          updated_at = now()
    RETURNING id, session_id, language
  `;
  return row;
}

/**
 * A conversation as stored.
 *
 * Deliberately carries the raw private `imageKey` rather than the API's
 * `imageUrl`: minting a presigned URL is a storage concern, not a database
 * one, so the route layer does that translation. Keeps this module free of
 * any MinIO dependency.
 */
export interface ConversationRecord extends Omit<Conversation, "messages"> {
  messages: (Omit<ConversationMessage, "imageUrl"> & { imageKey?: string })[];
}

/** Fetch a conversation with its messages in chronological order. */
export async function getConversation(
  id: string,
): Promise<ConversationRecord | null> {
  const sql = getSql();

  const [conversation] = await sql<ConversationRow[]>`
    SELECT id, session_id, language
    FROM conversations
    WHERE id = ${id}
  `;
  if (!conversation) return null;

  const rows = await sql<MessageRow[]>`
    SELECT id, role, content, image_key, data, created_at
    FROM messages
    WHERE conversation_id = ${id}
    ORDER BY created_at ASC
  `;

  return {
    id: conversation.id,
    sessionId: conversation.session_id,
    language: conversation.language,
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      ...(r.image_key ? { imageKey: r.image_key } : {}),
      ...(r.data ? { data: r.data } : {}),
      createdAt: r.created_at.toISOString(),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

export interface AppendMessageInput {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  imageKey?: string;
  data?: PricingData;
}

/** Append a turn to a conversation. Returns the new message id. */
export async function appendMessage(input: AppendMessageInput): Promise<string> {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO messages (conversation_id, role, content, image_key, data)
    VALUES (
      ${input.conversationId},
      ${input.role},
      ${input.content},
      ${input.imageKey ?? null},
      ${input.data ? toJsonb(sql, input.data) : null}
    )
    RETURNING id
  `;
  return row.id;
}

/* -------------------------------------------------------------------------- */
/* Agent runs (refinement log)                                                */
/* -------------------------------------------------------------------------- */

export interface LogAgentRunInput {
  conversationId: string;
  messageId: string;
  intent: FarmerIntent;
  /** Phase 3: which sub-graph handled it. */
  graphUsed?: string;
  /** Phase 3: which model won the fallback chain. */
  modelUsed?: string;
  /** Phase 3: Shamba Records queries + results. */
  toolCalls?: unknown;
  structuredOutput?: PricingData;
  latencyMs?: number;
  error?: string;
}

/** Record how an assistant reply was produced, for later refinement. */
export async function logAgentRun(input: LogAgentRunInput): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO agent_runs (
      conversation_id, message_id, intent, graph_used, model_used,
      tool_calls, structured_output, latency_ms, error
    )
    VALUES (
      ${input.conversationId},
      ${input.messageId},
      ${input.intent},
      ${input.graphUsed ?? null},
      ${input.modelUsed ?? null},
      ${input.toolCalls ? toJsonb(sql, input.toolCalls) : null},
      ${input.structuredOutput ? toJsonb(sql, input.structuredOutput) : null},
      ${input.latencyMs ?? null},
      ${input.error ?? null}
    )
  `;
}

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

export interface UserRow {
  id: string;
  clerkId: string;
  role: UserRole;
}

/**
 * Resolve our user row for a Clerk id, creating it on first contact.
 *
 * The role is only applied on insert; an existing user keeps their stored role
 * (a session's role claim shouldn't silently rewrite it here).
 */
export async function getOrCreateUser(
  clerkId: string,
  role: UserRole,
): Promise<UserRow> {
  const sql = getSql();
  const [row] = await sql<UserRow[]>`
    INSERT INTO users (clerk_id, role)
    VALUES (${clerkId}, ${role})
    ON CONFLICT (clerk_id) DO UPDATE
      SET clerk_id = EXCLUDED.clerk_id
    RETURNING id, clerk_id AS "clerkId", role
  `;
  return row;
}

/* -------------------------------------------------------------------------- */
/* Listings                                                                   */
/* -------------------------------------------------------------------------- */

/** Row shape as stored; numeric columns arrive as strings from postgres. */
interface ListingRow {
  id: string;
  farmer_id: string;
  produce_type: string;
  image_key: string | null;
  quantity_kg: string;
  price_per_kg: string;
  currency: string;
  active: boolean;
  created_at: Date;
}

/**
 * A stored listing carrying the raw private image key. Route handlers swap it
 * for a presigned imageUrl, keeping MinIO out of the db layer.
 */
export type ListingRecord = Omit<Listing, "imageUrl"> & { imageKey?: string };

function mapListing(r: ListingRow): ListingRecord {
  return {
    id: r.id,
    farmerId: r.farmer_id,
    produceType: r.produce_type,
    ...(r.image_key ? { imageKey: r.image_key } : {}),
    quantityKg: Number(r.quantity_kg),
    pricePerKg: Number(r.price_per_kg),
    currency: r.currency,
    active: r.active,
    createdAt: r.created_at.toISOString(),
  };
}

export interface CreateListingInput {
  farmerId: string;
  produceType: string;
  quantityKg: number;
  pricePerKg: number;
  currency?: string;
  imageKey?: string;
}

export async function createListing(input: CreateListingInput): Promise<ListingRecord> {
  const sql = getSql();
  const [row] = await sql<ListingRow[]>`
    INSERT INTO listings (farmer_id, produce_type, image_key, quantity_kg, price_per_kg, currency)
    VALUES (
      ${input.farmerId},
      ${input.produceType},
      ${input.imageKey ?? null},
      ${input.quantityKg},
      ${input.pricePerKg},
      ${input.currency ?? "KES"}
    )
    RETURNING *
  `;
  return mapListing(row);
}

/** All active listings, newest first (consumer browse grid). */
export async function listActiveListings(): Promise<ListingRecord[]> {
  const sql = getSql();
  const rows = await sql<ListingRow[]>`
    SELECT * FROM listings
    WHERE active = true
    ORDER BY created_at DESC
  `;
  return rows.map(mapListing);
}

/** A single farmer's listings, newest first (dashboard). */
export async function listFarmerListings(farmerId: string): Promise<ListingRecord[]> {
  const sql = getSql();
  const rows = await sql<ListingRow[]>`
    SELECT * FROM listings
    WHERE farmer_id = ${farmerId}
    ORDER BY created_at DESC
  `;
  return rows.map(mapListing);
}

export async function getListing(id: string): Promise<ListingRecord | null> {
  const sql = getSql();
  const [row] = await sql<ListingRow[]>`SELECT * FROM listings WHERE id = ${id}`;
  return row ? mapListing(row) : null;
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

interface OrderRow {
  id: string;
  consumer_id: string;
  listing_id: string;
  quantity_kg: string;
  total_price: string;
  currency: string;
  status: OrderStatus;
  created_at: Date;
}

function mapOrder(r: OrderRow): Order {
  return {
    id: r.id,
    consumerId: r.consumer_id,
    listingId: r.listing_id,
    quantityKg: Number(r.quantity_kg),
    totalPrice: Number(r.total_price),
    currency: r.currency,
    status: r.status,
    createdAt: r.created_at.toISOString(),
  };
}

export interface CreateOrderInput {
  consumerId: string;
  listingId: string;
  quantityKg: number;
  /** Unit price to bill at; total is computed here to stay consistent with stock. */
  pricePerKg: number;
  currency?: string;
}

/** Thrown when a listing is missing/inactive or lacks the requested stock. */
export class InsufficientStockError extends Error {
  constructor() {
    super("Listing is unavailable or has insufficient stock.");
    this.name = "InsufficientStockError";
  }
}

/**
 * Place an order and consume the listing's stock atomically.
 *
 * A conditional UPDATE decrements quantity_kg only when the listing is active
 * and has enough stock; both the decrement and the order insert run in one
 * transaction. If the UPDATE matches no row (sold out, inactive, gone), the
 * whole thing rolls back and InsufficientStockError is thrown — closing the
 * check-then-act race where two concurrent orders could oversell.
 *
 * @throws {InsufficientStockError}
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const sql = getSql();
  const totalPrice = Math.round(input.quantityKg * input.pricePerKg * 100) / 100;

  return sql.begin(async (tx) => {
    const updated = await tx<{ currency: string }[]>`
      UPDATE listings
      SET quantity_kg = quantity_kg - ${input.quantityKg}
      WHERE id = ${input.listingId}
        AND active = true
        AND quantity_kg >= ${input.quantityKg}
      RETURNING currency
    `;
    if (updated.length === 0) {
      throw new InsufficientStockError();
    }

    const [row] = await tx<OrderRow[]>`
      INSERT INTO orders (consumer_id, listing_id, quantity_kg, total_price, currency)
      VALUES (
        ${input.consumerId},
        ${input.listingId},
        ${input.quantityKg},
        ${totalPrice},
        ${input.currency ?? updated[0].currency}
      )
      RETURNING *
    `;
    return mapOrder(row);
  });
}

/** Orders placed against a given farmer's listings (dashboard "incoming"). */
export async function listOrdersForFarmer(farmerId: string): Promise<Order[]> {
  const sql = getSql();
  const rows = await sql<OrderRow[]>`
    SELECT o.* FROM orders o
    JOIN listings l ON l.id = o.listing_id
    WHERE l.farmer_id = ${farmerId}
    ORDER BY o.created_at DESC
  `;
  return rows.map(mapOrder);
}

/* -------------------------------------------------------------------------- */
/* AI task-graph runs (observability for /api/ai/price, /api/ai/cart)         */
/* -------------------------------------------------------------------------- */

export interface LogAiRunInput {
  endpoint: "price" | "cart";
  source: string;
  modelUsed?: string;
  input?: unknown;
  output?: unknown;
  toolCalls?: unknown;
  latencyMs?: number;
  error?: string;
}

/**
 * Record a stateless AI task-graph run. Best-effort: logging must never break
 * the request, so failures here are swallowed (unlike agent_runs, which is
 * transactional with a persisted conversation).
 */
export async function logAiRun(input: LogAiRunInput): Promise<void> {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO ai_runs (endpoint, source, model_used, input, output, tool_calls, latency_ms, error)
      VALUES (
        ${input.endpoint},
        ${input.source},
        ${input.modelUsed ?? null},
        ${input.input !== undefined ? toJsonb(sql, input.input) : null},
        ${input.output !== undefined ? toJsonb(sql, input.output) : null},
        ${input.toolCalls !== undefined ? toJsonb(sql, input.toolCalls) : null},
        ${input.latencyMs ?? null},
        ${input.error ?? null}
      )
    `;
  } catch (err) {
    console.warn("[ai_runs] log failed:", String(err).slice(0, 160));
  }
}

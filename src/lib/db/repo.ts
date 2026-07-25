import { getSql } from "./client";
import type {
  Conversation,
  ConversationMessage,
  FarmerIntent,
  Language,
  PricingData,
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

/** Fetch a conversation with its messages in chronological order. */
export async function getConversation(id: string): Promise<Conversation | null> {
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

  const messages: ConversationMessage[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    // TODO(Phase 2.5): mint a short-lived presigned GET URL from image_key.
    ...(r.image_key ? { imageUrl: r.image_key } : {}),
    ...(r.data ? { data: r.data } : {}),
    createdAt: r.created_at.toISOString(),
  }));

  return {
    id: conversation.id,
    sessionId: conversation.session_id,
    language: conversation.language,
    messages,
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

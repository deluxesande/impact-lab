/**
 * Shared API contract types for the Farmer surface.
 *
 * These types are the source-of-truth contract between the Next.js API-only
 * backend (this repo) and the native Android client (see docs/android-app-plan.md).
 *
 * Phase 1 ships stub route handlers that return values shaped by these types,
 * so the Android team can integrate immediately while the real AI orchestration
 * layer (LangGraph + Shamba Records + Postgres + MinIO) lands behind the same
 * contract in later phases.
 */

/** Language the farmer-facing assistant responds in. English is the default. */
export type Language = "en" | "sw";

/** Which specialized graph the supervisor routed a message to. */
export type FarmerIntent = "pricing" | "advisory";

/** Price trend direction for a produce/market over a recent window. */
export type PriceTrend = "up" | "down" | "stable";

/**
 * Structured pricing payload attached to an assistant reply when the
 * supervisor routes to the pricing graph. Absent for pure advisory replies.
 */
export interface PricingData {
  /** Canonical produce name resolved against the Shamba products catalog. */
  produce?: string;
  /** Fair recommended price per kilogram. */
  pricePerKg?: number;
  /** Unit the source market quoted (e.g. "90kg bag"), for transparency. */
  unit?: string;
  /** ISO 4217 currency code. Kenyan produce is quoted in KES. */
  currency?: string;
  /** Reference market the price was derived from (e.g. "Gikomba Market"). */
  market?: string;
  /** Recent trend for this produce in the referenced market/region. */
  trend?: PriceTrend;
}

/* -------------------------------------------------------------------------- */
/* POST /api/upload                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Response from the multipart image upload endpoint.
 * The Android app uploads a produce photo; the backend stores it in the
 * private MinIO bucket and returns a stable object key. That key is then
 * passed to POST /api/farmer/agent as `imageKey`.
 */
export interface UploadResponse {
  /** Opaque MinIO object key for the stored image. Never a public URL. */
  objectKey: string;
}

/* -------------------------------------------------------------------------- */
/* POST /api/farmer/agent                                                     */
/* -------------------------------------------------------------------------- */

export interface FarmerAgentRequest {
  /** The farmer's message (produce details, a question, etc.). */
  message: string;
  /**
   * Client-generated session identifier that groups messages into a
   * conversation. Auth (Clerk token + role) will later associate this with a
   * real farmer; in Phase 1 it is the sole conversation key.
   */
  sessionId: string;
  /** Optional MinIO object key for a produce photo (from POST /api/upload). */
  imageKey?: string;
  /** Preferred response language. Defaults to "en" when omitted. */
  language?: Language;
}

export interface FarmerAgentReply {
  role: "assistant";
  /** Human-readable response the farmer sees. */
  content: string;
  /** Which graph produced this reply. */
  intent: FarmerIntent;
  /** Structured pricing payload, present when `intent === "pricing"`. */
  data?: PricingData;
}

export interface FarmerAgentResponse {
  /** Conversation this exchange belongs to (persisted server-side). */
  conversationId: string;
  reply: FarmerAgentReply;
}

/* -------------------------------------------------------------------------- */
/* GET /api/farmer/conversations/:id                                          */
/* -------------------------------------------------------------------------- */

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /**
   * Short-lived presigned GET URL for a produce photo, when the message had
   * one. The backend mints this per request; it is never a permanent URL.
   */
  imageUrl?: string;
  /** Structured pricing payload for assistant pricing turns. */
  data?: PricingData;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface Conversation {
  id: string;
  sessionId: string;
  language: Language;
  messages: ConversationMessage[];
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

/** Uniform error envelope returned by all farmer/consumer endpoints. */
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

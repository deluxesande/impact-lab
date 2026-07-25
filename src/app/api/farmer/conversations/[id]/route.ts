import { NextResponse } from "next/server";
import { requireFarmer, AuthError } from "@/lib/auth/require-farmer";
import { getConversation } from "@/lib/db/repo";
import { presignMany } from "@/lib/storage/minio";
import type { Conversation, ConversationMessage, ApiError } from "@/lib/ai/types";

/**
 * GET /api/farmer/conversations/:id — fetch a farmer conversation with history.
 *
 * Contract (see docs/api-contract.md):
 *   Response: { id, sessionId, language, messages: [...] }
 *   Any `imageUrl` values are short-lived presigned GET URLs minted per request.
 *
 * PHASE 2.5 STATUS: reads real rows from Postgres (conversations + messages),
 * ordered chronologically, and mints a short-lived presigned MinIO GET URL for
 * every message that carries an image. The private object key is never
 * exposed. Unknown ids return 404.
 *
 * Next.js 16: dynamic route `params` is async and must be awaited.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<Conversation | ApiError>> {
  try {
    await requireFarmer();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { code: "missing_id", message: "A conversation id is required." } },
        { status: 400 },
      );
    }
    // The column is uuid; a malformed id would make Postgres raise rather than
    // return no rows, so treat "not a uuid" as "no such conversation".
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Conversation not found." } },
        { status: 404 },
      );
    }

    const record = await getConversation(id);
    if (!record) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Conversation not found." } },
        { status: 404 },
      );
    }

    // Swap private object keys for short-lived presigned GET URLs. A key that
    // fails to presign (e.g. the object was removed) simply yields no
    // imageUrl, so the rest of the history still renders.
    const keys = record.messages
      .map((m) => m.imageKey)
      .filter((k): k is string => Boolean(k));
    const urls = keys.length > 0 ? await presignMany(keys) : new Map<string, string>();

    const conversation: Conversation = {
      id: record.id,
      sessionId: record.sessionId,
      language: record.language,
      messages: record.messages.map(({ imageKey, ...rest }): ConversationMessage => {
        const imageUrl = imageKey ? urls.get(imageKey) : undefined;
        return imageUrl ? { ...rest, imageUrl } : rest;
      }),
    };

    return NextResponse.json(conversation, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load conversation." } },
      { status: 500 },
    );
  }
}

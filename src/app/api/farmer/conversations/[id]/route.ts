import { NextResponse } from "next/server";
import { requireFarmer, AuthError } from "@/lib/auth/require-farmer";
import { getConversation } from "@/lib/db/repo";
import type { Conversation, ApiError } from "@/lib/ai/types";

/**
 * GET /api/farmer/conversations/:id — fetch a farmer conversation with history.
 *
 * Contract (see docs/api-contract.md):
 *   Response: { id, sessionId, language, messages: [...] }
 *   Any `imageUrl` values are short-lived presigned GET URLs minted per request.
 *
 * PHASE 2 STATUS: reads real rows from Postgres (conversations + messages),
 * ordered chronologically. Unknown ids now return 404 instead of a fabricated
 * conversation.
 *
 * Still pending: `imageUrl` currently echoes the stored private object key.
 * Phase 2.5 swaps that for a short-lived presigned MinIO GET URL.
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

    // TODO(Phase 2.5): mint presigned GET URLs for any image object keys.
    const conversation = await getConversation(id);
    if (!conversation) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Conversation not found." } },
        { status: 404 },
      );
    }

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

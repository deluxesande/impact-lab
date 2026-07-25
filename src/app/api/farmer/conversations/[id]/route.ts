import { NextResponse } from "next/server";
import { requireFarmer, AuthError } from "@/lib/auth/require-farmer";
import type { Conversation, ApiError } from "@/lib/ai/types";

/**
 * GET /api/farmer/conversations/:id — fetch a farmer conversation with history.
 *
 * Contract (see docs/api-contract.md):
 *   Response: { id, sessionId, language, messages: [...] }
 *   Any `imageUrl` values are short-lived presigned GET URLs minted per request.
 *
 * PHASE 1 STATUS: STUBBED. Returns a mock conversation so the Android team can
 * build the chat history view. Real reads from Postgres (conversations +
 * messages) and MinIO presigning land in Phases 2 and 2.5.
 *
 * Next.js 16: dynamic route `params` is async and must be awaited.
 */

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

    // TODO(Phase 2): load the conversation + messages from Postgres.
    // TODO(Phase 2.5): mint presigned GET URLs for any image object keys.
    const mock: Conversation = {
      id,
      sessionId: "session-mock",
      language: "en",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "I have 200kg of maize, harvested this week. What is it worth?",
          createdAt: "2026-07-25T09:00:00.000Z",
        },
        {
          id: "msg-2",
          role: "assistant",
          content:
            "A fair rate for your maize is about KES 50 per kg based on recent " +
            "Gikomba Market data. Prices are trending up this week.",
          data: {
            produce: "Maize",
            pricePerKg: 50,
            unit: "90kg bag",
            currency: "KES",
            market: "Gikomba Market",
            trend: "up",
          },
          createdAt: "2026-07-25T09:00:03.000Z",
        },
      ],
    };

    return NextResponse.json(mock, { status: 200 });
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

import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { clerkClient } from "@clerk/nextjs/server";
import { createUserWithProfile, PhoneAlreadyRegisteredError } from "@/lib/db/repo";
import { isRole, type Role } from "@/lib/auth/roles";

/**
 * Clerk webhook — `user.created` (Phase 3: server-side provisioning).
 *
 * This is the ONLY place a role becomes authoritative. The client merely
 * *requests* a role (via unsafeMetadata, see src/lib/auth/capture-role.ts); here
 * we validate it, enforce one-human-one-account by phone, provision the DB rows
 * in a transaction, and bake the role into Clerk metadata with the secret key so
 * it can never be forged from the browser.
 *
 * ── SETUP (do this once in the Clerk dashboard) ───────────────────────────────
 *   1. Configure → Webhooks → Add Endpoint:  https://<your-domain>/api/webhooks/clerk
 *   2. Subscribe to the `user.created` event.
 *   3. Copy the endpoint's Signing Secret and set it in your environment as:
 *
 *        CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *        //  ^^^ INSERT YOUR SIGNING SECRET HERE (Clerk dashboard → Webhooks → Signing Secret)
 *
 *      `verifyWebhook()` reads this env var automatically (it uses Svix under the
 *      hood — no separate `svix` package needed with @clerk/nextjs 7+).
 *
 * NOTE: this route must be PUBLIC (no auth). The signature check IS the auth.
 * The default proxy.ts leaves routes public, so no change is needed there — but
 * make sure any future "protect everything" rule explicitly excludes this path.
 *
 * Next.js 16 App Router: this is a Route Handler; it runs on the Node runtime
 * (needed for the crypto used by signature verification and for postgres).
 */

export const runtime = "nodejs";

/** Clerk phone-number shape on the user.created payload (subset we use). */
interface ClerkPhoneNumber {
  id: string;
  phone_number: string;
  verification?: { status: "verified" | "unverified" | string } | null;
}

/**
 * Pick the user's primary *verified* phone number from the webhook payload.
 * Falls back to the first verified phone if `primary_phone_number_id` is absent.
 * Returns null when no verified number exists.
 */
function extractPhoneNumber(data: {
  phone_numbers?: ClerkPhoneNumber[];
  primary_phone_number_id?: string | null;
}): string | null {
  const phones = (data.phone_numbers ?? []).filter(
    (p): p is ClerkPhoneNumber & { verification: { status: "verified" } } =>
      p.verification?.status === "verified",
  );
  if (phones.length === 0) return null;
  const primary = data.primary_phone_number_id
    ? phones.find((p) => p.id === data.primary_phone_number_id)
    : undefined;
  return (primary ?? phones[0]).phone_number ?? null;
}

/** Read the requested role off unsafe_metadata, validating it. */
function extractRequestedRole(data: { unsafe_metadata?: Record<string, unknown> }): Role | null {
  const raw = data.unsafe_metadata?.role;
  return isRole(raw) ? raw : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1) Verify authenticity. A bad/absent signature is a 400 — never trust the body.
  let event;
  try {
    event = await verifyWebhook(request);
  } catch (err) {
    console.error("[clerk webhook] signature verification failed:", err);
    return NextResponse.json(
      { error: { code: "invalid_signature", message: "Webhook verification failed." } },
      { status: 400 },
    );
  }

  // We only act on user.created. Ack everything else so Clerk stops retrying.
  if (event.type !== "user.created") {
    return NextResponse.json({ ok: true, ignored: event.type }, { status: 200 });
  }

  const data = event.data;
  const clerkId = data.id;

  // 2) Extract the intended role and phone number.
  const role = extractRequestedRole(data);
  if (!role) {
    // No valid role intent reached us. Don't guess — a missing role is a client
    // bug, but returning 200 prevents Clerk from retrying forever. The user can
    // still pick a role via the existing /onboarding flow.
    console.warn(`[clerk webhook] user.created ${clerkId} arrived with no valid role intent.`);
    return NextResponse.json(
      { ok: true, warning: "no_role_intent" },
      { status: 200 },
    );
  }

  const phoneNumber = extractPhoneNumber(data);
  if (!phoneNumber) {
    // Phone is the physical-identity anchor for mutual exclusivity. If Clerk is
    // configured to collect it, this shouldn't happen; surface it loudly but
    // return 200 with a warning (not 422) so Clerk doesn't retry endlessly —
    // same pattern as the missing-role handling above.
    console.error(`[clerk webhook] user.created ${clerkId} has no verified phone number; cannot enforce identity.`);
    return NextResponse.json(
      { ok: true, warning: "no_verified_phone" },
      { status: 200 },
    );
  }

  // 3) Provision in a transaction: phone-uniqueness check + users row + profile.
  try {
    await createUserWithProfile({ clerkId, role, phoneNumber });
  } catch (err) {
    if (err instanceof PhoneAlreadyRegisteredError) {
      // The same human already has an account (possibly under the OTHER role or
      // a different email). This is the exact bypass we exist to block → 409.
      console.warn(`[clerk webhook] duplicate physical identity for ${clerkId}: ${err.message}`);
      return NextResponse.json(
        {
          error: {
            code: "phone_already_registered",
            message: "This phone number is already associated with an account.",
          },
        },
        { status: 409 },
      );
    }
    console.error(`[clerk webhook] provisioning failed for ${clerkId}:`, err);
    return NextResponse.json(
      { error: { code: "provisioning_failed", message: "Could not provision the account." } },
      { status: 500 },
    );
  }

  // 4) Bake the role into Clerk metadata with the SECRET key (server-only), so
  //    it rides in the session and cannot be edited by the client.
  //      - publicMetadata: what the EXISTING gates already read
  //        (roles.ts getRole() + require-user.ts sessionClaims.metadata.role).
  //        Keeping this in sync means nothing currently working breaks.
  //      - privateMetadata: the tamper-proof source of truth. Never sent to the
  //        browser; only readable server-side / via a JWT claim you control.
  try {
    const client = await clerkClient();
    await client.users.updateUser(clerkId, {
      publicMetadata: { role },
      privateMetadata: { role },
    });
  } catch (err) {
    // The DB rows exist but the metadata write failed. Return 500 so Clerk
    // retries; createUserWithProfile is idempotent on clerk_id, so the retry
    // safely re-runs and just re-writes the metadata.
    console.error(`[clerk webhook] metadata write failed for ${clerkId}:`, err);
    return NextResponse.json(
      { error: { code: "metadata_write_failed", message: "Role metadata could not be written." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, role }, { status: 200 });
}

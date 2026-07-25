/**
 * Farmer-role authorization gate for farmer API routes.
 *
 * PHASE 1 STATUS: STUBBED.
 * ------------------------------------------------------------------
 * The Android plan (docs/android-app-plan.md) requires Clerk auth with a
 * role check (farmer vs consumer) on every request. That real check depends
 * on the Android team wiring the Clerk SDK and on us assigning a `role`
 * claim in Clerk user metadata at sign-up.
 *
 * Until then this helper is intentionally permissive: it resolves the caller
 * as a farmer so the Android team can integrate against the contract without
 * being blocked on the full auth flow. The real implementation is sketched
 * below and gated behind AUTH_ENFORCED so flipping it on is a one-line change.
 *
 * TODO(Phase 4): verify the Clerk session token and require role === "farmer".
 */

/** Whether real Clerk auth enforcement is active. Kept off for Phase 1. */
const AUTH_ENFORCED = false;

export interface FarmerContext {
  /** Clerk user id once auth is enforced; null while stubbed. */
  userId: string | null;
  role: "farmer";
}

export class AuthError extends Error {
  constructor(
    public readonly code: "unauthorized" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Resolve and authorize the farmer making this request.
 *
 * @throws {AuthError} once AUTH_ENFORCED is true and the caller is not a
 *         signed-in farmer.
 */
export async function requireFarmer(): Promise<FarmerContext> {
  if (!AUTH_ENFORCED) {
    // Phase 1: permissive stub. Do not use in production.
    return { userId: null, role: "farmer" };
  }

  // TODO(Phase 4): real enforcement, e.g.
  //   const { userId, sessionClaims } = await auth();
  //   if (!userId) throw new AuthError("unauthorized", "Sign in required.");
  //   const role = sessionClaims?.metadata?.role;
  //   if (role !== "farmer") throw new AuthError("forbidden", "Farmer role required.");
  //   return { userId, role: "farmer" };
  throw new AuthError("unauthorized", "Auth enforcement not yet implemented.");
}

import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/db/repo";
import type { UserRole } from "@/lib/ai/types";

/**
 * Role-aware authorization for API routes.
 *
 * Resolves the Clerk session, maps it to our `users` row (creating it on first
 * contact), and optionally enforces a role. The role is read from Clerk public
 * metadata (`sessionClaims.metadata.role`), which the client sets at sign-up.
 *
 * DEV BYPASS: when AUTH_ENFORCED is false (no Clerk secret configured, e.g.
 * local dev or CI), a header-driven stub identity is used so the endpoints can
 * be exercised without a real Clerk session. This never runs when a real
 * CLERK_SECRET_KEY is present in production.
 */

/**
 * Dev/CI bypass is OFF unless AUTH_DEV_BYPASS=1 *and* we're not in production.
 *
 * Gating on its own flag (not "is CLERK_SECRET_KEY absent") keeps the Clerk
 * proxy middleware — which needs a key regardless — decoupled from this. The
 * extra NODE_ENV guard is a safety net: even if AUTH_DEV_BYPASS leaks into a
 * production environment, real Clerk enforcement still applies.
 */
const AUTH_ENFORCED =
  process.env.NODE_ENV === "production" || process.env.AUTH_DEV_BYPASS !== "1";

export interface UserContext {
  /** Our users.id (uuid), not the Clerk id. */
  id: string;
  clerkId: string;
  role: UserRole;
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

function isUserRole(value: unknown): value is UserRole {
  return value === "farmer" || value === "consumer";
}

/**
 * Authorize the caller, optionally requiring a specific role.
 *
 * @param requiredRole when set, a caller without that role gets 403.
 * @throws {AuthError} unauthorized (no session) or forbidden (wrong role).
 */
export async function requireUser(requiredRole?: UserRole): Promise<UserContext> {
  if (!AUTH_ENFORCED) {
    // Dev/CI stub: identity comes from headers, defaulting to a farmer.
    const hdrs = await getDevHeaders();
    const role: UserRole = isUserRole(hdrs.role) ? hdrs.role : "farmer";
    if (requiredRole && role !== requiredRole) {
      throw new AuthError("forbidden", `This endpoint requires the ${requiredRole} role.`);
    }
    const user = await getOrCreateUser(hdrs.clerkId, role);
    // Return the role we authorized against, not the stored one, so the context
    // reflects the current request's identity.
    return { id: user.id, clerkId: user.clerkId, role };
  }

  const { userId, sessionClaims } = await auth();
  if (!userId) {
    throw new AuthError("unauthorized", "Sign in required.");
  }

  const metadata = (sessionClaims?.metadata ?? {}) as { role?: unknown };
  if (!isUserRole(metadata.role)) {
    throw new AuthError("forbidden", "No role assigned to this account.");
  }
  const role = metadata.role;
  if (requiredRole && role !== requiredRole) {
    throw new AuthError("forbidden", `This endpoint requires the ${requiredRole} role.`);
  }

  const user = await getOrCreateUser(userId, role);
  // Return the role validated from the session's Clerk metadata, not the row's
  // stored role, so a metadata change takes effect immediately.
  return { id: user.id, clerkId: user.clerkId, role };
}

/**
 * Read the dev-bypass identity from request headers.
 *
 * Uses next/headers so it works inside route handlers. Header names mirror what
 * a client would send; absent values fall back to a stable stub farmer.
 */
async function getDevHeaders(): Promise<{ clerkId: string; role?: string }> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return {
    clerkId: h.get("x-dev-user-id") ?? "dev-user",
    role: h.get("x-dev-role") ?? undefined,
  };
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Role model for the web surfaces.
 *
 * Ownership split (docs/frontend-discovery.md §6): the frontend *assigns* the
 * role into Clerk `publicMetadata`; the backend *enforces* it later by flipping
 * `AUTH_ENFORCED` in `src/lib/auth/require-farmer.ts`. Until then these helpers
 * are the only gate on the web surfaces.
 *
 * `publicMetadata` is deliberate: it is readable by the client but writable only
 * with the secret key server-side. `unsafeMetadata` would let a user promote
 * themselves by editing a client request.
 */

export type Role = "farmer" | "consumer";

const ROLES: readonly Role[] = ["farmer", "consumer"] as const;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Landing surface for a role. */
export function homeFor(role: Role): string {
  return role === "farmer" ? "/farmer" : "/consumer";
}

/**
 * The signed-in user's role, or null when signed out or not yet assigned.
 *
 * Reads via `currentUser()` rather than `sessionClaims`, because
 * `publicMetadata` is only present in the session token if a custom JWT
 * template has been configured in the Clerk dashboard — which we have not done.
 * `currentUser()` is `fetch`-deduped per request, so repeat calls in one render
 * are free.
 */
export async function getRole(): Promise<Role | null> {
  const user = await currentUser();
  const role = user?.publicMetadata?.role;
  return isRole(role) ? role : null;
}

/**
 * Gate a farmer/consumer page. Returns the caller's userId and role, or
 * redirects:
 *   - signed out            → our /sign-in
 *   - signed in, no role    → "/" to pick one
 *   - signed in, wrong role → that role's own surface
 *
 * Protection lives here in the page, never in `proxy.ts`, per AGENTS.md.
 *
 * ⚠️ **Deliberately not `auth.protect()`.** That helper throws
 * `@clerk/backend: Missing publishableKey` under Clerk's **keyless mode** — which
 * is how this project runs locally, since there is no `.env.local`. The error is
 * raised inside `protect()` before any redirect logic, so `unauthenticatedUrl`
 * doesn't avoid it. `auth()` and `currentUser()` are unaffected.
 *
 * Checking `userId` explicitly works in both keyless and keyed modes, and sends
 * users to *our* `/sign-in` page rather than Clerk's hosted one — which matters
 * because that page sets `forceRedirectUrl="/onboarding"` to route by role.
 *
 * `redirect()` signals by throwing, so this must never be wrapped in a try/catch.
 */
export async function requireRole(role: Role): Promise<{ userId: string; role: Role }> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const current = await getRole();
  if (current === null) redirect("/?pick=1");
  if (current !== role) redirect(homeFor(current));

  return { userId, role: current };
}

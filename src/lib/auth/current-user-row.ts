import { getOrCreateUser, type UserRow } from "@/lib/db/repo";
import { requireRole, type Role } from "./roles";

/**
 * Bridge between page-level auth and the database identity.
 *
 * Two id spaces exist and they are easy to confuse:
 *   - Clerk's `userId` (`user_…`), which `auth()` and `requireRole()` return
 *   - our `users.id` (uuid), which every `repo.ts` function expects
 *
 * `repo.createListing({ farmerId })` and `listFarmerListings(farmerId)` both mean
 * the **uuid**. Passing a Clerk id silently matches nothing — reads come back
 * empty rather than erroring, which is the worst kind of bug to debug mid-demo.
 * So anything touching the database goes through here.
 *
 * `getOrCreateUser` is idempotent (upsert on clerk_id), so this is safe to call
 * on every request; it also means a user who signed up before the database
 * existed gets a row on first contact.
 *
 * Note this deliberately reuses `requireRole()` rather than the backend's
 * `requireUser()`: the two answer different questions. `requireUser()` throws
 * `AuthError` for a route handler to turn into a 401/403 envelope, whereas a page
 * needs a `redirect()`. See roles.ts for why `auth.protect()` isn't used either.
 */
export async function requireUserRow(
  role: Role,
): Promise<{ row: UserRow; clerkId: string; role: Role }> {
  const { userId, role: resolved } = await requireRole(role);
  const row = await getOrCreateUser(userId, resolved);
  return { row, clerkId: userId, role: resolved };
}

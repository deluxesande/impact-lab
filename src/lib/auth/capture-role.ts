/**
 * Role-intent capture for the sign-up flow (Phase 2: edge state capture).
 *
 * The problem: a user lands on `/sign-up?role=farmer`, but the `?role=` param
 * is lost across the OTP / OAuth redirect round-trip. By the time Clerk fires
 * the `user.created` webhook (Phase 3), the original URL is long gone. We need
 * the chosen role to survive that hop so the webhook can assign it server-side.
 *
 * Two independent, redundant channels — the webhook reads whichever is present:
 *
 *   1. `unsafeMetadata.role` on the Clerk SignUp — set during `signUp.create`.
 *      Clerk persists unsafeMetadata through the whole sign-up ceremony and
 *      copies it onto the created user, so it arrives in the webhook payload as
 *      `event.data.unsafe_metadata.role`. It is called "unsafe" because the
 *      CLIENT can write it — which is fine here: it is only an *intent*. The
 *      webhook still validates it and the role is ultimately assigned with the
 *      secret key into public/private metadata, which the client cannot forge.
 *
 *   2. A short-lived `signup_role` cookie — a belt-and-braces fallback for OAuth
 *      flows that don't go through `signUp.create` on our side. HttpOnly is NOT
 *      used deliberately: this value is non-sensitive intent, and the client
 *      code that calls `signUp.create` needs to read it back. It is SameSite
 *      + Secure + short TTL so it can't linger or be sent cross-site.
 *
 * This module is intentionally standalone: it does not modify the existing
 * sign-up page component. Import `captureRoleFromUrl()` in a client component,
 * and pass `roleUnsafeMetadata()` into your `signUp.create({ ... })` call.
 */

import { isRole, type Role } from "./roles";

const ROLE_COOKIE = "signup_role";
const COOKIE_MAX_AGE_SECONDS = 60 * 30; // 30 min — long enough for OTP/OAuth.

/**
 * Read a validated role from the current URL's `?role=` param.
 * Returns null for a missing or unrecognised value (never trust raw input).
 * Client-only (reads `window.location`).
 */
export function readRoleFromUrl(): Role | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("role");
  return isRole(raw) ? raw : null;
}

/**
 * Persist the role intent to the fallback cookie. Call this as soon as the
 * sign-up page mounts, before any redirect can strip the URL param.
 * SameSite=Lax so it survives the top-level OAuth redirect back to us.
 */
export function persistRoleCookie(role: Role): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${ROLE_COOKIE}=${encodeURIComponent(role)}` +
    `; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

/** Read the role back from the fallback cookie (client-side). */
export function readRoleCookie(): Role | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)signup_role=([^;]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  return isRole(value) ? value : null;
}

/** Clear the cookie once the role has been consumed (post-sign-up cleanup). */
export function clearRoleCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * One-shot capture: read the URL param, persist the cookie fallback, and return
 * the role (or null). Call this on sign-up page mount.
 *
 *   useEffect(() => { captureRoleFromUrl(); }, []);
 */
export function captureRoleFromUrl(): Role | null {
  const role = readRoleFromUrl() ?? readRoleCookie();
  if (role) persistRoleCookie(role);
  return role;
}

/**
 * Build the `unsafeMetadata` object to spread into a Clerk `signUp.create` call:
 *
 *   const role = captureRoleFromUrl();
 *   await signUp.create({
 *     emailAddress,
 *     password,
 *     ...roleUnsafeMetadata(role),   // <- carries role into the webhook
 *   });
 *
 * Returns `{}` when no valid role is known, so the spread is a no-op and never
 * writes a bogus value.
 */
export function roleUnsafeMetadata(role: Role | null): { unsafeMetadata?: { role: Role } } {
  return role ? { unsafeMetadata: { role } } : {};
}

/**
 * Farmer-role authorization gate.
 *
 * Superseded by the role-aware `requireUser` in ./require-user. This module
 * remains as a thin, backwards-compatible wrapper so existing imports keep
 * working: `requireFarmer()` is exactly `requireUser("farmer")`.
 */

import { requireUser, AuthError } from "./require-user";
import type { UserContext } from "./require-user";

export { AuthError };
export type { UserContext };

export function requireFarmer(): Promise<UserContext> {
  return requireUser("farmer");
}

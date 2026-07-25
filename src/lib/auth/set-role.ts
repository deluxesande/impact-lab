"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { homeFor, isRole, type Role } from "./roles";

/**
 * Assign the caller's role and send them to that surface.
 *
 * Writes Clerk `publicMetadata` with the secret key, so it cannot be forged from
 * the client. `clerkClient()` is async in Clerk 7 — it returns a promise for the
 * backend client.
 *
 * Switching roles is deliberately allowed: the demo script in docs/mvp.md walks
 * a judge through both surfaces, and blocking the switch would mean creating a
 * second account mid-demo. Revisit if roles ever carry real privilege.
 *
 * Never wrap the `redirect()` below in try/catch — it signals by throwing.
 */
export async function setRole(role: Role): Promise<void> {
  if (!isRole(role)) {
    throw new Error(`Unsupported role: ${String(role)}`);
  }

  const { userId } = await auth();
  if (!userId) {
    // Not signed in — nothing to assign. Send them to pick again after auth.
    redirect("/sign-up");
  }

  const client = await clerkClient();
  await client.users.updateUser(userId, { publicMetadata: { role } });

  redirect(homeFor(role));
}

/**
 * Form-action wrapper. `<form action={...}>` hands us FormData, so the role
 * arrives as a field rather than a typed argument.
 */
export async function setRoleFromForm(formData: FormData): Promise<void> {
  const role = formData.get("role");
  if (!isRole(role)) {
    throw new Error("Missing or invalid 'role' field.");
  }
  await setRole(role);
}

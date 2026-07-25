import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getRole, homeFor, isRole } from "@/lib/auth/roles";
import { setRole } from "@/lib/auth/set-role";

/**
 * Post-authentication hand-off. Clerk redirects here after sign-up/sign-in with
 * the role the user picked on the landing page, e.g. `/onboarding?role=farmer`.
 *
 * This is the only place a role is assigned as a side effect of navigation. It
 * renders nothing — every path ends in a redirect.
 *
 * `searchParams` is a promise in Next 16 and must be awaited (see
 * node_modules/next/dist/docs .../file-conventions/page.md).
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-up");

  const { role: raw } = await searchParams;
  // A repeated query param arrives as an array; take the first value.
  const requested = Array.isArray(raw) ? raw[0] : raw;

  if (isRole(requested)) {
    // Assigns publicMetadata, then redirects to that surface.
    await setRole(requested);
  }

  // No usable role in the URL — fall back to whatever they already have,
  // otherwise send them back to pick one.
  const existing = await getRole();
  redirect(existing ? homeFor(existing) : "/?pick=1");
}

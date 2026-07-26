import { SignUp } from '@clerk/nextjs'
import { isRole } from '@/lib/auth/roles'

/**
 * Clerk sign-up. Carries the role chosen on the landing page through
 * authentication: `/sign-up?role=farmer` sends the user to
 * `/onboarding?role=farmer` once they're signed up, which assigns the role and
 * forwards them to their surface.
 *
 * `forceRedirectUrl` (not `fallbackRedirectUrl`) because the role hand-off must
 * happen even if Clerk has a stored redirect of its own.
 *
 * `searchParams` is a promise in Next 16 and must be awaited.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>
}) {
  const { role: raw } = await searchParams
  const requested = Array.isArray(raw) ? raw[0] : raw

  // Only ever build the redirect from a validated role, so an arbitrary
  // `?role=` value can't be reflected into the URL.
  const redirectUrl = isRole(requested)
    ? `/onboarding?role=${requested}`
    : '/onboarding'

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <SignUp forceRedirectUrl={redirectUrl} signInUrl="/sign-in" />
    </div>
  )
}

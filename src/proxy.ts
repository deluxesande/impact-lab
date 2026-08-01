import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Next.js 16 renamed the `middleware` convention to `proxy`.
// Clerk 7+ supports it directly. All routes are public by default;
// page-level protection still lives in the pages (see src/lib/auth/roles.ts).
//
// Phase 4 — EDGE ACL. This adds a *coarse* mutual-exclusivity guard at the
// edge: a CONSUMER token may not reach farmer routes, and a FARMER token may
// not reach consumer routes. It returns a hard 403 (never a redirect), so a
// wrong-role request can't ping-pong between surfaces in a redirect loop.
//
// ── REQUIRES A CLERK JWT CLAIM ────────────────────────────────────────────────
// The role is read from `sessionClaims.metadata.role`. By default Clerk does
// NOT put publicMetadata into the session token, so you must expose it once in
// the dashboard:
//   Configure → Sessions → Customize session token → add:
//       { "metadata": "{{user.public_metadata}}" }
// Until you add that claim, `role` is undefined here and the ACL SAFELY NO-OPS
// (fail-open at the edge) — page/route-level checks still enforce. This keeps
// keyless local dev and existing sessions working; the edge guard simply
// activates the moment the claim is present.

// Route groups. Adjust these prefixes to match your real surfaces.
// (This project's surfaces are /farmer and /consumer, plus the API routes.)
const isFarmerRoute = createRouteMatcher([
  '/farmer(.*)',
  '/dashboard/farmer(.*)',
  '/api/farmer(.*)',
  '/api/agents/farm-advice(.*)',
  '/api/produce/post(.*)',
])

const isConsumerRoute = createRouteMatcher([
  '/consumer(.*)',
  '/dashboard/consumer(.*)',
  '/api/consumer(.*)',
  '/api/orders/create(.*)',
])

// The webhook authenticates by signature, not session — never gate it here.
const isPublicRoute = createRouteMatcher(['/api/webhooks(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const onFarmer = isFarmerRoute(req)
  const onConsumer = isConsumerRoute(req)
  if (!onFarmer && !onConsumer) return // Not a role-scoped route — let it pass.

  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

  // No role claim in the token (no JWT template yet, keyless dev, or signed
  // out): fail open at the edge and defer to page/route-level enforcement.
  if (role !== 'farmer' && role !== 'consumer') return

  // Mutual exclusivity: block the mismatched surface with a hard 403.
  if (onFarmer && role !== 'farmer') return forbidden('farmer')
  if (onConsumer && role !== 'consumer') return forbidden('consumer')

  // Role matches the surface — allow.
})

/** Hard 403 (no redirect) so wrong-role requests can't loop between surfaces. */
function forbidden(required: 'farmer' | 'consumer'): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'forbidden',
        message: `This area requires the ${required} role.`,
      },
    },
    { status: 403 },
  )
}

export const config = {
  matcher: [
    // Skip Next internals and static files, unless referenced in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk frontend API routes
    '/__clerk/(.*)',
  ],
}

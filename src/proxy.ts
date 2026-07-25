import { clerkMiddleware } from '@clerk/nextjs/server'

// Next.js 16 renamed the `middleware` convention to `proxy`.
// Clerk 7+ supports it directly. All routes are public by default;
// protect resources with `auth.protect()` in pages/actions/handlers.
export default clerkMiddleware()

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

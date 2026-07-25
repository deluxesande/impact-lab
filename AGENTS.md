

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Impact Lab — agent rules

AI-orchestrated food distribution platform. Three surfaces: **farmer logistics**
(fixed rates, farm→city transport), **store analytics** (per-city/produce market
metrics), and **grocery delivery** (Uber-Eats-style, below-supermarket pricing).
AI strategy: orchestrate existing models (loop across free/hosted models) — do
**not** train custom models.

## Stack

- **Runtime/pkg manager: Bun.** Use `bun` for everything — never `npm`, `yarn`, or `pnpm`.
  - `bun install`, `bun add <pkg>`, `bun run dev`, `bun run build`.
- **Next.js 16** (App Router, `src/`, TypeScript, `@/*` import alias).
- **Tailwind CSS v4** for styling.
- **Clerk** (`@clerk/nextjs`) for auth.

## Next.js 16 note

Known breaking change already applied here:

- **`middleware.ts` is renamed to `proxy.ts`** — lives at `src/proxy.ts`.

Read `node_modules/next/dist/docs/` before writing framework code (see banner above).

## Auth (Clerk) rules

- Middleware/proxy: `clerkMiddleware()` exported from `src/proxy.ts` (Next 16 name).
- `<ClerkProvider>` wraps the app **inside `<body>`** (see `src/app/layout.tsx`).
- Always `await auth()` — it's async. Protect resources with `auth.protect()` in
  the page/server-action/route-handler, not in the proxy.
- Use `@clerk/nextjs` (server bits from `@clerk/nextjs/server`) — never `@clerk/clerk-react`.
- **Never** expose `CLERK_SECRET_KEY` to client code. Never read or print `.env.local`.
- Custom auth routes: `/sign-in` and `/sign-up` (catch-all pages already scaffolded).

## Tooling rules for CLI agents

- **Library/API docs → use Context7** (`resolve-library-id` then `query-docs`)
  before writing against any library (Next, Clerk, Tailwind, etc.). Prefer it
  over training memory and web search — versions here are newer than your cutoff.
- **Web app code → run the `vibesec` skill** when writing/changing/reviewing app
  code or on any security scan/audit request.
- **Frontend/UI → run the `impeccable` skill** when designing, building, reviewing,
  or polishing UI. Pull in `apple-design` (motion/gesture) and
  `high-end-visual-design` (typography/spacing) as support.

## Env setup

Copy `.env.example` → `.env.local` and fill Clerk keys from the Clerk dashboard.

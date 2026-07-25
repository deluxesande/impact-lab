# Impact Lab

AI-orchestrated food distribution platform connecting farmers, stores, and
consumers into one supply chain. Three surfaces:

- **Farmer logistics** — fixed, transparent rates and reliable farm→city transport.
- **Store analytics** — per-city/produce market metrics for vendors.
- **Grocery delivery** — Uber-Eats-style consumer app at below-supermarket prices.

AI strategy: orchestrate existing hosted/free models — no custom model training.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, `src/`, TypeScript)
- [Bun](https://bun.sh) — runtime & package manager
- [Tailwind CSS v4](https://tailwindcss.com)
- [Clerk](https://clerk.com) — authentication

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure Clerk

Create an application at the [Clerk dashboard](https://dashboard.clerk.com),
then copy the example env file and fill in your keys:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

`.env.local` is gitignored — never commit real keys, and never expose
`CLERK_SECRET_KEY` to client code.

### 3. Run the dev server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
bun run dev     # start dev server
bun run build   # production build
bun run start   # serve production build
bun run lint    # eslint
```

## Project structure

```
src/
  proxy.ts                        # Clerk middleware (Next 16 renamed middleware.ts → proxy.ts)
  app/
    layout.tsx                    # ClerkProvider + header (auth controls)
    page.tsx                      # landing page
    sign-in/[[...sign-in]]/       # Clerk sign-in
    sign-up/[[...sign-up]]/       # Clerk sign-up
```

## Notes for contributors & CLI agents

Conventions, Next 16 gotchas, Clerk rules, and required tooling (Context7,
`vibesec`, `impeccable`) are documented in [`AGENTS.md`](./AGENTS.md).

Two version-specific gotchas to know up front:

- Middleware lives in `src/proxy.ts`, **not** `middleware.ts` (Next 16 rename).
- Auth visibility uses `<Show when="signed-in" | "signed-out">` — Clerk 7 dropped
  `<SignedIn>` / `<SignedOut>`.

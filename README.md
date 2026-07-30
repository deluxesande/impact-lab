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

## Run continuously on a VPS with Docker

The production image uses Next.js standalone output and runs as a non-root
user. Compose starts it detached and restarts it after crashes or VPS reboots.

```bash
cp .env.example .env
# Fill in production keys and replace every default password in .env.
chmod 600 .env

sudo systemctl enable --now docker
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
```

Leaving SSH or pressing `Ctrl+C` after viewing logs does not stop the services:

```bash
docker compose --env-file .env logs -f app
```

The app listens on port `3000` by default. Set `APP_PORT` in `.env` to change
the host port. Postgres and MinIO bind only to localhost; expose the app and
object storage through a TLS reverse proxy such as Caddy or Nginx. To use an
existing `.env.local` instead, prefix commands with `APP_ENV_FILE=.env.local`
and pass `--env-file .env.local`.

To deploy an update, pull the new code and run the same `up` command again.

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

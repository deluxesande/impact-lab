# Frontend Technical Discovery — Web Surface

**Owner:** Mike (web/frontend)
**Status:** decisions locked, ready to build
**Scope:** the Next.js web app only. Android, AI orchestration, and persistence are
owned by other team members.

Read alongside [`mvp.md`](./mvp.md) (what we're building),
[`api-contract.md`](./api-contract.md) (what the backend exposes today), and
[`../AGENTS.md`](../AGENTS.md) (repo conventions).

---

## 1. Position of the web surface

**Web is the demo surface.** Judges see the browser. Android remains in the
pitch as the mashinani-facing client and a fast-follow, but the 3-minute demo in
`mvp.md` runs on web — no APK install, no emulator, shareable as a URL.

> ⚠️ **Doc conflict to resolve with the team.**
> [`android-app-plan.md`](./android-app-plan.md) currently says *"No web
> frontend; Next.js becomes API-only"* and *"Strip frontend — remove
> `src/app/`"*. That is now stale. It needs amending, or a reviewer will
> reasonably delete the work in this document.

---

## 2. What exists today

| Area | State |
| --- | --- |
| `POST /api/upload` | Stub. Validates multipart, **discards the file**, returns a fabricated `objectKey` that resolves to nothing. |
| `POST /api/farmer/agent` | Stub. Keyword intent router (`pricing` \| `advisory`), canned EN/SW copy, real structured `PricingData`. |
| `GET /api/farmer/conversations/:id` | Stub. |
| `/api/consumer/*` | **`501 Not Implemented`** — both `route.ts` and a `[...path]` catch-all. |
| Auth | Clerk wired; `requireFarmer()` is permissive (`AUTH_ENFORCED = false`). No role concept anywhere. |
| Web UI | `create-next-app` default + Clerk header. Landing page with 3 pillar cards. No components dir, no design system. |

**The API does not match the MVP screens.** `mvp.md` promises
`POST /api/farmer/listing`, `GET /api/consumer/listings`,
`POST /api/consumer/order`, `POST /api/ai/price`, `POST /api/ai/cart` — none
exist. There is no `Listing` or `Order` persistence at all (Postgres is Phase 2).
So today there is no endpoint behind the farmer dashboard, the consumer grid, or
the cart.

**Resolution:** I own the missing routes as fixture-backed Next route handlers
matching the `mvp.md` contract (§5). The backend swaps the internals later
without touching my UI.

---

## 3. Design system

### 3.1 Colour — 1 primary, neutral, semantic

Tailwind palette. No secondary, no tertiary.

> **Note:** Tailwind **v4 re-specified its palette in oklch**, so the hexes
> differ from the v3 values most references (and most training data) still quote.
> `emerald-500` is `#00bc7d` in v4, not `#10b981`. The table below is the v4
> palette read out of `node_modules/tailwindcss/theme.css`, with WCAG ratios
> computed against white.

| Role | Token | v4 hex | vs white | Use |
| --- | --- | --- | --- | --- |
| **Primary** | `emerald-700` | `#007a55` | **5.37** ✅ | Buttons, links, active states, focus ring |
| Primary hover | `emerald-800` | `#006045` | 7.58 ✅ | Hover / pressed |
| Primary accent | `emerald-500` | `#00bc7d` | 2.46 ❌ | **Decorative fills only** — never text, never text on it |
| Primary tint | `emerald-50` | — | — | Tinted surfaces, selected rows, badges |
| Neutral | `zinc-50…950` | — | — | Surfaces, borders, all text |
| Success | `green-700` | `#008236` | 4.94 ✅ | Confirmations |
| Warning | `amber-500` | `#fe9a00` | 2.15 ❌ | **Fill only, dark text on it** — never a text colour |
| Danger | `red-600` | `#e7000b` | 4.76 ✅ | Destructive, validation errors |
| Info | `sky-700` | — | ✅ | Neutral notices (`sky-600` is 4.02 — AA-large only) |

**Shade choice here is dictated by contrast, not taste.** The obvious reading of
"emerald primary" is `emerald-500`, but at 2.46:1 it fails AA both as a text
colour *and* as a button fill under white text — a white-on-`emerald-500` primary
button is not accessible. `emerald-600` only reaches 3.67 (AA-large). So:

> **Rule: any token that carries text is `-700` or darker. `-500` shades are
> fills and icons only.**

**Known risk: primary and success are both green.** Mitigations, applied without
exception:

1. Success is `green-700` — materially darker and less saturated than
   `emerald-500`.
2. **Every semantic message pairs colour with a Reicon glyph and text.** Colour
   is never the sole carrier of meaning. This is also our colour-blindness floor.
3. Success colour is reserved for *transient feedback* (toasts, confirmation
   states). Persistent brand chrome only ever uses `emerald`.

**Price-trend colours are surface-dependent.** `PricingData.trend` is
`up | down | stable`. Rising prices are *good news for a farmer* and *bad news
for a consumer*, so red/green would invert meaning between our two surfaces.
Decision: **trend is rendered neutrally** — a `zinc-500` arrow glyph plus an
explicit word ("Prices rising") on both surfaces. Sentiment colour is applied
only on the farmer surface, where "up" is unambiguously positive.

### 3.2 Mode — light only

One theme, built properly. The `prefers-color-scheme` block currently in
`globals.css` gets **removed** — right now the app is accidentally dual-mode and
untested in both, which is worse than committing to one. No `next-themes`, no
Animate UI theme toggler.

### 3.3 Typography — Poppins

Loaded via `next/font/google`. Poppins is **not a variable font** on Google
Fonts, so weights must be enumerated. We take three:

```ts
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});
```

**Blocking fix:** `globals.css` currently ends with
`body { font-family: Arial, Helvetica, sans-serif }` — a create-next-app
leftover that overrides the font variables `layout.tsx` sets up. Poppins is dead
on arrival until that line goes.

**Figures use a tabular face.** Poppins' digits are wide and not tabular, which
makes price columns and the "KES 120 vs KES 210" comparison drift. Geist Mono is
already installed and stays, scoped to a `.tabular` / `font-mono` utility for
prices, quantities, and any right-aligned numeric column. Poppins owns
everything else.

| Role | Size / weight | Notes |
| --- | --- | --- |
| Display | `text-4xl`–`text-5xl` / 600 | Landing hero only |
| H1 | `text-3xl` / 600 | Page titles |
| H2 | `text-xl` / 500 | Section headers |
| Body | `text-base` / 400 | `leading-relaxed` |
| Small / meta | `text-sm` / 400 | `zinc-600` |
| Price | `font-mono` / 500 | Tabular, never Poppins |

Tracking: Poppins is geometric and wide — display and H1 get
`tracking-tight`. Nothing gets letter-spacing added.

### 3.4 Shape, elevation, density

- **Radius:** `0.75rem` base (`rounded-xl` cards, `rounded-lg` inputs/buttons,
  `rounded-full` pills and avatars). Set once at `shadcn init`.
- **Elevation:** flat surfaces with `border-zinc-200` as the default. Shadows are
  reserved for genuinely floating layers — dropdowns, dialogs, sheets, toasts.
  No shadow on cards. This is the single biggest lever on "simple and calm."
- **Spacing:** Tailwind's 4px scale; sections step in multiples of 8
  (`gap-2/4/6/8`). Page gutters `px-6` mobile, `px-8` from `md`.
- **Content width:** `max-w-6xl` for the app surfaces, `max-w-3xl` for prose and
  forms. Never full-bleed text.

### 3.5 Motion

You asked for *simple, little to no friction* — so Animate UI's capability is
deliberately underused. Motion communicates state change; it never decorates.

- **Durations:** 120ms micro (hover, press), 180ms standard (enter/exit, tabs),
  240ms max (sheets, dialogs). Nothing slower.
- **Easing:** `ease-out` entering, `ease-in` leaving. No spring bounce on
  anything the user has to interact with repeatedly.
- **Allowed:** layout transitions, list add/remove (cart items), tab indicators,
  skeleton→content crossfade, the AI price card arriving, toast enter/exit.
- **Not allowed:** animated backgrounds, parallax, entrance animations on page
  load, anything decorative on the farmer surface. Animate UI's Backgrounds
  (Fireworks, Gravity Stars, Hole, …) are **out of scope** — one possible
  exception is a single restrained accent on the landing hero.
- **`prefers-reduced-motion: reduce` is respected globally**, not per-component.

### 3.6 Iconography — Reicon

`reicon-react` v1.1.302. 2,674 icons × 2 weights, zero dependencies,
`sideEffects: false`, per-icon subpath exports. Tree-shakes cleanly.

```ts
import { Home, ShieldCheck, AltArrowDown } from "reicon-react";
```

Rules:

- **Outline is the default.** **Filled** marks active/selected state only.
- Sizes: `16` inline with text, `20` in buttons and inputs, `24` in nav and
  empty states. No other sizes.
- Icons inherit `currentColor`. Never hard-code an icon colour.
- Decorative icons get `aria-hidden`; icon-only buttons get an `aria-label`.

> ⚠️ **`lucide-react` will be in the tree regardless.** Many Animate UI registry
> items depend on it (e.g. `components-radix-sheet`, `components-radix-sidebar`),
> and its whole `icons-*` group is animated Lucide. That's fine — Lucide
> tree-shakes — but the rule is: **we never author with Lucide.** It appears only
> where a vendored Animate UI component already imports it. Where practical I'll
> swap those internal imports to Reicon when I touch the file, since we own the
> vendored source.

---

## 4. Component strategy — Animate UI via shadcn

Animate UI is **not an npm package**. It's a shadcn-style registry: components
are copied into our repo, so we own and can edit every file. Verified against the
live registry — **580 items** across `components`, `primitives`, `icons`,
`hooks`, and `lib`.

### 4.1 Primitive family — Radix UI, exclusively

Animate UI ports the same components across Radix UI, Base UI, and Headless UI.
Mixing families means installing two or three competing primitive dependencies
for overlapping components. **We use `components-radix-*` and
`primitives-radix-*` only.** Base UI (`@base-ui-components/react`) and Headless
UI (`@headlessui/react`) are off-limits.

Radix has the fullest catalogue, and it's the one that includes the pieces this
app actually needs:

`accordion` · `alert-dialog` · `checkbox` · `dialog` · `dropdown-menu` ·
`files` · `hover-card` · `popover` · `preview-link-card` · `progress` ·
`radio-group` · `sheet` · `sidebar` · `switch` · `tabs` · `toggle` ·
`toggle-group` · `tooltip`

Anything Animate UI doesn't cover falls back to plain shadcn/ui, which we need
anyway (§4.3).

### 4.2 Setup

✅ **Done — shadcn 4.15.0 verified against Next 16.2.11 + Tailwind v4 + Bun
1.3.14.** No compatibility problem; the fallback plan was not needed.

`shadcn info` correctly detects the project (`next-app`, `srcDirectory`, `rsc`,
`typescript`, `tailwindVersion v4`, `importAlias @`). The init that was run:

```bash
bunx --bun shadcn@latest init --template next --base radix \
  -p nova --no-monorepo --css-variables --pointer --yes
```

Flag notes, all discovered the hard way:

- **`-b, --base` is new in shadcn 4.x** and selects the primitive library
  (`base` | `radix` | `aria`). `--base radix` is what enforces our §4.1
  decision; it writes `"style": "radix-nova"` into `components.json`.
- **`--yes` does not make init non-interactive.** It still prompts for a preset.
  Pass `-p <name>`; valid names are `nova, vega, maia, lyra, mira, luma, sera,
  rhea`. There is no `--base-color` flag any more — presets replaced it.
- `shadcn preset decode` only accepts *encoded* preset codes, so it cannot be
  used to validate a preset name. Misleading.
- We took `nova` (Lucide/Geist) as the most neutral base and override its font
  and icon choices ourselves. Preset choice is therefore near-cosmetic for us.
- `--pointer` adds `cursor: pointer` to enabled buttons. Kept — it suits the
  low-friction brief.

Then the namespaced registry was added to `components.json`:

```jsonc
{
  "registries": {
    "@animate-ui": "https://animate-ui.com/r/{name}.json"
  }
}
```

✅ **Registry verified end-to-end.**
`bunx --bun shadcn@latest add @animate-ui/components-radix-tabs` resolved the
whole transitive graph unprompted — 8 files (the component, its Radix primitive,
two effects primitives, two hooks, and `get-strict-context`) — and auto-installed
`motion@^12.42.2`. `bun run build` and `bun run lint` both pass afterwards.

Animate UI also documents a **shadcn MCP server** (`shadcn mcp`), which lets an
agent read exact component source instead of guessing. Worth wiring locally — it
does not affect the shipped app.

### 4.2.1 Lint: registry code violates Next 16's React Compiler rules

Adding one Animate UI component produced **4 ESLint errors, all in vendored
code** — `react-hooks/set-state-in-effect` ×3 and `react-hooks/static-components`
×1. Since `bun run lint` must be clean before every PR (§8), and every new
component risks more of these, this needed a standing policy rather than
case-by-case suppression.

**Policy:** `eslint.config.mjs` turns those two rules off for *registry-managed
paths only*. They stay on for everything we author. Fixing the files in place
would not stick — `shadcn add` overwrites them.

The CLI also drops transitive hooks into `src/hooks/` and utils into `src/lib/`,
i.e. straight into directories our own code would otherwise use. So:

> **Convention:** `src/hooks/` is **registry-owned**. App-specific hooks live
> beside their feature, or in `src/lib/hooks/` — never in `src/hooks/`.

### 4.2.2 What init changed, and one bug it left

Two problems from §3 fixed themselves:

- The `body { font-family: Arial }` override is **gone**.
- The `prefers-color-scheme: dark` block was replaced by an **opt-in `.dark`
  class variant** (`@custom-variant dark`). Since nothing ever adds `.dark`, we
  are light-only by default — no stripping required. The unused `.dark` block is
  left in place as harmless dead CSS.

Also added: `radius` tokens (`--radius: 0.625rem`, to be changed to our
`0.75rem`), the full neutral/greyscale token set (primary to be replaced with
emerald), `@import "shadcn/tailwind.css"`, and `src/components/ui/button.tsx`.

> **`shadcn` is correctly a runtime dependency, not a dev one** — `globals.css`
> does `@import "shadcn/tailwind.css"`, so the build needs it. Do not "fix" this.
> `shadcn eject` would inline it if we ever want the dependency gone.

> 🐛 **Bug init left behind:** it wrote `--font-sans: var(--font-sans)` — a
> self-referential variable that nothing defines, while `layout.tsx` still
> declares `--font-geist-sans`. So `html { @apply font-sans }` currently resolves
> to nothing and the app renders in the browser default font. Fixed as part of
> the Poppins wiring in step 1.

### 4.3 Dependencies this pulls in

From the registry, the full set of npm packages any Animate UI item can require:

| Package | Why | Taking it? |
| --- | --- | --- |
| `motion` | Animation engine, core to Animate UI | ✅ |
| `radix-ui` | Unified Radix package (not `@radix-ui/react-*`) | ✅ |
| `class-variance-authority` | Component variants | ✅ |
| `tailwind-merge` + `clsx` | shadcn `cn()` util | ✅ |
| `tw-animate-css` | Registry style dependency | ✅ |
| `lucide-react` | Transitive only — see §3.6 | ⚠️ transitive |
| `next-themes` | Theme switching | ❌ light-only |
| `@base-ui-components/react` | Base UI family | ❌ |
| `@headlessui/react` | Headless UI family | ❌ |
| `embla-carousel*`, `shiki`, `@floating-ui/react`, `react-use-measure` | Per-item | Only if that item is used |

**Animate UI depends on plain shadcn/ui components.** Registry items reference
`button`, `input`, `separator`, `skeleton`, `use-mobile`, and `utils` without a
namespace — meaning base shadcn/ui is a requirement, not an alternative. Those
get installed up front.

### 4.4 Components we'll actually use

| Need | Source |
| --- | --- |
| Buttons | shadcn `button`, restyled to our tokens |
| Farmer form fields | shadcn `input`, `select`, `label`, `form` |
| Image dropzone | `@animate-ui/components-radix-files` |
| Price reveal card | Hand-built + `motion` |
| Tabs (farmer dashboard: Listings / Orders) | `@animate-ui/components-radix-tabs` |
| Mobile nav | `@animate-ui/components-radix-sheet` |
| Confirm destructive | `@animate-ui/components-radix-alert-dialog` |
| Tooltips ("why this price?") | `@animate-ui/components-radix-tooltip` |
| Toasts | shadcn `sonner` |
| Loading | shadcn `skeleton` |
| Cart quantity steppers | Hand-built, `motion` layout animation |

Deliberately skipped: Backgrounds, Community components (Radial Menu, Playful
Todolist, …), Liquid/Ripple/Flip buttons, GitHub Stars anything. They fight the
brief.

---

## 5. Data & API layer

### 5.1 No new API routes — Server Actions instead

**Decided: the web surface adds no HTTP route handlers at all.** An earlier draft
of this document planned six. That was wrong, and worth explaining because it
also settles the `/api/consumer/*` ownership question.

Nothing on the web surface needs HTTP. Server Components read the store directly
as a module import; every mutation (create listing, place order, build cart) is a
**Server Action**. Route handlers only earn their place when a *separate* client
consumes them — and the Android app already has its own contract
([`api-contract.md`](./api-contract.md)), owned by the backend.

What this buys:

- **The `/api/consumer/*` collision disappears.** No need to negotiate a
  namespace that already holds a teammate's `501` catch-all, and no risk of two
  people editing the same tree.
- Less code, no fetch wrappers, no serialisation layer between a page and its
  own data, and no duplicated validation.
- Type safety end to end — the page imports the same types the store exports.

Cost, stated plainly: there is nothing HTTP-shaped for Android to reuse. That is
acceptable because Android was never going to call our fixtures; it calls the
real backend.

**The one exception is the existing `POST /api/farmer/agent`**, which we *do* call
over HTTP because it is a teammate's real endpoint. `mvp.md` also lists a
`POST /api/ai/price`; we don't build it — the agent already classifies pricing
intent and returns structured `PricingData`, so the farmer form synthesises a
message (`"I have {qty}kg of {produce}"`) and reads `reply.data`.

### 5.2 Store

A `globalThis`-pinned in-memory store seeded from fixtures, so it survives dev
HMR. `Listing` / `Order` shapes taken verbatim from `mvp.md`'s data model.

**Decided: the demo runs from localhost on a laptop** — one persistent Node
process, so an in-memory store is entirely sufficient and no database enters
frontend scope. Limits, stated plainly: state resets on server restart, and this
would break across instances if we ever moved to serverless. Both are acceptable
for a 3-minute demo; neither is acceptable for production, and the doc should be
re-read before anyone deploys this.

### 5.2.1 Two integration hazards found while building this

**The pricing agent always answers "Maize, KES 50".** `mockPricingReply` in
`src/app/api/farmer/agent/route.ts` returns maize regardless of the produce
asked about. Taken at face value, a farmer listing tomatoes would be told their
crop is maize worth 50 — visibly wrong on stage, and exactly the kind of thing
that surfaces during a demo rather than before one. `pricing.ts` therefore
verifies the reply is *about the produce we asked about* and falls back to the
catalogue's `referencePricePerKg` when it isn't. The UI always shows which source
was used (`source: "agent" | "reference"`); a reference price is never dressed up
as an AI answer. When the real pricing graph lands in Phase 3 the reply will
match and the guard becomes a no-op.

**The cart builder is not AI.** `mvp.md` specifies `POST /api/ai/cart`;
`/api/consumer/*` returns `501` and AI orchestration is a teammate's scope. So
`buildCart` is a deterministic matcher — produce aliases (English, Swahili,
Sheng) plus head-count and explicit-weight parsing. It handles the demo script's
phrasings including `"nyanya kwa watu tatu"`. Swapping it for a real model call
means replacing that one function; the screens depend only on its `CartItem[]`
return type.

> ⚠️ **Do not call the cart builder "AI" in the demo** until that swap happens.
> Describe it as the ordering flow. The price *is* a real (stubbed) backend call;
> the cart is not.

### 5.3 Fetching & state

- **Server Components** read data directly from the store. Default.
- **Server Actions** for mutations (create listing, place order) — no client
  fetch wrappers, no react-query.
- **Client state** only where genuinely interactive: the consumer composer and the
  cart. The cart is a **module-level store read via `useSyncExternalStore`**
  (`src/lib/cart-store.ts`), mirrored to `sessionStorage` so it survives the hop to
  `/consumer/order/confirm`. No provider, no effect — see §5.3.1.
- All money formatted through one `formatKES()` helper wrapping
  `Intl.NumberFormat("en-KE", { currency: "KES" })`. Never inline string
  concatenation.

### 5.3.1 Why the cart isn't `useState` + `useEffect`

The obvious implementation — React state seeded from `sessionStorage` in a mount
effect — was written first and rejected for two reasons found while building:

1. **It trips `react-hooks/set-state-in-effect`** (a React Compiler rule shipping
   with eslint-config-next 16), and the rule is correct: the pattern causes a
   cascading render and flashes an empty basket on every page load.
2. **A `clear()` in an effect is an infinite loop.** `useCart()` returns fresh
   function identities each render, so `useEffect(() => { if (placed) clear() },
   [placed, clear])` re-runs on every render, commits a new cart snapshot,
   re-renders, and loops. This was caught before shipping; the cart is now cleared
   inline after the order succeeds, and `commit()` additionally no-ops when the
   cart is unchanged so no caller can reintroduce the loop.

`useSyncExternalStore` is the primitive built for this: `getServerSnapshot()`
covers SSR and hydration, then it switches to the live client snapshot with no
mismatch and no effect. Snapshots are reference-stable and only replaced on real
change. A side benefit is that no provider needs mounting, so the consumer layout
stays a plain Server Component.

### 5.4 Images

Upload is mocked and returns a key that resolves to nothing, so **nothing the
demo "uploads" can ever be fetched back.** The demo script's "upload tomatoes
photo" beat would end in a placeholder.

**Implemented (step 5):** the client downscales the chosen photo to a ~640px JPEG
data URL (`src/lib/image.ts`) and stores *that* on the listing, so the photo the
farmer just took really does appear on their dashboard and the consumer grid. The
file is also POSTed to `/api/upload` so the flow exercises the teammate's real
endpoint and its validation — a failure there is ignored, because the returned key
is unusable either way in Phase 1.

`createListingAction` rejects any `photo` that isn't a `data:image/` URL under
400 KB, since the string ends up inline in the HTML of every page rendering that
card.

This is viable **only** because the store is in-memory on localhost (§5.2). A data
URL is the wrong way to persist an image anywhere real — when MinIO lands in Phase
2.5, delete `src/lib/image.ts` and use the `objectKey` with a presigned URL.

**No photo files are committed.** Listings without a photo — the six seeded ones —
get a generated placeholder: neutral surface, emerald glyph, produce name. It is
deliberately **on-palette**; a per-produce colour scheme would have quietly broken
the one-primary rule. This also closes open question #6 without needing to source
or license any stock photography.

---

## 6. Auth & roles

- Role picker on `/` routes into Clerk sign-up carrying intent.
- After sign-up, a **Server Action writes `role: "farmer" | "consumer"` to Clerk
  `publicMetadata`.** Frontend owns assignment; the backend flips
  `AUTH_ENFORCED` and enforces it later.
- `/farmer/*` and `/consumer/*` call `await auth()` and check the role claim in
  the page — never in `proxy.ts`, per `AGENTS.md`.
- A signed-in user with no role yet gets routed back to the picker rather than a
  dead end.
- `CLERK_SECRET_KEY` never crosses into client code. `.env.local` is never read
  or printed.

### 6.1 Swahili

An **EN / SW toggle on the farmer surface only**, passing `language` to
`/api/farmer/agent` — which already returns genuine Swahili copy. Our own UI
chrome stays English; this is not full i18n. Cheap to build, and it's a real
demo beat for the mashinani theme rather than a claim.

---

## 7. Build order

Each step is a separate PR per `CONTRIBUTING.md` (issue first, branch off `main`,
1 approval, squash merge).

| # | Work | Unblocks |
| --- | --- | --- |
| 0 | ✅ **Done** — shadcn CLI verified on Next 16 + Tailwind v4 + Bun; `init` run, `@animate-ui` registry wired and proven, lint policy set (§4.2–4.2.2) | everything |
| 1 | ✅ **Done** — Poppins wired + `--font-sans` bug fixed, emerald/semantic tokens (contrast-verified), `--radius: 0.75rem`, `figure` utility, global reduced-motion, `reicon-react`, base shadcn components | all UI |
| 2 | ✅ **Done** — `SiteHeader` + wordmark, `DesktopNav`/`MobileNav` (Sheet) off one shared `NavItem[]`, `formatKES`/`formatRate`/`formatKg`/`savingPercent`, Toaster (de-`next-themes`'d), `EmptyState`/`ErrorState`. Nav components compile but are first *exercised* in step 5. | all screens |
| 3 | ✅ **Done** — landing hero + `RolePicker` (3 auth states), `roles.ts` (`getRole`/`requireRole`), `setRole` Server Action writing `publicMetadata`, `/onboarding` hand-off, sign-in/up `forceRedirectUrl`, `.env.example` | routing |
| 4 | ✅ **Done** — produce catalogue, `Listing`/`Order` types, `globalThis` store (copy-on-read, seeded), `suggestPrice` w/ agent-mismatch guard, `buildCart` (deterministic stand-in), 4 Server Actions. 24 logic assertions passing. | 5, 6 |
| 5 | ✅ **Done** — `/farmer` dashboard (Animate UI Tabs, listings + orders, empty states), `/farmer/new` (produce/qty/photo → `PriceCard` w/ source badge → editable rate → publish), live buyer-card preview, EN/SW toggle, `ProduceImage`, client-side image downscaling | demo beat 1 |
| 6 | ✅ **Done** — `/consumer` grid w/ live savings headline, `/consumer/order` composer + cart review (steppers, animated add/remove), `/consumer/order/confirm` + success screen. Cart is a module store read via `useSyncExternalStore`. | demo beat 2 |
| 7 | ✅ **Done** — `MotionConfig reducedMotion="user"`, `icon.svg` + metadata/viewport + title template, `error.tsx`/`not-found.tsx`, `loading.tsx` for both data surfaces, cart row made mobile-safe, focus-ring + contrast audits (§8) | demo |

Steps 5 and 6 are independent once 4 lands.

---

## 8. Accessibility & quality floor

Non-negotiable, checked in step 7:

- Text contrast ≥ 4.5:1, verified numerically per §3.1 rather than by eye.
  `emerald-500` (2.46) and `amber-500` (2.15) are fills only; `emerald-600`
  (3.67) and `sky-600` (4.02) are AA-large only and unused for body text.
- `prefers-reduced-motion: reduce` is enforced **twice**, because one mechanism is
  not enough: the global CSS rule in `globals.css` covers CSS animation, and
  `<MotionConfig reducedMotion="user">` in the root layout covers Motion's
  JS-driven inline transforms. **Motion's own default is `"never"`** — it ignores
  the OS setting unless told — so without the provider every Animate UI component
  (they all use Motion internally) kept animating for users who asked it not to.
  CSS cannot stop JS-written transforms, so the CSS rule alone was doing nothing
  for them.

**Audited in step 7, measured rather than eyeballed:**

- Every hand-written raw `<button>` carries `focus-visible:ring`; everything else
  routes through shadcn `Button`/`Input`/`Select`, which ship their own. No
  `outline: none` without a replacement. `--ring` is `emerald-700`, and
  `ring-offset` resolves to white — correct for a light-only app.
- Composited (not just on-white) contrast for every tinted pair in use:

  | Pair | Ratio |
  | --- | --- |
  | `text-primary` on `bg-primary-tint` | 5.09:1 ✅ |
  | `text-primary` on `bg-primary-tint/50` | 5.23:1 ✅ |
  | `text-destructive` on `bg-destructive/5` | 4.58:1 ✅ |
  | `text-success` on `bg-success/10` | **4.55:1** ✅ (tightest — don't lighten that tint) |

- The cart row was ~360px of fixed-width content, which overflowed a 375px phone
  inside the page gutters. It is now two rows below `sm`.
- Visible focus ring on every interactive element. Never `outline: none` without
  a replacement.
- The consumer chat is fully keyboard-operable; new AI messages announce via a
  polite live region.
- Every form error is text, adjacent to its field, and linked by
  `aria-describedby` — not colour alone.
- Real `alt` on produce images.
- `bun run lint` and `bun run build` clean before every PR.

---

## 9. Open questions

| # | Question | Blocks | Owner |
| --- | --- | --- | --- |
| 1 | ✅ **Resolved: localhost on a laptop.** One persistent Node process, so the `globalThis` in-memory store (§5.2) is sufficient and no database enters frontend scope. Re-read §5.2 before anyone deploys this. | — | settled |
| 2 | ✅ **Dissolved, not negotiated.** The web surface adds **no HTTP route handlers** — Server Components read the store directly, mutations are Server Actions (§5.1). Nothing of ours goes near the `501` catch-all, so the namespace stays entirely the backend's. | — | settled |
| 3 | `android-app-plan.md` says strip the frontend. Amend it? | reviewer confusion | team |
| 4 | ✅ **Resolved.** Clerk **keyless mode auto-provisions a real dev instance** on first `bun run dev` — sign-up, sign-in and the secret key all work with no `.env.local` at all. Keys land in `.clerk/.tmp/keyless.json`, which is already gitignored (`.gitignore:43`). `.env.example` has been added. **Open sub-question:** the keyless instance is per-machine, so all four of us get different ones — if we need a shared user pool for the demo, someone should claim it and share the keys. | — | team |
| 5 | ⚠️ **Placeholder in place — swap if anyone has a real mark.** I set type: "Impact Lab" in Poppins 600 beside an emerald leaf glyph, with a matching `src/app/icon.svg` (replaces the default Next favicon, now deleted). Functional, not a brand identity. | — | team, if wanted |
| 6 | ✅ **Resolved without stock photography.** Farmer-uploaded photos are downscaled client-side and really do appear (§5.4); listings without one get an on-palette generated placeholder. No image files committed, nothing to license. | — | settled |
| 7 | ✅ **Decided: no chart.** The struck-through mall price plus a percentage pill reads faster and cleaner at card size than any chart would, and it repeats consistently across the grid, the cart, and the success screen. A chart would add a dependency and a second visual language for one number. | — | settled |

Nothing here blocks steps 0–5. #6 and #7 are mine to decide and only touch step 6.

---

## 10. Verified facts

Recorded because several are newer than most training data and were checked
against live sources on 2026-07-26.

- `reicon-react@1.1.302` — 2,674 icons × 2 weights, **no dependencies**,
  `sideEffects: false`, subpath exports at `./icons/*`, peer `react >=16.8.0`.
- Animate UI registry: `https://animate-ui.com/r/registry.json` — 580 items,
  shadcn `registry.json` schema, per-item at `/r/{name}.json`.
- Registry item naming: `components-radix-*`, `primitives-radix-*`, `icons-*`,
  `hooks-*`, `lib-*`. Installed as `@animate-ui/<item-name>`.
- Animate UI's `icons-*` group is **animated Lucide**, each item depending on
  `motion` — it is not an independent icon set.
- Animate UI items depend on un-namespaced shadcn/ui items (`button`, `input`,
  `separator`, `skeleton`, `use-mobile`, `utils`), so base shadcn/ui is required.
- Namespaced registries are configured under `registries` in `components.json`
  with a `{name}` placeholder.
- Poppins on Google Fonts is static-weight, not variable — `next/font` needs an
  explicit `weight` array.
- shadcn CLI **4.15.0** works on Next **16.2.11** + Tailwind v4 + Bun **1.3.14**.
  New in 4.x: `--base <base|radix|aria>`, named presets (`nova, vega, maia, lyra,
  mira, luma, sera, rhea`) replacing `--base-color`, and the commands `info`,
  `docs`, `view`, `search`, `preset`, `registry`, `mcp`, `eject`.
- `--yes` does **not** suppress the preset prompt; `-p <name>` is required for a
  non-interactive init.
- `shadcn` must stay in `dependencies` — `globals.css` imports
  `shadcn/tailwind.css` at build time.
- Adding `@animate-ui/components-radix-tabs` auto-installs `motion@^12.42.2` and
  vendors 8 files, resolving transitive registry deps without prompting.
- `radix-ui@^1.6.7` is the unified Radix package — **not** `@radix-ui/react-*`.
- Animate UI's vendored code violates `react-hooks/set-state-in-effect` and
  `react-hooks/static-components` from eslint-config-next 16 (see §4.2.1).
- **Tailwind v4's palette is oklch and its hexes differ from v3.** Read values
  from `node_modules/tailwindcss/theme.css`; do not trust remembered v3 hexes.
- `reicon-react@1.1.302` installs with **zero** transitive dependencies.
- Tailwind v4 custom utilities use the `@utility` directive (our `figure`
  utility), not `@layer utilities` + `@apply`.
- **shadcn's `sonner` registry item pulls in `next-themes`** and calls
  `useTheme()` with a `"system"` fallback. With no `ThemeProvider` mounted that
  renders **dark toasts** for users whose OS prefers dark — wrong for a
  light-only app. Ours is rewritten to pin `theme="light"`; `next-themes` was
  then uninstalled. Re-adding `sonner` from the registry reintroduces both.
- Reicon's icon props: `size` (default `24`), `weight: 'Filled' | 'Outline'`
  (default `Outline`), `color`, `secondaryColor`, `strokeWidth`, plus all SVG
  attributes. Exports are flat PascalCase off the package root; names follow the
  Solar-ish convention (`AltArrowDown`, `X`, `CloseCircle`, `ChatDots`) — check
  `node_modules/reicon-react/icons/` before importing, several obvious names
  (e.g. `Tractor`, `Hamburger`, `Plant`) do not exist.
- Animate UI's Sheet renders a Lucide `XIcon` internally; ours is swapped to
  Reicon's `X` and will revert if the component is re-added.
- **Clerk 7.6.1:** `clerkClient()` is **async** — `(await clerkClient()).users.
  updateUser(id, { publicMetadata })`. `currentUser()` returns the Backend User
  (fetch-deduped per request) and is the reliable way to read `publicMetadata`;
  `sessionClaims` only carries it if a custom JWT template is configured in the
  dashboard, which we have not done.
- **Clerk keyless mode provisions a real dev instance automatically** — no
  `.env.local` needed for local development. Keys are written to
  `.clerk/.tmp/keyless.json` (gitignored). The instance is per-machine.
- Next 16 page `searchParams` is a **Promise** and must be awaited; a repeated
  query param arrives as `string[]`, so take `[0]`.
- 🚩 **`auth.protect()` is unusable under Clerk keyless mode.** It throws
  `@clerk/backend: Missing publishableKey` even though keys exist in
  `.clerk/.tmp/keyless.json` and `auth()` / `currentUser()` work fine. The throw
  happens inside `protect()` before any redirect logic, so the
  `unauthenticatedUrl` option does not avoid it. `requireRole()` checks
  `userId` from `await auth()` and calls `redirect()` explicitly instead — which
  also routes to our own `/sign-in` rather than Clerk's hosted page. Revisit if
  the team claims the instance and adds real keys.
- `eslint-disable-next-line` applies to the **immediately** following line — with
  a multi-line explanatory comment above the target, the directive must be the
  *last* comment line or it silently disables nothing.
- shadcn's `select` imports three Lucide icons; ours are swapped to Reicon
  (`ChevronDown`/`ChevronUp`/`Check`) and will revert if re-added. Reicon has no
  `AltArrowDown` despite that name appearing in its own docs example.
- **Motion's `reducedMotion` defaults to `"never"`** — animations ignore the OS
  setting until you mount `<MotionConfig reducedMotion="user">`. A CSS
  `prefers-reduced-motion` block cannot stop them, because Motion writes inline
  transforms from JS.
- **Adding `loading.tsx` turns a page-level `redirect()` into a streamed `200`**
  instead of a `307`. Next sends the loading shell first, then resolves the
  redirect inside the stream. Verified no data leaks in that shell — only the
  static `metadata.title`, which is evaluated in parallel with the page and does
  not run auth. Two consequences: an anonymous visitor to `/farmer` briefly sees
  the skeleton before being bounced, and the bounce needs JS. Both acceptable
  here; worth knowing before trusting a status code as an auth assertion.

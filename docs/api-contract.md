# Farmer API Contract (Phase 1 — stubs)

This document is the source-of-truth HTTP contract between the **API-only
Next.js backend** (this repo) and the **native Android client**
(see [`android-app-plan.md`](./android-app-plan.md)).

Phase 1 ships **stub route handlers** that return values matching the shapes
below, so the Android team can integrate immediately. The real implementations
(LangGraph agent orchestration, Postgres persistence, MinIO storage, Clerk
auth) land behind the **same contract** in later phases.

TypeScript types backing this contract live in
[`src/lib/ai/types.ts`](../src/lib/ai/types.ts).

---

## Conventions

- **Base:** all endpoints are served by Next.js under `/api/*`.
- **Auth:** farmer endpoints will require a Clerk bearer token with
  `role = farmer`. **Phase 1 stubs this** (`requireFarmer()` is permissive);
  send requests without auth for now, but design the client to attach the
  Clerk token — enforcement flips on in Phase 4.
- **Content type:** JSON everywhere except `POST /api/upload` (multipart).
- **Errors:** uniform envelope
  ```json
  { "error": { "code": "string", "message": "string" } }
  ```
- **Persistence:** conversations and messages are stored in Postgres. A
  conversation is keyed by `sessionId` (one thread per session), so repeat
  agent calls append turns rather than starting over. If the database is
  unreachable the request fails with `500` — replies are never returned
  unpersisted.
- **Images:** never returned as permanent public URLs. Uploads yield a private
  MinIO `objectKey`; history reads return **short-lived presigned GET URLs**
  (~5 min), minted per request.

---

## `POST /api/upload`

Multipart produce-image upload. The backend streams the image into a **private**
MinIO bucket and returns a durable object key.

**Request** — `multipart/form-data`

| Field       | Type   | Required | Notes                                   |
| ----------- | ------ | -------- | --------------------------------------- |
| `file`      | File   | yes      | `image/jpeg`, `image/png`, `image/webp` |
| `sessionId` | string | yes      | Client-generated conversation key       |

Limits: max **10 MB**.

**Response** — `201 Created`

```json
{ "objectKey": "<sessionId>/<timestamp>-<random>.jpg" }
```

**Errors:** `400` missing field · `413` too large · `415` bad type ·
`401/403` auth (Phase 4) · `500` internal.

Pass the returned `objectKey` to `POST /api/farmer/agent` as `imageKey`.

> **Storage model.** The bucket is private — objects are **never** reachable by
> a permanent public URL, and unsigned requests are refused. Keys carry a
> random suffix so they can't be guessed or enumerated. To display an image,
> read the conversation: `GET /api/farmer/conversations/:id` returns a
> short-lived presigned `imageUrl` (valid ~5 minutes). Treat `objectKey` as an
> opaque handle to store, not a URL to fetch.

---

## `POST /api/farmer/agent`

The farmer AI co-pilot. A supervisor routes the message to a **pricing** or
**advisory** graph and returns a reply.

**Request** — `application/json`

```json
{
  "message": "I have 200kg of maize, harvested this week. What is it worth?",
  "sessionId": "abc-123",
  "imageKey": "produce/abc-123/1690000000-mock.jpg",
  "language": "en"
}
```

| Field       | Type              | Required | Notes                                  |
| ----------- | ----------------- | -------- | -------------------------------------- |
| `message`   | string            | yes      | Non-empty                              |
| `sessionId` | string            | yes      | Groups messages into a conversation    |
| `imageKey`  | string            | no       | `objectKey` from `POST /api/upload`    |
| `language`  | `"en"` \| `"sw"`  | no       | Defaults to `"en"`; any other value → `400` |

**Response** — `200 OK`

```json
{
  "conversationId": "uuid",
  "reply": {
    "role": "assistant",
    "intent": "pricing",
    "content": "A fair rate for your maize is about KES 50 per kg ...",
    "data": {
      "produce": "Maize",
      "pricePerKg": 50,
      "unit": "90kg bag",
      "currency": "KES",
      "market": "Gikomba Market",
      "trend": "up"
    }
  }
}
```

- `intent` is `"pricing"` or `"advisory"`.
- `data` is present for **pricing** replies; omitted for pure advisory replies.

**Errors:** `400` invalid/missing body, unsupported `language` ·
`401/403` auth (Phase 4) · `500`.

> **Phase 2 note:** the exchange is now **persisted**. `conversationId` is a
> real, re-fetchable row — pass it to `GET /api/farmer/conversations/:id`.
> Repeat calls with the same `sessionId` **append to the same conversation**.
>
> The reply text is still mock: intent comes from a keyword heuristic and the
> copy is canned. `language` **is** validated and honored (`"sw"` returns
> Swahili copy). Real Shamba-Records-backed pricing and LLM advisory land in
> Phase 3.

---

## `GET /api/farmer/conversations/:id`

Fetch a conversation with its message history.

**Response** — `200 OK`

```json
{
  "id": "uuid",
  "sessionId": "abc-123",
  "language": "en",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "I have 200kg of maize ...",
      "createdAt": "2026-07-25T09:00:00.000Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "A fair rate for your maize is about KES 50 per kg ...",
      "data": { "produce": "Maize", "pricePerKg": 50, "unit": "90kg bag", "currency": "KES", "market": "Gikomba Market", "trend": "up" },
      "createdAt": "2026-07-25T09:00:03.000Z"
    }
  ]
}
```

- `imageUrl` (when present on a message) is a **short-lived presigned GET URL**.

**Errors:** `400` missing id · `404` unknown conversation ·
`401/403` auth (Phase 4) · `500`.

> **Phase 2.5 note:** reads **real rows from Postgres**, ordered
> chronologically. Unknown or malformed ids return `404`. Any message with an
> image gets a freshly minted **presigned `imageUrl`** (valid ~5 minutes) —
> mint-on-read, so don't cache these URLs; re-fetch the conversation instead.
> If an object has gone missing, that message simply comes back without an
> `imageUrl` rather than failing the whole request.

---

## Marketplace endpoints (mvp.md surface)

These serve **both** the web (Next.js) and Android clients. Auth uses Clerk with
a `role` (farmer | consumer); role-restricted endpoints return `403` for the
wrong role. See `docs/mvp.md` for the product scope.

### `POST /api/ai/price` — price recommendation *(any role)*
```ts
// Request:  { produceType: string, region?: string, quantityKg?: number, imageKey?: string }
// Response: PricingData  { produce, pricePerKg, unit, currency, market, trend }
```

### `POST /api/ai/cart` — build a cart from natural language *(any role)*
```ts
// Request:  { text: string, language?: "en"|"sw" }
// Response: { items: CartItem[], total, currency, mallComparison? }
//   CartItem = { listingId, produceType, quantityKg, pricePerKg, lineTotal }
```
Items bind to **real active listings**, so the cart is immediately orderable.

### `POST /api/farmer/listing` — publish a listing *(farmer)*
```ts
// Request:  { produceType, quantityKg, pricePerKg?, imageKey? }
//   pricePerKg omitted → filled from the AI recommendation.
// Response: Listing  (201)
```

### `GET /api/farmer/listings` — farmer dashboard *(farmer)*
```ts
// Response: { listings: Listing[], incomingOrders: Order[] }
```

### `GET /api/consumer/listings` — browse grid *(any role)*
```ts
// Response: { listings: Listing[] }   // active only, newest first, presigned photos
```

### `POST /api/consumer/order` — place an order *(consumer)*
```ts
// Request:  { listingId, quantityKg }
// Response: Order  (201).  Total computed server-side. Delivery mocked.
// Errors: 404 listing_unavailable · 409 insufficient_quantity
```

`Listing` = `{ id, farmerId, produceType, imageUrl?, quantityKg, pricePerKg, currency, active, createdAt }`
`Order` = `{ id, consumerId, listingId, quantityKg, totalPrice, currency, status, createdAt }`

> `/api/consumer/*` paths without a concrete handler still return `501`.

> **Phase 3b note:** `/api/ai/price` and `/api/ai/cart` use mock logic today
> (`src/lib/ai/pricing.ts`). The LangGraph pricing/cart graphs (Shamba Records +
> Gemini→Groq→OpenAI) replace the internals in Phase 3 behind these contracts.

---

## `/api/farmer/agent` — conversational assistant (retained)

The chat-style farmer assistant from earlier phases stays available but is not
part of the MVP demo flow. See its section above.

---

## Roadmap behind this contract

| Phase | Adds                                                                 | Status |
| ----- | ------------------------------------------------------------------- | ------ |
| 1     | Stub endpoints (mock responses) — unblock Android                   | ✅ done |
| 2     | Postgres (Docker): `conversations`, `messages`, `agent_runs`        | ✅ done |
| 2.5   | MinIO (Docker): real `POST /api/upload`, presigned GET for history  | ✅ done |
| 3     | LangGraph supervisor → pricing/advisory; Shamba Records; model fallback | next |
| 4     | Clerk token verification + `role=farmer` gate                       | |

## Running the backend locally

```bash
cp .env.example .env.local   # fill in Clerk keys
docker compose up -d         # Postgres (+ MinIO, for Phase 2.5)
bun run db:migrate           # apply schema.sql (idempotent)
bun run dev
```

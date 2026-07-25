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
- **Images:** never returned as permanent public URLs. Uploads yield a private
  MinIO `objectKey`; history reads return **short-lived presigned GET URLs**.

---

## `POST /api/upload`

Multipart produce-image upload. Backend stores the image in the private MinIO
bucket and returns a stable object key.

**Request** — `multipart/form-data`

| Field       | Type   | Required | Notes                                   |
| ----------- | ------ | -------- | --------------------------------------- |
| `file`      | File   | yes      | `image/jpeg`, `image/png`, `image/webp` |
| `sessionId` | string | yes      | Client-generated conversation key       |

Limits: max **10 MB**.

**Response** — `201 Created`

```json
{ "objectKey": "produce/<sessionId>/<timestamp>-mock.jpg" }
```

**Errors:** `400` missing field · `413` too large · `415` bad type ·
`401/403` auth (Phase 4) · `500` internal.

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
| `language`  | `"en"` \| `"sw"`  | no       | Defaults to `"en"`                     |

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

**Errors:** `400` invalid/missing body · `401/403` auth (Phase 4) · `500`.

> **Phase 1 note:** intent is decided by a keyword heuristic and replies are
> mock data. Real Shamba-Records-backed pricing and LLM advisory land in Phase 3.

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

**Errors:** `400` missing id · `401/403` auth (Phase 4) · `500`.

---

## `/api/consumer/*` — reserved

The Android app is dual-role (Farmer & Consumer). This namespace is reserved
for the consumer grocery-delivery surface (see
[`consumer-ai.md`](./consumer-ai.md)) and currently returns `501 Not
Implemented`. Farmer-first is the active milestone.

---

## Roadmap behind this contract

| Phase | Adds                                                                 |
| ----- | ------------------------------------------------------------------- |
| 1     | **These stub endpoints** (mock responses) — unblock Android         |
| 2     | Postgres (Docker): `conversations`, `messages`, `agent_runs`        |
| 2.5   | MinIO (Docker): real `POST /api/upload`, presigned GET for history  |
| 3     | LangGraph supervisor → pricing/advisory; Shamba Records; model fallback |
| 4     | Clerk token verification + `role=farmer` gate                       |

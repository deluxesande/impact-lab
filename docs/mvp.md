# MVP — Hackathon Build

Two screens, one backend, real login. Delivery is mocked. AI does pricing and ordering.

---

## Scope

| | Farmer | Consumer |
|---|---|---|
| **Auth** | Login / Sign up (Clerk) | Login / Sign up (Clerk) |
| **Core** | Upload produce (photo + type + qty) | Browse listings, chat-order, place order |
| **AI** | Price recommendation | Build cart from text/voice input |
| **Skip** | Transport, routing, weighing | Real delivery, payments, rider tracking |

---

## Screens (Android)

### Shared
- **Splash / Onboarding** — role picker: "I'm a Farmer" / "I'm a Consumer"
- **Sign In / Sign Up** — Clerk auth, role saved to user metadata

### Farmer Flow
1. **Dashboard** — list of my active produce listings + incoming orders
2. **New Listing** — camera/gallery → photo, select produce type, enter quantity → AI returns price → confirm and publish

### Consumer Flow
1. **Home** — browse available produce (card grid: photo, name, price, "vs. KES X at mall")
2. **Order** — chat input ("I want sukuma for 4 people") → AI fills cart → review cart
3. **Confirm** — place order → success screen (delivery mocked: "Your order is on its way")

---

## Backend API (Next.js 16, Bun)

| Endpoint | What it does |
|---|---|
| `POST /api/farmer/listing` | Create listing (image upload + produce metadata) |
| `GET /api/consumer/listings` | Return all active listings |
| `POST /api/consumer/order` | Place an order against a listing |
| `POST /api/ai/price` | Given produce type + region → return recommended price |
| `POST /api/ai/cart` | Given natural language input → return cart items from live listings |

Auth: every request carries Clerk session token. Backend checks role via `auth()`.

---

## AI

- **Price recommendation**: LLM call with produce type + recent market signals → fixed rate suggestion
- **Cart builder**: LLM call with consumer text + available listings → structured cart
- **Orchestration**: try model A → fallback to model B if rate-limited (Denzel's strategy)
- **No custom training.** Hosted/free models only.

---

## Data Model (minimal)

```
User         id, clerkId, role (farmer | consumer)
Listing      id, farmerId, produceType, photo, quantityKg, pricePerKg, active
Order        id, consumerId, listingId, quantityKg, totalPrice, status (placed | mocked-delivered)
```

---

## Out of Scope (fast-follow)

- Real payments
- Live delivery tracking / rider assignment
- Vendor management
- Cold chain / storage
- SMS/USSD interface (mention in demo, don't build)
- Store analytics

---

## Demo Flow (judges see this)

1. Sign up as **Farmer** → upload tomatoes photo → AI suggests KES 45/kg → listing published
2. Sign up as **Consumer** → type "I want tomatoes and sukuma for 3 people" → AI builds cart → see "KES 120 vs KES 210 at mall" → place order → success screen
3. Back to Farmer dashboard → order shows up

Total demo time: ~3 minutes.

# Concept 1 — AI for Farmers

**Hackathon theme:** AI:Mashinani — *AI for rural areas.* This is the surface that
touches "mashinani" most directly: the farmer at the source, in the village, is
the person we protect.

**One-line pitch:** An AI co-pilot that gives rural farmers **fixed, fair rates**
for their produce — cutting out the broker who lies about weight and price.

---

## 1. The problem (from the brainstorm)

Rural farmers are exploited by brokers ("middlemen"):

- **Weight fraud** — the broker claims a bag is 10 kg when it's actually 50 kg,
  and pays for 10.
- **Price opacity** — the farmer has no idea what their produce is worth in
  Nairobi or Kisumu *today*, so they accept whatever the broker offers.
- **No route to market** — a farmer in the village can't reach a city buyer
  directly, so they're forced to sell to whoever shows up.

The farmer is a price-taker with zero information and zero leverage.

## 2. What we build

A **farmer-facing produce + pricing layer** with two jobs:

1. **Fixed, transparent rates.** The farmer sees a guaranteed price per kg for
   their produce *before* they commit. No haggling, no weight games. The rate is
   published by our system, not negotiated with a broker.
2. **Direct market access.** Farmers list their produce on the platform; consumers
   order directly. No middleman takes the margin.

## 3. Where the AI comes in

Per the team decision: **orchestrate existing hosted/free models — do not train
our own.** The AI turns messy real-world inputs into a fair price and a smart
listing. Concretely:

| Job | How AI helps | Model role |
|-----|-------------|------------|
| **Price recommendation** | Suggest a fair fixed rate per produce/region from current market signals. | LLM reasons over recent market data + supply/demand text signals. |
| **Produce identification / grading** | Farmer photographs the crop; model estimates type, quality grade, rough quantity. | Vision-capable hosted model. |
| **Farmer assistant (voice/SMS/chat)** | Low-literacy, low-bandwidth farmers ask "what's my maize worth today?" in Swahili/Sheng and get an answer. | Multilingual LLM. |
| **Demand forecast** | "Tomatoes are oversupplied in Kisumu this week — price lower or wait." | LLM over market analytics. |

**Orchestration strategy (Denzel's idea):** loop across free/hosted models —
if one is rate-limited or down, fall through to the next. Cost stays near
zero (important for a hackathon and a low-margin rural product).

## 4. Why this fits "AI:Mashinani"

- The user is literally rural (mashinani). The interface must assume **low
  bandwidth, feature phones, low literacy, local languages.** → SMS/USSD/voice +
  Swahili-first.
- AI removes the information asymmetry that keeps rural farmers poor. The farmer
  now knows the fair price and has a guaranteed buyer.
- It's not "AI for AI's sake" — the model directly answers "what is my produce
  worth," which is the real rural pain.

## 5. Minimum hackathon build

Keep scope tight. A believable demo needs:

1. Farmer submits produce (type, photo, quantity) via a simple app flow.
2. AI returns a **fixed rate** and the listing goes live for consumers.
3. One orchestrated model call behind it all, with a fallback model.

Everything else (cold chain, payments, real routing) is a fast-follow — mention
it, don't build it for the demo.

## 6. How it connects to the consumer surface

- **Grocery delivery (Concept 2)** is the demand side — produce listed by farmers
  flows directly to consumers below supermarket prices. The farmer's guaranteed
  buyer is the consumer app.
- Consumer demand data flows **back to farmers** as a forecast signal — farmers
  grow/price toward what consumers actually buy.

---

*Sourced from the Impact Lab Brainstorm Session, 2026-07-24. See
`consumer-ai.md` for the consumer-facing grocery delivery concept.*

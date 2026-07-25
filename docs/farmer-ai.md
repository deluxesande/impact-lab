# Concept 1 — AI for Farmers (Farmer Logistics)

**Hackathon theme:** AI:Mashinani — *AI for rural areas.* This is the surface that
touches "mashinani" most directly: the farmer at the source, in the village, is
the person we protect.

**One-line pitch:** An AI co-pilot that gives rural farmers **fixed, fair rates**
and handles the **logistics of moving produce from the farm to city storage** —
cutting out the broker who lies about weight and price.

---

## 1. The problem (from the brainstorm)

Rural farmers are exploited by brokers ("middlemen"):

- **Weight fraud** — the broker claims a bag is 10 kg when it's actually 50 kg,
  and pays for 10.
- **Price opacity** — the farmer has no idea what their produce is worth in
  Nairobi or Kisumu *today*, so they accept whatever the broker offers.
- **No route to market** — a farmer in the village can't physically get produce
  to a city buyer, so they're forced to sell to whoever shows up.
- **Post-harvest loss** — no storage, no cold chain, produce rots before it sells.

The farmer is a price-taker with zero information and zero leverage.

## 2. What we build

A **farmer-facing logistics + pricing layer** with three jobs:

1. **Fixed, transparent rates.** The farmer sees a guaranteed price per kg for
   their produce *before* they commit. No haggling, no weight games. The rate is
   published by our system, not negotiated with a broker.
2. **Logistics orchestration.** We coordinate transport of the produce from the
   farm → our city storage facilities (Nairobi, Kisumu, etc.). The farmer books a
   pickup; we handle the route.
3. **Verified weighing.** Weight is recorded at pickup and again at storage, so
   the farmer is paid for the real 50 kg, not a broker's fictional 10 kg.

## 3. Where the AI comes in

Per the team decision: **orchestrate existing hosted/free models — do not train
our own.** The AI is the brain that turns messy real-world inputs into a fair
price and a good route. Concretely:

| Job | How AI helps | Model role |
|-----|-------------|------------|
| **Price recommendation** | Suggest a fair fixed rate per produce/region from current market signals (see Concept 2's store analytics). | LLM reasons over recent market data + supply/demand text signals. |
| **Produce identification / grading** | Farmer photographs the crop; model estimates type, quality grade, rough quantity. | Vision-capable hosted model. |
| **Logistics planning** | Batch nearby farm pickups into one efficient route to city storage. | LLM/optimizer orchestrated over pickup requests. |
| **Farmer assistant (voice/SMS/chat)** | Low-literacy, low-bandwidth farmers ask "what's my maize worth today?" in Swahili/Sheng and get an answer. | Multilingual LLM. |
| **Spoilage / demand forecast** | "Tomatoes are oversupplied in Kisumu this week — route to Nairobi instead." | LLM over market analytics. |

**Orchestration strategy (Denzel's idea):** loop across free/hosted models —
if one is rate-limited or down, fall through to the next. This keeps cost near
zero (important for a hackathon and for a low-margin rural product) and keeps the
scope on *implementation*, not model training.

## 4. Why this fits "AI:Mashinani"

- The user is literally rural (mashinani). The interface must assume **low
  bandwidth, feature phones, low literacy, local languages.** → SMS/USSD/voice +
  Swahili-first, not a heavy web app.
- AI removes the information asymmetry that keeps rural farmers poor. The farmer
  now knows the fair price and has a guaranteed buyer.
- It's not "AI for AI's sake" — the model directly answers "what is my produce
  worth and how do I get it to market," which is the real rural pain.

## 5. Minimum hackathon build

Keep scope tight. A believable demo needs:

1. Farmer submits produce (type, photo, quantity) via a simple/SMS-like flow.
2. AI returns a **fixed rate** + a **pickup booking** to city storage.
3. Weight recorded at pickup vs. storage (show the anti-fraud check).
4. One orchestrated model call behind it all, with a fallback model.

Everything else (cold chain, real routing optimization, payments) is a fast-
follow — mention it, don't build it for the demo.

## 6. How it connects to the other surfaces

- **Store analytics (Concept in AGENTS.md)** feeds the *fair price* — market
  success rates per city/produce tell us what to pay the farmer and where to send
  the produce.
- **Grocery delivery (Concept 2)** is the demand side — produce collected from
  farmers flows into our stores and then to consumers, below supermarket prices.
  The farmer's guaranteed buyer is ultimately the consumer app.

---

*Sourced from the Impact Lab Brainstorm Session, 2026-07-24. See
`consumer-ai.md` for the consumer-facing grocery delivery concept.*

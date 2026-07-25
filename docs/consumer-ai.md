# Concept 2 — AI for Consumers (Uber-Eats-style Grocery Delivery)

**Hackathon theme:** AI:Mashinani — *AI for rural areas.* This surface closes the
loop: produce collected from rural farmers (Concept 1) is delivered to consumers
**below supermarket/mall prices**, giving small vendors ("boggers"/mama mbogas)
real market access.

**One-line pitch:** An "Uber Eats for groceries" where an AI helps people order
fresh produce for delivery at **cheaper-than-supermarket prices** — while giving
local vendors the market and the profit that middlemen used to take.

---

## 1. The problem (from the brainstorm)

- In Kenya, **groceries in malls/supermarkets are expensive.** A vegetable that's
  KES 50 at the local market is much more inside a mall.
- Consumers either overpay at the supermarket, or spend time and transport going
  to the open-air market themselves.
- Local vendors have great prices but **no digital reach** — they can't get their
  stock in front of buyers beyond their stall.
- Incumbents (Uber, existing delivery apps) exist but their **pricing model isn't
  built for cheap groceries** — Mike's point in the meeting: "they'd have to
  overhaul that." That's our wedge: we're the *low-price* grocery play.

## 2. What we build

A direct-to-consumer grocery delivery app:

1. **Consumer orders fresh produce** from their phone instead of going to the
   supermarket or market.
2. **Prices are below supermarket/mall rates** — because our supply comes
   straight from farmers (Concept 1) and local vendors, not through the mall
   markup chain.
3. **Vendors get the market + the profit.** The local vendor (bogger) gets
   digital reach and keeps the margin the middleman used to eat.
4. **Delivery** brings it to the consumer's door — no trip to the market needed.

## 3. Where the AI comes in

Same rule as the whole project: **orchestrate existing hosted/free models, no
custom training.** The AI is what makes ordering fast, cheap, and smart:

| Job | How AI helps | Model role |
|-----|-------------|------------|
| **Conversational ordering** | "I want ingredients for ugali and sukuma for 4 people" → a filled cart. Works in Swahili/Sheng, by chat or voice. | Multilingual LLM. |
| **Smart substitutions** | Item out of stock → AI suggests the closest cheaper alternative from available vendor stock. | LLM over live inventory. |
| **Dynamic price comparison** | Show the shopper "KES 50 here vs. KES 90 at the mall" to prove the savings. | LLM + store analytics data. |
| **Basket / recipe builder** | Turn a meal or budget ("groceries for a week under KES 2000") into an optimized cart. | LLM planner. |
| **Vendor matching & delivery batching** | Route each order to the nearest vendor with stock; batch nearby deliveries to cut cost. | LLM/optimizer orchestrated over orders. |
| **Demand signal back to farmers** | What consumers buy feeds the farmer pricing/forecast in Concept 1. | Shared analytics. |

**Orchestration strategy (Denzel's idea):** loop through free/hosted models with
fallbacks. Cost stays near zero, which matters when the entire value prop is
*low prices* — we can't afford an expensive AI bill per order.

## 4. Why this fits "AI:Mashinani"

- It connects **rural supply to urban/peri-urban demand.** The farmer in the
  village (mashinani) reaches the consumer in Nairobi/Kisumu through our app.
- AI lowers the barrier to ordering for people who aren't power users of apps —
  **chat/voice in local languages**, not a complex checkout flow.
- It keeps money in the local economy: vendors and farmers capture the profit
  that malls and brokers extract today.

## 5. Minimum hackathon build

Keep scope tight. A believable demo needs:

1. Consumer opens the app / chat and asks for produce (or a recipe/budget).
2. AI builds a cart from available vendor stock, showing **our price vs. mall
   price**.
3. Consumer places an order → it's routed to a nearby vendor.
4. One orchestrated model call behind it, with a fallback model.

Skip for demo (mention as fast-follow): real payments, live rider tracking.
Fake the delivery step; make the *ordering + pricing* real.

## 6. How it connects to the other surfaces

- **Farmer listings (Concept 1)** is the supply: produce listed at fair fixed
  rates by farmers, enabling the below-supermarket price.
- **Store analytics (AGENTS.md)** tells us *which produce sells in which city*
  (Nairobi vs. Kisumu), so we stock the right vendors and price correctly.
- Consumer demand data flows **back to farmers** as a forecast signal — the loop
  closes: farmers grow/route toward what consumers actually buy.

---

*Sourced from the Impact Lab Brainstorm Session, 2026-07-24. See
`farmer-ai.md` for the farmer produce concept.*

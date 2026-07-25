# Android App Integration Plan

## Overview

Single Android app with dual roles (Farmer & Consumer) consuming a unified backend API. No web frontend; Next.js becomes API-only.

## Architecture

```
┌─────────────────┐
│  Android App    │
│  (Kotlin/Java)  │
├─────────────────┤
│ Farmer Role     │ Produce upload, pricing, order mgmt
│ Consumer Role   │ Browse, order, delivery tracking
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────────────┐
│  Backend API            │
│  (Next.js 16, Bun)      │
├─────────────────────────┤
│ /api/auth               │ Clerk + role assignment
│ /api/farmer/*           │ Produce, pricing, orders
│ /api/consumer/*         │ Browse, order, tracking
│ /api/upload             │ Image handling
└──────────┬──────────────┘
           │
           ▼
    ┌──────────────┐
    │  Database    │
    │  (Postgres)  │
    └──────────────┘
```

## Backend Changes

1. **Strip frontend** — remove `src/app/` (pages, components, layouts)
2. **Expose API routes** — `/api/auth`, `/api/farmer`, `/api/consumer`
3. **Clerk integration** — set role/metadata on user sign-up (farmer vs consumer)
4. **Image storage** — S3 or similar for produce uploads from Android

## Android App Structure

**Two flows from single entry point:**

- **Login** → Clerk authentication → role check
- **Farmer flow**: Dashboard (orders), Upload produce (camera), Manage pricing
- **Consumer flow**: Browse produce, Cart, Checkout, Order tracking

**Tech**: Kotlin, Android Studio, Retrofit/OkHttp for API calls, Glide for images.

## Integration Points

1. **Auth**: Clerk SDK on Android validates tokens, backend checks role on each request
2. **Image upload**: Camera → compress → multipart POST to `/api/upload`
3. **Real-time**: WebSocket or polling for order updates (farmer) and delivery tracking (consumer)
4. **Offline**: Cache critical data (farmer: produce list; consumer: recent orders)

## Scope Out (Phase 1)

- Real-time updates (can use polling initially)
- Advanced offline (simplified sync, not full offline-first)
- Payment processing (mock payment for MVP)

## Next Step

Build the backend API structure first (`/api/farmer`, `/api/consumer`, image upload endpoint), then scaffold Android app with login and role routing.

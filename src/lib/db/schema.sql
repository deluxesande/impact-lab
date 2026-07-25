-- Impact Lab — farmer surface persistence schema.
--
-- Applied idempotently by `bun run db:migrate` (src/lib/db/migrate.ts).
-- Postgres has no `CREATE TYPE ... IF NOT EXISTS`, so enums are guarded with
-- DO blocks that swallow duplicate_object.
--
-- Design notes:
--   * Enums mirror the TypeScript unions in src/lib/ai/types.ts.
--   * `messages.image_key` stores the private MinIO OBJECT KEY, never a URL.
--     Short-lived presigned GET URLs are minted at read time (Phase 2.5).
--   * jsonb columns (`data`, `tool_calls`, `structured_output`) let the AI
--     payload shape evolve in Phase 3 without a migration.
--   * `agent_runs` is the refinement/observability log: it captures how each
--     assistant reply was produced so prompts/routing can be tuned later.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

DO $$ BEGIN
  CREATE TYPE language AS ENUM ('en', 'sw');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE farmer_intent AS ENUM ('pricing', 'advisory');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE msg_role AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('farmer', 'consumer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('placed', 'mocked_delivered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One chat thread, keyed by the client-generated sessionId.
CREATE TABLE IF NOT EXISTS conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text        NOT NULL,
  language   language    NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One conversation per session: lets getOrCreateConversation upsert safely.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_session_id_key
  ON conversations (session_id);

-- Each turn in a conversation.
CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role            msg_role    NOT NULL,
  content         text        NOT NULL,
  image_key       text,        -- private MinIO object key (Phase 2.5)
  data            jsonb,       -- PricingData for assistant pricing turns
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at);

-- Observability log: how each assistant reply was produced.
CREATE TABLE IF NOT EXISTS agent_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid          NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  message_id        uuid          REFERENCES messages (id) ON DELETE SET NULL,
  intent            farmer_intent NOT NULL,
  graph_used        text,         -- Phase 3: 'pricing' | 'advisory'
  model_used        text,         -- Phase 3: 'gemini' | 'groq' | 'openai'
  tool_calls        jsonb,        -- Phase 3: Shamba queries + results
  structured_output jsonb,        -- mirror of reply.data
  latency_ms        integer,
  error             text,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_runs_conversation_created_idx
  ON agent_runs (conversation_id, created_at);

/* -------------------------------------------------------------------------- */
/* Marketplace (mvp.md): users, listings, orders                              */
/* -------------------------------------------------------------------------- */

-- Mirror of the Clerk user, with the role captured at sign-up. clerk_id is the
-- Clerk user id; role gates farmer vs consumer endpoints.
CREATE TABLE IF NOT EXISTS users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id   text      NOT NULL,
  role       user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_id_key ON users (clerk_id);

-- A farmer's produce listing. image_key is the private MinIO object key;
-- consumer reads mint a presigned URL, same pattern as conversation images.
CREATE TABLE IF NOT EXISTS listings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id    uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  produce_type text    NOT NULL,
  image_key    text,
  -- Stock is consumed atomically by createOrder (see repo.ts); a fully-sold
  -- listing reaches 0, so the floor is >= 0, not > 0.
  quantity_kg  numeric(10, 2) NOT NULL CHECK (quantity_kg >= 0),
  price_per_kg numeric(10, 2) NOT NULL CHECK (price_per_kg >= 0),
  currency     text    NOT NULL DEFAULT 'KES',
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_active_created_idx
  ON listings (active, created_at DESC);
CREATE INDEX IF NOT EXISTS listings_farmer_idx
  ON listings (farmer_id, created_at DESC);

-- A consumer order against a listing. Delivery is mocked for the MVP.
CREATE TABLE IF NOT EXISTS orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id  uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  listing_id   uuid    NOT NULL REFERENCES listings (id) ON DELETE RESTRICT,
  quantity_kg  numeric(10, 2) NOT NULL CHECK (quantity_kg > 0),
  total_price  numeric(12, 2) NOT NULL CHECK (total_price >= 0),
  currency     text         NOT NULL DEFAULT 'KES',
  status       order_status NOT NULL DEFAULT 'placed',
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- Relax the listings stock CHECK on databases created before stock consumption
-- existed (CREATE TABLE IF NOT EXISTS won't alter an existing constraint).
DO $$ BEGIN
  ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_quantity_kg_check;
  ALTER TABLE listings ADD CONSTRAINT listings_quantity_kg_check CHECK (quantity_kg >= 0);
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS orders_consumer_idx
  ON orders (consumer_id, created_at DESC);
-- Powers the farmer dashboard's "incoming orders" via listings join.
CREATE INDEX IF NOT EXISTS orders_listing_idx
  ON orders (listing_id, created_at DESC);

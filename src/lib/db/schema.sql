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

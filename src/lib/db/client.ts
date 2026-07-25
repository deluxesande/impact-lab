import postgres from "postgres";

/**
 * Shared Postgres client (porsager/postgres).
 *
 * Self-hosted Postgres runs in Docker alongside the app on Linode; the
 * connection string comes from DATABASE_URL. The client is memoised on
 * globalThis so Next.js dev hot-reloads reuse one pool instead of leaking a
 * new one on every module reload.
 *
 * Per the Phase 2 decision, persistence failures are NOT swallowed: if the
 * database is unreachable the request fails (500) rather than silently
 * dropping data, because the agent_runs log is the refinement dataset.
 */

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Start Postgres and configure .env.local.");
    this.name = "DatabaseNotConfiguredError";
  }
}

type SqlClient = ReturnType<typeof postgres>;

/**
 * Postgres SQLSTATE codes for "this object is already there" — emitted as
 * NOTICEs by our idempotent DDL and safe to ignore.
 * 42710 duplicate_object · 42P07 duplicate_table
 * 42P06 duplicate_schema · 42701 duplicate_column
 */
const ALREADY_EXISTS_CODES = new Set(["42710", "42P07", "42P06", "42701"]);

const globalForDb = globalThis as unknown as { __impactLabSql?: SqlClient };

function createClient(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();

  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: (notice) => {
      // The idempotent DDL (IF NOT EXISTS / duplicate_object guards) emits an
      // "already exists, skipping" notice on every re-run. Drop that expected
      // class; surface anything else so real warnings stay visible.
      if (notice.code && ALREADY_EXISTS_CODES.has(notice.code)) return;
      console.warn("[postgres notice]", notice.message);
    },
  });
}

/**
 * Lazily resolve the pooled client. Kept lazy (not a module-level const) so
 * importing this module during `next build` does not require DATABASE_URL.
 */
export function getSql(): SqlClient {
  if (!globalForDb.__impactLabSql) {
    globalForDb.__impactLabSql = createClient();
  }
  return globalForDb.__impactLabSql;
}

/**
 * Minimal, idempotent migration runner.
 *
 * Applies src/lib/db/schema.sql in one transaction. The DDL is written to be
 * safely re-runnable (IF NOT EXISTS / duplicate_object guards), so this can be
 * executed on every deploy without a versioned-migration framework — which is
 * the right trade-off while the schema is small and churn is low.
 *
 * The users_phone_number_key unique index is created CONCURRENTLY in a separate
 * step because CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
 *
 * Usage: bun run db:migrate
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getSql, DatabaseNotConfiguredError } from "./client";

async function main() {
  // Resolve schema.sql relative to this module (portable across Bun/Node,
  // unlike Bun's import.meta.dir which isn't in the configured TS libs).
  const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  const ddl = readFileSync(schemaPath, "utf8");

  const sql = getSql();
  try {
    await sql.unsafe(ddl);
    console.log("migrations applied: schema.sql");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function createPhoneNumberIndexConcurrently() {
  const sql = getSql();
  try {
    // CREATE INDEX CONCURRENTLY cannot run inside a transaction, so use a fresh
    // connection without a transaction block. IF NOT EXISTS is not supported with
    // CONCURRENTLY in older PG, so we guard manually.
    const exists = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'users_phone_number_key'
      ) AS exists
    `;
    if (!exists[0].exists) {
      await sql.unsafe(`
        CREATE UNIQUE INDEX CONCURRENTLY users_phone_number_key
        ON users (phone_number)
        WHERE phone_number IS NOT NULL
      `);
      console.log("created concurrent index: users_phone_number_key");
    } else {
      console.log("index already exists: users_phone_number_key");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main()
  .then(createPhoneNumberIndexConcurrently)
  .catch((err) => {
    if (err instanceof DatabaseNotConfiguredError) {
      console.error(err.message);
    } else {
      console.error("migration failed:", err);
    }
    process.exit(1);
  });

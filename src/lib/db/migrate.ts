/**
 * Minimal, idempotent migration runner.
 *
 * Applies src/lib/db/schema.sql in one transaction. The DDL is written to be
 * safely re-runnable (IF NOT EXISTS / duplicate_object guards), so this can be
 * executed on every deploy without a versioned-migration framework — which is
 * the right trade-off while the schema is small and churn is low.
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

main().catch((err) => {
  if (err instanceof DatabaseNotConfiguredError) {
    console.error(err.message);
  } else {
    console.error("migration failed:", err);
  }
  process.exit(1);
});

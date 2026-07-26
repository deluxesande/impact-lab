/**
 * Read-only inspector for the agent_runs refinement log.
 *
 * Prints recent agent runs plus fallback statistics so you can see, at a
 * glance, whether the real AI ran and how often it fell back.
 *
 * Usage:
 *   bun run agents:inspect            # last 20 runs + stats
 *   bun run agents:inspect 50         # last 50 runs
 *
 * `model_used` reveals the path:
 *   gemini | groq | openai   → a real LLM produced the result
 *   shamba+llm | llm         → the graph's source when the supervisor recorded it
 *   heuristic                → the deterministic fallback ran (no/failed AI)
 */

import { getSql, DatabaseNotConfiguredError } from "./client";

interface RunRow {
  created_at: Date;
  intent: string | null;
  graph_used: string | null;
  model_used: string | null;
  latency_ms: number | null;
  error: string | null;
  tool_calls: unknown;
  structured_output: { produce?: string; pricePerKg?: number; currency?: string } | null;
}

interface StatRow {
  model_used: string | null;
  runs: number;
  avg_ms: number | null;
  errors: number;
}

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

/** Color a model_used value by whether it's real AI, a fallback, or an error. */
function colorModel(model: string | null): string {
  if (!model) return `${DIM}—${RESET}`;
  if (model === "heuristic") return `${YELLOW}${model}${RESET}`;
  if (["gemini", "groq", "openai", "shamba+llm", "llm"].includes(model)) {
    return `${GREEN}${model}${RESET}`;
  }
  return model;
}

function fmtTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

async function main() {
  const limit = Math.min(Math.max(Number(process.argv[2]) || 20, 1), 500);
  const sql = getSql();

  try {
    const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM agent_runs`;

    if (count === 0) {
      console.log(
        `${DIM}No conversational agent runs yet (POST /api/farmer/agent to generate some).${RESET}`,
      );
    } else {
      await printAgentRuns(sql, count, limit);
    }

    await printAiRuns(sql, limit);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function printAgentRuns(
  sql: ReturnType<typeof getSql>,
  count: number,
  limit: number,
): Promise<void> {
    // --- Fallback statistics ---
    const stats = await sql<StatRow[]>`
      SELECT model_used,
             count(*)::int                              AS runs,
             round(avg(latency_ms))::int                AS avg_ms,
             count(*) FILTER (WHERE error IS NOT NULL)::int AS errors
      FROM agent_runs
      GROUP BY model_used
      ORDER BY runs DESC
    `;

    console.log(`\n${BOLD}Agent run summary${RESET} ${DIM}(${count} total)${RESET}`);
    console.log(`${DIM}${"─".repeat(52)}${RESET}`);
    console.log(`${DIM}path/model        runs    avg ms   errors${RESET}`);
    for (const s of stats) {
      const label = s.model_used ?? "—";
      // Pad the plain label first, then colorize, so ANSI codes don't skew width.
      const model = colorModel(s.model_used) + " ".repeat(Math.max(0, 16 - label.length));
      const runs = String(s.runs).padStart(5);
      const avg = String(s.avg_ms ?? "—").padStart(8);
      const errs = s.errors > 0 ? `${RED}${String(s.errors).padStart(6)}${RESET}` : String(0).padStart(6);
      console.log(`${model}${runs}${avg}${errs}`);
    }

    const real = stats
      .filter((s) => s.model_used && s.model_used !== "heuristic")
      .reduce((n, s) => n + s.runs, 0);
    const pct = count > 0 ? Math.round((real / count) * 100) : 0;
    console.log(`${DIM}${"─".repeat(52)}${RESET}`);
    console.log(`${real}/${count} runs used real AI (${pct}%), rest fell back to heuristic.\n`);

    // --- Recent runs ---
    const runs = await sql<RunRow[]>`
      SELECT created_at, intent, graph_used, model_used, latency_ms, error,
             tool_calls, structured_output
      FROM agent_runs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    console.log(`${BOLD}Last ${runs.length} runs${RESET}`);
    console.log(`${DIM}${"─".repeat(52)}${RESET}`);
    for (const r of runs) {
      const price = r.structured_output?.pricePerKg
        ? ` ${CYAN}${r.structured_output.currency ?? "KES"} ${r.structured_output.pricePerKg}/kg${RESET}${r.structured_output.produce ? ` ${DIM}(${r.structured_output.produce})${RESET}` : ""}`
        : "";
      const toolN = Array.isArray(r.tool_calls) ? r.tool_calls.length : 0;
      const tools = toolN ? ` ${DIM}${toolN} tool call${toolN === 1 ? "" : "s"}${RESET}` : "";
      const lat = r.latency_ms != null ? `${DIM}${r.latency_ms}ms${RESET}` : "";
      console.log(
        `${DIM}${fmtTime(r.created_at)}${RESET}  ` +
          `${(r.intent ?? "—").padEnd(8)} → ${colorModel(r.model_used)}  ${lat}${price}${tools}`,
      );
      if (r.error) console.log(`  ${RED}error: ${r.error.slice(0, 120)}${RESET}`);
    }
    console.log("");
}

/** AI task-graph runs (/api/ai/price, /api/ai/cart) from the ai_runs table. */
async function printAiRuns(sql: ReturnType<typeof getSql>, limit: number): Promise<void> {
  const [{ count: aiCount }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM ai_runs`;
  if (aiCount === 0) return;

  const aiRuns = await sql<
    {
      created_at: Date;
      endpoint: string;
      source: string;
      model_used: string | null;
      latency_ms: number | null;
      output: { pricePerKg?: number; currency?: string; itemCount?: number; total?: number } | null;
      error: string | null;
    }[]
  >`
    SELECT created_at, endpoint, source, model_used, latency_ms, output, error
    FROM ai_runs ORDER BY created_at DESC LIMIT ${limit}
  `;

  console.log(`${BOLD}AI task-graph runs${RESET} ${DIM}(${aiCount} total)${RESET}`);
  console.log(`${DIM}${"─".repeat(52)}${RESET}`);
  for (const r of aiRuns) {
    const model = r.model_used ? colorModel(r.model_used) : colorModel(r.source);
    const lat = r.latency_ms != null ? `${DIM}${r.latency_ms}ms${RESET}` : "";
    let detail = "";
    if (r.endpoint === "price" && r.output?.pricePerKg) {
      detail = ` ${CYAN}${r.output.currency ?? "KES"} ${r.output.pricePerKg}/kg${RESET}`;
    } else if (r.endpoint === "cart" && r.output?.itemCount != null) {
      detail = ` ${CYAN}${r.output.itemCount} items, KES ${r.output.total}${RESET}`;
    }
    console.log(
      `${DIM}${fmtTime(r.created_at)}${RESET}  ${r.endpoint.padEnd(6)} → ${model}  ${lat}${detail}`,
    );
    if (r.error) console.log(`  ${RED}error: ${r.error.slice(0, 120)}${RESET}`);
  }
  console.log("");
}

main().catch((err) => {
  if (err instanceof DatabaseNotConfiguredError) {
    console.error(err.message);
  } else {
    console.error("inspect failed:", err);
  }
  process.exit(1);
});

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Applies schema.sql on demand, so a deploy that lands before anyone runs
 * `npm run db:init` heals itself on the first request instead of showing a
 * missing-table error and refusing writes.
 *
 * schema.sql stays the single source of truth — it is read at runtime, not
 * duplicated here. next.config.ts traces it into the serverless bundle.
 */

export type Executor = (statement: string) => Promise<unknown>;

/**
 * Two instances can cold-start at once and race each other. `if not exists`
 * is not atomic against a concurrent creator — Postgres surfaces the collision
 * from the catalog instead — so treat "someone else just made this" as done.
 */
const ALREADY_THERE = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object — constraint or index
  "23505", // unique_violation on a catalog index
]);

/**
 * The HTTP driver takes one statement per call. Strip line comments before
 * splitting, since a comment may itself contain a semicolon. schema.sql has no
 * string literals containing "--", which is the case this would not survive.
 */
export function splitStatements(schema: string): string[] {
  return schema
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function applySchema(
  schema: string,
  exec: Executor,
): Promise<void> {
  for (const statement of splitStatements(schema)) {
    try {
      await exec(statement);
    } catch (cause) {
      const { code } = (cause ?? {}) as { code?: unknown };
      if (typeof code === "string" && ALREADY_THERE.has(code)) continue;
      throw cause;
    }
  }
}

let applied: Promise<void> | null = null;

/**
 * Runs once per process. A failed attempt is not cached: the next request
 * tries again, and meanwhile the query that follows raises the real error
 * rather than this one masking it.
 */
export function ensureSchema(exec: Executor): Promise<void> {
  applied ??= (async () => {
    const path = join(process.cwd(), "schema.sql");
    const schema = await readFile(path, "utf8");
    await applySchema(schema, exec);
  })().catch((cause) => {
    console.error("[schema] could not apply schema.sql:", cause);
    applied = null;
  });
  return applied;
}

import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
// @next/env is CommonJS, so it has no named ESM exports — import the default.
import nextEnv from "@next/env";

// The `true` puts it in dev mode so .env.development.local is read — that is
// the file `vercel env pull` writes.
nextEnv.loadEnvConfig(process.cwd(), true);

// The integration's own DATABASE_URL is one record shared by all three
// environments, so it is the league's live database wherever it is read from.
const PRODUCTION_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "STORAGE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

// DATABASE_URL_OVERRIDE exists only on Development and Preview, where it points
// at parlay_dev. Applying to production means deliberately stepping past it,
// which is what --production does and the only thing it does.
const production = process.argv.includes("--production");
const KEYS = production
  ? PRODUCTION_KEYS
  : ["DATABASE_URL_OVERRIDE", ...PRODUCTION_KEYS];

const key = KEYS.find((candidate) => process.env[candidate]);
if (!key) {
  console.error(
    `No connection string found (looked for ${KEYS.join(", ")}).\n` +
      "Run: vercel env pull .env.development.local",
  );
  process.exit(1);
}

/** Host and database name only — the connection string carries a password. */
function describeTarget(connectionString) {
  try {
    const { host, pathname } = new URL(connectionString);
    return `${pathname.replace(/^\//, "") || "(unnamed)"} on ${host}`;
  } catch {
    return "an unparseable connection string";
  }
}

console.log(
  `Applying schema.sql to ${describeTarget(process.env[key])} ` +
    `(via ${key})${production ? "  ← PRODUCTION, the league's data" : ""}\n`,
);

const sql = neon(process.env[key]);
const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");

// The HTTP driver takes one statement per call. Strip line comments before
// splitting, since a comment may itself contain a semicolon. schema.sql has no
// string literals containing "--", which is the case this would not survive.
const statements = schema
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log(`✓ ${statement.split("\n")[0].trim().slice(0, 60)}`);
}

console.log(`\nSchema applied to ${describeTarget(process.env[key])}.`);

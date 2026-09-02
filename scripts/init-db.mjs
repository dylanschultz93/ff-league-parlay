import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
// @next/env is CommonJS, so it has no named ESM exports — import the default.
import nextEnv from "@next/env";

// The `true` puts it in dev mode so .env.development.local is read — that is
// the file `vercel env pull` writes.
nextEnv.loadEnvConfig(process.cwd(), true);

const KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "STORAGE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

const key = KEYS.find((candidate) => process.env[candidate]);
if (!key) {
  console.error(
    `No connection string found (looked for ${KEYS.join(", ")}).\n` +
      "Run: vercel env pull .env.development.local",
  );
  process.exit(1);
}

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

console.log(`\nSchema applied using ${key}.`);

import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

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

// The HTTP driver takes one statement per call; schema.sql has no semicolons
// inside literals, so splitting on them is safe here.
const statements = schema
  .split(";")
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

for (const statement of statements) {
  await sql.query(statement);
  console.log(`✓ ${statement.split("\n")[0].slice(0, 60)}…`);
}

console.log(`\nSchema applied using ${key}.`);

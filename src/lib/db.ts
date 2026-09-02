import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * The Vercel/Neon integration names its connection string after the "Custom
 * Prefix" chosen at install time, so accept the usual candidates rather than
 * pinning one.
 */
const CANDIDATE_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "STORAGE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

let client: NeonQueryFunction<false, false> | null = null;

/**
 * Lazily built so a missing connection string fails on the first query with a
 * useful message, rather than at import time during `next build`.
 */
export function db(): NeonQueryFunction<false, false> {
  if (client) return client;

  const key = CANDIDATE_KEYS.find((candidate) => process.env[candidate]);
  if (!key) {
    throw new Error(
      `No Postgres connection string found. Looked for: ${CANDIDATE_KEYS.join(", ")}. ` +
        "Run `vercel env pull .env.development.local` to fetch it locally.",
    );
  }

  client = neon(process.env[key]!);
  return client;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres raises on a malformed uuid — screen ids before they reach a query. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The one thing in the app behind a password: people's phone numbers. Every
 * other screen stays open to anyone with the link, but numbers are personal,
 * so reading or changing them needs ADMIN_KEY — set in the Vercel project, and
 * entered once per device on /manage.
 *
 * The cookie holds an HMAC of the key rather than the key itself, and changing
 * ADMIN_KEY signs every device out.
 */
export const ADMIN_COOKIE = "parlay_admin";

/** A year: this is typed on a phone once, not every Sunday. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function adminKey(): string | null {
  return process.env.ADMIN_KEY?.trim() || null;
}

export function adminConfigured(): boolean {
  return adminKey() !== null;
}

function token(key: string): string {
  return createHmac("sha256", key).update("parlay-admin-v1").digest("hex");
}

/** Hash both sides first so the comparison is constant-time whatever the length. */
function same(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** The cookie value to hand out for a correct key, or null for a wrong one. */
export function tokenForKey(input: string): string | null {
  const key = adminKey();
  if (!key || !same(input.trim(), key)) return null;
  return token(key);
}

/** Whether this request came from a device that has entered the key. */
export async function isAdmin(): Promise<boolean> {
  const key = adminKey();
  if (!key) return false;
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  return cookie !== undefined && same(cookie, token(key));
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { dbError } from "@/app/api/legs/route";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  adminConfigured,
  tokenForKey,
} from "@/lib/admin";
import { listPhones } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Unlock phone numbers on this device. Answers with the numbers so /manage can
 * show them straight away, without a reload.
 */
export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_KEY isn't set on this deployment." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { key } = (body ?? {}) as { key?: unknown };
  const token = typeof key === "string" ? tokenForKey(key) : null;
  if (!token) {
    return NextResponse.json({ error: "That's not the key." }, { status: 401 });
  }

  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  try {
    return NextResponse.json({ phones: await listPhones() });
  } catch (cause) {
    return dbError(cause, "participants");
  }
}

/** Lock this device again. */
export async function DELETE() {
  (await cookies()).delete(ADMIN_COOKIE);
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from "next/server";
import { dbError } from "@/app/api/legs/route";
import { isAdmin } from "@/lib/admin";
import { normalizePhone } from "@/lib/phone";
import { setParticipantPhone } from "@/lib/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Set someone's number, or `{ "phone": null }` to take it off. Admin only. */
export async function PUT(request: Request, { params }: Context) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Unlock phone numbers on /manage first." },
      { status: 401 },
    );
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { phone } = (body ?? {}) as { phone?: unknown };
  let normalized: string | null = null;
  if (typeof phone === "string" && phone.trim() !== "") {
    normalized = normalizePhone(phone);
    if (!normalized) {
      return NextResponse.json(
        { error: "That doesn't look like a phone number." },
        { status: 400 },
      );
    }
  } else if (phone !== null && phone !== "") {
    return NextResponse.json(
      { error: 'Send { "phone": "555-123-4567" } or { "phone": null }.' },
      { status: 400 },
    );
  }

  try {
    return (await setParticipantPhone(id, normalized))
      ? NextResponse.json({ phone: normalized })
      : NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (cause) {
    return dbError(cause, "participants");
  }
}

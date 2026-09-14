import { NextResponse } from "next/server";
import { dbError } from "@/app/api/legs/route";
import { addParticipant, listParticipants } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Long enough for a nickname, short enough to fit a leg card. */
const MAX_NAME = 40;

export async function GET() {
  try {
    return NextResponse.json({ participants: await listParticipants() });
  } catch (cause) {
    return dbError(cause, "participants");
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { name } = (body ?? {}) as { name?: unknown };
  if (typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Enter a name." }, { status: 400 });
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME) {
    return NextResponse.json(
      { error: `Keep it under ${MAX_NAME} characters.` },
      { status: 400 },
    );
  }

  try {
    const participant = await addParticipant(trimmed);
    // addParticipant returns nothing when the name is taken, case aside.
    if (!participant) {
      return NextResponse.json(
        { error: `${trimmed} is already on the list.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ participant }, { status: 201 });
  } catch (cause) {
    return dbError(cause, "participants");
  }
}

import { NextResponse } from "next/server";
import { dbError } from "@/app/api/legs/route";
import { removeParticipant, setParticipantActive } from "@/lib/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Not found." }, { status: 404 });

/** Bench someone, or bring them back. */
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { active } = (body ?? {}) as { active?: unknown };
  if (typeof active !== "boolean") {
    return NextResponse.json(
      { error: "Send { active: true } or { active: false }." },
      { status: 400 },
    );
  }

  try {
    const participant = await setParticipantActive(id, active);
    return participant ? NextResponse.json({ participant }) : notFound();
  } catch (cause) {
    return dbError(cause, "participants");
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  try {
    switch (await removeParticipant(id)) {
      case "removed":
        return new NextResponse(null, { status: 204 });
      case "has-leg":
        return NextResponse.json(
          {
            error:
              "They've got a leg on this week's board. Bench them instead, or take the leg off first.",
          },
          { status: 409 },
        );
      default:
        return notFound();
    }
  } catch (cause) {
    return dbError(cause, "participants");
  }
}

import { NextResponse } from "next/server";
import { dbError } from "@/app/api/legs/route";
import { isValidAmericanOdds } from "@/lib/odds";
import { deleteLeg, updateLeg } from "@/lib/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { pick, odds } = (body ?? {}) as { pick?: unknown; odds?: unknown };
  const patch: { pick?: string; odds?: number } = {};

  if (pick !== undefined) {
    if (typeof pick !== "string" || pick.trim() === "") {
      return NextResponse.json({ error: "Enter your pick." }, { status: 400 });
    }
    patch.pick = pick.trim();
  }
  if (odds !== undefined) {
    if (typeof odds !== "number" || !isValidAmericanOdds(odds)) {
      return NextResponse.json(
        { error: "Odds must be a whole number of at least +100 or -100." },
        { status: 400 },
      );
    }
    patch.odds = odds;
  }

  try {
    const leg = await updateLeg(id, patch);
    if (!leg) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ leg });
  } catch (cause) {
    return dbError(cause);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  try {
    if (!(await deleteLeg(id))) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (cause) {
    return dbError(cause);
  }
}

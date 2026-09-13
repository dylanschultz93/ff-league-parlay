import { NextResponse } from "next/server";
import { dbError, lockedError } from "@/app/api/legs/route";
import { isValidAmericanOdds } from "@/lib/odds";
import {
  deleteLeg,
  getParlay,
  setLegResult,
  updateLeg,
  type LegResult,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const RESULTS: LegResult[] = ["won", "lost"];

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { pick, odds, result } = (body ?? {}) as {
    pick?: unknown;
    odds?: unknown;
    result?: unknown;
  };

  // Editing a leg and grading it are opposite sides of the lock, so a request
  // that asks for both is always wrong whichever way the week is set.
  if (result !== undefined && (pick !== undefined || odds !== undefined)) {
    return NextResponse.json(
      { error: "Edit a leg or grade it, not both." },
      { status: 400 },
    );
  }

  if (result !== undefined) {
    if (result !== null && !RESULTS.includes(result as LegResult)) {
      return NextResponse.json(
        { error: 'A result is "won", "lost", or null to clear it.' },
        { status: 400 },
      );
    }
    try {
      const leg = await setLegResult(id, result as LegResult | null);
      if (leg) return NextResponse.json({ leg });
      // setLegResult only writes while the week is locked; it can't say which
      // of the two it hit.
      const parlay = await getParlay();
      return parlay.locked
        ? NextResponse.json({ error: "Not found." }, { status: 404 })
        : NextResponse.json(
            { error: "Lock the parlay before grading legs." },
            { status: 409 },
          );
    } catch (cause) {
      return dbError(cause);
    }
  }

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
    if (leg) return NextResponse.json({ leg });
    return (await getParlay()).locked
      ? lockedError()
      : NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (cause) {
    return dbError(cause);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  try {
    if (await deleteLeg(id)) return new NextResponse(null, { status: 204 });
    return (await getParlay()).locked
      ? lockedError()
      : NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (cause) {
    return dbError(cause);
  }
}

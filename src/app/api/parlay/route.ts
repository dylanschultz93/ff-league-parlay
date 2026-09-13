import { NextResponse } from "next/server";
import { dbError } from "@/app/api/legs/route";
import { gradedCount } from "@/lib/parlay";
import { getParlay, listLegs, lockParlay, unlockParlay } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The current week's parlay — one per (season, week), see src/lib/league.ts. */
export async function GET() {
  try {
    return NextResponse.json({ parlay: await getParlay() });
  } catch (cause) {
    return dbError(cause);
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { locked } = (body ?? {}) as { locked?: unknown };
  if (typeof locked !== "boolean") {
    return NextResponse.json(
      { error: "Send { locked: true } or { locked: false }." },
      { status: 400 },
    );
  }

  try {
    if (locked) {
      // Locking an empty board would place a ticket with nothing on it.
      if ((await listLegs()).length === 0) {
        return NextResponse.json(
          { error: "Add a leg before locking the parlay." },
          { status: 409 },
        );
      }
      return NextResponse.json({ parlay: await lockParlay() });
    }

    const parlay = await unlockParlay();
    if (parlay) return NextResponse.json({ parlay });

    // unlockParlay refuses once anything is graded, and no-ops on a week that
    // was never locked — which is already the state being asked for.
    const legs = await listLegs();
    if (gradedCount(legs) > 0) {
      return NextResponse.json(
        { error: "Clear the leg results before unlocking." },
        { status: 409 },
      );
    }
    return NextResponse.json({ parlay: await getParlay() });
  } catch (cause) {
    return dbError(cause);
  }
}

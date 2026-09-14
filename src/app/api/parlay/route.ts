import { NextResponse } from "next/server";
import { dbError } from "@/app/api/legs/route";
import { gradedCount } from "@/lib/parlay";
import {
  getParlay,
  listLegs,
  listParticipants,
  lockParlay,
  setPayer,
  unlockParlay,
} from "@/lib/store";

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

  const { locked, payer, payerReason } = (body ?? {}) as {
    locked?: unknown;
    payer?: unknown;
    payerReason?: unknown;
  };

  // The lock and the payer are both columns on the week row, but they are set
  // from different screens and mean different things — one request asking for
  // both is a mistake, not a shortcut.
  if (payer !== undefined) {
    if (locked !== undefined) {
      return NextResponse.json(
        { error: "Set the lock or the payer, not both." },
        { status: 400 },
      );
    }
    return patchPayer(payer, payerReason);
  }

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

/**
 * Name who's covering the ticket, or send null to take it back off them. The
 * payer has to be someone on the roster: it decides who owes $10, so a typo
 * that puts a stranger on the hook is worth refusing.
 */
async function patchPayer(payer: unknown, payerReason: unknown) {
  if (payer !== null && typeof payer !== "string") {
    return NextResponse.json(
      { error: "Send a name, or null to clear it." },
      { status: 400 },
    );
  }
  if (
    payerReason !== undefined &&
    payerReason !== null &&
    typeof payerReason !== "string"
  ) {
    return NextResponse.json(
      { error: "A reason is text, or null." },
      { status: 400 },
    );
  }

  // Clearing the payer clears why they were paying along with it.
  const reason =
    payer === null || typeof payerReason !== "string"
      ? null
      : payerReason.trim() || null;

  try {
    if (payer !== null) {
      const roster = await listParticipants();
      if (!roster.some((person) => person.active && person.name === payer)) {
        return NextResponse.json(
          { error: "Pick a name from the league roster." },
          { status: 400 },
        );
      }
    }
    return NextResponse.json({ parlay: await setPayer(payer, reason) });
  } catch (cause) {
    return dbError(cause, "parlay");
  }
}

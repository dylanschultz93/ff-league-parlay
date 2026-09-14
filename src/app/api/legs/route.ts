import { NextResponse } from "next/server";
import { describeDbError } from "@/lib/db";
import { isValidAmericanOdds } from "@/lib/odds";
import { getParlay, listLegs, listParticipants, upsertLeg } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [legs, parlay] = await Promise.all([listLegs(), getParlay()]);
    return NextResponse.json({ legs, parlay });
  } catch (cause) {
    return dbError(cause);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { name, pick, odds } = (body ?? {}) as {
    name?: unknown;
    pick?: unknown;
    odds?: unknown;
  };

  if (typeof name !== "string") {
    return NextResponse.json(
      { error: "Pick a name from the league roster." },
      { status: 400 },
    );
  }
  if (typeof pick !== "string" || pick.trim() === "") {
    return NextResponse.json({ error: "Enter your pick." }, { status: 400 });
  }
  if (typeof odds !== "number" || !isValidAmericanOdds(odds)) {
    return NextResponse.json(
      { error: "Odds must be a whole number of at least +100 or -100." },
      { status: 400 },
    );
  }

  try {
    // The roster is a table now, so this check is a query. A benched name is
    // as good as an unknown one: they're off this week either way.
    const roster = await listParticipants();
    if (!roster.some((person) => person.active && person.name === name)) {
      return NextResponse.json(
        { error: "Pick a name from the league roster." },
        { status: 400 },
      );
    }

    const leg = await upsertLeg({ name, pick: pick.trim(), odds });
    // upsertLeg refuses to write once the week is locked; it can't say why.
    if (!leg) return lockedError();
    return NextResponse.json({ leg }, { status: 201 });
  } catch (cause) {
    return dbError(cause);
  }
}

/** The ticket is placed — legs are frozen until someone unlocks it. */
export function lockedError() {
  return NextResponse.json(
    { error: "The parlay is locked. Unlock it to change a leg." },
    { status: 409 },
  );
}

export function dbError(cause: unknown, tag = "legs") {
  console.error(`[${tag}]`, cause);
  return NextResponse.json({ error: describeDbError(cause) }, { status: 503 });
}

import { NextResponse } from "next/server";
import { describeDbError } from "@/lib/db";
import { LEAGUE } from "@/lib/league";
import { isValidAmericanOdds } from "@/lib/odds";
import { getParlay, listLegs, upsertLeg } from "@/lib/store";

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

  if (typeof name !== "string" || !LEAGUE.roster.includes(name)) {
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

export function dbError(cause: unknown) {
  console.error("[legs]", cause);
  return NextResponse.json({ error: describeDbError(cause) }, { status: 503 });
}

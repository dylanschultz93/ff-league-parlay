import { NextResponse } from "next/server";
import { dbError } from "@/app/api/legs/route";
import {
  getLeagueState,
  getParlay,
  listLegs,
  setLeagueState,
} from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Weeks worth allowing: a regular season plus playoffs, with room either side.
 * Loose enough not to argue with the league, tight enough to catch a fat
 * finger on a control that re-points every other query in the app.
 */
const WEEKS = { min: 1, max: 25 };
const SEASONS = { min: 2000, max: 2100 };

export async function GET() {
  try {
    return NextResponse.json({ league: await getLeagueState() });
  } catch (cause) {
    return dbError(cause, "league");
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { season, week } = (body ?? {}) as { season?: unknown; week?: unknown };
  if (season === undefined && week === undefined) {
    return NextResponse.json(
      { error: "Send a season, a week, or both." },
      { status: 400 },
    );
  }

  try {
    const current = await getLeagueState();
    const nextSeason = season === undefined ? current.season : season;
    const nextWeek = week === undefined ? current.week : week;

    if (!inRange(nextSeason, SEASONS)) {
      return NextResponse.json(
        { error: `A season is between ${SEASONS.min} and ${SEASONS.max}.` },
        { status: 400 },
      );
    }
    if (!inRange(nextWeek, WEEKS)) {
      return NextResponse.json(
        { error: `A week is between ${WEEKS.min} and ${WEEKS.max}.` },
        { status: 400 },
      );
    }

    const league = await setLeagueState(nextSeason, nextWeek);
    // The payer and the legs belong to the week, so both just changed under
    // the caller. Hand back the new week's versions rather than making the
    // management screen ask for them separately.
    const [parlay, legs] = await Promise.all([getParlay(), listLegs()]);
    return NextResponse.json({ league, parlay, legCount: legs.length });
  } catch (cause) {
    return dbError(cause, "league");
  }
}

function inRange(
  value: unknown,
  { min, max }: { min: number; max: number },
): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

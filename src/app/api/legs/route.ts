import { NextResponse } from "next/server";
import { LEAGUE } from "@/lib/league";
import { isValidAmericanOdds } from "@/lib/odds";
import { listLegs, upsertLeg } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ legs: await listLegs() });
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
    return NextResponse.json({ leg }, { status: 201 });
  } catch (cause) {
    return dbError(cause);
  }
}

export function dbError(cause: unknown) {
  const message =
    cause instanceof Error ? cause.message : "Database request failed.";
  console.error("[legs]", cause);
  return NextResponse.json({ error: message }, { status: 503 });
}

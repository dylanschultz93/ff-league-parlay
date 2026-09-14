import type { Metadata } from "next";
import ManageBoard from "@/components/ManageBoard";
import PageShell from "@/components/PageShell";
import { describeDbError } from "@/lib/db";
import { LEAGUE } from "@/lib/league";
import {
  getParlay,
  listParticipants,
  type Parlay,
  type Participant,
} from "@/lib/store";

export const metadata: Metadata = { title: "Manage" };
export const dynamic = "force-dynamic";

export default async function ManagePage() {
  let participants: Participant[] = [];
  let parlay: Parlay = {
    locked: false,
    lockedAt: null,
    payer: null,
    payerReason: null,
  };
  let initialError: string | undefined;

  try {
    [participants, parlay] = await Promise.all([
      listParticipants(),
      getParlay(),
    ]);
  } catch (cause) {
    // Same as the board: render the screen with the failure on it rather than
    // a crash page.
    initialError = describeDbError(cause);
  }

  return (
    <PageShell
      title="Manage"
      meta={`Week ${LEAGUE.week} · ${LEAGUE.season} Season`}
      metaShort={`Week ${LEAGUE.week}`}
    >
      <ManageBoard
        week={LEAGUE.week}
        initialParticipants={participants}
        initialParlay={parlay}
        initialError={initialError}
      />
    </PageShell>
  );
}

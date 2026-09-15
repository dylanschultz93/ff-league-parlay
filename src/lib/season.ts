import { getLeagueState } from "@/lib/store";

/**
 * The current season, or null if it can't be read.
 *
 * For screens where the season is only a caption: they have nothing else to
 * show from the database, so a failure there should cost them the label rather
 * than the page. Anywhere the week actually matters, read `getLeagueState`
 * directly and let the failure surface.
 */
export async function currentSeason(): Promise<number | null> {
  try {
    return (await getLeagueState()).season;
  } catch {
    return null;
  }
}

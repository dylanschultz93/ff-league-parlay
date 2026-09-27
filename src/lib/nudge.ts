/**
 * Nudges go out through whatever the sender already uses — iMessage, SMS,
 * Messenger, the league group chat — by handing the text to the phone's share
 * sheet. The app never sends anything itself: no provider, no phone numbers
 * on file, nobody has to sign up for anything.
 */

/** Joins names the way a text would: "A", "A and B", "A, B and C". */
function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function nudgeText({
  names,
  week,
  locksAt,
  url,
}: {
  names: string[];
  week?: number;
  locksAt: string;
  url: string;
}) {
  const forWeek = week ? ` for Week ${week}` : "";
  const who =
    names.length === 1
      ? `${names[0]}, still need your parlay leg${forWeek}`
      : `Still waiting on parlay legs${forWeek} from ${listNames(names)}`;
  return `${who} (${locksAt}). Add it here: ${url}`;
}

export type NudgeOutcome = "shared" | "copied" | "cancelled" | "failed";

/**
 * Opens the share sheet where there is one (phones, most desktop browsers),
 * otherwise puts the text on the clipboard to paste into a chat by hand.
 */
export async function sendNudge(text: string): Promise<NudgeOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      // Dismissing the sheet rejects with AbortError — that's a choice, not a
      // failure. Anything else falls through to the clipboard.
      if (err instanceof DOMException && err.name === "AbortError")
        return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/**
 * Nudges go out from the sender's own phone. The app never sends anything
 * itself: no provider, and nobody has to sign up for anything.
 *
 * With numbers on file (see src/lib/admin.ts) a nudge opens Messages already
 * addressed and written, so all that's left is Send. Without them it falls
 * back to the share sheet, and the sender picks who it goes to.
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

/**
 * A text link with the recipients and message filled in. Apple and Android
 * disagree on the syntax: Messages on iPhone and Mac wants
 * `sms://open?addresses=` to start a group and `&body=`, Android takes a
 * comma-separated list and `?body=`.
 */
export function smsHref(phones: string[], body: string): string {
  const text = encodeURIComponent(body);
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  if (!apple) return `sms:${phones.join(",")}?body=${text}`;
  return phones.length === 1
    ? `sms:${phones[0]}&body=${text}`
    : `sms://open?addresses=${phones.join(",")}&body=${text}`;
}

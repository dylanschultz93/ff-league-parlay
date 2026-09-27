"use client";

import { useState } from "react";
import { sendNudge, smsHref } from "@/lib/nudge";

/**
 * A text link that sends a prewritten reminder. With phone numbers it opens
 * Messages addressed and ready to send; without, it hands the text to the
 * share sheet. The message is built at click time, not render time, so the
 * link in it is the page the sender is actually on.
 */
export default function NudgeButton({
  label,
  ariaLabel,
  phones = [],
  message,
}: {
  label: string;
  ariaLabel?: string;
  phones?: string[];
  message: (url: string) => string;
}) {
  const [note, setNote] = useState<string | null>(null);

  async function nudge() {
    const text = message(window.location.origin);
    if (phones.length > 0) {
      window.location.href = smsHref(phones, text);
      return;
    }
    const outcome = await sendNudge(text);
    const shown =
      outcome === "copied"
        ? "copied"
        : outcome === "failed"
          ? "couldn't share"
          : null;
    setNote(shown);
    if (shown) setTimeout(() => setNote(null), 2000);
  }

  return (
    <button
      type="button"
      onClick={nudge}
      aria-label={ariaLabel}
      className="font-mono text-xs text-muted-3 transition-colors hover:text-accent-soft active:text-accent-soft"
    >
      {note ?? label}
    </button>
  );
}

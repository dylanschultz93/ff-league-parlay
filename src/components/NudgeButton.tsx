"use client";

import { useState } from "react";
import { sendNudge } from "@/lib/nudge";

/**
 * A text link that hands a prewritten reminder to the share sheet. Built at
 * click time, not render time, so the link in the message is the page the
 * sender is actually on.
 */
export default function NudgeButton({
  label,
  ariaLabel,
  message,
}: {
  label: string;
  ariaLabel?: string;
  message: (url: string) => string;
}) {
  const [note, setNote] = useState<string | null>(null);

  async function nudge() {
    const outcome = await sendNudge(message(window.location.origin));
    const text =
      outcome === "copied"
        ? "copied"
        : outcome === "failed"
          ? "couldn't share"
          : null;
    setNote(text);
    if (text) setTimeout(() => setNote(null), 2000);
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

"use client";

import { useState } from "react";
import type { ParlayStatus } from "@/lib/parlay";

/**
 * Placing the ticket, and taking it back. Locking is a two-tap confirm rather
 * than a window.confirm: there's no auth, so anyone can do it to everyone
 * else's week, and it freezes every leg on the board.
 */
export default function LockControls({
  status,
  legCount,
  graded,
  pending,
  onLock,
  onUnlock,
}: {
  status: ParlayStatus;
  legCount: number;
  graded: number;
  pending: boolean;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (status === "open") {
    if (legCount === 0) return null;

    if (!confirming) {
      return (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex h-[50px] w-full items-center justify-center rounded-2xl bg-accent text-[15px] font-semibold text-app transition-opacity hover:opacity-90 active:opacity-90"
          >
            Lock the parlay
          </button>
          <p className="px-0.5 font-mono text-[11px] text-muted-3">
            Do this once the bet is placed. {legCount}{" "}
            {legCount === 1 ? "leg freezes" : "legs freeze"}.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--accent-28)] bg-[var(--accent-11)] px-4 py-3.5">
        <p className="text-[13px] text-ink-3">
          Lock {legCount} {legCount === 1 ? "leg" : "legs"}? Nobody can add,
          edit, or remove a leg after this.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLock}
            disabled={pending}
            className="h-10 flex-1 rounded-xl bg-accent text-sm font-semibold text-app transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Locking…" : "Yes, lock it"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-10 rounded-xl border border-input-line px-4 text-sm text-muted transition-colors hover:text-ink-3"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Graded legs make the week a record of what happened, not a draft — so the
  // way back out is to clear the results first.
  if (status === "live" && graded === 0) {
    return (
      <button
        type="button"
        onClick={onUnlock}
        disabled={pending}
        className="self-start px-0.5 font-mono text-[11px] text-muted-3 underline underline-offset-4 transition-colors hover:text-ink-3 disabled:opacity-50"
      >
        Locked by mistake? Unlock it
      </button>
    );
  }

  return null;
}

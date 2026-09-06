"use client";

import { useState, useTransition } from "react";
import { reopenRater } from "../../../actions";

export function ReopenRaterButton({
  raterId,
  cycleId,
  raterLabel,
}: {
  raterId: string;
  cycleId: string;
  raterLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      `Reopen ${raterLabel}'s questionnaire for corrections? They'll be able to use their existing link to change and resubmit their answers.`,
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await reopenRater(raterId, cycleId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? "Reopening…" : "Reopen"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

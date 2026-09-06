"use client";

import { useState, useTransition } from "react";
import { setCycleStatus } from "../../../actions";
import type { CycleStatus } from "@/lib/types";

export function CycleStatusControl({ cycleId, status }: { cycleId: string; status: CycleStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(next: CycleStatus) {
    if (next === "closed") {
      const confirmed = window.confirm(
        "Mark this cycle as complete? Only completed cycles are included in organisation-wide reports, and its numbers should be final before you do this.",
      );
      if (!confirmed) return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setCycleStatus(cycleId, next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          status === "closed"
            ? "bg-green-100 text-green-800"
            : status === "open"
              ? "bg-amber-100 text-amber-800"
              : "bg-zinc-100 text-zinc-600"
        }`}
      >
        {status === "closed" ? "Completed" : status === "open" ? "Open" : "Draft"}
      </span>
      {status === "closed" ? (
        <button
          type="button"
          onClick={() => handleClick("open")}
          disabled={isPending}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {isPending ? "Reopening…" : "Reopen cycle"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => handleClick("closed")}
          disabled={isPending}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Mark cycle as complete"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateLinkExpiry } from "../../../actions";

export function LinkExpiryEditor({
  cycleId,
  initialDays,
}: {
  cycleId: string;
  initialDays: number;
}) {
  const [days, setDays] = useState(String(initialDays));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const parsed = Number(days);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateLinkExpiry(cycleId, parsed);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="link_expiry_days_edit" className="text-sm text-zinc-700">
        Rater links expire after
      </label>
      <input
        id="link_expiry_days_edit"
        type="number"
        min={1}
        step={1}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
      />
      <span className="text-sm text-zinc-700">days</span>
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending || days === String(initialDays)}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

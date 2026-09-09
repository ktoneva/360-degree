"use client";

import { useState, useTransition } from "react";
import { saveCompetencyComment } from "./actions";

export function CompetencyCommentBox({
  token,
  competencyNumber,
  initialValue,
}: {
  token: string;
  competencyNumber: number;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleBlur() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveCompetencyComment(token, competencyNumber, value);
        if (result.error) setError(result.error);
      } catch {
        setError("Couldn't save — check your connection. It will be saved again when you submit.");
      }
    });
  }

  return (
    <div className="mt-4">
      <label htmlFor={`comp-comment-${competencyNumber}`} className="block text-sm font-medium text-zinc-700">
        Anything else you&apos;d add about this area? (optional)
      </label>
      <textarea
        id={`comp-comment-${competencyNumber}`}
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-brand-navy focus:outline-none"
      />
      {isPending && <p className="mt-1 text-xs text-zinc-400">Saving…</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

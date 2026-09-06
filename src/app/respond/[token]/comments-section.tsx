"use client";

import { useState, useTransition } from "react";
import { saveComments } from "./actions";
import type { CommentsValue } from "@/lib/types";

const FIELDS: { key: keyof CommentsValue; label: string }[] = [
  { key: "continue_text", label: "What should they continue doing?" },
  { key: "start_text", label: "What should they start doing?" },
  { key: "stop_text", label: "What should they stop doing?" },
];

export function CommentsSection({
  token,
  value,
  onChange,
}: {
  token: string;
  value: CommentsValue;
  onChange: (value: CommentsValue) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleBlur() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveComments(token, value);
        if (result.error) setError(result.error);
      } catch {
        setError("Couldn't save — check your connection. It will be saved again when you submit.");
      }
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Your comments</h2>
        <p className="mt-1 text-sm text-zinc-600">Optional, but genuinely useful. Shown in full.</p>
      </div>

      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label htmlFor={key} className="block text-sm font-medium text-zinc-700">
            {label}
          </label>
          <textarea
            id={key}
            rows={3}
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            onBlur={handleBlur}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
      ))}

      {isPending && <p className="text-xs text-zinc-400">Saving…</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </section>
  );
}

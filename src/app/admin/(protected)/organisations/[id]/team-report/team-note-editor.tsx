"use client";

import { useState, useTransition } from "react";
import { saveTeamReportNote } from "@/app/admin/actions";
import type { LeaderLevel } from "@/lib/types";

type Card = "strengths" | "gaps" | "stretch" | "development";

export function TeamNoteEditor({
  organisationId,
  level,
  card,
  position,
  initialWho,
  initialWhat,
}: {
  organisationId: string;
  level: LeaderLevel;
  card: Card;
  position: 1 | 2;
  initialWho: string;
  initialWhat: string;
}) {
  const [editing, setEditing] = useState(false);
  const [who, setWho] = useState(initialWho);
  const [what, setWhat] = useState(initialWhat);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveTeamReportNote(organisationId, level, card, position, who, what);
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  }

  if (editing) {
    return (
      <li style={{ padding: "7px 0" }}>
        <input
          value={who}
          onChange={(e) => setWho(e.target.value)}
          placeholder="Who or what (bold line)"
          className="mb-1 block w-full rounded border border-zinc-300 px-2 py-1 text-xs"
        />
        <textarea
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="Description"
          rows={2}
          className="block w-full rounded border border-zinc-300 px-2 py-1 text-xs"
        />
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setWho(initialWho);
              setWhat(initialWhat);
              setEditing(false);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-700"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </li>
    );
  }

  return (
    <li>
      <span className="who">{who || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Not set</span>}</span>
      <span className="what">{what}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="print:hidden mt-1 text-xs text-zinc-400 underline hover:text-zinc-700"
      >
        Edit
      </button>
    </li>
  );
}

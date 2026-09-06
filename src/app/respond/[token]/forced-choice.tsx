"use client";

import { useState, useTransition } from "react";
import { saveForcedChoice } from "./actions";
import { FORCED_CHOICE_PRIORITY_COUNT } from "@/lib/types";
import type { AssignedItem } from "@/lib/types";

export function ForcedChoice({
  token,
  items,
  initialSelectedIds,
  onSelectionChange,
}: {
  token: string;
  items: AssignedItem[];
  initialSelectedIds: string[];
  onSelectionChange: (count: number) => void;
}) {
  const [savedSelected, setSavedSelected] = useState<string[]>(initialSelectedIds);
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const eligible = items.filter((item) => !item.is_integrity_item);

  function toggle(itemId: string) {
    setError(null);
    let next: string[];
    if (selected.includes(itemId)) {
      next = selected.filter((id) => id !== itemId);
    } else {
      if (selected.length >= FORCED_CHOICE_PRIORITY_COUNT) return;
      next = [...selected, itemId];
    }
    setSelected(next);
    onSelectionChange(next.length);
    startTransition(async () => {
      try {
        const result = await saveForcedChoice(token, next);
        if (result.error) {
          setError(result.error);
          setSelected(savedSelected);
          onSelectionChange(savedSelected.length);
          return;
        }
        setSavedSelected(next);
      } catch {
        setError("Couldn't save — check your connection and try again.");
        setSelected(savedSelected);
        onSelectionChange(savedSelected.length);
      }
    });
  }

  const byCompetency = new Map<string, AssignedItem[]>();
  for (const item of eligible) {
    const key = `${item.competency_number}. ${item.competency_name}`;
    if (!byCompetency.has(key)) byCompetency.set(key, []);
    byCompetency.get(key)!.push(item);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-navy">Development priorities</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Pick the 3 behaviours that would make the biggest difference if improved. These can be
          from any of the 9 areas.
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-700">
          {selected.length} of {FORCED_CHOICE_PRIORITY_COUNT} chosen
        </p>
      </div>

      <div className="space-y-5">
        {[...byCompetency.entries()].map(([competencyLabel, competencyItems]) => (
          <div key={competencyLabel}>
            <h3 className="mb-2 text-sm font-semibold text-brand-gold">{competencyLabel}</h3>
            <div className="space-y-1.5">
              {competencyItems.map((item) => {
                const isChecked = selected.includes(item.id);
                const isDisabled = !isChecked && selected.length >= FORCED_CHOICE_PRIORITY_COUNT;
                return (
                  <label
                    key={item.id}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                      isChecked
                        ? "border-brand-navy bg-brand-navy text-white"
                        : isDisabled
                          ? "cursor-not-allowed border-zinc-100 text-zinc-300"
                          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => toggle(item.id)}
                      className="mt-0.5"
                    />
                    <span>{item.behaviour_text}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {isPending && <p className="text-xs text-zinc-400">Saving…</p>}
      {error && (
        <p className="text-xs font-medium text-red-600">
          {error} Your choice was not saved — try again.
        </p>
      )}
    </section>
  );
}

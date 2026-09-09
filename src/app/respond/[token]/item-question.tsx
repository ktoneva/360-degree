"use client";

import { useState, useTransition } from "react";
import { saveResponse } from "./actions";
import type { AssignedItem, IntegrityValue, ResponseValue } from "@/lib/types";

const SCALE_OPTIONS = [
  { value: 1, label: "Almost never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Usually" },
  { value: 5, label: "Almost always" },
];

const INTEGRITY_OPTIONS: { value: IntegrityValue; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_observed", label: "Not observed" },
];

type SelectedOption = number | "not_observed" | IntegrityValue | null;

function toSelectedOption(item: AssignedItem, value: ResponseValue | undefined): SelectedOption {
  if (!value) return null;
  if (item.is_integrity_item) return value.integrity_value;
  if (value.not_observed) return "not_observed";
  return value.scale_value;
}

export function ItemQuestion({
  token,
  item,
  initialValue,
  onSaved,
  className,
}: {
  token: string;
  item: AssignedItem;
  initialValue: ResponseValue | undefined;
  onSaved: (itemId: string, answered: boolean) => void;
  className?: string;
}) {
  const initialSelected = toSelectedOption(item, initialValue);
  // Tracks the last option we know was actually persisted, so a failed save
  // can revert the visible selection instead of showing an answer that
  // silently isn't there — the whole point of surfacing an error here.
  const [savedOption, setSavedOption] = useState<SelectedOption>(initialSelected);
  const [selected, setSelected] = useState<SelectedOption>(initialSelected);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(option: SelectedOption) {
    setSelected(option);
    setError(null);

    const value: ResponseValue = item.is_integrity_item
      ? { scale_value: null, not_observed: false, integrity_value: option as IntegrityValue }
      : option === "not_observed"
        ? { scale_value: null, not_observed: true, integrity_value: null }
        : { scale_value: option as number, not_observed: false, integrity_value: null };

    startTransition(async () => {
      try {
        const result = await saveResponse(token, item.id, value);
        if (result.error) {
          setError(result.error);
          setSelected(savedOption);
          return;
        }
        setSavedOption(option);
        onSaved(item.id, true);
      } catch {
        setError("Couldn't save — check your connection and try again.");
        setSelected(savedOption);
      }
    });
  }

  const isUnsaved = error !== null;

  return (
    <div
      className={`rounded-lg border p-4 ${isUnsaved ? "border-red-300 bg-red-50/30" : "border-zinc-200 bg-white"} ${className ?? ""}`}
    >
      <p className="mb-3 text-sm text-zinc-900">{item.behaviour_text}</p>

      <div className="space-y-1.5">
        {(item.is_integrity_item ? INTEGRITY_OPTIONS : SCALE_OPTIONS).map((option) => (
          <label
            key={option.value}
            className={`flex min-h-[44px] cursor-pointer items-center rounded-md border px-3 py-2 text-sm transition-colors ${
              selected === option.value
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <input
              type="radio"
              name={`item-${item.id}`}
              value={option.value}
              checked={selected === option.value}
              onChange={() => choose(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}

        {!item.is_integrity_item && (
          <label
            className={`flex min-h-[44px] cursor-pointer items-center rounded-md border border-dashed px-3 py-2 text-sm transition-colors ${
              selected === "not_observed"
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-zinc-300 text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <input
              type="radio"
              name={`item-${item.id}`}
              value="not_observed"
              checked={selected === "not_observed"}
              onChange={() => choose("not_observed")}
              className="sr-only"
            />
            Not able to comment
          </label>
        )}
      </div>

      {isPending && <p className="mt-2 text-xs text-zinc-400">Saving…</p>}
      {error && (
        <p className="mt-2 text-xs font-medium text-red-600">
          {error} Your answer above was not saved — pick again to retry.
        </p>
      )}
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { addRater } from "@/app/admin/actions";
import { initialActionState } from "@/lib/action-state";
import { RATER_GROUPS, RATER_GROUP_LABELS } from "@/lib/types";

export function AddRaterForm({ cycleId }: { cycleId: string }) {
  const addRaterForCycle = addRater.bind(null, cycleId);
  const [state, formAction, pending] = useActionState(addRaterForCycle, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.successCount > 0) {
      formRef.current?.reset();
    }
  }, [state.successCount]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="full_name" className="block text-xs font-medium text-zinc-700">
            Name
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            className="mt-1 w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="mt-1 w-56 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="rater_group" className="block text-xs font-medium text-zinc-700">
            Group
          </label>
          <select
            id="rater_group"
            name="rater_group"
            required
            defaultValue=""
            className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="" disabled>
              Choose…
            </option>
            {RATER_GROUPS.map((group) => (
              <option key={group} value={group}>
                {RATER_GROUP_LABELS[group]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add rater"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

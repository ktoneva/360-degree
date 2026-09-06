"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createReviewCycle } from "@/app/admin/actions";
import { initialActionState } from "@/lib/action-state";
import { LEADER_LEVELS, LEADER_LEVEL_LABELS } from "@/lib/types";

export function NewCycleForm({
  organisations,
}: {
  organisations: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createReviewCycle,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="leader_name" className="block text-sm font-medium text-zinc-700">
          Leader&apos;s name
        </label>
        <input
          id="leader_name"
          name="leader_name"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          placeholder="Jamie Okafor"
        />
        <p className="mt-1 text-xs text-zinc-500">
          If this name matches an existing leader, the cycle is added to them instead of creating a duplicate.
        </p>
      </div>

      <div>
        <label htmlFor="role_title" className="block text-sm font-medium text-zinc-700">
          Role title (optional)
        </label>
        <input
          id="role_title"
          name="role_title"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          placeholder="Headteacher"
        />
      </div>

      <div>
        <label htmlFor="organisation_id" className="block text-sm font-medium text-zinc-700">
          Organisation
        </label>
        {organisations.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">
            No organisations yet.{" "}
            <Link href="/admin/organisations" className="underline hover:text-zinc-700">
              Add one first
            </Link>
            .
          </p>
        ) : (
          <select
            id="organisation_id"
            name="organisation_id"
            required
            defaultValue=""
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="" disabled>
              Choose…
            </option>
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label htmlFor="level" className="block text-sm font-medium text-zinc-700">
          Leader&apos;s level
        </label>
        <select
          id="level"
          name="level"
          required
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="" disabled>
            Choose…
          </option>
          {LEADER_LEVELS.map((level) => (
            <option key={level} value={level}>
              {LEADER_LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="cycle_name" className="block text-sm font-medium text-zinc-700">
          Cycle name
        </label>
        <input
          id="cycle_name"
          name="cycle_name"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          placeholder="Autumn 2026 review"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="period_start" className="block text-sm font-medium text-zinc-700">
            Opens
          </label>
          <input
            id="period_start"
            name="period_start"
            type="date"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="period_end" className="block text-sm font-medium text-zinc-700">
            Closes
          </label>
          <input
            id="period_end"
            name="period_end"
            type="date"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="link_expiry_days" className="block text-sm font-medium text-zinc-700">
          Rater link expires after (days)
        </label>
        <input
          id="link_expiry_days"
          name="link_expiry_days"
          type="number"
          min={1}
          step={1}
          defaultValue={60}
          required
          className="mt-1 block w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Raters&apos; links stop working this many days after they&apos;re invited. You can change this later from the cycle page.
        </p>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-zinc-700">Competency 9</legend>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="competency_9_variant"
              value="standard"
              defaultChecked
              className="mt-1"
            />
            <span>
              <span className="font-medium">Standard</span> — Teaching, learning and standards
              (teaching leaders)
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input type="radio" name="competency_9_variant" value="ops" className="mt-1" />
            <span>
              <span className="font-medium">Ops variant</span> — Operational standards and
              service quality (business managers, operations, finance, estates, HR, central-team
              leaders)
            </span>
          </label>
        </div>
      </fieldset>

      {state.error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create review cycle"}
      </button>
    </form>
  );
}

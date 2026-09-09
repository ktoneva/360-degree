"use client";

import { useState, useTransition } from "react";
import { removeRater, unarchiveRater, updateRater } from "@/app/admin/actions";
import { RATER_GROUPS, RATER_GROUP_LABELS, type Rater, type RaterGroup } from "@/lib/types";
import { CopyLinkButton } from "./copy-link-button";
import { ReopenRaterButton } from "./reopen-rater-button";

function raterStatus(rater: Rater) {
  if (rater.completed_at) return { label: "Completed", date: rater.completed_at };
  if (rater.started_at) return { label: "Started", date: rater.started_at };
  return { label: "Not started", date: null };
}

export function RaterTableRow({
  rater,
  cycleId,
  link,
  mailto,
}: {
  rater: Rater;
  cycleId: string;
  link: string;
  mailto: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(rater.full_name ?? "");
  const [email, setEmail] = useState(rater.email ?? "");
  const [raterGroup, setRaterGroup] = useState<RaterGroup>(rater.rater_group);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const status = raterStatus(rater);
  const archived = Boolean(rater.archived_at);
  // A hint only, for the button label -- removeRater re-checks the actual
  // response tables server-side and archives instead of deleting if this
  // guess turns out wrong, so nothing is ever silently lost to a stale view.
  const likelyHasData = Boolean(rater.started_at || rater.completed_at);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateRater(rater.id, cycleId, { fullName, email, raterGroup });
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  }

  function handleCancel() {
    setFullName(rater.full_name ?? "");
    setEmail(rater.email ?? "");
    setRaterGroup(rater.rater_group);
    setError(null);
    setEditing(false);
  }

  function handleRemove() {
    const label = rater.full_name ?? "this rater";
    const confirmed = window.confirm(
      likelyHasData
        ? `Archive ${label}? They'll be removed from reports and completion counts, but their submitted answers stay in the system and this can be undone with Unarchive.`
        : `Delete ${label}? They haven't submitted anything, so this removes the invite completely with no trace. This can't be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await removeRater(rater.id, cycleId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.result === "archived" && !likelyHasData) {
        setInfo("They already had response data on file, so they were archived rather than deleted.");
      }
    });
  }

  function handleUnarchive() {
    setError(null);
    startTransition(async () => {
      const result = await unarchiveRater(rater.id, cycleId);
      if (result.error) setError(result.error);
    });
  }

  if (editing) {
    return (
      <tr className={archived ? "opacity-60" : undefined}>
        <td className="px-4 py-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Name"
            className="mb-1 block w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="block w-full rounded border border-zinc-300 px-2 py-1 text-xs"
          />
        </td>
        <td className="px-4 py-3">
          <select
            value={raterGroup}
            onChange={(e) => setRaterGroup(e.target.value as RaterGroup)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
          >
            {RATER_GROUPS.map((group) => (
              <option key={group} value={group}>
                {RATER_GROUP_LABELS[group]}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-zinc-400">—</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className={archived ? "opacity-60" : undefined}>
      <td className="px-4 py-3">
        <p className="font-medium text-zinc-900">{rater.full_name ?? "—"}</p>
        <p className="text-xs text-zinc-500">{rater.email ?? "No email on file"}</p>
      </td>
      <td className="px-4 py-3 text-zinc-700">{RATER_GROUP_LABELS[rater.rater_group]}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={
              status.label === "Completed"
                ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                : status.label === "Started"
                  ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                  : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
            }
          >
            {status.label}
          </span>
          {archived && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Archived
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <CopyLinkButton link={link} />
          {mailto ? (
            <a
              href={mailto}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Email
            </a>
          ) : (
            <span className="text-xs text-zinc-400">No email</span>
          )}
          {!archived && status.label === "Completed" && (
            <ReopenRaterButton
              raterId={rater.id}
              cycleId={cycleId}
              raterLabel={rater.full_name ?? "This rater"}
            />
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Edit
          </button>
          {archived ? (
            <button
              type="button"
              onClick={handleUnarchive}
              disabled={isPending}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {isPending ? "Restoring…" : "Unarchive"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {isPending ? "Working…" : likelyHasData ? "Archive" : "Delete"}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {info && <p className="mt-1 text-xs text-zinc-500">{info}</p>}
      </td>
    </tr>
  );
}

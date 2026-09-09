import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRaterLink } from "@/lib/app-url";
import {
  LEADER_LEVEL_LABELS,
  RATER_GROUPS,
  RATER_GROUP_LABELS,
  type LeaderLevel,
  type Rater,
  type RaterGroup,
} from "@/lib/types";
import { AddRaterForm } from "./add-rater-form";
import { RaterTableRow } from "./rater-table-row";
import { LinkExpiryEditor } from "./link-expiry-editor";
import { CycleStatusControl } from "./cycle-status-control";

// Explicit, since Supabase-js calls aren't native fetch() and Next's static
// analysis can't otherwise tell this page depends on live data.
export const dynamic = "force-dynamic";

const COMPETENCY_9_LABELS: Record<string, string> = {
  standard: "Standard (Teaching, learning and standards)",
  ops: "Ops variant (Operational standards and service quality)",
};

const SENDER_SIGNOFF = "Krasi Toneva, Coach My Future";

function formatInviteDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMailto(
  rater: Rater,
  leaderName: string,
  organisationName: string,
  link: string,
  periodStart: string,
  periodEnd: string,
) {
  if (!rater.email) return null;
  const firstName = (rater.full_name ?? "").trim().split(/\s+/)[0] || "there";
  const closeDate = formatInviteDate(periodEnd);
  const subject = `360 Degree feedback for ${leaderName} - complete by ${closeDate}`;
  const body = [
    `Hi ${firstName},`,
    "",
    `Welcome to ${organisationName} 360 feedback.`,
    "",
    `${leaderName} has asked for honest feedback as part of their leadership journey, and your view is one of the ones that matters most here.`,
    "",
    `This is entirely for their development and for the ${organisationName} SLT development.`,
    "",
    `Your individual answers are never shown to ${leaderName}. Results are reported as group figures, and only once at least 3 people in your group have responded.`,
    "",
    `Your questionnaire is open from ${formatInviteDate(periodStart)} to ${closeDate}: ${link}`,
    "",
    `It takes most people around 15-30 minutes. Thank you for giving ${leaderName} the honest version rather than the easy one, it is worth more than either of you might expect.`,
    "",
    "Many thanks in advance",
    SENDER_SIGNOFF,
  ].join("\n");
  return `mailto:${rater.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("review_cycles")
    .select(
      "id, name, period_start, period_end, status, competency_9_variant, link_expiry_days, level, organisations(name), review_subjects(full_name, role_title)",
    )
    .eq("id", id)
    .maybeSingle();

  if (cycleError) {
    throw new Error(cycleError.message);
  }
  if (!cycle) {
    notFound();
  }

  const subject = Array.isArray(cycle.review_subjects)
    ? cycle.review_subjects[0]
    : cycle.review_subjects;
  const organisation = Array.isArray(cycle.organisations)
    ? cycle.organisations[0]
    : cycle.organisations;

  const { data: raters, error: ratersError } = await supabase
    .from("raters")
    .select("*")
    .eq("review_cycle_id", id)
    .order("rater_group", { ascending: true })
    .order("invited_at", { ascending: true });

  if (ratersError) {
    throw new Error(ratersError.message);
  }

  const ratersByGroup = new Map<RaterGroup, Rater[]>();
  for (const group of RATER_GROUPS) ratersByGroup.set(group, []);
  for (const rater of raters ?? []) {
    // Archived raters are excluded from completion counts, same as they are
    // from every report -- they're still listed in the table below so the
    // admin can review or undo the archive.
    if ((rater as Rater).archived_at) continue;
    ratersByGroup.get(rater.rater_group as RaterGroup)?.push(rater as Rater);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to review cycles
      </Link>

      <div className="mt-2 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {subject?.full_name ?? "Unknown leader"}
          </h1>
          <p className="text-sm text-zinc-500">
            {subject?.role_title ? `${subject.role_title} · ` : ""}
            {cycle.name} &middot; {cycle.period_start} to {cycle.period_end}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {organisation?.name ?? "No organisation set"}
            {cycle.level ? ` · ${LEADER_LEVEL_LABELS[cycle.level as LeaderLevel]}` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Competency 9: {COMPETENCY_9_LABELS[cycle.competency_9_variant]}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <LinkExpiryEditor cycleId={id} initialDays={cycle.link_expiry_days} />
          </div>
          <div className="mt-2">
            <CycleStatusControl cycleId={id} status={cycle.status} />
          </div>
        </div>
        <Link
          href={`/admin/cycles/${id}/report`}
          className="shrink-0 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          View report
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {RATER_GROUPS.map((group) => {
          const groupRaters = ratersByGroup.get(group) ?? [];
          const completed = groupRaters.filter((r) => r.completed_at).length;
          const notStarted = groupRaters.filter((r) => !r.started_at).length;
          return (
            <div key={group} className="rounded-lg border border-zinc-200 bg-white p-3">
              <p className="text-xs font-medium text-zinc-500">{RATER_GROUP_LABELS[group]}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {completed}/{groupRaters.length}
              </p>
              <p className="text-xs text-zinc-500">completed</p>
              {groupRaters.length > 0 && (
                <p className="mt-1 text-xs text-zinc-400">{notStarted} not started</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Add a rater</h2>
        <AddRaterForm cycleId={id} />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Group</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(raters ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No raters invited yet.
                </td>
              </tr>
            )}
            {(raters as Rater[] | null)?.map((rater) => {
              const link = getRaterLink(rater.token);
              const mailto = buildMailto(
                rater,
                subject?.full_name ?? "the leader",
                organisation?.name ?? "the organisation",
                link,
                cycle.period_start,
                cycle.period_end,
              );
              return (
                <RaterTableRow key={rater.id} rater={rater} cycleId={id} link={link} mailto={mailto} />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { buildTeamReportData } from "@/lib/report/build-team-report-data";
import { LEADER_LEVELS, LEADER_LEVEL_LABELS, type LeaderLevel } from "@/lib/types";
import { TeamReportView } from "./team-report-view";
import { PrintButton } from "../../../cycles/[id]/report/print-button";

export const dynamic = "force-dynamic";

function isLeaderLevel(value: string): value is LeaderLevel {
  return (LEADER_LEVELS as string[]).includes(value);
}

export default async function TeamReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { id } = await params;
  const { level: levelParam } = await searchParams;
  const level = levelParam && isLeaderLevel(levelParam) ? levelParam : null;

  if (!level) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/admin/organisations" className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to organisations
        </Link>
        <h1 className="mt-2 mb-2 text-2xl font-semibold text-zinc-900">Team summary report</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Choose the level this team report is for. Unlike the competency overview, this report
          always needs a specific level.
        </p>
        <div className="flex flex-wrap gap-2">
          {LEADER_LEVELS.map((l) => (
            <Link
              key={l}
              href={`/admin/organisations/${id}/team-report?level=${l}`}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {LEADER_LEVEL_LABELS[l]}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const data = await buildTeamReportData(id, level);
  if (!data) notFound();

  return (
    <div className="print:m-0">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 print:hidden">
        <Link href={`/admin/organisations/${id}/team-report`} className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Choose a different level
        </Link>
        {data.leaders.length > 0 && <PrintButton />}
      </div>

      {data.leaders.length === 0 ? (
        <p className="mx-auto max-w-4xl px-6 text-sm text-zinc-500">
          No completed cycles yet for {data.levelLabel} at {data.organisationName}. A cycle only
          counts once it&apos;s been marked complete from its own page.
        </p>
      ) : (
        <TeamReportView data={data} organisationId={id} level={level} />
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { buildOrgReportData } from "@/lib/report/build-org-report-data";
import { LEADER_LEVELS, LEADER_LEVEL_LABELS, type LeaderLevel } from "@/lib/types";
import { OrgReportView } from "./org-report-view";

export const dynamic = "force-dynamic";

function isLeaderLevel(value: string): value is LeaderLevel {
  return (LEADER_LEVELS as string[]).includes(value);
}

export default async function OrgReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { id } = await params;
  const { level: levelParam } = await searchParams;
  const level = levelParam && isLeaderLevel(levelParam) ? levelParam : null;

  const data = await buildOrgReportData(id, level);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/organisations" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to organisations
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{data.organisationName}</h1>
          <p className="mt-1 text-sm text-zinc-500">Organisation-wide competency overview</p>
        </div>
        <Link
          href={`/admin/organisations/${id}/team-report${level ? `?level=${level}` : ""}`}
          className="shrink-0 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Team summary report
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/organisations/${id}/report`}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            level === null ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          All levels
        </Link>
        {LEADER_LEVELS.map((l) => (
          <Link
            key={l}
            href={`/admin/organisations/${id}/report?level=${l}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              level === l ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {LEADER_LEVEL_LABELS[l]}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        {data.leaderCount} completed cycle{data.leaderCount === 1 ? "" : "s"} in scope
        {level ? ` at ${LEADER_LEVEL_LABELS[level]}` : ""}.
      </p>

      <OrgReportView data={data} />
    </div>
  );
}

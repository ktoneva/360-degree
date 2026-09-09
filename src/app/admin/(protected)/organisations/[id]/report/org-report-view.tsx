import { round1 } from "@/lib/scoring";
import type { OrgReportData } from "@/lib/report/build-org-report-data";

function Bar({ label, value, max = 5 }: { label: string; value: number | null; max?: number }) {
  const pct = value === null ? 0 : (value / max) * 100;
  return (
    <div className="mb-2 flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-zinc-600">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-100">
        {value !== null && <div className="h-full rounded bg-zinc-700" style={{ width: `${pct}%` }} />}
      </div>
      <span className="w-10 shrink-0 text-right font-medium text-zinc-900">
        {value === null ? "—" : round1(value)}
      </span>
    </div>
  );
}

function rowLabel(
  row: OrgReportData["rows"][number],
  competencyNames: Record<number, string>,
  competency9VariantNames: Partial<Record<"standard" | "ops", string>>,
): string {
  if (row.competencyNumber !== 9) {
    return `${row.competencyNumber}. ${competencyNames[row.competencyNumber] ?? ""}`;
  }
  const variantName = row.competency9Variant ? competency9VariantNames[row.competency9Variant] : undefined;
  const suffix = row.competency9Variant === "ops" ? "Operations" : "Teaching";
  return `9. ${variantName ?? ""} (${suffix})`;
}

export function OrgReportView({ data }: { data: OrgReportData }) {
  if (data.leaderCount === 0) {
    return (
      <p className="mt-8 rounded-md bg-zinc-50 p-4 text-sm text-zinc-600">
        No completed cycles match this filter yet. A cycle only counts once it&apos;s been marked
        complete from its own page — an open cycle&apos;s numbers could still change.
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <p className="text-sm text-zinc-700">
        Figures for a competency are only broken out by leader once at least 3 leaders are in
        scope for it. Below that, one combined figure is shown instead — never attributed to a
        specific leader. This applies independently to each competency-9 row, since a level can
        have plenty of leaders overall but few on a particular variant.
      </p>

      {data.rows.map((row) => {
        const label = rowLabel(row, data.competencyNames, data.competency9VariantNames);
        return (
          <div key={`${row.competencyNumber}-${row.competency9Variant ?? "std"}`}>
            <p className="mb-2 text-sm font-medium text-zinc-900">{label}</p>

            {row.mode === "insufficient" && (
              <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
                Insufficient data ({row.leaderCount} leader{row.leaderCount === 1 ? "" : "s"} in
                scope).
              </p>
            )}

            {row.mode === "merged" && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                Combined figure: <strong>{round1(row.pooledMean)}</strong> (
                {row.leaderCount} leader{row.leaderCount === 1 ? "" : "s"} pooled,{" "}
                {row.respondentCount} respondent{row.respondentCount === 1 ? "" : "s"}). Too few
                leaders to break out individually without identifying them.
              </p>
            )}

            {row.mode === "separate" && (
              <>
                <Bar label="Self" value={row.self.mean} />
                <Bar label="All others" value={row.allOthers.mean} />
                <Bar label="Manager" value={row.manager.mean} />
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="border-b border-zinc-200 uppercase text-zinc-500">
                      <tr>
                        <th className="py-1.5 pr-3 font-medium">Leader</th>
                        <th className="py-1.5 pr-3 font-medium">Self</th>
                        <th className="py-1.5 pr-3 font-medium">All others</th>
                        <th className="py-1.5 font-medium">Manager</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700">
                      {row.perLeader.map((leader) => (
                        <tr key={leader.leaderId}>
                          <td className="py-1.5 pr-3">{leader.leaderName}</td>
                          <td className="py-1.5 pr-3">{leader.self === null ? "—" : round1(leader.self)}</td>
                          <td className="py-1.5 pr-3">
                            {leader.allOthers === null ? "—" : round1(leader.allOthers)}
                          </td>
                          <td className="py-1.5">
                            {leader.manager === null ? "—" : round1(leader.manager)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

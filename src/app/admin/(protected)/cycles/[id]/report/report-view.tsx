import { RATER_GROUPS, RATER_GROUP_LABELS, type RaterGroup } from "@/lib/types";
import { SAFEGUARDING_WORDING } from "@/lib/respond/briefing";
import type { ReportData } from "@/lib/report/types";
import { round1, type ComparisonCell, type ColleagueCell } from "@/lib/scoring";

const SCALE_LABELS = ["Almost never", "Rarely", "Sometimes", "Often", "Usually", "Almost always"];
const COMPETENCY_9_LABELS: Record<string, string> = {
  standard: "Standard (Teaching, learning and standards)",
  ops: "Ops variant (Operational standards and service quality)",
};

function Section({
  title,
  children,
  breakBefore = false,
}: {
  title: string;
  children: React.ReactNode;
  breakBefore?: boolean;
}) {
  return (
    <section className={`break-inside-avoid-page ${breakBefore ? "break-before-page" : ""} py-8`}>
      <h2 className="mb-4 text-xl font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function Bar({ label, value, max = 6 }: { label: string; value: number | null; max?: number }) {
  const pct = value === null ? 0 : (value / max) * 100;
  return (
    <div className="mb-2 flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 text-zinc-600">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-100">
        {value !== null && <div className="h-full rounded bg-zinc-700" style={{ width: `${pct}%` }} />}
      </div>
      <span className="w-10 shrink-0 text-right font-medium text-zinc-900">
        {value === null ? "—" : round1(value)}
      </span>
    </div>
  );
}

function CoverSection({ data }: { data: ReportData }) {
  return (
    <Section title="Cover and response rate">
      <p className="text-lg font-medium text-zinc-900">{data.leaderName}</p>
      {data.roleTitle && <p className="text-sm text-zinc-600">{data.roleTitle}</p>}
      <p className="mt-1 text-sm text-zinc-600">
        {data.cycleName} &middot; {data.periodStart} to {data.periodEnd}
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        Competency 9: {COMPETENCY_9_LABELS[data.competency9Variant]}
      </p>

      <p className="mt-4 text-sm text-zinc-700">
        Any figure drawn from fewer than 3 respondents in a group is combined with other small
        groups or withheld, rather than shown — this is the anonymity threshold used throughout
        this report.
      </p>

      <table className="mt-4 w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
          <tr>
            <th className="py-2 font-medium">Rater group</th>
            <th className="py-2 font-medium">Invited</th>
            <th className="py-2 font-medium">Responded</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {data.responseRates.map((row) => (
            <tr key={row.group}>
              <td className="py-2">{RATER_GROUP_LABELS[row.group]}</td>
              <td className="py-2">{row.invited}</td>
              <td className="py-2">{row.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function HowToReadSection() {
  return (
    <Section title="How to read this report">
      <div className="space-y-3 text-sm text-zinc-700">
        <p>
          Every item is rated on a 6-point frequency scale, with no midpoint:{" "}
          {SCALE_LABELS.map((l, i) => (
            <span key={l}>
              {i > 0 && ", "}
              <strong>{i + 1} = {l}</strong>
            </span>
          ))}
          .
        </p>
        <p>
          Raters could also choose <strong>&ldquo;Not able to comment&rdquo;</strong> on any item.
          Those responses are excluded from every mean shown in this report — they are never
          treated as a midpoint or counted as a 0.
        </p>
        <p>
          Any group&rsquo;s figure is only shown once at least <strong>3 people</strong> in that
          group have answered. Smaller groups are combined into a single &ldquo;all
          colleagues&rdquo; figure; if that combined figure is still under 3 people, it is marked
          &ldquo;insufficient responses&rdquo; rather than shown as a number.
        </p>
        <p>
          The <strong>manager</strong> is reported separately throughout, as a single identifiable
          rater (n=1) — by design, not subject to the anonymity threshold above.
        </p>
      </div>
    </Section>
  );
}

function CompetencyOverviewSection({ data }: { data: ReportData }) {
  return (
    <Section title="Competency overview" breakBefore>
      <p className="mb-4 text-sm text-zinc-600">
        Ordered highest to lowest by &ldquo;all others&rdquo;.
      </p>
      <div className="space-y-5">
        {data.competencyOverview.map((row) => (
          <div key={row.competencyNumber}>
            <p className="mb-1 text-sm font-medium text-zinc-900">
              {row.competencyNumber}. {row.competencyName}
            </p>
            <Bar label="Self" value={row.self} />
            <Bar label="All others" value={row.allOthers} />
            <Bar label="Manager" value={row.manager} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function comparisonCellText(cell: ComparisonCell): { text: string; flagged: boolean } {
  if (cell.status === "reported") return { text: `${cell.mean} (n=${cell.n})`, flagged: false };
  if (cell.status === "insufficient_responses") return { text: "Insufficient responses", flagged: true };
  return { text: "—", flagged: false };
}

function colleagueCellText(cell: ColleagueCell): { text: string; flagged: boolean } {
  if (cell.status === "reported") return { text: `${cell.mean} (n=${cell.n})`, flagged: false };
  if (cell.status === "merged") return { text: "Merged †", flagged: true };
  return { text: "—", flagged: false };
}

function RaterGroupComparisonSection({ data }: { data: ReportData }) {
  const anyFootnote = data.raterGroupComparison.some(
    (row) =>
      row.peer.status === "merged" ||
      row.directReport.status === "merged" ||
      row.other.status === "merged" ||
      row.allColleagues?.status === "insufficient_responses",
  );

  return (
    <Section title="Rater group comparison">
      <p className="mb-4 text-sm text-zinc-600">
        Competency order is fixed (1 to 9) — this page compares groups against each other, not
        against a score ranking.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Competency</th>
              <th className="py-2 pr-3 font-medium">Self</th>
              <th className="py-2 pr-3 font-medium">Manager</th>
              <th className="py-2 pr-3 font-medium">Peers</th>
              <th className="py-2 pr-3 font-medium">Direct reports</th>
              <th className="py-2 pr-3 font-medium">Others</th>
              <th className="py-2 font-medium">All colleagues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.raterGroupComparison.map((row) => {
              const self = comparisonCellText(row.self);
              const manager = comparisonCellText(row.manager);
              const peer = colleagueCellText(row.peer);
              const directReport = colleagueCellText(row.directReport);
              const other = colleagueCellText(row.other);
              const allColleagues = row.allColleagues ? comparisonCellText(row.allColleagues) : null;
              return (
                <tr key={row.competencyNumber}>
                  <td className="py-2 pr-3">
                    {row.competencyNumber}. {row.competencyName}
                  </td>
                  <td className="py-2 pr-3">{self.text}</td>
                  <td className="py-2 pr-3">{manager.text}</td>
                  <td className="py-2 pr-3">{peer.text}</td>
                  <td className="py-2 pr-3">{directReport.text}</td>
                  <td className="py-2 pr-3">{other.text}</td>
                  <td className="py-2">{allColleagues ? allColleagues.text : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {anyFootnote && (
        <p className="mt-3 text-xs text-zinc-500">
          &dagger; This group had fewer than 3 respondents for that competency and was combined
          into &ldquo;All colleagues&rdquo;.
        </p>
      )}
    </Section>
  );
}

function GapItemsSection({
  title,
  description,
  items,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: ReportData["blindSpots"];
  emptyMessage: string;
}) {
  return (
    <Section title={title}>
      <p className="mb-4 text-sm text-zinc-600">{description}</p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.itemId} className="rounded-lg border border-zinc-200 p-3">
              <p className="text-xs font-medium text-zinc-500">
                {item.competencyNumber}. {item.competencyName}
              </p>
              <p className="text-sm text-zinc-900">{item.behaviourText}</p>
              <p className="mt-1 text-sm text-zinc-600">
                Self {item.selfMean} &middot; All others {item.allOthersMean} &middot; Gap{" "}
                {item.gap}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function HighestLowestSection({ data }: { data: ReportData }) {
  const renderList = (rows: ReportData["highestLowestItems"]["highest"]) => (
    <ol className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.itemId} className="flex justify-between gap-4 border-b border-zinc-100 pb-2">
          <span>
            <span className="text-xs text-zinc-500">
              {row.competencyNumber}. {row.competencyName}
            </span>
            <br />
            {row.behaviourText}
          </span>
          <span className="shrink-0 font-medium text-zinc-900">{row.allOthersMean}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <Section title="Highest and lowest ten items" breakBefore>
      <p className="mb-4 text-sm text-zinc-600">All-others mean, across every scored item.</p>
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">Highest</h3>
          {renderList(data.highestLowestItems.highest)}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">Lowest</h3>
          {renderList(data.highestLowestItems.lowest)}
        </div>
      </div>
    </Section>
  );
}

function DevelopmentPrioritiesSection({ data }: { data: ReportData }) {
  return (
    <Section title="Development priorities (forced choice)">
      <p className="mb-4 text-sm text-zinc-600">
        Top 10 items by colleague nomination count, from the &ldquo;pick 3 to improve&rdquo;
        question. Self and manager are reference flags, not part of the ranking.
      </p>
      {data.developmentPriorities.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No development priorities were identified this cycle.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.developmentPriorities.map((item) => (
            <li key={item.itemId} className="rounded-lg border border-zinc-200 p-3">
              <p className="text-xs font-medium text-zinc-500">
                {item.competencyNumber}. {item.competencyName}
              </p>
              <p className="text-sm text-zinc-900">{item.behaviourText}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {item.breakdown.mode === "separate" &&
                  `Peers ${item.breakdown.peer} · Direct reports ${item.breakdown.directReport} · Others ${item.breakdown.other}`}
                {item.breakdown.mode === "partial_merge" &&
                  `${Object.entries(item.breakdown.separate)
                    .map(([g, n]) => `${RATER_GROUP_LABELS[g as RaterGroup]} ${n}`)
                    .join(" · ")}${
                    Object.keys(item.breakdown.separate).length > 0 ? " · " : ""
                  }All colleagues ${item.breakdown.allColleagues}`}
                {item.breakdown.mode === "merge_failed" &&
                  `${item.totalColleagueNominations} colleague nomination${item.totalColleagueNominations === 1 ? "" : "s"} (group under 3, not attributed)`}
                {" · "}
                Self {item.selfNominated ? "yes" : "no"} &middot; Manager{" "}
                {item.managerNominated ? "yes" : "no"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ItemAppendixSection({ data }: { data: ReportData }) {
  return (
    <Section title="Item-level appendix" breakBefore>
      <p className="mb-4 text-sm text-zinc-600">
        Every scored item, raw mean and n by rater group (no anonymity threshold applied on this
        page), and count of &ldquo;not able to comment&rdquo;.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Item</th>
              {RATER_GROUPS.map((g) => (
                <th key={g} className="py-2 pr-3 font-medium">
                  {RATER_GROUP_LABELS[g]}
                </th>
              ))}
              <th className="py-2 font-medium">N/A comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.itemAppendix.map((row) => (
              <tr key={row.itemId}>
                <td className="py-2 pr-3">
                  <span className="text-xs text-zinc-500">
                    {row.competencyNumber}.{row.itemNumber}
                  </span>{" "}
                  {row.behaviourText}
                </td>
                {RATER_GROUPS.map((g) => (
                  <td key={g} className="py-2 pr-3">
                    {row.groups[g].mean !== null
                      ? `${round1(row.groups[g].mean!)} (n=${row.groups[g].n})`
                      : "—"}
                  </td>
                ))}
                <td className="py-2">{row.notAbleToCommentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

const COMMENT_FIELDS: { key: "continueText" | "startText" | "stopText"; label: string }[] = [
  { key: "continueText", label: "Continue" },
  { key: "startText", label: "Start" },
  { key: "stopText", label: "Stop" },
];

function CommentsSection({ data }: { data: ReportData }) {
  return (
    <Section title="Written comments" breakBefore>
      <p className="mb-4 text-sm text-zinc-700">
        Verbatim, grouped as continue / start / stop, tagged only by rater group. Review before
        distributing: remove names and unique identifying detail, without rewriting tone.
      </p>
      <div className="space-y-6">
        {COMMENT_FIELDS.map(({ key, label }) => {
          const entries = data.comments.filter((c) => c[key]);
          return (
            <div key={key}>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">{label}</h3>
              {entries.length === 0 ? (
                <p className="text-sm text-zinc-500">No comments.</p>
              ) : (
                <ul className="space-y-2">
                  {entries.map((c) => (
                    <li key={c.raterId} className="rounded-md border border-zinc-200 p-3 text-sm">
                      <p className="mb-1 text-xs font-medium text-zinc-500">
                        {RATER_GROUP_LABELS[c.group]}
                      </p>
                      <p className="whitespace-pre-line text-zinc-800">{c[key]}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function SafeguardingSection({ data }: { data: ReportData }) {
  return (
    <Section title="Safeguarding integrity check" breakBefore>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="whitespace-pre-line">{SAFEGUARDING_WORDING}</p>
      </div>
      <p className="mb-3 text-sm text-zinc-600">
        Reported as counts only. No mean, no benchmark, no trend line.
      </p>
      <div className="space-y-3">
        {data.safeguarding.map((item) => (
          <div key={item.itemId} className="rounded-lg border border-zinc-200 p-3 text-sm">
            <p className="text-zinc-900">{item.behaviourText}</p>
            <p className="mt-1 text-zinc-600">
              Yes: {item.yes} &middot; No: {item.no} &middot; Not observed: {item.notObserved}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DevelopmentPlanSection() {
  return (
    <Section title="Development plan" breakBefore>
      <p className="mb-4 text-sm text-zinc-600">
        Completed by the consultant during the debrief — not generated from the data above.
      </p>
      <div className="space-y-4 text-sm text-zinc-500">
        <p className="border-b border-dashed border-zinc-300 pb-8">
          Two strengths to deploy more deliberately
        </p>
        <p className="border-b border-dashed border-zinc-300 pb-8">
          Two priorities from the development priorities section
        </p>
        <p className="border-b border-dashed border-zinc-300 pb-8">
          Specific actions, with dates
        </p>
        <p className="border-b border-dashed border-zinc-300 pb-8">
          One named person who will tell them the truth about progress
        </p>
        <p className="border-b border-dashed border-zinc-300 pb-8">Review date</p>
      </div>
    </Section>
  );
}

export function ReportView({ data }: { data: ReportData }) {
  return (
    <div className="divide-y divide-zinc-200">
      <CoverSection data={data} />
      <HowToReadSection />
      <CompetencyOverviewSection data={data} />
      <RaterGroupComparisonSection data={data} />
      <GapItemsSection
        title="Blind spots"
        description="Items where self exceeds the all-others mean by 1.0 or more. Capped at 8."
        items={data.blindSpots}
        emptyMessage="No blind spots were identified this cycle."
      />
      <GapItemsSection
        title="Hidden strengths"
        description="Items where the all-others mean exceeds self by 1.0 or more. Always shown in full."
        items={data.hiddenStrengths}
        emptyMessage="No hidden strengths were identified this cycle."
      />
      <HighestLowestSection data={data} />
      <DevelopmentPrioritiesSection data={data} />
      <ItemAppendixSection data={data} />
      <CommentsSection data={data} />
      <SafeguardingSection data={data} />
      <DevelopmentPlanSection />
    </div>
  );
}

import type { TeamReportData } from "@/lib/report/build-team-report-data";
import type { LeaderLevel } from "@/lib/types";
import { TeamNoteEditor } from "./team-note-editor";

const TOTAL_PAGES = 13;
const HIGH_THRESHOLD = 4.25;
const LOW_THRESHOLD = 2.25;

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function PageNumber({ n }: { n: number }) {
  return (
    <div className="pageno">
      Page {n} of {TOTAL_PAGES}
    </div>
  );
}

function ScoreCell({ value }: { value: number | null }) {
  if (value === null) return <>-</>;
  if (value >= HIGH_THRESHOLD) return <span className="score high">{value}</span>;
  if (value <= LOW_THRESHOLD) return <span className="score low">{value}</span>;
  return <>{value}</>;
}

const TEAM_REPORT_STYLES = `
.team-report-root { --navy:#1E2530; --navy-light:#2A3340; --gold:#C39A3E; --gold-dark:#B8872B; --gold-light:#E8CE60; --ink:#1E2530; --muted:#6B7280; --line:#E5E7EB; --paper:#FFFFFF; --canvas:#E8E6E0; --amber:#B5541E; --strength-bg:#FBF4E4; --gap-bg:#FBEFE4; }
.team-report-root * { box-sizing: border-box; }
.team-report-root { background: var(--canvas); font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: var(--ink); padding: 32px 0 80px; }
.team-report-root .page { width: 780px; max-width: 94vw; margin: 0 auto 24px; background: var(--paper); box-shadow: 0 6px 24px rgba(0,0,0,0.14); border-radius: 4px; overflow: hidden; }
.team-report-root .cover { background: var(--navy); color: #fff; padding: 72px 56px 56px; min-height: 480px; display: flex; flex-direction: column; justify-content: space-between; }
.team-report-root .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
.team-report-root .brand-mark { font-size: 12px; letter-spacing: 0.14em; color: var(--gold-light); font-weight: 600; }
.team-report-root .report-tag { font-size: 11px; letter-spacing: 0.1em; color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.25); padding: 5px 10px; border-radius: 3px; }
.team-report-root .cover-mid { margin-top: 90px; }
.team-report-root .cover-eyebrow { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 14px; }
.team-report-root .cover-name { font-size: 40px; line-height: 1.15; font-weight: 600; background: linear-gradient(120deg, var(--gold-dark), var(--gold-light)); -webkit-background-clip: text; background-clip: text; color: transparent; margin: 0 0 18px; }
.team-report-root .cover-role { font-size: 16px; color: rgba(255,255,255,0.75); }
.team-report-root .cover-bottom { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 18px; }
.team-report-root .cover-meta { font-size: 12px; color: rgba(255,255,255,0.55); }
.team-report-root .cover-meta strong { display: block; color: #fff; font-size: 13px; font-weight: 500; margin-top: 2px; }
.team-report-root .inner { padding: 36px 44px 44px; }
.team-report-root .inner h2 { font-size: 19px; margin: 0 0 4px; color: var(--navy); }
.team-report-root .inner .sub { font-size: 12.5px; color: var(--muted); margin: 0 0 18px; }
.team-report-root table.comp-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.team-report-root table.comp-table th { background: var(--navy); color: #fff; font-weight: 500; text-align: center; padding: 6px 4px; font-size: 10.5px; }
.team-report-root table.comp-table th:first-child, .team-report-root table.comp-table td:first-child { text-align: left; padding-left: 8px; }
.team-report-root table.comp-table td { padding: 7px 4px; text-align: center; border-bottom: 1px solid var(--line); vertical-align: middle; }
.team-report-root table.comp-table td.item-label { text-align: left; max-width: 175px; line-height: 1.3; font-size: 10.5px; }
.team-report-root .score { display: inline-block; min-width: 18px; }
.team-report-root .score.high { border-radius: 50%; background: var(--gold); color: #fff; width: 20px; height: 20px; line-height: 20px; font-weight: 600; font-size: 11px; }
.team-report-root .score.low { border-radius: 50%; border: 2px solid var(--amber); color: var(--amber); width: 18px; height: 18px; line-height: 14px; font-weight: 600; font-size: 10px; }
.team-report-root .legend { display: flex; gap: 16px; font-size: 10.5px; color: var(--muted); margin-top: 14px; flex-wrap: wrap; }
.team-report-root .legend span { display: inline-flex; align-items: center; gap: 6px; }
.team-report-root .callout { padding: 11px 14px; font-size: 12px; line-height: 1.5; margin-bottom: 8px; border-left: 3px solid; }
.team-report-root .callout.strength { background: var(--strength-bg); border-color: var(--gold-dark); }
.team-report-root .callout.gap { background: var(--gap-bg); border-color: var(--amber); }
.team-report-root .callout.prompt { background: #F3F4F6; border-left: 3px dashed var(--muted); color: var(--muted); font-style: italic; }
.team-report-root .insights-head { margin-top: 16px; font-size: 12px; font-weight: 600; color: var(--navy); }
.team-report-root .team-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
.team-report-root .team-card { border: 1px solid var(--line); border-radius: 6px; padding: 16px 18px; }
.team-report-root .team-card h3 { font-size: 13px; margin: 0 0 10px; padding-bottom: 8px; border-bottom: 2px solid var(--gold); color: var(--navy); }
.team-report-root .team-card ul { margin: 0; padding: 0; list-style: none; }
.team-report-root .team-card li { font-size: 12.5px; padding: 7px 0; border-bottom: 1px solid var(--line); line-height: 1.4; }
.team-report-root .team-card li:last-child { border-bottom: none; }
.team-report-root .team-card li .who { font-weight: 600; display: block; }
.team-report-root .team-card li .what { color: var(--muted); }
.team-report-root .plan-section { font-weight: 600; font-size: 12.5px; color: var(--navy); border-bottom: 2px solid var(--gold); padding-bottom: 6px; margin-bottom: 8px; margin-top: 20px; }
.team-report-root .plan-hint { font-size: 11.5px; color: var(--muted); margin: 0 0 6px; }
.team-report-root .plan-box { height: 42px; border: 1px dashed var(--line); border-radius: 4px; }
.team-report-root .pageno { text-align: right; font-size: 10.5px; color: var(--muted); padding: 8px 24px 14px; }

@media print {
  body { background: #fff !important; }
  .team-report-root { background: #fff; padding: 0; }
  .team-report-root .page { box-shadow: none; border-radius: 0; width: auto; max-width: none; margin: 0; page-break-after: always; }
  .team-report-root .page:last-child { page-break-after: auto; }
  .team-report-root .cover { min-height: 100vh; }
}
`;

function NoteCard({
  title,
  card,
  entries,
  organisationId,
  level,
}: {
  title: string;
  card: "strengths" | "gaps" | "stretch" | "development";
  entries: { who: string; what: string }[];
  organisationId: string;
  level: LeaderLevel;
}) {
  return (
    <div className="team-card">
      <h3>{title}</h3>
      <ul>
        {[0, 1].map((i) => (
          <TeamNoteEditor
            key={i}
            organisationId={organisationId}
            level={level}
            card={card}
            position={(i + 1) as 1 | 2}
            initialWho={entries[i]?.who ?? ""}
            initialWhat={entries[i]?.what ?? ""}
          />
        ))}
      </ul>
    </div>
  );
}

export function TeamReportView({
  data,
  organisationId,
  level,
}: {
  data: TeamReportData;
  organisationId: string;
  level: LeaderLevel;
}) {
  let pageNum = 4;

  return (
    <div className="team-report-root">
      <style dangerouslySetInnerHTML={{ __html: TEAM_REPORT_STYLES }} />

      {/* Page 1: cover */}
      <div className="page">
        <div className="cover">
          <div className="cover-top">
            <div className="brand-mark">COACH MY FUTURE</div>
            <div className="report-tag">CONFIDENTIAL</div>
          </div>
          <div className="cover-mid">
            <div className="cover-eyebrow">Team summary report</div>
            <div className="cover-name">{data.organisationName}</div>
            <div className="cover-role">
              {data.levelLabel} &middot; {data.leaders.length} leader{data.leaders.length === 1 ? "" : "s"} reviewed
            </div>
          </div>
          <div className="cover-bottom">
            <div className="cover-meta">
              Review window
              <strong>
                {data.periodStart && data.periodEnd ? `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}` : "-"}
              </strong>
            </div>
            <div className="cover-meta">
              Prepared for
              <strong>Headteacher, {data.organisationName}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Page 2: how to read this report */}
      <div className="page">
        <div className="inner">
          <h2>How to read this report</h2>
          <p className="sub">A short guide before the detail.</p>
          <p style={{ fontSize: 13, lineHeight: 1.65 }}>
            Every item is rated on a 5-point scale: almost never, rarely, sometimes, usually, almost
            always, plus &ldquo;not able to comment,&rdquo; which is excluded from every average rather
            than treated as a neutral score.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.65 }}>
            Each competency page is a matrix: one row per item, one column per leader, using the
            team-wide (all others, excluding self) score for that leader on that item.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.65 }}>
            A score of 4.25 or above is marked with a filled gold circle, a genuine team-wide
            strength. A score of 2.25 or below is marked with an outlined amber circle. Nothing in
            between is marked, colour is used sparingly so it means something when it appears, most
            scores will sit unmarked in the middle of the scale, and that&apos;s expected.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.65 }}>
            Below each matrix, 2 key insights are called out directly: a strength worth leaning on,
            and the single largest gap between a leader&apos;s self-rating and their team&apos;s
            rating anywhere in that competency. Where a competency doesn&apos;t produce a genuine
            strength or gap against these thresholds, a reflection question appears in its place
            instead of a data finding.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.65 }}>
            Any group with fewer than 3 respondents on a given item is combined with another group to
            protect anonymity, or, if still fewer than 3, left out of that figure entirely rather than
            shown as a number.
          </p>
        </div>
        <PageNumber n={2} />
      </div>

      {/* Page 3: the whole team, at a glance -- editable */}
      <div className="page">
        <div className="inner">
          <h2>The whole team, at a glance</h2>
          <p className="sub">
            Aggregated across all senior leaders. Named where it&apos;s a straightforward strength,
            grouped where naming could read as singling someone out.
          </p>
          <div className="team-grid">
            <NoteCard title="Team strengths" card="strengths" entries={data.notes.strengths} organisationId={organisationId} level={level} />
            <NoteCard title="Team gaps" card="gaps" entries={data.notes.gaps} organisationId={organisationId} level={level} />
            <NoteCard title="Stretch points" card="stretch" entries={data.notes.stretch} organisationId={organisationId} level={level} />
            <NoteCard title="Development points" card="development" entries={data.notes.development} organisationId={organisationId} level={level} />
          </div>
        </div>
        <PageNumber n={3} />
      </div>

      {/* Pages 4-12: one matrix per competency */}
      {data.matrices.map((matrix) => {
        const n = pageNum++;
        return (
          <div className="page" key={matrix.competencyNumber}>
            <div className="inner">
              <h2>{matrix.competencyName}</h2>
              <p className="sub">
                Team-wide score per item, all others (excluding self), across the {data.leaders.length}{" "}
                leader{data.leaders.length === 1 ? "" : "s"} in this review.
              </p>
              <table className="comp-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Item</th>
                    {data.leaders.map((l) => (
                      <th key={l.leaderId}>{l.initials}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.items.map((row) => (
                    <tr key={row.itemId}>
                      <td className="item-label">{row.behaviourText}</td>
                      {data.leaders.map((l) => {
                        const cell = row.cells.find((c) => c.leaderId === l.leaderId);
                        return (
                          <td key={l.leaderId}>
                            <ScoreCell value={cell?.allOthers ?? null} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="legend">
                <span>
                  <span className="score high" style={{ width: 14, height: 14, lineHeight: "14px", fontSize: 8 }}>
                    &nbsp;
                  </span>{" "}
                  4.25 and above, team-wide strength
                </span>
                <span>
                  <span className="score low" style={{ width: 12, height: 12, lineHeight: "8px", fontSize: 8 }}>
                    &nbsp;
                  </span>{" "}
                  2.25 and below
                </span>
              </div>
              <div className="insights-head">Key insights</div>
              <div style={{ marginTop: 8 }}>
                {matrix.strength ? (
                  <div className="callout strength">
                    <strong>Strength to lean on:</strong> {matrix.strength.leaderName} rates{" "}
                    {matrix.strength.score} on &ldquo;{matrix.strength.behaviourText}&rdquo;, worth
                    pairing with a leader scoring lower on the same item.
                  </div>
                ) : (
                  <div className="callout prompt">
                    What 3 steps or actions can move the team closer to a 5 in this competency?
                  </div>
                )}
                {matrix.gap ? (
                  <div className="callout gap">
                    <strong>Gap to close:</strong> {matrix.gap.leaderName} rates themselves{" "}
                    {matrix.gap.selfScore} on &ldquo;{matrix.gap.behaviourText}&rdquo;, their team rates
                    them {matrix.gap.othersScore}, the largest self-versus-others gap in this
                    competency this cycle.
                  </div>
                ) : (
                  <div className="callout prompt">
                    Where would you like your leaders to sit within this competency? What would a 3
                    look like? Or a 4? And finally, a 5?
                  </div>
                )}
              </div>
            </div>
            <PageNumber n={n} />
          </div>
        );
      })}

      {/* Page 13: recommendations */}
      <div className="page">
        <div className="inner">
          <h2>Recommendations</h2>
          <div className="plan-section">Quick wins</div>
          <p className="plan-hint">A specific action, low effort, visible fast. Who owns it, by when.</p>
          <div className="plan-box" style={{ marginBottom: 16 }} />
          <div className="plan-section">Mid-term priorities</div>
          <p className="plan-hint">Needs real time or a shared session, not a single conversation. Who owns it, by when.</p>
          <div className="plan-box" style={{ marginBottom: 16 }} />
          <div className="plan-section">Longer-term work</div>
          <p className="plan-hint">Structural or cultural, unlikely to move without sustained attention. Who owns it, review date.</p>
          <div className="plan-box" />
        </div>
        <PageNumber n={13} />
      </div>
    </div>
  );
}

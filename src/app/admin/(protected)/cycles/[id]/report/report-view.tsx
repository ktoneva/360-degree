import type { IndividualReportData } from "@/lib/report/build-individual-report-data";
import type { ColleagueCell, ComparisonCell } from "@/lib/scoring";

const TOTAL_PAGES = 17;
const HIGH_THRESHOLD = 4.25;
const LOW_THRESHOLD = 2.25;
const SCALE_MAX = 5;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function PageNumber({ n }: { n: number }) {
  return (
    <div className="pageno">
      Page {n} of {TOTAL_PAGES}
    </div>
  );
}

/** Self and "All others" are the only two cells ever circle-marked (filled
 * gold >=4.25, outlined amber <=2.25) -- individual rater-group columns
 * (manager, peer, direct reports, others) always show plain numbers, even
 * when they themselves cross a threshold, per the approved sample. */
function ScoreCell({ cell, canMark }: { cell: ComparisonCell; canMark: boolean }) {
  if (cell.status !== "reported") return <>&mdash;</>;
  if (canMark) {
    if (cell.mean >= HIGH_THRESHOLD) return <span className="score high">{cell.mean}</span>;
    if (cell.mean <= LOW_THRESHOLD) return <span className="score low">{cell.mean}</span>;
  }
  return <>{cell.mean}</>;
}

function ColleagueTd({ cell }: { cell: ColleagueCell }) {
  if (cell.status === "reported") return <>{cell.mean}</>;
  if (cell.status === "merged") return <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Merged</span>;
  return <>&mdash;</>;
}

function RangeBar({ range }: { range: { low: number; high: number; average: number } | null }) {
  if (!range) return null;
  const left = (range.low / SCALE_MAX) * 100;
  const width = ((range.high - range.low) / SCALE_MAX) * 100;
  const tick = (range.average / SCALE_MAX) * 100;
  return (
    <div className="range-bar">
      <div className="range-fill" style={{ left: `${left}%`, width: `${width}%` }} />
      <div className="range-tick" style={{ left: `${tick}%` }} />
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span>
        <span className="score high" style={{ width: 15, height: 15, lineHeight: "15px", fontSize: 9 }}>
          &nbsp;
        </span>{" "}
        4.25 and above
      </span>
      <span>
        <span className="score low" style={{ width: 13, height: 13, lineHeight: "9px", fontSize: 9 }}>
          &nbsp;
        </span>{" "}
        2.25 and below
      </span>
      <span>
        <span style={{ width: 20, height: 5, background: "#C9C2B4", display: "inline-block", borderRadius: 3 }} />{" "}
        colleague range, tick = average
      </span>
    </div>
  );
}

const REPORT_STYLES = `
.report-root { --navy:#1E2530; --navy-light:#2A3340; --gold:#C39A3E; --gold-dark:#B8872B; --gold-light:#E8CE60; --ink:#1E2530; --muted:#6B7280; --line:#E5E7EB; --paper:#FFFFFF; --canvas:#E8E6E0; --amber:#B5541E; --strength-bg:#FBF4E4; --gap-bg:#FBEFE4; }
.report-root * { box-sizing: border-box; }
.report-root { background: var(--canvas); font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: var(--ink); padding: 32px 0 80px; }
.report-root .page { width: 780px; max-width: 94vw; margin: 0 auto 24px; background: var(--paper); box-shadow: 0 6px 24px rgba(0,0,0,0.14); border-radius: 4px; overflow: hidden; }
.report-root .cover { background: var(--navy); color: #fff; padding: 72px 56px 56px; min-height: 480px; display: flex; flex-direction: column; justify-content: space-between; }
.report-root .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
.report-root .brand-mark { font-size: 12px; letter-spacing: 0.14em; color: var(--gold-light); font-weight: 600; }
.report-root .report-tag { font-size: 11px; letter-spacing: 0.1em; color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.25); padding: 5px 10px; border-radius: 3px; }
.report-root .cover-mid { margin-top: 90px; }
.report-root .cover-eyebrow { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 14px; }
.report-root .cover-name { font-size: 44px; line-height: 1.1; font-weight: 600; background: linear-gradient(120deg, var(--gold-dark), var(--gold-light)); -webkit-background-clip: text; background-clip: text; color: transparent; margin: 0 0 18px; }
.report-root .cover-role { font-size: 16px; color: rgba(255,255,255,0.75); }
.report-root .cover-bottom { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 18px; }
.report-root .cover-meta { font-size: 12px; color: rgba(255,255,255,0.55); }
.report-root .cover-meta strong { display: block; color: #fff; font-size: 13px; font-weight: 500; margin-top: 2px; }
.report-root .inner { padding: 36px 44px 44px; }
.report-root .inner h2 { font-size: 19px; margin: 0 0 4px; color: var(--navy); }
.report-root .inner .sub { font-size: 12.5px; color: var(--muted); margin: 0 0 18px; }
.report-root .pageno { text-align: right; font-size: 10.5px; color: var(--muted); padding: 8px 24px 14px; }
.report-root .rank-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.report-root .rank-num { width: 18px; font-weight: 600; color: var(--muted); font-size: 12px; }
.report-root .rank-content { flex: 1; min-width: 0; }
.report-root .rank-text { font-size: 12.5px; margin-bottom: 5px; line-height: 1.3; }
.report-root .rank-bar-track { height: 10px; background: var(--line); border-radius: 5px; overflow: hidden; }
.report-root .rank-bar-fill { height: 100%; border-radius: 5px; }
.report-root .rank-bar-fill.hi { background: linear-gradient(90deg, var(--gold-dark), var(--gold-light)); }
.report-root .rank-bar-fill.lo { background: var(--amber); }
.report-root .rank-score { width: 32px; text-align: right; font-weight: 600; font-size: 13px; }
.report-root table.comp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.report-root table.comp-table th { background: var(--navy); color: #fff; font-weight: 500; text-align: center; padding: 7px 5px; font-size: 11px; }
.report-root table.comp-table th:first-child, .report-root table.comp-table td:first-child { text-align: left; padding-left: 10px; }
.report-root table.comp-table .summary-row td { background: #FBF4E4; font-weight: 600; padding: 8px 5px; border-bottom: 2px solid var(--gold); }
.report-root table.comp-table td { padding: 8px 5px; text-align: center; border-bottom: 1px solid var(--line); vertical-align: middle; }
.report-root table.comp-table td.item-label { text-align: left; max-width: 210px; line-height: 1.35; font-size: 11.5px; }
.report-root .score { display: inline-block; min-width: 20px; }
.report-root .score.high { border-radius: 50%; background: var(--gold); color: #fff; width: 24px; height: 24px; line-height: 24px; font-weight: 600; font-size: 12px; }
.report-root .score.low { border-radius: 50%; border: 2px solid var(--amber); color: var(--amber); width: 20px; height: 20px; line-height: 16px; font-weight: 600; font-size: 11px; }
.report-root .range-cell { width: 95px; }
.report-root .range-bar { position: relative; height: 6px; background: var(--line); border-radius: 3px; margin: 0 6px; }
.report-root .range-fill { position: absolute; top: 0; bottom: 0; background: #C9C2B4; border-radius: 3px; }
.report-root .range-tick { position: absolute; top: -3px; width: 2px; height: 12px; background: var(--gold-dark); }
.report-root .legend { display: flex; gap: 18px; font-size: 11px; color: var(--muted); margin-top: 14px; flex-wrap: wrap; }
.report-root .legend span { display: inline-flex; align-items: center; gap: 6px; }
.report-root .plain-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 4px; }
.report-root .plain-table th { text-align: left; font-size: 11px; color: var(--muted); font-weight: 500; padding: 6px 10px; border-bottom: 1px solid var(--navy); }
.report-root .plain-table td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
.report-root .plain-table td.num { font-weight: 600; width: 46px; }
.report-root .plain-table td.comp { color: var(--muted); font-size: 11.5px; width: 150px; }
.report-root .comment-head { font-weight: 600; font-size: 12.5px; color: var(--navy); border-bottom: 2px solid var(--gold); padding-bottom: 6px; margin-bottom: 8px; margin-top: 18px; }
.report-root .comment-body { font-size: 12.5px; line-height: 1.6; color: var(--ink); margin: 0 0 16px; }
.report-root .plan-section { font-weight: 600; font-size: 12.5px; color: var(--navy); border-bottom: 2px solid var(--gold); padding-bottom: 6px; margin-bottom: 8px; margin-top: 20px; }
.report-root .plan-box { height: 42px; border: 1px dashed var(--line); border-radius: 4px; margin-bottom: 8px; }
.report-root .empty-note { font-size: 12.5px; color: var(--muted); font-style: italic; }

@media print {
  body { background: #fff !important; }
  .report-root { background: #fff; padding: 0; }
  .report-root .page { box-shadow: none; border-radius: 0; width: auto; max-width: none; margin: 0; page-break-after: always; }
  .report-root .page:last-child { page-break-after: auto; }
  .report-root .cover { min-height: 100vh; }
}
`;

export function ReportView({ data }: { data: IndividualReportData }) {
  const settingLine = [data.roleTitle, data.organisationName].filter(Boolean).join(" · ");
  let pageNum = 3; // pages 1-2 (cover, how to read) are fixed

  return (
    <div className="report-root">
      <style dangerouslySetInnerHTML={{ __html: REPORT_STYLES }} />

      {/* Page 1: cover */}
      <div className="page">
        <div className="cover">
          <div className="cover-top">
            <div className="brand-mark">COACH MY FUTURE</div>
            <div className="report-tag">CONFIDENTIAL</div>
          </div>
          <div className="cover-mid">
            <div className="cover-eyebrow">360&deg; leadership feedback report</div>
            <div className="cover-name">{data.leaderName}</div>
            {settingLine && <div className="cover-role">{settingLine}</div>}
          </div>
          <div className="cover-bottom">
            <div className="cover-meta">
              Review completed
              <strong>{data.completedAt ? formatDate(data.completedAt) : "—"}</strong>
            </div>
            <div className="cover-meta">
              Prepared by
              <strong>Krasi Toneva, Coach My Future</strong>
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
            A score of 4.25 or above is marked with a filled gold circle, a strength worth naming. A
            score of 2.25 or below is marked with an outlined amber circle. Nothing in between is
            marked, colour is used sparingly so it means something when it appears.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.65 }}>
            Each item also carries a small range bar: the lowest to highest individual rating from your
            colleagues (peers, direct reports, and others, excluding you and your manager), with a tick
            at their average. A tight bar means your colleagues agreed. A wide bar means they
            didn&apos;t, and that disagreement is worth exploring even where the average looks
            unremarkable.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.65 }}>
            Any group with fewer than 3 respondents on a given item is combined with another group to
            protect anonymity, or, if still fewer than 3, left out of that figure entirely rather than
            shown as a number. Your manager is reported separately throughout, since they are a single,
            identifiable rater by design, and they know this.
          </p>
        </div>
        <PageNumber n={2} />
      </div>

      {/* Pages 3-11: one competency table per competency, questionnaire order */}
      {data.competencyTables.map((table) => {
        const n = pageNum++;
        return (
          <div className="page" key={table.competencyNumber}>
            <div className="inner">
              <h2>{table.competencyName}</h2>
              <p className="sub">
                Self, colleague average, and each rater group. Range bar shows the spread of colleague
                ratings.
              </p>
              <table className="comp-table">
                <thead>
                  <tr>
                    <th>{table.competencyName}</th>
                    <th>Self</th>
                    <th>All others</th>
                    <th>Manager</th>
                    <th>Peers</th>
                    <th>Direct reports</th>
                    <th>Others</th>
                    <th>Range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="summary-row">
                    <td>Competency average</td>
                    <td>
                      <ScoreCell cell={table.summary.self} canMark={false} />
                    </td>
                    <td>
                      <ScoreCell cell={table.summary.allOthers} canMark={false} />
                    </td>
                    <td>
                      <ScoreCell cell={table.summary.manager} canMark={false} />
                    </td>
                    <td>
                      <ColleagueTd cell={table.summary.peer} />
                    </td>
                    <td>
                      <ColleagueTd cell={table.summary.directReport} />
                    </td>
                    <td>
                      <ColleagueTd cell={table.summary.other} />
                    </td>
                    <td></td>
                  </tr>
                  {table.items.map((item) => (
                    <tr key={item.itemId}>
                      <td className="item-label">{item.behaviourText}</td>
                      <td>
                        <ScoreCell cell={item.self} canMark={true} />
                      </td>
                      <td>
                        <ScoreCell cell={item.allOthers} canMark={true} />
                      </td>
                      <td>
                        <ScoreCell cell={item.manager} canMark={false} />
                      </td>
                      <td>
                        <ColleagueTd cell={item.peer} />
                      </td>
                      <td>
                        <ColleagueTd cell={item.directReport} />
                      </td>
                      <td>
                        <ColleagueTd cell={item.other} />
                      </td>
                      <td className="range-cell">
                        <RangeBar range={item.colleagueRange} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Legend />
            </div>
            <PageNumber n={n} />
          </div>
        );
      })}

      {/* Page 12: blind spots */}
      <div className="page">
        <div className="inner">
          <h2>Blind spots</h2>
          <p className="sub">Items where self exceeds the colleague average by 1.0 or more.</p>
          {data.blindSpots.length === 0 ? (
            <p className="empty-note">No blind spots were identified this cycle.</p>
          ) : (
            <table className="plain-table">
              <thead>
                <tr>
                  <th>Self</th>
                  <th>Others</th>
                  <th>Statement</th>
                  <th>Competency</th>
                </tr>
              </thead>
              <tbody>
                {data.blindSpots.map((row) => (
                  <tr key={row.itemId}>
                    <td className="num">{row.selfMean}</td>
                    <td className="num">{row.allOthersMean}</td>
                    <td>{row.behaviourText}</td>
                    <td className="comp">{row.competencyName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <PageNumber n={12} />
      </div>

      {/* Page 13: hidden strengths */}
      <div className="page">
        <div className="inner">
          <h2>Hidden strengths</h2>
          <p className="sub">Items where the colleague average exceeds self by 1.0 or more.</p>
          {data.hiddenStrengths.length === 0 ? (
            <p className="empty-note">No hidden strengths were identified this cycle.</p>
          ) : (
            <table className="plain-table">
              <thead>
                <tr>
                  <th>Others</th>
                  <th>Self</th>
                  <th>Statement</th>
                  <th>Competency</th>
                </tr>
              </thead>
              <tbody>
                {data.hiddenStrengths.map((row) => (
                  <tr key={row.itemId}>
                    <td className="num">{row.allOthersMean}</td>
                    <td className="num">{row.selfMean}</td>
                    <td>{row.behaviourText}</td>
                    <td className="comp">{row.competencyName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <PageNumber n={13} />
      </div>

      {/* Page 14: highest and lowest five */}
      <div className="page">
        <div className="inner">
          <h2>Highest and lowest five items</h2>
          <p className="sub">Across all items, by colleague average.</p>
          <p style={{ fontWeight: 600, fontSize: 12.5, color: "var(--navy)", margin: "16px 0 10px" }}>Highest</p>
          {data.highestLowest.highest.map((row, i) => (
            <div className="rank-row" key={row.itemId}>
              <div className="rank-num">{i + 1}</div>
              <div className="rank-content">
                <div className="rank-text">
                  {row.behaviourText} <span style={{ color: "var(--muted)", fontSize: 11 }}>&middot; {row.competencyName}</span>
                </div>
                <div className="rank-bar-track">
                  <div className="rank-bar-fill hi" style={{ width: `${(row.allOthersMean / SCALE_MAX) * 100}%` }} />
                </div>
              </div>
              <div className="rank-score">{row.allOthersMean}</div>
            </div>
          ))}
          <p style={{ fontWeight: 600, fontSize: 12.5, color: "var(--navy)", margin: "22px 0 10px" }}>Lowest</p>
          {data.highestLowest.lowest.map((row, i) => (
            <div className="rank-row" key={row.itemId}>
              <div className="rank-num">{i + 1}</div>
              <div className="rank-content">
                <div className="rank-text">
                  {row.behaviourText} <span style={{ color: "var(--muted)", fontSize: 11 }}>&middot; {row.competencyName}</span>
                </div>
                <div className="rank-bar-track">
                  <div className="rank-bar-fill lo" style={{ width: `${(row.allOthersMean / SCALE_MAX) * 100}%` }} />
                </div>
              </div>
              <div className="rank-score">{row.allOthersMean}</div>
            </div>
          ))}
        </div>
        <PageNumber n={14} />
      </div>

      {/* Page 15: development priorities */}
      <div className="page">
        <div className="inner">
          <h2>Development priorities</h2>
          <p className="sub">
            Top 10 items by colleague nomination as &ldquo;would make the biggest difference if
            improved.&rdquo; Self and manager shown as separate flags.
          </p>
          {data.developmentPriorities.length === 0 ? (
            <p className="empty-note">No development priorities were identified this cycle.</p>
          ) : (
            <table className="plain-table">
              <thead>
                <tr>
                  <th>Nominations</th>
                  <th>Statement</th>
                  <th>Competency</th>
                  <th>Self picked</th>
                  <th>Manager picked</th>
                </tr>
              </thead>
              <tbody>
                {data.developmentPriorities.map((row) => (
                  <tr key={row.itemId}>
                    <td className="num">{row.totalColleagueNominations}</td>
                    <td>{row.behaviourText}</td>
                    <td className="comp">{row.competencyName}</td>
                    <td style={{ textAlign: "center", width: 50 }}>{row.selfNominated ? "yes" : "no"}</td>
                    <td style={{ textAlign: "center", width: 60 }}>{row.managerNominated ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <PageNumber n={15} />
      </div>

      {/* Page 16: written comments */}
      <div className="page">
        <div className="inner">
          <h2>Written comments</h2>
          <p className="sub">
            Grouped by competency, then the 3 overall questions. Identifying detail removed, wording
            otherwise untouched. Competencies with no comments received are not listed.
          </p>
          {data.competencyComments.map((c, i) => (
            <div key={i}>
              <div className="comment-head">{c.competencyName}</div>
              <p className="comment-body">{c.text}</p>
            </div>
          ))}
          {data.overallComments.length > 0 && (
            <>
              <div className="comment-head">Continue, start, stop</div>
              {data.overallComments.map((c, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  {c.continueText && (
                    <p className="comment-body">
                      <strong>Continue:</strong> {c.continueText}
                    </p>
                  )}
                  {c.startText && (
                    <p className="comment-body">
                      <strong>Start:</strong> {c.startText}
                    </p>
                  )}
                  {c.stopText && (
                    <p className="comment-body">
                      <strong>Stop:</strong> {c.stopText}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
          {data.competencyComments.length === 0 && data.overallComments.length === 0 && (
            <p className="empty-note">No written comments were received this cycle.</p>
          )}
        </div>
        <PageNumber n={16} />
      </div>

      {/* Page 17: development plan -- all boxes empty, for the consultant to
          fill in during the debrief. Nothing else on this page. */}
      <div className="page">
        <div className="inner">
          <h2>Development plan</h2>
          <div className="plan-section">2 strengths to deploy more deliberately</div>
          <div className="plan-box" />
          <div className="plan-box" />
          <div className="plan-section">2 priorities from the development priorities page</div>
          <div className="plan-box" />
          <div className="plan-box" />
          <div className="plan-section">Specific actions, with dates</div>
          <div className="plan-box" />
          <div className="plan-box" />
          <div className="plan-box" />
          <div className="plan-box" />
        </div>
        <PageNumber n={17} />
      </div>
    </div>
  );
}

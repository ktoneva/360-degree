import { itemAllOthersMean, itemGroupMean, groupRatersByGroup } from "./means";
import { computeHiddenStrengths, computeBlindSpots } from "./blind-spots";
import type { ScoringDataset } from "./types";

export type TeamItemAggregate =
  | { mode: "separate"; mean: number; leaderCount: number }
  | { mode: "merged"; mean: number; leaderCount: number; respondentCount: number }
  | { mode: "insufficient"; leaderCount: number };

export interface TeamLeaderInput {
  leaderId: string;
  /** This leader's own complete dataset -- items already reflect their own
   * competency9Variant, exactly as for the individual report. */
  dataset: ScoringDataset;
}

export interface TeamMatrixCell {
  leaderId: string;
  /** This leader's own item-level "all others" figure (itemAllOthersMean) --
   * already anonymity-checked for that leader individually. Null if not
   * reportable for that leader (no colleague data clears the threshold). */
  allOthers: number | null;
  self: number | null;
}

export interface TeamMatrixItemRow {
  itemId: string;
  itemNumber: number;
  cells: TeamMatrixCell[];
}

export interface TeamStrengthInsight {
  leaderId: string;
  itemId: string;
  score: number;
}

export interface TeamGapInsight {
  leaderId: string;
  itemId: string;
  selfScore: number;
  othersScore: number;
  gap: number;
}

export interface TeamCompetencyMatrix {
  competencyNumber: number;
  items: TeamMatrixItemRow[];
  /** Single highest matrix cell in this competency clearing 4.25. Null means
   * no cell qualifies -- show a reflection prompt instead. */
  strengthInsight: TeamStrengthInsight | null;
  /** Single largest self-exceeds-others gap (>=1.0) anywhere in this
   * competency, scanned per leader per item -- never a cross-leader
   * aggregate. Null means show a reflection prompt instead. */
  gapInsight: TeamGapInsight | null;
}

const GAP_THRESHOLD = 1.0;
const HIGH_THRESHOLD = 4.25;

/**
 * One matrix per competency (Team report template section 4-12): rows are
 * items, columns are leaders, each cell is that leader's own existing
 * item-level "all others" figure -- not a cross-leader blend. The 2 insight
 * cards scan those same raw cells (plus each leader's own self value) for a
 * single standout finding; they do not aggregate across leaders either, per
 * the Team report logic tab (steps 4-5 describe finding "the single
 * highest-scoring cell" / "the single largest gap", not a team mean).
 */
export function computeTeamMatrix(leaders: TeamLeaderInput[]): TeamCompetencyMatrix[] {
  const perLeader = leaders.map((leader) => {
    const ratersByGroup = groupRatersByGroup(leader.dataset.raters);
    const scoredItems = leader.dataset.items.filter((i) => !i.isIntegrityItem);
    return { leaderId: leader.leaderId, ratersByGroup, dataset: leader.dataset, scoredItems };
  });

  const competencyNumbers = [
    ...new Set(perLeader.flatMap((l) => l.scoredItems.map((i) => i.competencyNumber))),
  ].sort((a, b) => a - b);

  return competencyNumbers.map((competencyNumber): TeamCompetencyMatrix => {
    // Item identity (id/number) is shared across leaders on the same
    // variant, so any one leader's item list for this competency defines
    // the rows; leaders who weren't asked a given item just show null cells.
    const itemsForCompetency = new Map<string, number>();
    for (const l of perLeader) {
      for (const item of l.scoredItems) {
        if (item.competencyNumber === competencyNumber) itemsForCompetency.set(item.id, item.itemNumber);
      }
    }
    const orderedItemIds = [...itemsForCompetency.entries()].sort((a, b) => a[1] - b[1]);

    let strengthInsight: TeamStrengthInsight | null = null;
    let gapInsight: TeamGapInsight | null = null;

    const items: TeamMatrixItemRow[] = orderedItemIds.map(([itemId, itemNumber]) => {
      const cells: TeamMatrixCell[] = perLeader.map((l) => {
        const allOthersResult = itemAllOthersMean(l.dataset.responses, itemId, l.ratersByGroup);
        const selfResult = itemGroupMean(l.dataset.responses, itemId, l.ratersByGroup.self);
        const allOthers = allOthersResult.mean;
        const self = selfResult.mean;

        if (allOthers !== null && allOthers >= HIGH_THRESHOLD) {
          if (!strengthInsight || allOthers > strengthInsight.score) {
            strengthInsight = { leaderId: l.leaderId, itemId, score: allOthers };
          }
        }
        if (self !== null && allOthers !== null) {
          const gap = self - allOthers;
          if (gap >= GAP_THRESHOLD && (!gapInsight || gap > gapInsight.gap)) {
            gapInsight = { leaderId: l.leaderId, itemId, selfScore: self, othersScore: allOthers, gap };
          }
        }

        return { leaderId: l.leaderId, allOthers, self };
      });

      return { itemId, itemNumber, cells };
    });

    return { competencyNumber, items, strengthInsight, gapInsight };
  });
}

/**
 * The genuine cross-leader aggregate for one item (used only on section 3,
 * "the whole team, at a glance" -- the matrix pages never need this, since a
 * matrix cell is one leader's own figure). Mean-of-means across leaders'
 * own item-level "all others" figures when 3+ leaders have one; below that,
 * pools every real individual colleague rating on that item across the
 * merged leaders instead -- same principle as computeOrgOverview, one level
 * down from competency to item.
 */
export function computeTeamItemAggregate(leaders: TeamLeaderInput[], itemId: string): TeamItemAggregate {
  // Outer gate: are there enough LEADERS in scope at all, regardless of
  // whether any one of them individually has a reportable figure yet --
  // mirrors computeOrgOverview's leaderCount-then-mean-of-means structure
  // exactly, rather than conflating "leaders in scope" with "leaders whose
  // own figure happens to be non-null" into a single count.
  const leaderCount = leaders.length;
  if (leaderCount === 0) return { mode: "insufficient", leaderCount: 0 };

  if (leaderCount >= 3) {
    const perLeaderMeans: number[] = [];
    for (const leader of leaders) {
      const ratersByGroup = groupRatersByGroup(leader.dataset.raters);
      const { mean } = itemAllOthersMean(leader.dataset.responses, itemId, ratersByGroup);
      if (mean !== null) perLeaderMeans.push(mean);
    }
    if (perLeaderMeans.length === 0) return { mode: "insufficient", leaderCount };
    const mean = perLeaderMeans.reduce((sum, v) => sum + v, 0) / perLeaderMeans.length;
    return { mode: "separate", mean, leaderCount };
  }

  // Under 3 leaders in scope: pool raw individual colleague ratings on this
  // one item across all of them.
  const combinedRaterIds = leaders.flatMap((l) => [
    ...groupRatersByGroup(l.dataset.raters).peer,
    ...groupRatersByGroup(l.dataset.raters).direct_report,
    ...groupRatersByGroup(l.dataset.raters).other,
  ]);
  const combinedResponses = leaders.flatMap((l) => l.dataset.responses);
  const { mean, n } = itemGroupMean(combinedResponses, itemId, combinedRaterIds);
  if (mean === null) return { mode: "insufficient", leaderCount };
  return { mode: "merged", mean, leaderCount, respondentCount: n };
}

export interface TeamLeaderPatternCount {
  leaderId: string;
  /** How many of this leader's own items clear the hidden-strength (others
   * exceed self by >=1.0) or blind-spot (self exceeds others by >=1.0)
   * threshold, reusing the exact same per-leader computation as the
   * individual report unchanged. */
  count: number;
}

/**
 * Starting-point candidates for "the whole team, at a glance" (section 3) --
 * this page is explicitly a curated, editable screen (confirmed with the
 * user), not a fully automatic one, so this only surfaces the mechanically
 * clear signals for the consultant to write the final narrative around:
 * which leaders have the most hidden-strength patterns (stretch) or
 * blind-spot patterns (development) across their own reports.
 */
export function computeTeamPatternCandidates(leaders: TeamLeaderInput[]): {
  stretch: TeamLeaderPatternCount[];
  development: TeamLeaderPatternCount[];
} {
  const stretch = leaders
    .map((l) => ({ leaderId: l.leaderId, count: computeHiddenStrengths(l.dataset).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const development = leaders
    .map((l) => ({ leaderId: l.leaderId, count: computeBlindSpots(l.dataset).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return { stretch, development };
}

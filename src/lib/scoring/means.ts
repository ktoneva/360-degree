import { MERGEABLE_GROUPS, type MergeableGroup, type RaterGroup, type ScoringRater, type ScoringResponse } from "./types";

/** Rounds to 1 decimal place for display. Never use this before a threshold test. */
export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function groupRatersByGroup(raters: ScoringRater[]): Record<RaterGroup, string[]> {
  const result: Record<RaterGroup, string[]> = {
    self: [],
    manager: [],
    peer: [],
    direct_report: [],
    other: [],
  };
  for (const rater of raters) {
    result[rater.group].push(rater.id);
  }
  return result;
}

function meanOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface ItemGroupMean {
  mean: number | null;
  /** Distinct raters (from the given id list) with a real scale rating on this item. */
  n: number;
}

/**
 * A group's mean on a single item: only real scale ratings from the given
 * raters count. "Not able to comment" and unanswered are both excluded, from
 * both the total and the count (Blind spots logic, step 2).
 */
export function itemGroupMean(
  responses: ScoringResponse[],
  itemId: string,
  raterIds: string[],
): ItemGroupMean {
  const raterIdSet = new Set(raterIds);
  const byRater = new Map<string, number>();
  for (const r of responses) {
    if (r.itemId !== itemId) continue;
    if (!raterIdSet.has(r.raterId)) continue;
    if (typeof r.scaleValue !== "number") continue;
    byRater.set(r.raterId, r.scaleValue);
  }
  const values = [...byRater.values()];
  return { mean: meanOf(values), n: values.length };
}

export interface CompetencyGroupStats {
  /** Flat average of every individual real rating pooled across the given
   * items, for the given raters — not an average of per-item means (Rater
   * group comparison logic, step 1). */
  mean: number | null;
  /** Distinct raters (from the given id list) with >=1 real rating among the
   * given items — the figure the n>=3 threshold is tested against (step 2). */
  respondentCount: number;
}

export function competencyGroupMean(
  responses: ScoringResponse[],
  itemIds: string[],
  raterIds: string[],
): CompetencyGroupStats {
  const itemIdSet = new Set(itemIds);
  const raterIdSet = new Set(raterIds);
  const values: number[] = [];
  const respondents = new Set<string>();
  for (const r of responses) {
    if (!itemIdSet.has(r.itemId)) continue;
    if (!raterIdSet.has(r.raterId)) continue;
    if (typeof r.scaleValue !== "number") continue;
    values.push(r.scaleValue);
    respondents.add(r.raterId);
  }
  return { mean: meanOf(values), respondentCount: respondents.size };
}

/**
 * Item-level "all others" mean per the Blind spots logic tab (steps 3-5):
 * peer/direct_report/other each report separately if they clear n>=3 on this
 * item; groups that don't are pooled into a single "all colleagues" figure,
 * which itself must clear n>=3 to count. The final mean averages the
 * *group-level* means that cleared the bar, each counted once — never a
 * straight pooled average of every individual rater. Manager is never
 * included, in either direction (step 10).
 */
export interface ItemAllOthersResult {
  mean: number | null;
  /** Sum of the real-rating counts behind whichever group-level means were
   * actually averaged in — used for the blind-spot tie-break (step 9). */
  totalRealRatings: number;
}

export function itemAllOthersMean(
  responses: ScoringResponse[],
  itemId: string,
  ratersByGroup: Record<RaterGroup, string[]>,
): ItemAllOthersResult {
  const reportableMeans: number[] = [];
  let totalRealRatings = 0;
  const needsMerge: MergeableGroup[] = [];

  for (const group of MERGEABLE_GROUPS) {
    const { mean, n } = itemGroupMean(responses, itemId, ratersByGroup[group]);
    if (n >= 3) {
      reportableMeans.push(mean!);
      totalRealRatings += n;
    } else {
      needsMerge.push(group);
    }
  }

  if (needsMerge.length > 0) {
    const mergedRaterIds = needsMerge.flatMap((g) => ratersByGroup[g]);
    const merged = itemGroupMean(responses, itemId, mergedRaterIds);
    if (merged.n >= 3) {
      reportableMeans.push(merged.mean!);
      totalRealRatings += merged.n;
    }
    // else: the merged pool still falls short — those groups contribute
    // nothing to this item's all-others figure at all.
  }

  if (reportableMeans.length === 0) return { mean: null, totalRealRatings: 0 };
  return {
    mean: reportableMeans.reduce((sum, m) => sum + m, 0) / reportableMeans.length,
    totalRealRatings,
  };
}

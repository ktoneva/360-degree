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
  /** Average of only the real scale ratings among the given raters on this
   * item. "Not able to comment" is excluded here regardless of respondentCount. */
  mean: number | null;
  /** Distinct raters (from the given id list) with a real scale rating on
   * this item — feeds the mean above and the blind-spot tie-break
   * (totalRealRatings). Never the figure the n>=3 threshold is tested
   * against on its own; see respondentCount (v15). */
  n: number;
  /** Distinct raters (from the given id list) who responded to this item at
   * all — a real rating OR "not able to comment" — the figure the n>=3
   * threshold is tested against (Blind spots logic, step 3, v15). Always
   * >= n, since every real rating is itself a response. */
  respondentCount: number;
}

/**
 * A group's mean on a single item: only real scale ratings from the given
 * raters feed the mean, "not able to comment" is always excluded from it
 * (Blind spots logic, step 2) — but a rater who explicitly said "not able to
 * comment" still responded, so they count toward respondentCount, the figure
 * the n>=3 anonymity threshold actually tests (step 3, v15). A rater who
 * never answered the item at all has no row in `responses` and counts
 * toward neither.
 */
export function itemGroupMean(
  responses: ScoringResponse[],
  itemId: string,
  raterIds: string[],
): ItemGroupMean {
  const raterIdSet = new Set(raterIds);
  const byRater = new Map<string, number>();
  const responders = new Set<string>();
  for (const r of responses) {
    if (r.itemId !== itemId) continue;
    if (!raterIdSet.has(r.raterId)) continue;
    responders.add(r.raterId);
    if (typeof r.scaleValue === "number") {
      byRater.set(r.raterId, r.scaleValue);
    }
  }
  const values = [...byRater.values()];
  return { mean: meanOf(values), n: values.length, respondentCount: responders.size };
}

export interface CompetencyGroupStats {
  /** Flat average of every individual real rating pooled across the given
   * items, for the given raters — not an average of per-item means (Rater
   * group comparison logic, step 1). "Not able to comment" is always
   * excluded here, regardless of respondentCount below. */
  mean: number | null;
  /** Distinct raters (from the given id list) who responded to any of the
   * given items at all — a real rating OR "not able to comment" — the figure
   * the n>=3 threshold is tested against (step 2, v15). A rater who never
   * answered any item in this competency has no row in `responses` for it
   * and isn't counted. */
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
    respondents.add(r.raterId);
    if (typeof r.scaleValue === "number") {
      values.push(r.scaleValue);
    }
  }
  return { mean: meanOf(values), respondentCount: respondents.size };
}

/**
 * Item-level "all others" mean per the Blind spots logic tab (steps 3-5):
 * peer/direct_report/other each report separately if they clear n>=3
 * *responders* on this item — a real rating or "not able to comment" both
 * count (step 3, v15) — groups that don't are pooled into a single "all
 * colleagues" figure, which itself must clear n>=3 responders to count. The
 * final mean averages the *group-level* means that cleared the bar, each
 * counted once — never a straight pooled average of every individual rater,
 * and always built only from real ratings regardless of how the threshold
 * was cleared. Manager is never included, in either direction (step 10).
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
    const { mean, n, respondentCount } = itemGroupMean(responses, itemId, ratersByGroup[group]);
    // Clearing the threshold on participation alone can still leave zero
    // real ratings (e.g. 3 people all said "not able to comment") — nothing
    // to report in that rare case, and nothing to merge either, since the
    // group genuinely isn't short on responders.
    if (respondentCount >= 3) {
      if (mean !== null) {
        reportableMeans.push(mean);
        totalRealRatings += n;
      }
    } else {
      needsMerge.push(group);
    }
  }

  if (needsMerge.length > 0) {
    const mergedRaterIds = needsMerge.flatMap((g) => ratersByGroup[g]);
    const merged = itemGroupMean(responses, itemId, mergedRaterIds);
    if (merged.respondentCount >= 3 && merged.mean !== null) {
      reportableMeans.push(merged.mean);
      totalRealRatings += merged.n;
    }
    // else: the merged pool still falls short on responders, or has zero
    // real ratings despite clearing it — those groups contribute nothing to
    // this item's all-others figure at all.
  }

  if (reportableMeans.length === 0) return { mean: null, totalRealRatings: 0 };
  return {
    mean: reportableMeans.reduce((sum, m) => sum + m, 0) / reportableMeans.length,
    totalRealRatings,
  };
}

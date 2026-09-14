import { MERGEABLE_GROUPS, type MergeableGroup } from "./types";
import { competencyGroupMean, groupRatersByGroup, round1, type CompetencyGroupStats } from "./means";
import type { ScoringDataset } from "./types";

export type ComparisonCell =
  | { status: "reported"; mean: number; n: number }
  | { status: "insufficient_responses" }
  | { status: "no_data" };

/** A colleague group's cell either reports its own mean, shows the same
 * resolved figure the competency's allColleagues row shows when this group
 * was folded into it (a real mean, or "insufficient responses" if the pool
 * itself still falls short — never a bare internal status), or has no
 * data to show at all: either zero raters in this group for the cycle, or
 * (v15) this group was never asked any item in this competency in the first
 * place — a genuine not-applicable, not an anonymity suppression, so it
 * renders the same plain dash rather than "insufficient responses" and
 * never enters the merge decision. */
export type ColleagueCell =
  | { status: "reported"; mean: number; n: number }
  | { status: "insufficient_responses" }
  | { status: "no_data" };

export interface CompetencyComparisonRow {
  competencyNumber: number;
  self: ComparisonCell;
  manager: ComparisonCell;
  peer: ColleagueCell;
  directReport: ColleagueCell;
  other: ColleagueCell;
  /** Present only when at least one of peer/directReport/other was merged
   * this competency; null means all three reported separately. */
  allColleagues: ComparisonCell | null;
}

function toGroupCell(stats: CompetencyGroupStats): ComparisonCell {
  if (stats.mean === null) return { status: "no_data" };
  return { status: "reported", mean: round1(stats.mean), n: stats.respondentCount };
}

/**
 * One row per competency, fixed order 1-9 (never reordered by score — that's
 * only the competency overview page). Self and manager always show as their
 * own column, never merged or suppressed. For peer/direct report/other, the
 * applicability check (v15) runs first and stops there: a group never asked
 * any item in this competency at all shows a plain dash and never enters the
 * n>=3-or-merge logic below. Only *then* are the applicable groups merged
 * whenever they fall under n>=3 *responders* for that competency's items — a
 * real rating or "not able to comment" both count toward that (step 2),
 * though the mean itself still only ever averages real ratings. A merged
 * group's own cell shows the exact same resolved figure as allColleagues (a
 * real pooled mean, or "insufficient responses" if the pool is still under
 * 3) — never a bare internal status. A group with zero raters invited to the
 * cycle at all is likewise left out of the merge decision entirely (see
 * `existingGroups` below).
 */
export function computeRaterGroupComparison(dataset: ScoringDataset): CompetencyComparisonRow[] {
  const ratersByGroup = groupRatersByGroup(dataset.raters);
  const scoredItems = dataset.items.filter((i) => !i.isIntegrityItem);
  const competencyNumbers = [...new Set(scoredItems.map((i) => i.competencyNumber))].sort(
    (a, b) => a - b,
  );

  return competencyNumbers.map((competencyNumber): CompetencyComparisonRow => {
    const competencyItems = scoredItems.filter((i) => i.competencyNumber === competencyNumber);
    const itemIds = competencyItems.map((i) => i.id);

    // Was this group ever asked any item in this competency at all? A group
    // that wasn't is a genuine not-applicable (a dash), never an anonymity
    // question — distinct from being asked but falling under the response
    // threshold (v15).
    const groupAskedInCompetency = (group: MergeableGroup) =>
      competencyItems.some((item) => item.askedRaterGroups.includes(group));

    const selfStats = competencyGroupMean(dataset.responses, itemIds, ratersByGroup.self);
    const managerStats = competencyGroupMean(dataset.responses, itemIds, ratersByGroup.manager);

    const groupStats: Record<MergeableGroup, CompetencyGroupStats> = {
      peer: competencyGroupMean(dataset.responses, itemIds, ratersByGroup.peer),
      direct_report: competencyGroupMean(dataset.responses, itemIds, ratersByGroup.direct_report),
      other: competencyGroupMean(dataset.responses, itemIds, ratersByGroup.other),
    };

    // A group with zero raters invited to the cycle at all, or never asked
    // this competency in the first place, has nothing to protect and
    // nothing to fold in — it's excluded from the merge decision entirely,
    // rather than being treated as an under-3 group that forces a merge
    // attempt (and possibly an "insufficient responses" verdict) on groups
    // that are otherwise perfectly healthy. A group that clears 3 responders
    // but has zero real ratings (everyone said "not able to comment") has
    // nothing to report either, but isn't short on responders — it's
    // excluded from both the safe list and the merge pool too.
    const existingGroups = MERGEABLE_GROUPS.filter(
      (g) => ratersByGroup[g].length > 0 && groupAskedInCompetency(g),
    );
    const safeGroups = existingGroups.filter(
      (g) => groupStats[g].respondentCount >= 3 && groupStats[g].mean !== null,
    );
    const groupsToMerge = existingGroups.filter((g) => !safeGroups.includes(g));

    let allColleagues: ComparisonCell | null = null;
    let pooledCell: ColleagueCell | null = null;
    if (groupsToMerge.length > 0) {
      const mergedRaterIds = groupsToMerge.flatMap((g) => ratersByGroup[g]);
      const mergedStats = competencyGroupMean(dataset.responses, itemIds, mergedRaterIds);
      const resolved: ComparisonCell =
        mergedStats.respondentCount >= 3 && mergedStats.mean !== null
          ? { status: "reported", mean: round1(mergedStats.mean), n: mergedStats.respondentCount }
          : { status: "insufficient_responses" };
      allColleagues = resolved;
      pooledCell = resolved;
    }

    const colleagueCell = (group: MergeableGroup): ColleagueCell => {
      // Applicability first, and stop there -- never run a not-applicable
      // group through the n>=3-or-merge logic at all (v15).
      if (ratersByGroup[group].length === 0) return { status: "no_data" };
      if (!groupAskedInCompetency(group)) return { status: "no_data" };
      if (safeGroups.includes(group)) {
        return {
          status: "reported",
          mean: round1(groupStats[group].mean!),
          n: groupStats[group].respondentCount,
        };
      }
      // Folded into the pooled allColleagues figure for this competency —
      // show that same resolved value here too, never a separate "merged"
      // placeholder.
      return pooledCell!;
    };

    return {
      competencyNumber,
      self: toGroupCell(selfStats),
      manager: toGroupCell(managerStats),
      peer: colleagueCell("peer"),
      directReport: colleagueCell("direct_report"),
      other: colleagueCell("other"),
      allColleagues,
    };
  });
}

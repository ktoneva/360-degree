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
 * raters in this group at all for the cycle (distinct from being folded in:
 * there's nothing to protect or pool, so it doesn't affect whether
 * allColleagues appears). */
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
 * own column, never merged or suppressed. Peer/direct report/other are
 * merged independently *per competency* whenever they fall under n>=3
 * *responders* for that competency's items — a real rating or "not able to
 * comment" both count toward that (step 2, v15), though the mean itself
 * still only ever averages real ratings. A merged group's own cell shows the
 * exact same resolved figure as allColleagues (a real pooled mean, or
 * "insufficient responses" if the pool is still under 3) — never a bare
 * internal status. A group with zero raters invited to the cycle at all is
 * left out of the merge decision entirely (see `existingGroups` below).
 */
export function computeRaterGroupComparison(dataset: ScoringDataset): CompetencyComparisonRow[] {
  const ratersByGroup = groupRatersByGroup(dataset.raters);
  const scoredItems = dataset.items.filter((i) => !i.isIntegrityItem);
  const competencyNumbers = [...new Set(scoredItems.map((i) => i.competencyNumber))].sort(
    (a, b) => a - b,
  );

  return competencyNumbers.map((competencyNumber): CompetencyComparisonRow => {
    const itemIds = scoredItems
      .filter((i) => i.competencyNumber === competencyNumber)
      .map((i) => i.id);

    const selfStats = competencyGroupMean(dataset.responses, itemIds, ratersByGroup.self);
    const managerStats = competencyGroupMean(dataset.responses, itemIds, ratersByGroup.manager);

    const groupStats: Record<MergeableGroup, CompetencyGroupStats> = {
      peer: competencyGroupMean(dataset.responses, itemIds, ratersByGroup.peer),
      direct_report: competencyGroupMean(dataset.responses, itemIds, ratersByGroup.direct_report),
      other: competencyGroupMean(dataset.responses, itemIds, ratersByGroup.other),
    };

    // A group with zero raters invited to the cycle at all has nothing to
    // protect and nothing to fold in — it's excluded from the merge decision
    // entirely, rather than being treated as an under-3 group that forces a
    // merge attempt (and possibly an "insufficient responses" verdict) on
    // groups that are otherwise perfectly healthy. A group that clears 3
    // responders but has zero real ratings (everyone said "not able to
    // comment") has nothing to report either, but isn't short on responders
    // — it's excluded from both the safe list and the merge pool.
    const existingGroups = MERGEABLE_GROUPS.filter((g) => ratersByGroup[g].length > 0);
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
      if (ratersByGroup[group].length === 0) return { status: "no_data" };
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

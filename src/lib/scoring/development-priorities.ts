import { MERGEABLE_GROUPS, type MergeableGroup } from "./types";
import { groupRatersByGroup } from "./means";
import type { ScoringDataset } from "./types";

/** How many development priorities a rater must pick for their forced choice
 * to count at all (v10 of the spec: 3, all required, equally weighted). */
const REQUIRED_PRIORITY_COUNT = 3;

export type DevelopmentPriorityBreakdown =
  | { mode: "separate"; peer: number; directReport: number; other: number }
  | { mode: "partial_merge"; separate: Partial<Record<MergeableGroup, number>>; allColleagues: number }
  // Step 7: if the merged pool is *still* under 3, group attribution is
  // dropped entirely for the section — not just for the merged bucket — and
  // every item shows one ungrouped colleague total instead. This is the one
  // place in the spec that falls back to a number rather than suppressing,
  // since a bare count isn't identifying the way a small group's mean is.
  | { mode: "merge_failed" };

export interface DevelopmentPriorityItemResult {
  itemId: string;
  competencyNumber: number;
  itemNumber: number;
  /** Colleague (peer+direct_report+other) nominations only — what the list is
   * ranked and capped by. Self/manager are reference flags, not part of this. */
  totalColleagueNominations: number;
  breakdown: DevelopmentPriorityBreakdown;
  selfNominated: boolean;
  managerNominated: boolean;
}

/** Raters whose forced choice counts at all: exactly REQUIRED_PRIORITY_COUNT
 * distinct nominated items. Fewer is excluded entirely, not partially
 * counted (step 2) — a rater who nominated only 2 of the required 3 before
 * this changed from 2 to 3 is correctly treated the same as 0 or 1 here. */
function completeNominationsByRater(nominations: ScoringDataset["nominations"]): Map<string, Set<string>> {
  const byRater = new Map<string, Set<string>>();
  for (const nom of nominations) {
    if (!byRater.has(nom.raterId)) byRater.set(nom.raterId, new Set());
    byRater.get(nom.raterId)!.add(nom.itemId);
  }
  for (const [raterId, items] of byRater) {
    if (items.size !== REQUIRED_PRIORITY_COUNT) byRater.delete(raterId);
  }
  return byRater;
}

/**
 * Top 10 items by colleague nomination count from the forced-choice
 * question. Group-level n>=3 (and merge) is decided once for the whole
 * section, not per item (step 5) — unlike blind spots and rater group
 * comparison, which decide it per item / per competency.
 */
export function computeDevelopmentPriorities(dataset: ScoringDataset): DevelopmentPriorityItemResult[] {
  const ratersByGroup = groupRatersByGroup(dataset.raters);
  const complete = completeNominationsByRater(dataset.nominations);

  const nominatedBy = (raterIds: string[], itemId: string) =>
    raterIds.filter((id) => complete.get(id)?.has(itemId)).length;

  const completeCount = (group: MergeableGroup) =>
    ratersByGroup[group].filter((id) => complete.has(id)).length;

  // A group with zero raters invited at all doesn't force a merge on groups
  // that are otherwise perfectly healthy — there's nothing of theirs to
  // protect or fold in (same reasoning as the rater group comparison page).
  const existingGroups = MERGEABLE_GROUPS.filter((g) => ratersByGroup[g].length > 0);
  const safeGroups = existingGroups.filter((g) => completeCount(g) >= 3);
  const groupsToMerge = existingGroups.filter((g) => completeCount(g) < 3);

  let mode: DevelopmentPriorityBreakdown["mode"];
  let mergedRaterIds: string[] = [];
  if (groupsToMerge.length === 0) {
    mode = "separate";
  } else {
    mergedRaterIds = groupsToMerge.flatMap((g) => ratersByGroup[g]);
    const mergedCompleteCount = mergedRaterIds.filter((id) => complete.has(id)).length;
    mode = mergedCompleteCount >= 3 ? "partial_merge" : "merge_failed";
  }

  const eligibleItems = dataset.items.filter((i) => !i.isIntegrityItem);
  const allColleagueRaterIds = MERGEABLE_GROUPS.flatMap((g) => ratersByGroup[g]);

  const results: DevelopmentPriorityItemResult[] = eligibleItems.map((item) => {
    let totalColleagueNominations: number;
    let breakdown: DevelopmentPriorityBreakdown;

    if (mode === "separate") {
      const peer = nominatedBy(ratersByGroup.peer, item.id);
      const directReport = nominatedBy(ratersByGroup.direct_report, item.id);
      const other = nominatedBy(ratersByGroup.other, item.id);
      totalColleagueNominations = peer + directReport + other;
      breakdown = { mode, peer, directReport, other };
    } else if (mode === "partial_merge") {
      const separate: Partial<Record<MergeableGroup, number>> = {};
      for (const g of safeGroups) separate[g] = nominatedBy(ratersByGroup[g], item.id);
      const allColleagues = nominatedBy(mergedRaterIds, item.id);
      totalColleagueNominations =
        Object.values(separate).reduce((sum: number, v) => sum + (v ?? 0), 0) + allColleagues;
      breakdown = { mode, separate, allColleagues };
    } else {
      totalColleagueNominations = nominatedBy(allColleagueRaterIds, item.id);
      breakdown = { mode: "merge_failed" };
    }

    return {
      itemId: item.id,
      competencyNumber: item.competencyNumber,
      itemNumber: item.itemNumber,
      totalColleagueNominations,
      breakdown,
      selfNominated: nominatedBy(ratersByGroup.self, item.id) > 0,
      managerNominated: nominatedBy(ratersByGroup.manager, item.id) > 0,
    };
  });

  // Step 10: drop zero-nomination items before capping. Step 9/11: rank by
  // colleague total descending, tie-broken by lower competency then item.
  return results
    .filter((r) => r.totalColleagueNominations > 0)
    .sort((a, b) => {
      if (b.totalColleagueNominations !== a.totalColleagueNominations) {
        return b.totalColleagueNominations - a.totalColleagueNominations;
      }
      if (a.competencyNumber !== b.competencyNumber) return a.competencyNumber - b.competencyNumber;
      return a.itemNumber - b.itemNumber;
    })
    .slice(0, 10);
}

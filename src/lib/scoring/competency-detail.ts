import { itemAllOthersMean, itemGroupMean, groupRatersByGroup, round1 } from "./means";
import { computeCompetencyOverview } from "./competency-overview";
import {
  computeRaterGroupComparison,
  type ColleagueCell,
  type ComparisonCell,
} from "./rater-group-comparison";
import { MERGEABLE_GROUPS, type MergeableGroup, type ScoringDataset } from "./types";

export interface CompetencyDetailItemRow {
  itemId: string;
  itemNumber: number;
  self: ComparisonCell;
  manager: ComparisonCell;
  allOthers: ComparisonCell;
  peer: ColleagueCell;
  directReport: ColleagueCell;
  other: ColleagueCell;
  /** Lowest/highest individual colleague (peer+direct_report+other) rating on
   * this item, with their pooled average -- shown unconditionally, not
   * anonymity-gated like the cells above. A bare spread doesn't attribute a
   * value to any one person the way a group mean does, so it isn't subject
   * to the same n>=3 rule. Null only when no colleague rated this item at
   * all (never happens for a real, assigned item, but keeps the type honest
   * for an item nobody was routed to). */
  colleagueRange: { low: number; high: number; average: number } | null;
}

export interface CompetencySummaryRow {
  competencyNumber: number;
  self: ComparisonCell;
  manager: ComparisonCell;
  /** Mean of the peer/direct_report/other group-level means, each counted
   * once regardless of headcount -- same convention as the competency
   * overview page, not a pooled individual average, and not anonymity-gated
   * (it's a statistic about groups, not one small group's own figure). */
  allOthers: ComparisonCell;
  peer: ColleagueCell;
  directReport: ColleagueCell;
  other: ColleagueCell;
}

export interface CompetencyDetailTable {
  competencyNumber: number;
  summary: CompetencySummaryRow;
  /** Original item-bank order, not reordered by score. */
  items: CompetencyDetailItemRow[];
}

function toCell(mean: number | null, n: number): ComparisonCell {
  if (mean === null) return { status: "no_data" };
  return { status: "reported", mean: round1(mean), n };
}

/**
 * One table per competency (report template section 3), combining what were
 * 3 separate sections -- competency overview, rater group comparison, and
 * the item-level appendix -- into a single summary-row-plus-item-rows table.
 * The summary row reuses computeRaterGroupComparison unchanged; item rows
 * apply the identical per-group n>=3-and-merge logic one level down, per
 * item rather than per competency (Blind spots logic tab, steps 2-4), since
 * rater attendance varies even more at item level than at competency level.
 */
export function computeCompetencyDetailTables(dataset: ScoringDataset): CompetencyDetailTable[] {
  const ratersByGroup = groupRatersByGroup(dataset.raters);
  const scoredItems = dataset.items.filter((i) => !i.isIntegrityItem);
  const comparisonByCompetency = new Map(
    computeRaterGroupComparison(dataset).map((row) => [row.competencyNumber, row]),
  );
  const overviewByCompetency = new Map(
    computeCompetencyOverview(dataset).map((row) => [row.competencyNumber, row]),
  );

  const competencyNumbers = [...new Set(scoredItems.map((i) => i.competencyNumber))].sort(
    (a, b) => a - b,
  );

  return competencyNumbers.map((competencyNumber): CompetencyDetailTable => {
    const items = scoredItems
      .filter((i) => i.competencyNumber === competencyNumber)
      .sort((a, b) => a.itemNumber - b.itemNumber)
      .map((item): CompetencyDetailItemRow => {
        const selfResult = itemGroupMean(dataset.responses, item.id, ratersByGroup.self);
        const managerResult = itemGroupMean(dataset.responses, item.id, ratersByGroup.manager);
        const allOthers = itemAllOthersMean(dataset.responses, item.id, ratersByGroup);

        const groupResults: Record<MergeableGroup, ReturnType<typeof itemGroupMean>> = {
          peer: itemGroupMean(dataset.responses, item.id, ratersByGroup.peer),
          direct_report: itemGroupMean(dataset.responses, item.id, ratersByGroup.direct_report),
          other: itemGroupMean(dataset.responses, item.id, ratersByGroup.other),
        };
        const safeGroups = MERGEABLE_GROUPS.filter((g) => groupResults[g].n >= 3);

        const colleagueCell = (group: MergeableGroup): ColleagueCell => {
          if (ratersByGroup[group].length === 0) return { status: "no_data" };
          return safeGroups.includes(group)
            ? { status: "reported", mean: round1(groupResults[group].mean!), n: groupResults[group].n }
            : { status: "merged" };
        };

        const colleagueRaterIds = new Set([
          ...ratersByGroup.peer,
          ...ratersByGroup.direct_report,
          ...ratersByGroup.other,
        ]);
        const colleagueValues = dataset.responses
          .filter(
            (r) =>
              r.itemId === item.id && colleagueRaterIds.has(r.raterId) && typeof r.scaleValue === "number",
          )
          .map((r) => r.scaleValue as number);
        const colleagueRange =
          colleagueValues.length > 0
            ? {
                low: Math.min(...colleagueValues),
                high: Math.max(...colleagueValues),
                average: colleagueValues.reduce((sum, v) => sum + v, 0) / colleagueValues.length,
              }
            : null;

        return {
          itemId: item.id,
          itemNumber: item.itemNumber,
          self: toCell(selfResult.mean, selfResult.n),
          manager: toCell(managerResult.mean, managerResult.n),
          allOthers: toCell(allOthers.mean, allOthers.totalRealRatings),
          peer: colleagueCell("peer"),
          directReport: colleagueCell("direct_report"),
          other: colleagueCell("other"),
          colleagueRange,
        };
      });

    const comparison = comparisonByCompetency.get(competencyNumber)!;
    const overview = overviewByCompetency.get(competencyNumber)!;

    return {
      competencyNumber,
      summary: {
        competencyNumber,
        self: comparison.self,
        manager: comparison.manager,
        allOthers: overview.allOthers === null ? { status: "no_data" } : { status: "reported", mean: round1(overview.allOthers), n: 0 },
        peer: comparison.peer,
        directReport: comparison.directReport,
        other: comparison.other,
      },
      items,
    };
  });
}

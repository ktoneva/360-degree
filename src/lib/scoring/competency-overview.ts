import { competencyGroupMean, groupRatersByGroup } from "./means";
import type { ScoringDataset } from "./types";

export interface CompetencyOverviewRow {
  competencyNumber: number;
  self: number | null;
  manager: number | null;
  /** Average of the peer mean, direct report mean, and others mean — each
   * counted once, only over groups that have at least one real rating. Not a
   * pooled average of every individual rater. No anonymity threshold applies
   * here (unlike the rater group comparison page). */
  allOthers: number | null;
}

/**
 * Ordered highest to lowest by allOthers (nulls last, then by competency
 * number for a stable, deterministic order), per the report template's
 * competency overview section.
 */
export function computeCompetencyOverview(dataset: ScoringDataset): CompetencyOverviewRow[] {
  const ratersByGroup = groupRatersByGroup(dataset.raters);
  const scoredItems = dataset.items.filter((i) => !i.isIntegrityItem);
  const competencyNumbers = [...new Set(scoredItems.map((i) => i.competencyNumber))].sort(
    (a, b) => a - b,
  );

  const rows = competencyNumbers.map((competencyNumber): CompetencyOverviewRow => {
    const itemIds = scoredItems
      .filter((i) => i.competencyNumber === competencyNumber)
      .map((i) => i.id);

    const selfStats = competencyGroupMean(dataset.responses, itemIds, ratersByGroup.self);
    const managerStats = competencyGroupMean(dataset.responses, itemIds, ratersByGroup.manager);
    const peerStats = competencyGroupMean(dataset.responses, itemIds, ratersByGroup.peer);
    const directReportStats = competencyGroupMean(
      dataset.responses,
      itemIds,
      ratersByGroup.direct_report,
    );
    const otherStats = competencyGroupMean(dataset.responses, itemIds, ratersByGroup.other);

    const otherGroupMeans = [peerStats.mean, directReportStats.mean, otherStats.mean].filter(
      (m): m is number => m !== null,
    );
    const allOthers =
      otherGroupMeans.length > 0
        ? otherGroupMeans.reduce((sum, m) => sum + m, 0) / otherGroupMeans.length
        : null;

    return {
      competencyNumber,
      self: selfStats.mean,
      manager: managerStats.mean,
      allOthers,
    };
  });

  return rows.sort((a, b) => {
    if (a.allOthers === null && b.allOthers === null) return a.competencyNumber - b.competencyNumber;
    if (a.allOthers === null) return 1;
    if (b.allOthers === null) return -1;
    if (b.allOthers !== a.allOthers) return b.allOthers - a.allOthers;
    return a.competencyNumber - b.competencyNumber;
  });
}

import { itemGroupMean, groupRatersByGroup } from "./means";
import { ALL_RATER_GROUPS, type RaterGroup, type ScoringDataset } from "./types";

export interface ItemAppendixGroupStats {
  mean: number | null;
  n: number;
}

export interface ItemAppendixRow {
  itemId: string;
  competencyNumber: number;
  itemNumber: number;
  groups: Record<RaterGroup, ItemAppendixGroupStats>;
  /** Count of raters who were asked this item and marked "not able to
   * comment", across every group. */
  notAbleToCommentCount: number;
}

/**
 * Every scored item, raw per-group mean and n, with no anonymity threshold
 * or merge — the report template describes this appendix ("needed for
 * credibility... and item-variance review") without invoking the n>=3 rule
 * it explicitly cites for every other section, so it's treated as an
 * internal/methodological page rather than a leader-facing narrative one.
 */
export function computeItemLevelAppendix(dataset: ScoringDataset): ItemAppendixRow[] {
  const ratersByGroup = groupRatersByGroup(dataset.raters);
  const scoredItems = dataset.items.filter((i) => !i.isIntegrityItem);

  return scoredItems
    .map((item): ItemAppendixRow => {
      const groups = {} as Record<RaterGroup, ItemAppendixGroupStats>;
      for (const group of ALL_RATER_GROUPS) {
        groups[group] = itemGroupMean(dataset.responses, item.id, ratersByGroup[group]);
      }

      const notAbleToCommentCount = dataset.responses.filter(
        (r) => r.itemId === item.id && r.scaleValue === null,
      ).length;

      return {
        itemId: item.id,
        competencyNumber: item.competencyNumber,
        itemNumber: item.itemNumber,
        groups,
        notAbleToCommentCount,
      };
    })
    .sort((a, b) => a.competencyNumber - b.competencyNumber || a.itemNumber - b.itemNumber);
}

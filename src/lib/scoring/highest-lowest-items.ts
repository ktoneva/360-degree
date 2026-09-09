import { itemAllOthersMean, groupRatersByGroup, round1 } from "./means";
import type { ScoringDataset } from "./types";

export interface RankedItemMean {
  itemId: string;
  competencyNumber: number;
  itemNumber: number;
  allOthersMean: number;
}

export interface HighestLowestItems {
  /** Up to 5 items, highest all-others mean first. */
  highest: RankedItemMean[];
  /** Up to 5 items, lowest all-others mean first. */
  lowest: RankedItemMean[];
}

interface RankedInternal extends RankedItemMean {
  rawMean: number;
  totalRealRatings: number;
}

function tieBreak(a: RankedInternal, b: RankedInternal): number {
  if (b.totalRealRatings !== a.totalRealRatings) return b.totalRealRatings - a.totalRealRatings;
  if (a.competencyNumber !== b.competencyNumber) return a.competencyNumber - b.competencyNumber;
  return a.itemNumber - b.itemNumber;
}

function strip({ itemId, competencyNumber, itemNumber, allOthersMean }: RankedInternal): RankedItemMean {
  return { itemId, competencyNumber, itemNumber, allOthersMean };
}

/**
 * The five highest and five lowest items across the whole bank by all-others
 * mean (report template section 7). Uses the same item-level all-others
 * figure as blind spots/hidden strengths — including its n>=3 merge rule —
 * since "all-others mean" is a single consistent concept throughout the
 * report, not a separate calculation. Self is not part of this comparison.
 * An item with no reportable all-others mean is excluded rather than shown
 * as insufficient; the spec doesn't define a tie-break for this section, so
 * it reuses the same deterministic one as blind spots (more real ratings
 * behind the figure, then lower competency, then lower item number).
 */
export function computeHighestLowestItems(dataset: ScoringDataset): HighestLowestItems {
  const ratersByGroup = groupRatersByGroup(dataset.raters);
  const scoredItems = dataset.items.filter((i) => !i.isIntegrityItem);

  const ranked: RankedInternal[] = [];
  for (const item of scoredItems) {
    const result = itemAllOthersMean(dataset.responses, item.id, ratersByGroup);
    if (result.mean === null) continue;
    ranked.push({
      itemId: item.id,
      competencyNumber: item.competencyNumber,
      itemNumber: item.itemNumber,
      allOthersMean: round1(result.mean),
      rawMean: result.mean,
      totalRealRatings: result.totalRealRatings,
    });
  }

  const highest = [...ranked]
    .sort((a, b) => (b.rawMean !== a.rawMean ? b.rawMean - a.rawMean : tieBreak(a, b)))
    .slice(0, 5)
    .map(strip);

  const lowest = [...ranked]
    .sort((a, b) => (a.rawMean !== b.rawMean ? a.rawMean - b.rawMean : tieBreak(a, b)))
    .slice(0, 5)
    .map(strip);

  return { highest, lowest };
}

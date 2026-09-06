import { itemAllOthersMean, itemGroupMean, groupRatersByGroup, round1 } from "./means";
import type { ScoringDataset } from "./types";

export interface GapItemResult {
  itemId: string;
  competencyNumber: number;
  itemNumber: number;
  selfMean: number;
  allOthersMean: number;
  /** Rounded to 1 decimal place, in the direction of the gap (always positive). */
  gap: number;
}

type Direction = "blind_spot" | "hidden_strength";

function computeGapItems(dataset: ScoringDataset, direction: Direction, cap: number | null): GapItemResult[] {
  const ratersByGroup = groupRatersByGroup(dataset.raters);
  const scoredItems = dataset.items.filter((i) => !i.isIntegrityItem);

  const candidates: (GapItemResult & { rawGap: number; totalRealRatings: number })[] = [];

  for (const item of scoredItems) {
    // Step 1 (eligibility): self must have a real rating, and there must be a
    // reportable all-others mean — folded into the checks below rather than
    // tested separately, since "reportable" is exactly what itemAllOthersMean
    // already determines.
    const selfResult = itemGroupMean(dataset.responses, item.id, ratersByGroup.self);
    if (selfResult.n === 0) continue;
    const selfMean = selfResult.mean!;

    const allOthers = itemAllOthersMean(dataset.responses, item.id, ratersByGroup);
    if (allOthers.mean === null) continue;

    const rawGap = direction === "blind_spot" ? selfMean - allOthers.mean : allOthers.mean - selfMean;
    if (rawGap < 1.0) continue;

    candidates.push({
      itemId: item.id,
      competencyNumber: item.competencyNumber,
      itemNumber: item.itemNumber,
      selfMean: round1(selfMean),
      allOthersMean: round1(allOthers.mean),
      gap: round1(rawGap),
      rawGap,
      totalRealRatings: allOthers.totalRealRatings,
    });
  }

  // Step 8/9: sort by the unrounded gap descending; ties broken by more
  // real ratings behind the all-others figure, then lower competency number,
  // then lower item number.
  candidates.sort((a, b) => {
    if (b.rawGap !== a.rawGap) return b.rawGap - a.rawGap;
    if (b.totalRealRatings !== a.totalRealRatings) return b.totalRealRatings - a.totalRealRatings;
    if (a.competencyNumber !== b.competencyNumber) return a.competencyNumber - b.competencyNumber;
    return a.itemNumber - b.itemNumber;
  });

  const capped = cap === null ? candidates : candidates.slice(0, cap);
  return capped.map(({ itemId, competencyNumber, itemNumber, selfMean, allOthersMean, gap }) => ({
    itemId,
    competencyNumber,
    itemNumber,
    selfMean,
    allOthersMean,
    gap,
  }));
}

/** Self rating exceeds the all-others mean by >=1.0 (unrounded). Capped at 8. */
export function computeBlindSpots(dataset: ScoringDataset): GapItemResult[] {
  return computeGapItems(dataset, "blind_spot", 8);
}

/** All-others mean exceeds self by >=1.0 (unrounded). Identical rules in
 * reverse, but never capped — always shown in full. */
export function computeHiddenStrengths(dataset: ScoringDataset): GapItemResult[] {
  return computeGapItems(dataset, "hidden_strength", null);
}

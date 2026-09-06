import type { ScoringDataset } from "./types";

export interface SafeguardingItemCounts {
  itemId: string;
  itemNumber: number;
  yes: number;
  no: number;
  notObserved: number;
}

/**
 * Items 7.5 and 7.6 as plain yes/no/not-observed counts. No mean, no
 * benchmark, ever — and no rater-group breakdown or anonymity threshold;
 * the report template treats this as a flat integrity check, not a scored
 * or grouped page.
 */
export function computeSafeguardingCounts(dataset: ScoringDataset): SafeguardingItemCounts[] {
  return dataset.items
    .filter((item) => item.isIntegrityItem)
    .map((item) => {
      let yes = 0;
      let no = 0;
      let notObserved = 0;
      for (const response of dataset.responses) {
        if (response.itemId !== item.id) continue;
        if (response.integrityValue === "yes") yes++;
        else if (response.integrityValue === "no") no++;
        else if (response.integrityValue === "not_observed") notObserved++;
      }
      return { itemId: item.id, itemNumber: item.itemNumber, yes, no, notObserved };
    })
    .sort((a, b) => a.itemNumber - b.itemNumber);
}

import type { RaterGroup, ScoringDataset, ScoringItem, ScoringRater, ScoringResponse } from "./types";

/** Minimal item bank for tests: competency 1 has one scored item; competency
 * 7 has one scored item plus the two integrity items (7.5/7.6 pattern). */
export const ITEM_C1: ScoringItem = { id: "c1i1", competencyNumber: 1, itemNumber: 1, isIntegrityItem: false };
export const ITEM_C1_B: ScoringItem = { id: "c1i2", competencyNumber: 1, itemNumber: 2, isIntegrityItem: false };
export const ITEM_C7: ScoringItem = { id: "c7i1", competencyNumber: 7, itemNumber: 1, isIntegrityItem: false };
export const ITEM_C7_SAFE_A: ScoringItem = { id: "c7i5", competencyNumber: 7, itemNumber: 5, isIntegrityItem: true };
export const ITEM_C7_SAFE_B: ScoringItem = { id: "c7i6", competencyNumber: 7, itemNumber: 6, isIntegrityItem: true };

export const DEFAULT_ITEMS: ScoringItem[] = [ITEM_C1, ITEM_C1_B, ITEM_C7, ITEM_C7_SAFE_A, ITEM_C7_SAFE_B];

let raterCounter = 0;

export function makeRater(group: RaterGroup): ScoringRater {
  raterCounter += 1;
  return { id: `${group}-${raterCounter}`, group };
}

export function makeRaters(group: RaterGroup, count: number): ScoringRater[] {
  return Array.from({ length: count }, () => makeRater(group));
}

export function scaleResponse(raterId: string, itemId: string, scaleValue: number | null): ScoringResponse {
  return { raterId, itemId, scaleValue, integrityValue: null };
}

export function integrityResponse(
  raterId: string,
  itemId: string,
  integrityValue: "yes" | "no" | "not_observed",
): ScoringResponse {
  return { raterId, itemId, scaleValue: null, integrityValue };
}

/** Gives every rater the same scale rating on the same item. */
export function ratersAllScore(raters: ScoringRater[], itemId: string, value: number): ScoringResponse[] {
  return raters.map((r) => scaleResponse(r.id, itemId, value));
}

export function buildDataset(overrides: Partial<ScoringDataset> = {}): ScoringDataset {
  return {
    items: DEFAULT_ITEMS,
    raters: [],
    responses: [],
    nominations: [],
    ...overrides,
  };
}

export function resetRaterCounter() {
  raterCounter = 0;
}

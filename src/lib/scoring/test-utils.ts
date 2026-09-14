import { ALL_RATER_GROUPS, type RaterGroup, type ScoringDataset, type ScoringItem, type ScoringRater, type ScoringResponse } from "./types";

/** Minimal item bank for tests: competency 1 has one scored item; competency
 * 7 has one scored item plus the two integrity items (7.5/7.6 pattern). Every
 * default item is asked of every rater group, so existing suites that never
 * mention applicability keep behaving exactly as before -- tests that need a
 * restricted askedRaterGroups build their own item via `itemFor`. */
export const ITEM_C1: ScoringItem = { id: "c1i1", competencyNumber: 1, itemNumber: 1, isIntegrityItem: false, askedRaterGroups: ALL_RATER_GROUPS };
export const ITEM_C1_B: ScoringItem = { id: "c1i2", competencyNumber: 1, itemNumber: 2, isIntegrityItem: false, askedRaterGroups: ALL_RATER_GROUPS };
export const ITEM_C2: ScoringItem = { id: "c2i1", competencyNumber: 2, itemNumber: 1, isIntegrityItem: false, askedRaterGroups: ALL_RATER_GROUPS };
export const ITEM_C7: ScoringItem = { id: "c7i1", competencyNumber: 7, itemNumber: 1, isIntegrityItem: false, askedRaterGroups: ALL_RATER_GROUPS };
export const ITEM_C7_SAFE_A: ScoringItem = { id: "c7i5", competencyNumber: 7, itemNumber: 5, isIntegrityItem: true, askedRaterGroups: ALL_RATER_GROUPS };
export const ITEM_C7_SAFE_B: ScoringItem = { id: "c7i6", competencyNumber: 7, itemNumber: 6, isIntegrityItem: true, askedRaterGroups: ALL_RATER_GROUPS };

/** Builds a one-off item asked only of the given groups, for tests of the
 * not-applicable-vs-suppressed distinction. */
export function itemFor(
  id: string,
  competencyNumber: number,
  itemNumber: number,
  askedRaterGroups: RaterGroup[],
): ScoringItem {
  return { id, competencyNumber, itemNumber, isIntegrityItem: false, askedRaterGroups };
}

// ITEM_C2 is deliberately not part of DEFAULT_ITEMS -- every other scoring
// suite builds datasets against the default set without overriding it, so
// adding a 4th real item here would silently introduce a zero-response item
// into their results. Tests that need a 4th distinct item pass it via
// buildDataset({ items: [...] }) explicitly.
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

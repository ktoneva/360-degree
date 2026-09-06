import { beforeEach, describe, expect, it } from "vitest";
import { computeBlindSpots, computeHiddenStrengths } from "./blind-spots";
import { ITEM_C1, buildDataset, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";
import type { ScoringItem } from "./types";

beforeEach(() => resetRaterCounter());

function itemBank(count: number): ScoringItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    competencyNumber: 1,
    itemNumber: i + 1,
    isIntegrityItem: false,
  }));
}

describe("computeBlindSpots", () => {
  it("flags an item when self exceeds all-others by exactly the 1.0 threshold", () => {
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(self[0].id, ITEM_C1.id, 5),
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 4)), // gap exactly 1.0
    ];
    const result = computeBlindSpots(buildDataset({ raters: [...self, ...peers], responses }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ selfMean: 5, allOthersMean: 4, gap: 1 });
  });

  it("does not flag a gap just under the threshold", () => {
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(self[0].id, ITEM_C1.id, 4.9),
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 4)),
    ];
    const result = computeBlindSpots(buildDataset({ raters: [...self, ...peers], responses }));
    expect(result).toEqual([]);
  });

  it("tests the threshold on the unrounded gap, not the rounded display figures", () => {
    // self 4.95 rounds to 5.0 for display; others is 4.0. A naive
    // round-then-subtract check would read (5.0 - 4.0 = 1.0) and wrongly
    // qualify this item. The real unrounded gap is only 0.95, so it must not.
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(self[0].id, ITEM_C1.id, 4.95),
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 4)),
    ];
    const result = computeBlindSpots(buildDataset({ raters: [...self, ...peers], responses }));
    expect(result).toEqual([]);
  });

  it("is ineligible when self did not give a real rating on the item", () => {
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(self[0].id, ITEM_C1.id, null), // not able to comment
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 1)),
    ];
    const result = computeBlindSpots(buildDataset({ raters: [...self, ...peers], responses }));
    expect(result).toEqual([]);
  });

  it("is ineligible when there is no reportable all-others mean (colleagues under n=3, unmerged)", () => {
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 2); // under 3, and nothing else to merge with
    const responses = [
      scaleResponse(self[0].id, ITEM_C1.id, 6),
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 1)),
    ];
    const result = computeBlindSpots(buildDataset({ raters: [...self, ...peers], responses }));
    expect(result).toEqual([]);
  });

  it("never includes the manager in the all-others figure", () => {
    const self = makeRaters("self", 1);
    const manager = makeRaters("manager", 1);
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(self[0].id, ITEM_C1.id, 5),
      scaleResponse(manager[0].id, ITEM_C1.id, 6), // would cancel the gap if it counted
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 4)),
    ];
    const result = computeBlindSpots(
      buildDataset({ raters: [...self, ...manager, ...peers], responses }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].allOthersMean).toBe(4); // manager's 6 excluded
  });

  it("returns an empty array when nothing clears the threshold", () => {
    const result = computeBlindSpots(buildDataset());
    expect(result).toEqual([]);
  });

  it("caps at 8 items, keeping the largest gaps", () => {
    const items = itemBank(10);
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    const raters = [...self, ...peers];
    const responses = items.flatMap((item, i) => [
      scaleResponse(self[0].id, item.id, 6),
      // Vary the gap per item so ranking is unambiguous: item 1 has the
      // biggest gap, item 10 the smallest (but all still >= 1.0).
      ...peers.map((p) => scaleResponse(p.id, item.id, 6 - (10 - i) * 0.1 - 1)),
    ]);
    const result = computeBlindSpots(buildDataset({ items, raters, responses }));
    expect(result).toHaveLength(8);
    expect(result[0].itemNumber).toBe(1); // largest gap first
    expect(result.map((r) => r.itemNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("tie-breaks equal gaps by more real ratings behind all-others, then lower item number", () => {
    const items = itemBank(2);
    const self = makeRaters("self", 1);
    const peersA = makeRaters("peer", 3); // 3 ratings behind item 1
    const peersB = makeRaters("peer", 4); // 4 ratings behind item 2
    const raters = [...self, ...peersA, ...peersB];
    const responses = [
      scaleResponse(self[0].id, items[0].id, 5),
      ...peersA.map((p) => scaleResponse(p.id, items[0].id, 4)), // gap 1.0, n=3
      scaleResponse(self[0].id, items[1].id, 5),
      ...peersB.map((p) => scaleResponse(p.id, items[1].id, 4)), // gap 1.0, n=4
    ];
    const result = computeBlindSpots(buildDataset({ items, raters, responses }));
    expect(result.map((r) => r.itemNumber)).toEqual([2, 1]); // item 2's larger n ranks first
  });
});

describe("computeHiddenStrengths", () => {
  it("flags the reverse gap: all-others exceeds self by >=1.0", () => {
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(self[0].id, ITEM_C1.id, 3),
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 4.5)),
    ];
    const result = computeHiddenStrengths(buildDataset({ raters: [...self, ...peers], responses }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ selfMean: 3, allOthersMean: 4.5, gap: 1.5 });
  });

  it("is never capped, even with more than 8 qualifying items", () => {
    const items = itemBank(9);
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    const raters = [...self, ...peers];
    const responses = items.flatMap((item) => [
      scaleResponse(self[0].id, item.id, 1),
      ...peers.map((p) => scaleResponse(p.id, item.id, 6)),
    ]);
    const result = computeHiddenStrengths(buildDataset({ items, raters, responses }));
    expect(result).toHaveLength(9);
  });

  it("returns an empty array when nothing clears the threshold", () => {
    const result = computeHiddenStrengths(buildDataset());
    expect(result).toEqual([]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { computeHighestLowestItems } from "./highest-lowest-items";
import { buildDataset, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";
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

describe("computeHighestLowestItems", () => {
  it("ranks highest descending and lowest ascending by all-others mean", () => {
    const items = itemBank(3);
    const peers = makeRaters("peer", 3);
    const responses = [
      ...peers.map((p) => scaleResponse(p.id, items[0].id, 5)),
      ...peers.map((p) => scaleResponse(p.id, items[1].id, 3)),
      ...peers.map((p) => scaleResponse(p.id, items[2].id, 1)),
    ];
    const result = computeHighestLowestItems(buildDataset({ items, raters: peers, responses }));

    expect(result.highest.map((r) => r.itemNumber)).toEqual([1, 2, 3]);
    expect(result.lowest.map((r) => r.itemNumber)).toEqual([3, 2, 1]);
  });

  it("excludes items with no reportable all-others mean (under n=3, unmerged)", () => {
    const items = itemBank(1);
    const peers = makeRaters("peer", 2); // under 3, nothing to merge with
    const responses = peers.map((p) => scaleResponse(p.id, items[0].id, 5));
    const result = computeHighestLowestItems(buildDataset({ items, raters: peers, responses }));
    expect(result.highest).toEqual([]);
    expect(result.lowest).toEqual([]);
  });

  it("caps each list at 5 even when more items qualify", () => {
    const items = itemBank(15);
    const peers = makeRaters("peer", 3);
    const responses = items.flatMap((item, i) => peers.map((p) => scaleResponse(p.id, item.id, 1 + (i % 5))));
    const result = computeHighestLowestItems(buildDataset({ items, raters: peers, responses }));
    expect(result.highest).toHaveLength(5);
    expect(result.lowest).toHaveLength(5);
  });

  it("does not require self to have rated the item, unlike blind spots", () => {
    const items = itemBank(1);
    const peers = makeRaters("peer", 3);
    // No self rater at all in this dataset.
    const responses = peers.map((p) => scaleResponse(p.id, items[0].id, 4));
    const result = computeHighestLowestItems(buildDataset({ items, raters: peers, responses }));
    expect(result.highest).toHaveLength(1);
  });

  it("returns empty lists when nothing is reportable", () => {
    const result = computeHighestLowestItems(buildDataset());
    expect(result).toEqual({ highest: [], lowest: [] });
  });
});

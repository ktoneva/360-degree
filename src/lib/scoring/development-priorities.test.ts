import { beforeEach, describe, expect, it } from "vitest";
import { computeDevelopmentPriorities } from "./development-priorities";
import { ITEM_C1, ITEM_C1_B, ITEM_C7, buildDataset, makeRaters, resetRaterCounter } from "./test-utils";
import type { ScoringItem, ScoringNomination } from "./types";

beforeEach(() => resetRaterCounter());

function nominate(raterId: string, ...itemIds: string[]): ScoringNomination[] {
  return itemIds.map((itemId) => ({ raterId, itemId }));
}

describe("computeDevelopmentPriorities", () => {
  it("excludes a rater's nominations entirely if they only submitted 1 of 2", () => {
    const peers = makeRaters("peer", 3);
    const nominations = [
      ...nominate(peers[0].id, ITEM_C1.id, ITEM_C1_B.id), // complete
      ...nominate(peers[1].id, ITEM_C1.id), // incomplete: only 1
      ...nominate(peers[2].id, ITEM_C1.id, ITEM_C1_B.id), // complete
    ];
    const result = computeDevelopmentPriorities(buildDataset({ raters: peers, nominations }));
    const item1 = result.find((r) => r.itemId === ITEM_C1.id)!;
    // Only the 2 complete peers count; peer[1]'s single pick doesn't count
    // even partially toward item 1's total.
    expect(item1.totalColleagueNominations).toBe(2);
  });

  it("weighs 1st and 2nd priority identically", () => {
    const peers = makeRaters("peer", 3);
    const nominations = peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id));
    const result = computeDevelopmentPriorities(buildDataset({ raters: peers, nominations }));
    const item1 = result.find((r) => r.itemId === ITEM_C1.id)!;
    const item2 = result.find((r) => r.itemId === ITEM_C1_B.id)!;
    expect(item1.totalColleagueNominations).toBe(3);
    expect(item2.totalColleagueNominations).toBe(3);
  });

  it("reports groups separately once every group individually clears n>=3", () => {
    const peers = makeRaters("peer", 3);
    const directReports = makeRaters("direct_report", 3);
    const others = makeRaters("other", 3);
    const raters = [...peers, ...directReports, ...others];
    const nominations = [
      ...peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id)),
      // All 3 direct reports complete their forced choice (so the group is
      // safe on its own), but only 1 of them actually nominates ITEM_C1 —
      // the other 2 nominate a different pair of items entirely.
      ...nominate(directReports[0].id, ITEM_C1.id, ITEM_C1_B.id),
      ...nominate(directReports[1].id, ITEM_C1_B.id, ITEM_C7.id),
      ...nominate(directReports[2].id, ITEM_C1_B.id, ITEM_C7.id),
      ...others.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id)),
    ];
    const result = computeDevelopmentPriorities(buildDataset({ raters, nominations }));
    const item1 = result.find((r) => r.itemId === ITEM_C1.id)!;
    expect(item1.breakdown).toEqual({ mode: "separate", peer: 3, directReport: 1, other: 3 });
  });

  it("merges an under-3 group into allColleagues when the merged pool clears n>=3", () => {
    const peers = makeRaters("peer", 1); // under 3
    const directReports = makeRaters("direct_report", 2); // under 3
    const others = makeRaters("other", 3); // safe
    const raters = [...peers, ...directReports, ...others];
    const nominations = [
      ...peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id)),
      ...directReports.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id)),
      ...others.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id)),
    ];
    const [item1] = computeDevelopmentPriorities(buildDataset({ raters, nominations }));
    // 1 peer + 2 direct reports = 3 complete people merged.
    expect(item1.breakdown).toEqual({
      mode: "partial_merge",
      separate: { other: 3 },
      allColleagues: 3,
    });
    expect(item1.totalColleagueNominations).toBe(6);
  });

  it("falls back to one ungrouped total per item when the merged pool still falls short", () => {
    const peers = makeRaters("peer", 1);
    const directReports = makeRaters("direct_report", 1);
    const raters = [...peers, ...directReports];
    const nominations = [
      ...peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id)),
      ...directReports.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id)),
    ];
    const [item1] = computeDevelopmentPriorities(buildDataset({ raters, nominations }));
    expect(item1.breakdown).toEqual({ mode: "merge_failed" });
    expect(item1.totalColleagueNominations).toBe(2); // still counted, just not attributed
  });

  it("decides the group mode once for the whole section, tested only on complete submissions", () => {
    const peers = makeRaters("peer", 3);
    // Only 2 of the 3 peers actually complete their forced choice; the 3rd
    // submits just one pick, which must not count toward the n>=3 headcount.
    const nominations = [
      ...nominate(peers[0].id, ITEM_C1.id, ITEM_C1_B.id),
      ...nominate(peers[1].id, ITEM_C1.id, ITEM_C1_B.id),
      ...nominate(peers[2].id, ITEM_C1.id),
    ];
    const [item1] = computeDevelopmentPriorities(buildDataset({ raters: peers, nominations }));
    expect(item1.breakdown).toMatchObject({ mode: "merge_failed" });
  });

  it("tracks self and manager as separate yes/no flags, unaffected by merge status", () => {
    const self = makeRaters("self", 1);
    const manager = makeRaters("manager", 1);
    // A colleague nomination is needed too, or the item is dropped entirely
    // by the zero-colleague-nominations filter before self/manager flags
    // would even be visible.
    const peers = makeRaters("peer", 3);
    const nominations = [
      ...nominate(self[0].id, ITEM_C1.id, ITEM_C1_B.id),
      ...nominate(manager[0].id, ITEM_C1_B.id, ITEM_C1.id),
      ...peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id)),
    ];
    const result = computeDevelopmentPriorities(
      buildDataset({ raters: [...self, ...manager, ...peers], nominations }),
    );
    const item1 = result.find((r) => r.itemId === ITEM_C1.id)!;
    expect(item1.selfNominated).toBe(true);
    expect(item1.managerNominated).toBe(true);
  });

  it("drops an item entirely if only self/manager nominated it, even with zero colleague nominations", () => {
    const self = makeRaters("self", 1);
    const nominations = nominate(self[0].id, ITEM_C1.id, ITEM_C1_B.id);
    const result = computeDevelopmentPriorities(buildDataset({ raters: self, nominations }));
    expect(result).toEqual([]);
  });

  it("a group with zero raters invited doesn't force a merge on otherwise-healthy groups", () => {
    // Only peers exist for this cycle (no direct reports or others were ever
    // invited) — that must not push everything into "merge_failed".
    const peers = makeRaters("peer", 3);
    const nominations = peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id));
    const [item1] = computeDevelopmentPriorities(buildDataset({ raters: peers, nominations }));
    expect(item1.breakdown).toEqual({ mode: "separate", peer: 3, directReport: 0, other: 0 });
  });

  it("an incomplete self/manager submission doesn't flag any item", () => {
    const self = makeRaters("self", 1);
    const nominations = nominate(self[0].id, ITEM_C1.id); // only 1 pick
    const result = computeDevelopmentPriorities(buildDataset({ raters: self, nominations }));
    const item1 = result.find((r) => r.itemId === ITEM_C1.id);
    expect(item1?.selfNominated).not.toBe(true);
  });

  it("drops zero-nomination items before ranking, and returns an empty array when nobody completed the forced choice", () => {
    const result = computeDevelopmentPriorities(buildDataset());
    expect(result).toEqual([]);
  });

  it("caps at the top 10 items by colleague nomination count", () => {
    // 15 independent (item, junk-partner) pairs, each voted on by its own
    // disjoint set of peers, so counts don't interact across pairs. Pair i
    // gets (16 - i) voters, giving 15 distinct count levels with 2 items
    // (the real item and its junk partner) tied at each level. Taking the
    // top 5 count levels lands on exactly 10 items with no boundary tie.
    const items: ScoringItem[] = [];
    const raters: ReturnType<typeof makeRaters> = [];
    const nominations: ScoringNomination[] = [];

    for (let i = 1; i <= 15; i++) {
      const realItem: ScoringItem = { id: `real-${i}`, competencyNumber: 1, itemNumber: i, isIntegrityItem: false };
      const junkItem: ScoringItem = { id: `junk-${i}`, competencyNumber: 2, itemNumber: i, isIntegrityItem: false };
      items.push(realItem, junkItem);

      const voterCount = 16 - i; // pair 1 -> 15 voters, pair 15 -> 1 voter
      const voters = makeRaters("peer", voterCount);
      raters.push(...voters);
      voters.forEach((v) => nominations.push(...nominate(v.id, realItem.id, junkItem.id)));
    }

    const result = computeDevelopmentPriorities(buildDataset({ items, raters, nominations }));

    expect(result).toHaveLength(10);
    for (let i = 1; i <= 5; i++) {
      expect(result.some((r) => r.itemId === `real-${i}`)).toBe(true);
    }
    for (let i = 6; i <= 15; i++) {
      expect(result.some((r) => r.itemId === `real-${i}`)).toBe(false);
    }
  });

  it("excludes integrity items from eligibility even if somehow nominated", () => {
    const peers = makeRaters("peer", 3);
    const items: ScoringItem[] = [
      { id: "safe-item", competencyNumber: 7, itemNumber: 5, isIntegrityItem: true },
      ITEM_C1,
    ];
    const nominations = peers.flatMap((p) => nominate(p.id, "safe-item", ITEM_C1.id));
    const result = computeDevelopmentPriorities(buildDataset({ items, raters: peers, nominations }));
    expect(result.find((r) => r.itemId === "safe-item")).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { computeDevelopmentPriorities } from "./development-priorities";
import {
  ITEM_C1,
  ITEM_C1_B,
  ITEM_C2,
  ITEM_C7,
  buildDataset,
  makeRaters,
  resetRaterCounter,
} from "./test-utils";
import type { ScoringItem, ScoringNomination } from "./types";

beforeEach(() => resetRaterCounter());

function nominate(raterId: string, ...itemIds: string[]): ScoringNomination[] {
  return itemIds.map((itemId) => ({ raterId, itemId }));
}

describe("computeDevelopmentPriorities", () => {
  it("excludes a rater's nominations entirely if they only submitted 2 of the required 3", () => {
    const peers = makeRaters("peer", 3);
    const nominations = [
      ...nominate(peers[0].id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id), // complete
      ...nominate(peers[1].id, ITEM_C1.id, ITEM_C1_B.id), // incomplete: only 2 of 3
      ...nominate(peers[2].id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id), // complete
    ];
    const result = computeDevelopmentPriorities(buildDataset({ raters: peers, nominations }));
    const item1 = result.find((r) => r.itemId === ITEM_C1.id)!;
    // Only the 2 complete peers count; peer[1]'s 2 picks don't count even
    // partially toward item 1's total.
    expect(item1.totalColleagueNominations).toBe(2);
  });

  it("weighs 1st, 2nd and 3rd priority identically", () => {
    const peers = makeRaters("peer", 3);
    const nominations = peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id));
    const result = computeDevelopmentPriorities(buildDataset({ raters: peers, nominations }));
    const item1 = result.find((r) => r.itemId === ITEM_C1.id)!;
    const item2 = result.find((r) => r.itemId === ITEM_C1_B.id)!;
    const item3 = result.find((r) => r.itemId === ITEM_C7.id)!;
    expect(item1.totalColleagueNominations).toBe(3);
    expect(item2.totalColleagueNominations).toBe(3);
    expect(item3.totalColleagueNominations).toBe(3);
  });

  it("reports groups separately once every group individually clears n>=3", () => {
    const items: ScoringItem[] = [ITEM_C1, ITEM_C1_B, ITEM_C2, ITEM_C7];
    const peers = makeRaters("peer", 3);
    const directReports = makeRaters("direct_report", 3);
    const others = makeRaters("other", 3);
    const raters = [...peers, ...directReports, ...others];
    const nominations = [
      ...peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id)),
      // All 3 direct reports complete their forced choice (so the group is
      // safe on its own), but only 1 of them actually nominates ITEM_C1 —
      // the other 2 nominate a different trio entirely.
      ...nominate(directReports[0].id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id),
      ...nominate(directReports[1].id, ITEM_C1_B.id, ITEM_C7.id, ITEM_C2.id),
      ...nominate(directReports[2].id, ITEM_C1_B.id, ITEM_C7.id, ITEM_C2.id),
      ...others.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id)),
    ];
    const result = computeDevelopmentPriorities(buildDataset({ items, raters, nominations }));
    const item1 = result.find((r) => r.itemId === ITEM_C1.id)!;
    expect(item1.breakdown).toEqual({ mode: "separate", peer: 3, directReport: 1, other: 3 });
  });

  it("merges an under-3 group into allColleagues when the merged pool clears n>=3", () => {
    const peers = makeRaters("peer", 1); // under 3
    const directReports = makeRaters("direct_report", 2); // under 3
    const others = makeRaters("other", 3); // safe
    const raters = [...peers, ...directReports, ...others];
    const nominations = [
      ...peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id)),
      ...directReports.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id)),
      ...others.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id)),
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
      ...peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id)),
      ...directReports.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id)),
    ];
    const [item1] = computeDevelopmentPriorities(buildDataset({ raters, nominations }));
    expect(item1.breakdown).toEqual({ mode: "merge_failed" });
    expect(item1.totalColleagueNominations).toBe(2); // still counted, just not attributed
  });

  it("decides the group mode once for the whole section, tested only on complete submissions", () => {
    const peers = makeRaters("peer", 3);
    // Only 2 of the 3 peers actually complete their forced choice; the 3rd
    // submits only 2 of the required 3, which must not count toward the
    // n>=3 headcount.
    const nominations = [
      ...nominate(peers[0].id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id),
      ...nominate(peers[1].id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id),
      ...nominate(peers[2].id, ITEM_C1.id, ITEM_C1_B.id),
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
      ...nominate(self[0].id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id),
      ...nominate(manager[0].id, ITEM_C1_B.id, ITEM_C1.id, ITEM_C7.id),
      ...peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id)),
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
    const nominations = nominate(self[0].id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id);
    const result = computeDevelopmentPriorities(buildDataset({ raters: self, nominations }));
    expect(result).toEqual([]);
  });

  it("a group with zero raters invited doesn't force a merge on otherwise-healthy groups", () => {
    // Only peers exist for this cycle (no direct reports or others were ever
    // invited) — that must not push everything into "merge_failed".
    const peers = makeRaters("peer", 3);
    const nominations = peers.flatMap((p) => nominate(p.id, ITEM_C1.id, ITEM_C1_B.id, ITEM_C7.id));
    const [item1] = computeDevelopmentPriorities(buildDataset({ raters: peers, nominations }));
    expect(item1.breakdown).toEqual({ mode: "separate", peer: 3, directReport: 0, other: 0 });
  });

  it("an incomplete self/manager submission doesn't flag any item", () => {
    const self = makeRaters("self", 1);
    const nominations = nominate(self[0].id, ITEM_C1.id, ITEM_C1_B.id); // only 2 of 3
    const result = computeDevelopmentPriorities(buildDataset({ raters: self, nominations }));
    const item1 = result.find((r) => r.itemId === ITEM_C1.id);
    expect(item1?.selfNominated).not.toBe(true);
  });

  it("drops zero-nomination items before ranking, and returns an empty array when nobody completed the forced choice", () => {
    const result = computeDevelopmentPriorities(buildDataset());
    expect(result).toEqual([]);
  });

  it("caps at the top 10 items by colleague nomination count", () => {
    // 12 real items with strictly decreasing, distinct vote counts (12 down
    // to 1) so the rank-10 boundary is never ambiguous. Each voter's other 2
    // required picks are unique junk items nobody else ever nominates, so
    // every junk item tops out at count 1 -- never enough to outrank a real
    // item with 2+ voters, and irrelevant to where the top-10 cutoff falls.
    const items: ScoringItem[] = [];
    const raters: ReturnType<typeof makeRaters> = [];
    const nominations: ScoringNomination[] = [];
    let junkCounter = 0;

    for (let i = 1; i <= 12; i++) {
      const realItem: ScoringItem = { id: `real-${i}`, competencyNumber: 1, itemNumber: i, isIntegrityItem: false };
      items.push(realItem);

      const voterCount = 13 - i; // real-1 -> 12 voters, real-12 -> 1 voter
      const voters = makeRaters("peer", voterCount);
      raters.push(...voters);
      voters.forEach((v) => {
        junkCounter += 1;
        const junkA: ScoringItem = { id: `junkA-${junkCounter}`, competencyNumber: 2, itemNumber: junkCounter, isIntegrityItem: false };
        const junkB: ScoringItem = { id: `junkB-${junkCounter}`, competencyNumber: 3, itemNumber: junkCounter, isIntegrityItem: false };
        items.push(junkA, junkB);
        nominations.push(...nominate(v.id, realItem.id, junkA.id, junkB.id));
      });
    }

    const result = computeDevelopmentPriorities(buildDataset({ items, raters, nominations }));

    expect(result).toHaveLength(10);
    for (let i = 1; i <= 10; i++) {
      expect(result.some((r) => r.itemId === `real-${i}`)).toBe(true);
    }
    for (let i = 11; i <= 12; i++) {
      expect(result.some((r) => r.itemId === `real-${i}`)).toBe(false);
    }
  });

  it("excludes integrity items from eligibility even if somehow nominated", () => {
    const peers = makeRaters("peer", 3);
    const items: ScoringItem[] = [
      { id: "safe-item", competencyNumber: 7, itemNumber: 5, isIntegrityItem: true },
      ITEM_C1,
      ITEM_C1_B,
    ];
    const nominations = peers.flatMap((p) => nominate(p.id, "safe-item", ITEM_C1.id, ITEM_C1_B.id));
    const result = computeDevelopmentPriorities(buildDataset({ items, raters: peers, nominations }));
    expect(result.find((r) => r.itemId === "safe-item")).toBeUndefined();
  });
});

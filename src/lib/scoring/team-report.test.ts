import { beforeEach, describe, expect, it } from "vitest";
import {
  computeTeamItemAggregate,
  computeTeamMatrix,
  computeTeamPatternCandidates,
  type TeamLeaderInput,
} from "./team-report";
import { ITEM_C1, buildDataset, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";

beforeEach(() => resetRaterCounter());

function leader(id: string, overrides: Partial<Parameters<typeof buildDataset>[0]> = {}): TeamLeaderInput {
  return { leaderId: id, dataset: buildDataset(overrides) };
}

describe("computeTeamMatrix", () => {
  it("each cell is that leader's own item-level figure, not a cross-leader blend", () => {
    const peersA = makeRaters("peer", 3);
    const leaderA = leader("A", { raters: peersA, responses: peersA.map((r) => scaleResponse(r.id, ITEM_C1.id, 5)) });
    const peersB = makeRaters("peer", 3);
    const leaderB = leader("B", { raters: peersB, responses: peersB.map((r) => scaleResponse(r.id, ITEM_C1.id, 2)) });

    const [c1] = computeTeamMatrix([leaderA, leaderB]);
    const row = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(row.cells.find((c) => c.leaderId === "A")!.allOthers).toBe(5);
    expect(row.cells.find((c) => c.leaderId === "B")!.allOthers).toBe(2);
  });

  it("strength insight is the single highest cell clearing 4.25, naming the leader and item", () => {
    const peersA = makeRaters("peer", 3);
    const leaderA = leader("A", { raters: peersA, responses: peersA.map((r) => scaleResponse(r.id, ITEM_C1.id, 4.5)) });
    const peersB = makeRaters("peer", 3);
    const leaderB = leader("B", { raters: peersB, responses: peersB.map((r) => scaleResponse(r.id, ITEM_C1.id, 3)) });

    const [c1] = computeTeamMatrix([leaderA, leaderB]);
    expect(c1.strengthInsight).toEqual({ leaderId: "A", itemId: ITEM_C1.id, score: 4.5 });
  });

  it("strength insight is null (reflection prompt) when nothing clears the threshold", () => {
    const peers = makeRaters("peer", 3);
    const one = leader("A", { raters: peers, responses: peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 3.5)) });
    const [c1] = computeTeamMatrix([one]);
    expect(c1.strengthInsight).toBeNull();
  });

  it("gap insight only fires when self exceeds others by >=1.0, never the reverse direction", () => {
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    // Others (4) exceed self (2) -- a hidden strength, not a "gap to close".
    const one = leader("A", {
      raters: [...self, ...peers],
      responses: [scaleResponse(self[0].id, ITEM_C1.id, 2), ...peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 4))],
    });
    const [c1] = computeTeamMatrix([one]);
    expect(c1.gapInsight).toBeNull();
  });

  it("gap insight names the leader, item, and both figures for the largest self-over-others gap", () => {
    const self = makeRaters("self", 1);
    const peers = makeRaters("peer", 3);
    const one = leader("A", {
      raters: [...self, ...peers],
      responses: [scaleResponse(self[0].id, ITEM_C1.id, 5), ...peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 2))],
    });
    const [c1] = computeTeamMatrix([one]);
    expect(c1.gapInsight).toEqual({ leaderId: "A", itemId: ITEM_C1.id, selfScore: 5, othersScore: 2, gap: 3 });
  });
});

describe("computeTeamItemAggregate", () => {
  it("mean-of-means across leaders when n>=3, one leader one vote", () => {
    // Each leader individually clears n>=3 for their own item-level figure
    // (5, 1, 1 peers respectively -- all >=3 -- so each contributes their
    // own real mean), but leader A's much larger group must not dominate.
    const peersA = makeRaters("peer", 5);
    const a = leader("A", { raters: peersA, responses: peersA.map((r) => scaleResponse(r.id, ITEM_C1.id, 5)) });
    const peersB = makeRaters("peer", 3);
    const b = leader("B", { raters: peersB, responses: peersB.map((r) => scaleResponse(r.id, ITEM_C1.id, 1)) });
    const peersC = makeRaters("peer", 3);
    const c = leader("C", { raters: peersC, responses: peersC.map((r) => scaleResponse(r.id, ITEM_C1.id, 1)) });

    const result = computeTeamItemAggregate([a, b, c], ITEM_C1.id);
    expect(result).toEqual({ mode: "separate", mean: 7 / 3, leaderCount: 3 });
  });

  it("pools raw individual ratings when under 3 leaders have a reportable figure", () => {
    const peersA = makeRaters("peer", 3);
    const a = leader("A", { raters: peersA, responses: peersA.map((r) => scaleResponse(r.id, ITEM_C1.id, 5)) });
    const peersB = makeRaters("peer", 1);
    const b = leader("B", { raters: peersB, responses: [scaleResponse(peersB[0].id, ITEM_C1.id, 1)] });

    const result = computeTeamItemAggregate([a, b], ITEM_C1.id);
    expect(result.mode).toBe("merged");
    if (result.mode === "merged") {
      // pooled: (5+5+5+1)/4 = 4, not the mean of leader means (5+1)/2 = 3.
      expect(result.mean).toBe(4);
      expect(result.respondentCount).toBe(4);
    }
  });

  it("insufficient when nobody has reportable data for this item", () => {
    const result = computeTeamItemAggregate([leader("A")], ITEM_C1.id);
    expect(result).toEqual({ mode: "insufficient", leaderCount: 1 });
  });

  it("insufficient with leaderCount 0 when no leaders are in scope at all", () => {
    const result = computeTeamItemAggregate([], ITEM_C1.id);
    expect(result).toEqual({ mode: "insufficient", leaderCount: 0 });
  });
});

describe("computeTeamPatternCandidates", () => {
  it("ranks leaders by their own hidden-strength / blind-spot counts, most first", () => {
    const self1 = makeRaters("self", 1);
    const peers1 = makeRaters("peer", 3);
    const leaderWithGap = leader("A", {
      raters: [...self1, ...peers1],
      responses: [scaleResponse(self1[0].id, ITEM_C1.id, 5), ...peers1.map((r) => scaleResponse(r.id, ITEM_C1.id, 2))],
    });
    const leaderClean = leader("B", { raters: makeRaters("peer", 1) });

    const { development } = computeTeamPatternCandidates([leaderClean, leaderWithGap]);
    expect(development).toEqual([{ leaderId: "A", count: 1 }]);
  });
});

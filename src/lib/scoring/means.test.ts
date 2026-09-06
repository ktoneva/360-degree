import { beforeEach, describe, expect, it } from "vitest";
import { competencyGroupMean, itemAllOthersMean, itemGroupMean, groupRatersByGroup, round1 } from "./means";
import { ITEM_C1, ITEM_C1_B, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";

beforeEach(() => resetRaterCounter());

describe("round1", () => {
  it("rounds to 1 decimal place", () => {
    expect(round1(3.14159)).toBe(3.1);
    expect(round1(3.05)).toBe(3.1);
    expect(round1(3)).toBe(3);
  });
});

describe("itemGroupMean", () => {
  it("excludes 'not able to comment' (null scaleValue) from both mean and count", () => {
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 6),
      scaleResponse(peers[1].id, ITEM_C1.id, 4),
      scaleResponse(peers[2].id, ITEM_C1.id, null), // not able to comment
    ];
    const result = itemGroupMean(responses, ITEM_C1.id, peers.map((p) => p.id));
    expect(result.n).toBe(2);
    expect(result.mean).toBe(5);
  });

  it("returns null mean and n=0 when nobody in the group answered", () => {
    const peers = makeRaters("peer", 2);
    const result = itemGroupMean([], ITEM_C1.id, peers.map((p) => p.id));
    expect(result).toEqual({ mean: null, n: 0 });
  });

  it("dedupes a rater who somehow has two rows for the same item (keeps the last)", () => {
    const [peer] = makeRaters("peer", 1);
    const responses = [scaleResponse(peer.id, ITEM_C1.id, 2), scaleResponse(peer.id, ITEM_C1.id, 5)];
    const result = itemGroupMean(responses, ITEM_C1.id, [peer.id]);
    expect(result.n).toBe(1);
    expect(result.mean).toBe(5);
  });
});

describe("competencyGroupMean", () => {
  it("pools every individual real rating across items, not an average of per-item means", () => {
    const peers = makeRaters("peer", 2);
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 6),
      scaleResponse(peers[0].id, ITEM_C1_B.id, 6),
      scaleResponse(peers[1].id, ITEM_C1.id, 1),
      // peer 2 skips item B entirely
    ];
    const result = competencyGroupMean(responses, [ITEM_C1.id, ITEM_C1_B.id], peers.map((p) => p.id));
    // Flat pool: (6 + 6 + 1) / 3 = 4.333..., NOT the mean of [6, 3.5] = 4.75
    expect(result.mean).toBeCloseTo(13 / 3, 10);
    expect(result.respondentCount).toBe(2);
  });

  it("respondentCount counts distinct people, not individual ratings", () => {
    const peers = makeRaters("peer", 1);
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 5),
      scaleResponse(peers[0].id, ITEM_C1_B.id, 3),
    ];
    const result = competencyGroupMean(responses, [ITEM_C1.id, ITEM_C1_B.id], peers.map((p) => p.id));
    expect(result.respondentCount).toBe(1);
  });
});

describe("itemAllOthersMean", () => {
  it("reports each mergeable group separately once each clears n>=3", () => {
    const peers = makeRaters("peer", 3);
    const directReports = makeRaters("direct_report", 3);
    const others = makeRaters("other", 3);
    const raters = [...peers, ...directReports, ...others];
    const ratersByGroup = groupRatersByGroup(raters);

    const responses = [
      ...peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 6)), // peer mean 6
      ...directReports.map((r) => scaleResponse(r.id, ITEM_C1.id, 2)), // DR mean 2
      ...others.map((r) => scaleResponse(r.id, ITEM_C1.id, 4)), // other mean 4
    ];

    const result = itemAllOthersMean(responses, ITEM_C1.id, ratersByGroup);
    // Average of the three group means (6+2+4)/3 = 4, not a pooled individual average.
    expect(result.mean).toBe(4);
    expect(result.totalRealRatings).toBe(9);
  });

  it("merges groups under n=3 into a single pooled 'all colleagues' figure", () => {
    const peers = makeRaters("peer", 2); // under 3
    const directReports = makeRaters("direct_report", 1); // under 3
    const others = makeRaters("other", 3); // safe on its own
    const raters = [...peers, ...directReports, ...others];
    const ratersByGroup = groupRatersByGroup(raters);

    const responses = [
      ...peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 6)),
      ...directReports.map((r) => scaleResponse(r.id, ITEM_C1.id, 6)),
      ...others.map((r) => scaleResponse(r.id, ITEM_C1.id, 2)),
    ];

    // Merged pool (2 peers + 1 DR = 3 people, all rated 6) clears n>=3, so it
    // becomes one more reportable group mean of 6, averaged with others' 2.
    const result = itemAllOthersMean(responses, ITEM_C1.id, ratersByGroup);
    expect(result.mean).toBe(4); // (6 + 2) / 2
    expect(result.totalRealRatings).toBe(6); // 3 merged + 3 other
  });

  it("drops the merged pool entirely if it still falls short of n>=3", () => {
    const peers = makeRaters("peer", 1);
    const directReports = makeRaters("direct_report", 1);
    const others = makeRaters("other", 3); // safe
    const raters = [...peers, ...directReports, ...others];
    const ratersByGroup = groupRatersByGroup(raters);

    const responses = [
      ...peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 6)),
      ...directReports.map((r) => scaleResponse(r.id, ITEM_C1.id, 6)),
      ...others.map((r) => scaleResponse(r.id, ITEM_C1.id, 2)),
    ];

    // Merged pool is only 2 people (peer + DR) — still under 3, so it's not
    // reportable at all. Only "other" (2) counts.
    const result = itemAllOthersMean(responses, ITEM_C1.id, ratersByGroup);
    expect(result.mean).toBe(2);
    expect(result.totalRealRatings).toBe(3);
  });

  it("returns null when every mergeable group is empty (nothing to report)", () => {
    const ratersByGroup = groupRatersByGroup([]);
    const result = itemAllOthersMean([], ITEM_C1.id, ratersByGroup);
    expect(result).toEqual({ mean: null, totalRealRatings: 0 });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { computeOrgOverview, type OrgLeaderInput } from "./org-overview";
import { ITEM_C1, buildDataset, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";
import type { ScoringItem } from "./types";

beforeEach(() => resetRaterCounter());

function makeLeader(
  leaderId: string,
  overrides: Partial<Parameters<typeof buildDataset>[0]> = {},
  competency9Variant: "standard" | "ops" = "standard",
): OrgLeaderInput {
  return {
    leaderId,
    leaderName: `Leader ${leaderId}`,
    competency9Variant,
    dataset: buildDataset(overrides),
  };
}

describe("computeOrgOverview", () => {
  it("n>=3 leaders: averages each leader's own competency figure, one leader one vote", () => {
    // Leader A has 5 peers all rating 6; leaders B and C have 1 peer each
    // rating 2. A pooled average of every individual rating would skew
    // heavily toward A's 5 raters; mean-of-means must not.
    const peersA = makeRaters("peer", 5);
    const leaderA = makeLeader("A", {
      raters: peersA,
      responses: peersA.map((r) => scaleResponse(r.id, ITEM_C1.id, 6)),
    });
    const peerB = makeRaters("peer", 1);
    const leaderB = makeLeader("B", {
      raters: peerB,
      responses: [scaleResponse(peerB[0].id, ITEM_C1.id, 2)],
    });
    const peerC = makeRaters("peer", 1);
    const leaderC = makeLeader("C", {
      raters: peerC,
      responses: [scaleResponse(peerC[0].id, ITEM_C1.id, 2)],
    });

    const rows = computeOrgOverview([leaderA, leaderB, leaderC]);
    const c1 = rows.find((r) => r.competencyNumber === 1 && r.mode === "separate")!;
    expect(c1.mode).toBe("separate");
    if (c1.mode !== "separate") throw new Error("unreachable");
    // (6 + 2 + 2) / 3 = 3.33, NOT a pooled average which would be
    // (6*5 + 2 + 2) / 7 ≈ 4.86.
    expect(c1.allOthers.mean).toBeCloseTo(10 / 3, 5);
    expect(c1.allOthers.leaderCount).toBe(3);
    expect(c1.leaderCount).toBe(3);
    expect(c1.perLeader).toHaveLength(3);
  });

  it("1-2 leaders: pools raw individual ratings instead of averaging leader means, and suppresses per-leader breakdown", () => {
    const peersA = makeRaters("peer", 3);
    const leaderA = makeLeader("A", {
      raters: peersA,
      responses: peersA.map((r) => scaleResponse(r.id, ITEM_C1.id, 6)), // leader A mean 6
    });
    const peerB = makeRaters("peer", 1);
    const leaderB = makeLeader("B", {
      raters: peerB,
      responses: [scaleResponse(peerB[0].id, ITEM_C1.id, 2)], // leader B mean 2
    });

    const rows = computeOrgOverview([leaderA, leaderB]);
    const c1 = rows.find((r) => r.competencyNumber === 1)!;
    expect(c1.mode).toBe("merged");
    if (c1.mode !== "merged") throw new Error("unreachable");
    // Pooled: (6+6+6+2) / 4 = 5, NOT the mean of leader means (6+2)/2 = 4.
    expect(c1.pooledMean).toBeCloseTo(5, 5);
    expect(c1.respondentCount).toBe(4);
    expect(c1.leaderCount).toBe(2);
    expect("perLeader" in c1).toBe(false);
  });

  it("0 leaders: reports insufficient data rather than a fabricated figure", () => {
    const rows = computeOrgOverview([]);
    const c1 = rows.find((r) => r.competencyNumber === 1)!;
    expect(c1.mode).toBe("insufficient");
    expect(c1.leaderCount).toBe(0);
  });

  it("1-2 leaders with zero real ratings for a competency: still insufficient, not a fabricated pooled mean", () => {
    const self = makeRaters("self", 1);
    const leaderA = makeLeader("A", { raters: self, responses: [] });
    const rows = computeOrgOverview([leaderA]);
    const c1 = rows.find((r) => r.competencyNumber === 1)!;
    expect(c1.mode).toBe("insufficient");
  });

  it("never blends competency 9 standard and ops -- reports two independent rows", () => {
    const standardItem: ScoringItem = { id: "std-9-1", competencyNumber: 9, itemNumber: 1, isIntegrityItem: false };
    const opsItem: ScoringItem = { id: "ops-9-1", competencyNumber: 9, itemNumber: 1, isIntegrityItem: false };

    const peersStandard = makeRaters("peer", 3);
    const leaderStandard = makeLeader(
      "std",
      {
        raters: peersStandard,
        responses: peersStandard.map((r) => scaleResponse(r.id, standardItem.id, 5)),
        items: [standardItem],
      },
      "standard",
    );

    const peersOps = makeRaters("peer", 1);
    const leaderOps = makeLeader(
      "ops",
      {
        raters: peersOps,
        responses: [scaleResponse(peersOps[0].id, opsItem.id, 1)],
        items: [opsItem],
      },
      "ops",
    );

    const rows = computeOrgOverview([leaderStandard, leaderOps]);
    const nineRows = rows.filter((r) => r.competencyNumber === 9);
    expect(nineRows).toHaveLength(2);

    const standardRow = nineRows.find((r) => r.competency9Variant === "standard")!;
    const opsRow = nineRows.find((r) => r.competency9Variant === "ops")!;

    // Standard row only sees the standard leader (n=1 -> merged, pooled from
    // just that leader's own raters) — never mixed with the ops leader.
    expect(standardRow.leaderCount).toBe(1);
    expect(standardRow.mode).toBe("merged");
    if (standardRow.mode === "merged") expect(standardRow.pooledMean).toBe(5);

    expect(opsRow.leaderCount).toBe(1);
    expect(opsRow.mode).toBe("merged");
    if (opsRow.mode === "merged") expect(opsRow.pooledMean).toBe(1);
  });

  it("applies n>=3 independently per competency-9 variant even when the overall leader count is well above 3", () => {
    // 4 leaders total, but only 1 on the ops variant -- competencies 1-8
    // should clear n>=3, while the ops row for competency 9 should not.
    const leaders: OrgLeaderInput[] = [];
    for (const id of ["A", "B", "C"]) {
      const peers = makeRaters("peer", 1);
      leaders.push(
        makeLeader(
          id,
          { raters: peers, responses: [scaleResponse(peers[0].id, ITEM_C1.id, 4)] },
          "standard",
        ),
      );
    }
    const opsItem: ScoringItem = { id: "ops-9-1", competencyNumber: 9, itemNumber: 1, isIntegrityItem: false };
    const opsPeer = makeRaters("peer", 1);
    leaders.push(
      makeLeader(
        "D",
        { raters: opsPeer, responses: [scaleResponse(opsPeer[0].id, opsItem.id, 3)], items: [opsItem] },
        "ops",
      ),
    );

    const rows = computeOrgOverview(leaders);
    const c1 = rows.find((r) => r.competencyNumber === 1)!;
    expect(c1.leaderCount).toBe(4);
    expect(c1.mode).toBe("separate");

    const opsRow = rows.find((r) => r.competencyNumber === 9 && r.competency9Variant === "ops")!;
    expect(opsRow.leaderCount).toBe(1);
    expect(opsRow.mode).toBe("merged");
  });

  it("excludes a leader from self's mean-across-leaders if that leader's self never responded, without affecting manager or allOthers", () => {
    const peers1 = makeRaters("peer", 1);
    const self1 = makeRaters("self", 1);
    const leader1 = makeLeader("1", {
      raters: [...self1, ...peers1],
      responses: [
        scaleResponse(self1[0].id, ITEM_C1.id, 5),
        scaleResponse(peers1[0].id, ITEM_C1.id, 4),
      ],
    });

    const peers2 = makeRaters("peer", 1);
    const leader2 = makeLeader("2", {
      // No self rater at all for this leader.
      raters: peers2,
      responses: [scaleResponse(peers2[0].id, ITEM_C1.id, 4)],
    });

    const peers3 = makeRaters("peer", 1);
    const leader3 = makeLeader("3", {
      raters: peers3,
      responses: [scaleResponse(peers3[0].id, ITEM_C1.id, 4)],
    });

    const rows = computeOrgOverview([leader1, leader2, leader3]);
    const c1 = rows.find((r) => r.competencyNumber === 1)!;
    expect(c1.mode).toBe("separate");
    if (c1.mode !== "separate") throw new Error("unreachable");
    expect(c1.self.mean).toBe(5); // only leader1 contributed a self rating
    expect(c1.self.leaderCount).toBe(1);
    expect(c1.allOthers.mean).toBe(4); // all 3 leaders contributed
    expect(c1.allOthers.leaderCount).toBe(3);
  });
});

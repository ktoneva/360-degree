import { beforeEach, describe, expect, it } from "vitest";
import { computeCompetencyOverview } from "./competency-overview";
import { ITEM_C1, ITEM_C7, buildDataset, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";

beforeEach(() => resetRaterCounter());

describe("computeCompetencyOverview", () => {
  it("averages the peer/direct_report/other means, not a pooled individual average", () => {
    const self = makeRaters("self", 1);
    const manager = makeRaters("manager", 1);
    const peers = makeRaters("peer", 5); // large group, would dominate a pooled average
    const directReports = makeRaters("direct_report", 1);
    const others = makeRaters("other", 1);
    const raters = [...self, ...manager, ...peers, ...directReports, ...others];

    const responses = [
      scaleResponse(self[0].id, ITEM_C1.id, 5),
      scaleResponse(manager[0].id, ITEM_C1.id, 4),
      ...peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 6)), // peer mean 6
      scaleResponse(directReports[0].id, ITEM_C1.id, 2), // DR mean 2
      scaleResponse(others[0].id, ITEM_C1.id, 4), // other mean 4
    ];

    const rows = computeCompetencyOverview(buildDataset({ raters, responses }));
    const c1 = rows.find((r) => r.competencyNumber === 1)!;

    expect(c1.self).toBe(5);
    expect(c1.manager).toBe(4);
    // (6 + 2 + 4) / 3 = 4, NOT a pooled average which would skew toward the
    // 5-person peer group (that pooled figure would be (6*5+2+4)/7 ≈ 5.14).
    expect(c1.allOthers).toBe(4);
  });

  it("averages only over groups that have data when one group is empty", () => {
    const peers = makeRaters("peer", 1);
    const raters = [...peers];
    const responses = [scaleResponse(peers[0].id, ITEM_C1.id, 3)];

    const rows = computeCompetencyOverview(buildDataset({ raters, responses }));
    const c1 = rows.find((r) => r.competencyNumber === 1)!;

    // direct_report and other have no data at all; allOthers falls back to
    // just the peer mean rather than being null or averaging in a phantom 0.
    expect(c1.allOthers).toBe(3);
  });

  it("returns null for self, manager, and allOthers when nobody has responded", () => {
    const rows = computeCompetencyOverview(buildDataset());
    const c1 = rows.find((r) => r.competencyNumber === 1)!;
    expect(c1.self).toBeNull();
    expect(c1.manager).toBeNull();
    expect(c1.allOthers).toBeNull();
  });

  it("excludes integrity items (7.5/7.6) from every mean, never just from safeguarding", () => {
    const self = makeRaters("self", 1);
    // Only integrity items answered for competency 7's item bank in this
    // fixture; the one scored item (ITEM_C7) is left blank.
    const responses = [
      { raterId: self[0].id, itemId: "c7i5", scaleValue: null, integrityValue: "yes" as const },
      { raterId: self[0].id, itemId: "c7i6", scaleValue: null, integrityValue: "no" as const },
    ];
    const rows = computeCompetencyOverview(buildDataset({ raters: self, responses }));
    const c7 = rows.find((r) => r.competencyNumber === 7)!;
    expect(c7.self).toBeNull(); // ITEM_C7 (the only scored item) has no response
  });

  it("orders rows highest to lowest by allOthers, nulls last", () => {
    const peers = makeRaters("peer", 1);
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 2), // competency 1 -> allOthers 2
      scaleResponse(peers[0].id, ITEM_C7.id, 6), // competency 7 -> allOthers 6
    ];
    const rows = computeCompetencyOverview(buildDataset({ raters: peers, responses }));
    expect(rows.map((r) => r.competencyNumber)).toEqual([7, 1]);
  });
});

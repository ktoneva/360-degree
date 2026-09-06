import { beforeEach, describe, expect, it } from "vitest";
import { computeRaterGroupComparison } from "./rater-group-comparison";
import { ITEM_C1, ITEM_C7, buildDataset, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";
import type { ScoringResponse } from "./types";

beforeEach(() => resetRaterCounter());

describe("computeRaterGroupComparison", () => {
  it("reports self with n implied and manager with n=1, always, even alone", () => {
    const self = makeRaters("self", 1);
    const manager = makeRaters("manager", 1);
    const responses = [scaleResponse(self[0].id, ITEM_C1.id, 5), scaleResponse(manager[0].id, ITEM_C1.id, 3)];

    const [c1] = computeRaterGroupComparison(buildDataset({ raters: [...self, ...manager], responses }));

    expect(c1.self).toEqual({ status: "reported", mean: 5, n: 1 });
    expect(c1.manager).toEqual({ status: "reported", mean: 3, n: 1 });
  });

  it("shows a colleague group separately once it reaches exactly n=3", () => {
    const peers = makeRaters("peer", 3);
    const responses = peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 6));
    const [c1] = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));
    expect(c1.peer).toEqual({ status: "reported", mean: 6, n: 3 });
    expect(c1.allColleagues).toBeNull();
  });

  it("a group with zero raters invited doesn't force a merge on otherwise-healthy groups", () => {
    // Only peers exist for this cycle (no direct reports or others were ever
    // invited) — that must not drag peer into an "insufficient" merge just
    // because the other two group categories are empty.
    const peers = makeRaters("peer", 3);
    const responses = peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 6));
    const [c1] = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));
    expect(c1.peer).toEqual({ status: "reported", mean: 6, n: 3 });
    expect(c1.directReport).toEqual({ status: "no_data" });
    expect(c1.other).toEqual({ status: "no_data" });
    expect(c1.allColleagues).toBeNull();
  });

  it("merges a group with n=2 (one below threshold) into allColleagues", () => {
    const peers = makeRaters("peer", 2);
    const others = makeRaters("other", 3); // safe
    const responses = [
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 6)),
      ...others.map((o) => scaleResponse(o.id, ITEM_C1.id, 2)),
    ];
    const [c1] = computeRaterGroupComparison(
      buildDataset({ raters: [...peers, ...others], responses }),
    );

    expect(c1.peer).toEqual({ status: "merged" });
    expect(c1.other).toEqual({ status: "reported", mean: 2, n: 3 });
    // Merged pool of peers only (2 people) is itself under 3 -> insufficient.
    expect(c1.allColleagues).toEqual({ status: "insufficient_responses" });
  });

  it("pools merged groups' individual ratings, not an average of their group means", () => {
    const peers = makeRaters("peer", 1); // under 3
    const directReports = makeRaters("direct_report", 2); // under 3
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 6),
      scaleResponse(directReports[0].id, ITEM_C1.id, 1),
      scaleResponse(directReports[1].id, ITEM_C1.id, 1),
    ];
    const [c1] = computeRaterGroupComparison(
      buildDataset({ raters: [...peers, ...directReports], responses }),
    );

    // 3 people merged (1 peer + 2 DR): pooled mean = (6+1+1)/3 = 2.666... -> 2.7
    // NOT the average of group means ((6 + 1) / 2 = 3.5).
    expect(c1.allColleagues).toEqual({ status: "reported", mean: 2.7, n: 3 });
  });

  it("shows 'insufficient_responses' as a status, never a bare number or dash, when merge still falls short", () => {
    const peers = makeRaters("peer", 1);
    const responses = [scaleResponse(peers[0].id, ITEM_C1.id, 6)];
    const [c1] = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));

    expect(c1.allColleagues).toEqual({ status: "insufficient_responses" });
    expect(c1.allColleagues).not.toHaveProperty("mean");
  });

  it("recalculates merge status independently per competency", () => {
    const peers = makeRaters("peer", 3);
    // All 3 peers answer competency 1's item, but only 2 of them answer
    // competency 7's item -> safe in competency 1, merged (alone, so
    // insufficient) in competency 7.
    const responses = [
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 5)),
      scaleResponse(peers[0].id, ITEM_C7.id, 5),
      scaleResponse(peers[1].id, ITEM_C7.id, 5),
    ];
    const rows = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));
    const c1 = rows.find((r) => r.competencyNumber === 1)!;
    const c7 = rows.find((r) => r.competencyNumber === 7)!;

    expect(c1.peer).toEqual({ status: "reported", mean: 5, n: 3 });
    expect(c1.allColleagues).toBeNull();

    expect(c7.peer).toEqual({ status: "merged" });
    expect(c7.allColleagues).toEqual({ status: "insufficient_responses" });
  });

  it("returns 'no_data' for self/manager when they haven't answered anything in a competency", () => {
    const peers = makeRaters("peer", 3);
    const responses = peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 5));
    const [c1] = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));
    expect(c1.self).toEqual({ status: "no_data" });
    expect(c1.manager).toEqual({ status: "no_data" });
  });

  it("keeps competency order fixed at 1..9 rather than sorting by score", () => {
    const peers = makeRaters("peer", 3);
    const responses = [
      ...peers.map((p) => scaleResponse(p.id, ITEM_C7.id, 6)), // higher score, higher competency number
      ...peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 1)), // lower score, lower competency number
    ];
    const rows = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));
    expect(rows.map((r) => r.competencyNumber)).toEqual([1, 7]);
  });

  it("excludes integrity items from the comparison entirely", () => {
    const peers = makeRaters("peer", 3);
    const responses: ScoringResponse[] = peers.map((p) => ({
      raterId: p.id,
      itemId: "c7i5",
      scaleValue: null,
      integrityValue: "yes",
    }));
    const rows = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));
    const c7 = rows.find((r) => r.competencyNumber === 7)!;
    expect(c7.peer).toEqual({ status: "merged" });
    expect(c7.allColleagues).toEqual({ status: "insufficient_responses" });
  });
});

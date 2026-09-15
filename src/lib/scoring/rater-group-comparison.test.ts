import { beforeEach, describe, expect, it } from "vitest";
import { computeRaterGroupComparison } from "./rater-group-comparison";
import { ITEM_C1, ITEM_C7, buildDataset, itemFor, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";
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

    // Merged pool of peers only (2 people) is itself under 3 -> insufficient,
    // and the peer cell shows that same resolved figure, never a bare
    // "merged" placeholder.
    expect(c1.peer).toEqual({ status: "insufficient_responses" });
    expect(c1.other).toEqual({ status: "reported", mean: 2, n: 3 });
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
    // Both merged groups' own cells show that exact same resolved figure --
    // a real number, never a "merged" placeholder distinct from allColleagues.
    expect(c1.peer).toEqual({ status: "reported", mean: 2.7, n: 3 });
    expect(c1.directReport).toEqual({ status: "reported", mean: 2.7, n: 3 });
  });

  it("counts 'not able to comment' toward the n>=3 threshold, so a group of 3 with one such response still reports its own figure (v15)", () => {
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 6),
      scaleResponse(peers[1].id, ITEM_C1.id, 4),
      scaleResponse(peers[2].id, ITEM_C1.id, null), // not able to comment
    ];
    const [c1] = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));
    // All 3 peers responded in some form, so the group clears n>=3 on its
    // own -- mean built from only the 2 real ratings, per step 1.
    expect(c1.peer).toEqual({ status: "reported", mean: 5, n: 3 });
    expect(c1.allColleagues).toBeNull();
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

    expect(c7.peer).toEqual({ status: "insufficient_responses" });
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

  it("shows a plain dash, never 'insufficient responses', when a group was never asked this competency at all (v15)", () => {
    // Peers exist and have raters, but this competency's only item never
    // names "peer" in askedRaterGroups -- a genuine not-applicable, not a
    // suppression, and it must not drag anyone else into a merge either.
    const item = itemFor("not-for-peers", 1, 1, ["self", "manager", "direct_report"]);
    const peers = makeRaters("peer", 3);
    const directReports = makeRaters("direct_report", 3);
    const responses = directReports.map((d) => scaleResponse(d.id, item.id, 5));
    const [c1] = computeRaterGroupComparison(
      buildDataset({ items: [item], raters: [...peers, ...directReports], responses }),
    );
    expect(c1.peer).toEqual({ status: "no_data" });
    expect(c1.directReport).toEqual({ status: "reported", mean: 5, n: 3 });
    // Peer's not-applicable status doesn't force a merge on direct_report.
    expect(c1.allColleagues).toBeNull();
  });

  it("applies the not-applicable dash consistently to direct_report and other, not only peer", () => {
    const item = itemFor("not-for-dr-or-other", 1, 1, ["self", "manager", "peer"]);
    const peers = makeRaters("peer", 3);
    const directReports = makeRaters("direct_report", 3);
    const others = makeRaters("other", 3);
    const responses = peers.map((p) => scaleResponse(p.id, item.id, 4));
    const [c1] = computeRaterGroupComparison(
      buildDataset({ items: [item], raters: [...peers, ...directReports, ...others], responses }),
    );
    expect(c1.peer).toEqual({ status: "reported", mean: 4, n: 3 });
    expect(c1.directReport).toEqual({ status: "no_data" });
    expect(c1.other).toEqual({ status: "no_data" });
    expect(c1.allColleagues).toBeNull();
  });

  it("a group applicable to the competency but under 3 responders still shows 'insufficient responses', distinct from not-applicable", () => {
    const item = itemFor("for-everyone", 1, 1, ["self", "manager", "peer"]);
    const peers = makeRaters("peer", 2); // applicable, but under 3
    const responses = peers.map((p) => scaleResponse(p.id, item.id, 4));
    const [c1] = computeRaterGroupComparison(buildDataset({ items: [item], raters: peers, responses }));
    expect(c1.peer).toEqual({ status: "insufficient_responses" });
  });

  it("a documented anonymityThreshold override lets a smaller group report on its own (one-off exception, Design decisions row 25)", () => {
    const peers = makeRaters("peer", 2); // under the standard n>=3
    const responses = peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 4));
    const [c1] = computeRaterGroupComparison(
      buildDataset({ raters: peers, responses, anonymityThreshold: 2 }),
    );
    expect(c1.peer).toEqual({ status: "reported", mean: 4, n: 2 });
    expect(c1.allColleagues).toBeNull();
  });

  it("the exact same data without the override still shows insufficient responses (the override is per-dataset, not global)", () => {
    const peers = makeRaters("peer", 2);
    const responses = peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 4));
    const [c1] = computeRaterGroupComparison(buildDataset({ raters: peers, responses }));
    expect(c1.peer).toEqual({ status: "insufficient_responses" });
  });

  it("a lowered threshold still suppresses a group that falls short of even that lower bar", () => {
    const peers = makeRaters("peer", 1); // under n>=2 as well as n>=3
    const responses = [scaleResponse(peers[0].id, ITEM_C1.id, 4)];
    const [c1] = computeRaterGroupComparison(
      buildDataset({ raters: peers, responses, anonymityThreshold: 2 }),
    );
    expect(c1.peer).toEqual({ status: "insufficient_responses" });
  });

  it("a not-applicable group still shows a plain dash under a lowered threshold, never resolved into a number", () => {
    const item = itemFor("not-for-peers", 1, 1, ["self", "manager", "direct_report"]);
    const peers = makeRaters("peer", 2);
    const directReports = makeRaters("direct_report", 2);
    const responses = directReports.map((d) => scaleResponse(d.id, item.id, 5));
    const [c1] = computeRaterGroupComparison(
      buildDataset({ items: [item], raters: [...peers, ...directReports], responses, anonymityThreshold: 2 }),
    );
    expect(c1.peer).toEqual({ status: "no_data" });
    expect(c1.directReport).toEqual({ status: "reported", mean: 5, n: 2 });
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
    expect(c7.peer).toEqual({ status: "insufficient_responses" });
    expect(c7.allColleagues).toEqual({ status: "insufficient_responses" });
  });
});

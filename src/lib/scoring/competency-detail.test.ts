import { beforeEach, describe, expect, it } from "vitest";
import { computeCompetencyDetailTables } from "./competency-detail";
import { ITEM_C1, ITEM_C1_B, buildDataset, itemFor, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";

beforeEach(() => resetRaterCounter());

describe("computeCompetencyDetailTables", () => {
  it("reuses the competency-level rater group comparison unchanged as the summary row", () => {
    const peers = makeRaters("peer", 3);
    const responses = peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 4));
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: peers, responses }));
    expect(c1.summary.competencyNumber).toBe(1);
    expect(c1.summary.peer).toEqual({ status: "reported", mean: 4, n: 3 });
  });

  it("summary row's allOthers is the mean of group means, not a pooled average (matches the competency overview convention)", () => {
    const peers = makeRaters("peer", 5); // large group, would dominate a pooled average
    const directReports = makeRaters("direct_report", 1);
    const others = makeRaters("other", 1);
    // peer mean 5, DR mean 1, other mean 1 -> mean of means = (5+1+1)/3 = 2.33.
    const responses = [
      ...peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 5)),
      scaleResponse(directReports[0].id, ITEM_C1.id, 1),
      scaleResponse(others[0].id, ITEM_C1.id, 1),
    ];
    const [c1] = computeCompetencyDetailTables(
      buildDataset({ raters: [...peers, ...directReports, ...others], responses }),
    );
    expect(c1.summary.allOthers).toEqual({ status: "reported", mean: 2.3, n: 0 });
  });

  it("item row: a group with n>=3 on this item reports its own mean", () => {
    const peers = makeRaters("peer", 3);
    const responses = peers.map((r) => scaleResponse(r.id, ITEM_C1.id, 5));
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: peers, responses }));
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.peer).toEqual({ status: "reported", mean: 5, n: 3 });
  });

  it("item row: a group with n<3 on this specific item resolves to insufficient responses, even if the competency-level summary reported it separately", () => {
    // 3 peers total (competency-level n=3, reported), but only 1 of them
    // actually answered this specific item -- item-level attendance is
    // tracked independently per the Blind spots logic tab.
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 4),
      scaleResponse(peers[0].id, ITEM_C1_B.id, 4),
      scaleResponse(peers[1].id, ITEM_C1_B.id, 3),
      scaleResponse(peers[2].id, ITEM_C1_B.id, 3),
    ];
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: peers, responses }));
    expect(c1.summary.peer.status).toBe("reported"); // 3 peers answered *something* in competency 1

    // Only 1 peer answered this item specifically -- resolves to the same
    // "insufficient responses" text the pooled figure would show, never a
    // bare "merged" placeholder.
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.peer).toEqual({ status: "insufficient_responses" });
  });

  it("item row: 'not able to comment' still counts toward n>=3, so a group of 3 with one such response reports its own mean from the real ratings only (v15)", () => {
    const peers = makeRaters("peer", 3);
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 6),
      scaleResponse(peers[1].id, ITEM_C1.id, 4),
      scaleResponse(peers[2].id, ITEM_C1.id, null), // not able to comment
    ];
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: peers, responses }));
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.peer).toEqual({ status: "reported", mean: 5, n: 3 });
  });

  it("item row: a merged group's own cell shows the actual pooled mean, never the literal string 'Merged'", () => {
    const peers = makeRaters("peer", 1); // under 3
    const directReports = makeRaters("direct_report", 2); // under 3
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 6),
      scaleResponse(directReports[0].id, ITEM_C1.id, 1),
      scaleResponse(directReports[1].id, ITEM_C1.id, 1),
    ];
    const [c1] = computeCompetencyDetailTables(
      buildDataset({ raters: [...peers, ...directReports], responses }),
    );
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    // Pooled mean (6+1+1)/3 = 2.7, shown directly in both merged groups' own
    // cells -- no "status: merged" value exists anywhere in this type.
    expect(item1.peer).toEqual({ status: "reported", mean: 2.7, n: 3 });
    expect(item1.directReport).toEqual({ status: "reported", mean: 2.7, n: 3 });
    expect(JSON.stringify(item1)).not.toContain("merged");
  });

  it("item row: shows a plain dash, never 'insufficient responses', when this item was never on that group's questionnaire at all (v15)", () => {
    // Peers were never asked this item -- a genuine not-applicable, distinct
    // from being asked and falling short of the 3-person threshold.
    const item = itemFor("peer-not-asked", 1, 1, ["self", "manager", "direct_report"]);
    const peers = makeRaters("peer", 3);
    const directReports = makeRaters("direct_report", 3);
    const responses = directReports.map((d) => scaleResponse(d.id, item.id, 4));
    const [c1] = computeCompetencyDetailTables(
      buildDataset({ items: [item], raters: [...peers, ...directReports], responses }),
    );
    const row = c1.items.find((i) => i.itemId === item.id)!;
    expect(row.peer).toEqual({ status: "no_data" });
    expect(row.directReport).toEqual({ status: "reported", mean: 4, n: 3 });
  });

  it("item row: the not-applicable dash applies consistently to direct_report and other too, not only peer", () => {
    const item = itemFor("dr-and-other-not-asked", 1, 1, ["self", "manager", "peer"]);
    const peers = makeRaters("peer", 3);
    const directReports = makeRaters("direct_report", 3);
    const others = makeRaters("other", 3);
    const responses = peers.map((p) => scaleResponse(p.id, item.id, 5));
    const [c1] = computeCompetencyDetailTables(
      buildDataset({ items: [item], raters: [...peers, ...directReports, ...others], responses }),
    );
    const row = c1.items.find((i) => i.itemId === item.id)!;
    expect(row.peer).toEqual({ status: "reported", mean: 5, n: 3 });
    expect(row.directReport).toEqual({ status: "no_data" });
    expect(row.other).toEqual({ status: "no_data" });
  });

  it("item row: a documented anonymityThreshold override lets a smaller group report its own mean (Design decisions row 25)", () => {
    const peers = makeRaters("peer", 2); // under the standard n>=3
    const responses = [scaleResponse(peers[0].id, ITEM_C1.id, 5), scaleResponse(peers[1].id, ITEM_C1.id, 3)];
    const [c1] = computeCompetencyDetailTables(
      buildDataset({ raters: peers, responses, anonymityThreshold: 2 }),
    );
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.peer).toEqual({ status: "reported", mean: 4, n: 2 });
    // Also feeds the shared item-level "all others" figure used across the
    // report (Design decision 21) -- not just this one column.
    expect(item1.allOthers).toEqual({ status: "reported", mean: 4, n: 2 });
  });

  it("item row: the same data without the override still shows insufficient responses", () => {
    const peers = makeRaters("peer", 2);
    const responses = [scaleResponse(peers[0].id, ITEM_C1.id, 5), scaleResponse(peers[1].id, ITEM_C1.id, 3)];
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: peers, responses }));
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.peer).toEqual({ status: "insufficient_responses" });
  });

  it("self and manager are always shown plainly regardless of n", () => {
    const self = makeRaters("self", 1);
    const responses = [scaleResponse(self[0].id, ITEM_C1.id, 3)];
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: self, responses }));
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.self).toEqual({ status: "reported", mean: 3, n: 1 });
    expect(item1.manager).toEqual({ status: "no_data" });
  });

  it("colleague range is computed unconditionally, even when the group cells are suppressed for anonymity", () => {
    const peers = makeRaters("peer", 2); // under 3 -> insufficient responses
    const responses = [scaleResponse(peers[0].id, ITEM_C1.id, 2), scaleResponse(peers[1].id, ITEM_C1.id, 5)];
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: peers, responses }));
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.peer).toEqual({ status: "insufficient_responses" });
    expect(item1.colleagueRange).toEqual({ low: 2, high: 5, average: 3.5 });
  });

  it("colleague range is null when no colleague rated the item at all", () => {
    const self = makeRaters("self", 1);
    const responses = [scaleResponse(self[0].id, ITEM_C1.id, 3)];
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: self, responses }));
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.colleagueRange).toBeNull();
  });

  it("orders competencies by number, and items within a competency by item number, never by score", () => {
    const peers = makeRaters("peer", 3);
    const responses = peers.flatMap((r) => [
      scaleResponse(r.id, ITEM_C1.id, 1), // lower score but item 1
      scaleResponse(r.id, ITEM_C1_B.id, 5), // higher score but item 2
    ]);
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: peers, responses }));
    expect(c1.items.map((i) => i.itemNumber)).toEqual([1, 2]);
  });
});

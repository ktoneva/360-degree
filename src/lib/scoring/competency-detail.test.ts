import { beforeEach, describe, expect, it } from "vitest";
import { computeCompetencyDetailTables } from "./competency-detail";
import { ITEM_C1, ITEM_C1_B, buildDataset, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";

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

  it("item row: a group with n<3 on this specific item shows merged, even if the competency-level summary reported it separately", () => {
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

    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.peer).toEqual({ status: "merged" }); // only 1 peer answered this item specifically
  });

  it("self and manager are always shown plainly regardless of n", () => {
    const self = makeRaters("self", 1);
    const responses = [scaleResponse(self[0].id, ITEM_C1.id, 3)];
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: self, responses }));
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.self).toEqual({ status: "reported", mean: 3, n: 1 });
    expect(item1.manager).toEqual({ status: "no_data" });
  });

  it("colleague range is computed unconditionally, even when the group cells are merged for anonymity", () => {
    const peers = makeRaters("peer", 2); // under 3 -> merged
    const responses = [scaleResponse(peers[0].id, ITEM_C1.id, 2), scaleResponse(peers[1].id, ITEM_C1.id, 5)];
    const [c1] = computeCompetencyDetailTables(buildDataset({ raters: peers, responses }));
    const item1 = c1.items.find((i) => i.itemId === ITEM_C1.id)!;
    expect(item1.peer).toEqual({ status: "merged" });
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

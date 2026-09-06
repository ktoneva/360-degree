import { beforeEach, describe, expect, it } from "vitest";
import { computeItemLevelAppendix } from "./item-appendix";
import { ITEM_C1, buildDataset, makeRaters, resetRaterCounter, scaleResponse } from "./test-utils";

beforeEach(() => resetRaterCounter());

describe("computeItemLevelAppendix", () => {
  it("reports every group's raw mean and n with no threshold or merge", () => {
    const peers = makeRaters("peer", 2); // would be merged/suppressed everywhere else
    const responses = peers.map((p) => scaleResponse(p.id, ITEM_C1.id, 5));
    const rows = computeItemLevelAppendix(buildDataset({ raters: peers, responses }));
    const row = rows.find((r) => r.itemId === ITEM_C1.id)!;
    expect(row.groups.peer).toEqual({ mean: 5, n: 2 });
    expect(row.groups.self).toEqual({ mean: null, n: 0 });
  });

  it("counts 'not able to comment' across all groups for the item", () => {
    const peers = makeRaters("peer", 2);
    const directReports = makeRaters("direct_report", 1);
    const responses = [
      scaleResponse(peers[0].id, ITEM_C1.id, 5),
      scaleResponse(peers[1].id, ITEM_C1.id, null),
      scaleResponse(directReports[0].id, ITEM_C1.id, null),
    ];
    const rows = computeItemLevelAppendix(
      buildDataset({ raters: [...peers, ...directReports], responses }),
    );
    const row = rows.find((r) => r.itemId === ITEM_C1.id)!;
    expect(row.notAbleToCommentCount).toBe(2);
  });

  it("excludes integrity items from the appendix", () => {
    const rows = computeItemLevelAppendix(buildDataset());
    expect(rows.some((r) => r.itemId === "c7i5" || r.itemId === "c7i6")).toBe(false);
  });

  it("orders rows by competency then item number", () => {
    const rows = computeItemLevelAppendix(buildDataset());
    const order = rows.map((r) => [r.competencyNumber, r.itemNumber]);
    expect(order).toEqual([...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  });
});

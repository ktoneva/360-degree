import { beforeEach, describe, expect, it } from "vitest";
import { computeSafeguardingCounts } from "./safeguarding";
import { buildDataset, integrityResponse, makeRaters, resetRaterCounter } from "./test-utils";

beforeEach(() => resetRaterCounter());

describe("computeSafeguardingCounts", () => {
  it("tallies yes/no/not_observed for both integrity items, with no mean anywhere", () => {
    const raters = makeRaters("peer", 4);
    const responses = [
      integrityResponse(raters[0].id, "c7i5", "yes"),
      integrityResponse(raters[1].id, "c7i5", "yes"),
      integrityResponse(raters[2].id, "c7i5", "no"),
      integrityResponse(raters[3].id, "c7i5", "not_observed"),
      integrityResponse(raters[0].id, "c7i6", "not_observed"),
    ];
    const result = computeSafeguardingCounts(buildDataset({ raters, responses }));

    expect(result).toHaveLength(2);
    const item5 = result.find((r) => r.itemNumber === 5)!;
    expect(item5).toEqual({ itemId: "c7i5", itemNumber: 5, yes: 2, no: 1, notObserved: 1 });
    expect(item5).not.toHaveProperty("mean");

    const item6 = result.find((r) => r.itemNumber === 6)!;
    expect(item6).toEqual({ itemId: "c7i6", itemNumber: 6, yes: 0, no: 0, notObserved: 1 });
  });

  it("counts across every rater group with no anonymity threshold or breakdown", () => {
    const self = makeRaters("self", 1);
    const manager = makeRaters("manager", 1);
    const peer = makeRaters("peer", 1); // a single peer would be suppressed everywhere else
    const responses = [
      integrityResponse(self[0].id, "c7i5", "yes"),
      integrityResponse(manager[0].id, "c7i5", "yes"),
      integrityResponse(peer[0].id, "c7i5", "yes"),
    ];
    const result = computeSafeguardingCounts(
      buildDataset({ raters: [...self, ...manager, ...peer], responses }),
    );
    const item5 = result.find((r) => r.itemNumber === 5)!;
    expect(item5.yes).toBe(3); // no group filtering, no n>=3 gate
  });

  it("returns zero counts for an integrity item nobody has answered yet", () => {
    const result = computeSafeguardingCounts(buildDataset());
    expect(result).toEqual([
      { itemId: "c7i5", itemNumber: 5, yes: 0, no: 0, notObserved: 0 },
      { itemId: "c7i6", itemNumber: 6, yes: 0, no: 0, notObserved: 0 },
    ]);
  });
});

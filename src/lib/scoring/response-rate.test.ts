import { describe, expect, it } from "vitest";
import { computeResponseRates } from "./response-rate";

describe("computeResponseRates", () => {
  it("counts invited and completed per group, including groups with zero raters", () => {
    const result = computeResponseRates([
      { group: "self", completed: true },
      { group: "peer", completed: true },
      { group: "peer", completed: true },
      { group: "peer", completed: false },
    ]);

    expect(result).toEqual([
      { group: "self", invited: 1, completed: 1 },
      { group: "manager", invited: 0, completed: 0 },
      { group: "peer", invited: 3, completed: 2 },
      { group: "direct_report", invited: 0, completed: 0 },
      { group: "other", invited: 0, completed: 0 },
    ]);
  });
});

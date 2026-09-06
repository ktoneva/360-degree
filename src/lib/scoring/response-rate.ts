import { ALL_RATER_GROUPS, type RaterGroup } from "./types";

export interface ResponseRateInput {
  group: RaterGroup;
  completed: boolean;
}

export interface ResponseRateRow {
  group: RaterGroup;
  invited: number;
  completed: number;
}

/** Invited vs. completed count per rater group, for the report cover page. */
export function computeResponseRates(raters: ResponseRateInput[]): ResponseRateRow[] {
  return ALL_RATER_GROUPS.map((group) => {
    const inGroup = raters.filter((r) => r.group === group);
    return {
      group,
      invited: inGroup.length,
      completed: inGroup.filter((r) => r.completed).length,
    };
  });
}

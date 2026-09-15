/**
 * Pure data types for the scoring engine. Deliberately independent of the
 * Supabase schema and the UI — callers adapt DB rows into this shape.
 */

export type RaterGroup = "self" | "manager" | "peer" | "direct_report" | "other";

export const ALL_RATER_GROUPS: RaterGroup[] = ["self", "manager", "peer", "direct_report", "other"];

/** The three rater groups that are ever merged or suppressed for anonymity. */
export type MergeableGroup = "peer" | "direct_report" | "other";

export const MERGEABLE_GROUPS: MergeableGroup[] = ["peer", "direct_report", "other"];

/** The platform-wide anonymity threshold (Design decisions, row 10): a
 * colleague group's figure is shown once this many distinct people have
 * responded. Every cycle uses this unless it has a documented, named
 * ScoringDataset.anonymityThreshold override (row 25) -- never a setting an
 * admin can change in the ordinary cycle-creation flow. */
export const STANDARD_ANONYMITY_THRESHOLD = 3;

export interface ScoringItem {
  id: string;
  competencyNumber: number;
  itemNumber: number;
  /** True only for 7.5/7.6. Never included in any mean; never in blind spots,
   * hidden strengths, competency overview, rater group comparison, or
   * development priorities. Reported only via the safeguarding integrity check. */
  isIntegrityItem: boolean;
  /** Which rater groups this item is actually on the questionnaire for --
   * self and manager typically see everything, peers/direct_reports/others
   * each see a different subset (rater load varies by group). A group not
   * in this list was never asked the item at all, which is a genuine
   * not-applicable, never an anonymity suppression -- the 2 must render
   * differently (v15). */
  askedRaterGroups: RaterGroup[];
}

export interface ScoringRater {
  id: string;
  group: RaterGroup;
}

/**
 * One row per rater per item that has *some* recorded answer. Omit the row
 * entirely if the rater never answered that item at all — that omission is
 * the only way "never answered" is represented, and it is NOT the same as
 * "not able to comment" (a row with scaleValue null): the former never
 * counts toward anything, the latter is excluded from every mean but still
 * counts as a response for the n>=3 anonymity threshold (v15).
 */
export interface ScoringResponse {
  raterId: string;
  itemId: string;
  /** 1-6 for a real scale rating; null for "not able to comment" (a row
   * still exists) — for a scored item, never null because the item was
   * simply unanswered, since an unanswered item has no row at all. */
  scaleValue: number | null;
  /** yes/no/not_observed for an integrity item's answer; null otherwise. */
  integrityValue: "yes" | "no" | "not_observed" | null;
}

/** One row per (rater, item) the rater nominated as a top-2 development priority. */
export interface ScoringNomination {
  raterId: string;
  itemId: string;
}

export interface ScoringDataset {
  items: ScoringItem[];
  raters: ScoringRater[];
  responses: ScoringResponse[];
  nominations: ScoringNomination[];
  /** Overrides STANDARD_ANONYMITY_THRESHOLD for this cycle's report only.
   * Undefined/null means the standard threshold applies -- this field exists
   * for a single documented, one-off exception (Design decisions, row 25),
   * never a general setting, and is never populated from anything an admin
   * can set in the ordinary cycle-creation flow. */
  anonymityThreshold?: number | null;
}

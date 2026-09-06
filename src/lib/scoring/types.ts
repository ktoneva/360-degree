/**
 * Pure data types for the scoring engine. Deliberately independent of the
 * Supabase schema and the UI — callers adapt DB rows into this shape.
 */

export type RaterGroup = "self" | "manager" | "peer" | "direct_report" | "other";

export const ALL_RATER_GROUPS: RaterGroup[] = ["self", "manager", "peer", "direct_report", "other"];

/** The three rater groups that are ever merged or suppressed for anonymity. */
export type MergeableGroup = "peer" | "direct_report" | "other";

export const MERGEABLE_GROUPS: MergeableGroup[] = ["peer", "direct_report", "other"];

export interface ScoringItem {
  id: string;
  competencyNumber: number;
  itemNumber: number;
  /** True only for 7.5/7.6. Never included in any mean; never in blind spots,
   * hidden strengths, competency overview, rater group comparison, or
   * development priorities. Reported only via the safeguarding integrity check. */
  isIntegrityItem: boolean;
}

export interface ScoringRater {
  id: string;
  group: RaterGroup;
}

/**
 * One row per rater per item that has *some* recorded answer. Omit the row
 * entirely if the rater never answered that item — that's equivalent to
 * "not able to comment" for every calculation here.
 */
export interface ScoringResponse {
  raterId: string;
  itemId: string;
  /** 1-6 for a real scale rating; null for "not able to comment" or unanswered. */
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
}

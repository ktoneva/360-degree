import { createAdminClient } from "@/lib/supabase/admin";
import type { CompetencyVariant, RaterGroup } from "@/lib/types";
import {
  computeBlindSpots,
  computeCompetencyDetailTables,
  computeDevelopmentPriorities,
  computeHiddenStrengths,
  computeHighestLowestItems,
  type CompetencyDetailItemRow,
  type CompetencySummaryRow,
  type DevelopmentPriorityItemResult,
  type GapItemResult,
  type RankedItemMean,
  type ScoringDataset,
} from "@/lib/scoring";
import { getCycleItems, type CycleItem } from "./get-cycle-items";
import { fetchAllRows } from "./fetch-all-rows";

export interface ReportCompetencyTable {
  competencyNumber: number;
  competencyName: string;
  summary: CompetencySummaryRow;
  items: (CompetencyDetailItemRow & { behaviourText: string })[];
}

export interface IndividualReportData {
  leaderName: string;
  roleTitle: string | null;
  organisationName: string | null;
  /** ISO date string, or null if the cycle hasn't been marked complete --
   * the caller decides whether that means "not ready to report" at all. */
  completedAt: string | null;
  /** True only when this cycle carries a documented, one-off anonymity
   * threshold override (Design decisions, row 25) -- tells the report to
   * show the standard disclosure that some colleague figures rest on fewer
   * responses than the platform minimum. Never true for an ordinary cycle. */
  anonymityOverrideNotice: boolean;
  competencyTables: ReportCompetencyTable[];
  blindSpots: (GapItemResult & { behaviourText: string; competencyName: string })[];
  hiddenStrengths: (GapItemResult & { behaviourText: string; competencyName: string })[];
  highestLowest: {
    highest: (RankedItemMean & { behaviourText: string; competencyName: string })[];
    lowest: (RankedItemMean & { behaviourText: string; competencyName: string })[];
  };
  developmentPriorities: (DevelopmentPriorityItemResult & { behaviourText: string; competencyName: string })[];
  /** One entry per rater who left a per-competency comment -- shown as
   * submitted, not merged across raters. */
  competencyComments: { competencyNumber: number; competencyName: string; text: string }[];
  overallComments: { continueText: string | null; startText: string | null; stopText: string | null }[];
}

/** Returns null when the cycle doesn't exist, so the caller can 404 instead
 * of rendering a broken report. Does not itself check completion status --
 * the caller decides whether an incomplete cycle should even reach here. */
export async function buildIndividualReportData(cycleId: string): Promise<IndividualReportData | null> {
  const supabase = createAdminClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("review_cycles")
    .select(
      "competency_9_variant, completed_at, anonymity_threshold_override, review_subjects(full_name, role_title), organisations(name)",
    )
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleError) throw new Error(cycleError.message);
  if (!cycle) return null;

  const anonymityThreshold = cycle.anonymity_threshold_override as number | null;

  const subject = Array.isArray(cycle.review_subjects) ? cycle.review_subjects[0] : cycle.review_subjects;
  const organisation = Array.isArray(cycle.organisations) ? cycle.organisations[0] : cycle.organisations;
  const competency9Variant = cycle.competency_9_variant as CompetencyVariant;

  const items = await getCycleItems(supabase, competency9Variant);
  const itemMeta = new Map(items.map((i) => [i.id, i]));
  const competencyNameByNumber = new Map(items.map((i) => [i.competencyNumber, i.competencyName]));

  const { data: raters, error: ratersError } = await supabase
    .from("raters")
    .select("id, rater_group")
    .eq("review_cycle_id", cycleId)
    .is("archived_at", null);
  if (ratersError) throw new Error(ratersError.message);

  const raterIds = (raters ?? []).map((r) => r.id as string);

  // A single busy leader (many raters, most of the item bank each) can
  // plausibly exceed Supabase's unpaginated 1000-row cap on its own, so
  // responses pages through explicitly rather than trusting one select() --
  // the other 3 tables are bounded far below that per rater and stay as a
  // single query each, run in parallel.
  const [{ data: nominations, error: nominationsError }, { data: comments, error: commentsError }, { data: competencyCommentRows, error: competencyCommentsError }] =
    await Promise.all([
      raterIds.length === 0
        ? { data: [], error: null }
        : supabase.from("forced_choice_nominations").select("rater_id, item_id").in("rater_id", raterIds),
      raterIds.length === 0
        ? { data: [], error: null }
        : supabase.from("comments").select("continue_text, start_text, stop_text").in("rater_id", raterIds),
      raterIds.length === 0
        ? { data: [], error: null }
        : supabase.from("competency_comments").select("competency_number, comment_text").in("rater_id", raterIds),
    ]);
  if (nominationsError) throw new Error(nominationsError.message);
  if (commentsError) throw new Error(commentsError.message);
  if (competencyCommentsError) throw new Error(competencyCommentsError.message);

  const responses =
    raterIds.length === 0
      ? []
      : await fetchAllRows<{ rater_id: string; item_id: string; scale_value: number | null; integrity_value: string | null }>(
          (from, to) =>
            supabase
              .from("responses")
              .select("rater_id, item_id, scale_value, integrity_value")
              .in("rater_id", raterIds)
              .range(from, to),
        );

  const dataset: ScoringDataset = {
    items: items.map((i) => ({
      id: i.id,
      competencyNumber: i.competencyNumber,
      itemNumber: i.itemNumber,
      isIntegrityItem: i.isIntegrityItem,
      askedRaterGroups: i.askedRaterGroups,
    })),
    raters: (raters ?? []).map((r) => ({ id: r.id as string, group: r.rater_group as RaterGroup })),
    responses: (responses ?? []).map((r) => ({
      raterId: r.rater_id as string,
      itemId: r.item_id as string,
      scaleValue: r.scale_value as number | null,
      integrityValue: r.integrity_value as "yes" | "no" | "not_observed" | null,
    })),
    nominations: (nominations ?? []).map((n) => ({
      raterId: n.rater_id as string,
      itemId: n.item_id as string,
    })),
    anonymityThreshold,
  };

  function meta(itemId: string): CycleItem {
    const m = itemMeta.get(itemId);
    if (!m) throw new Error(`Unknown item id in scoring result: ${itemId}`);
    return m;
  }

  return {
    leaderName: subject?.full_name ?? "Unknown leader",
    roleTitle: subject?.role_title ?? null,
    organisationName: organisation?.name ?? null,
    completedAt: cycle.completed_at,
    anonymityOverrideNotice: anonymityThreshold != null && anonymityThreshold < 3,

    competencyTables: computeCompetencyDetailTables(dataset).map((table) => ({
      ...table,
      competencyName: competencyNameByNumber.get(table.competencyNumber) ?? "",
      items: table.items.map((item) => ({ ...item, behaviourText: meta(item.itemId).behaviourText })),
    })),

    blindSpots: computeBlindSpots(dataset).map((row) => ({
      ...row,
      behaviourText: meta(row.itemId).behaviourText,
      competencyName: meta(row.itemId).competencyName,
    })),

    hiddenStrengths: computeHiddenStrengths(dataset).map((row) => ({
      ...row,
      behaviourText: meta(row.itemId).behaviourText,
      competencyName: meta(row.itemId).competencyName,
    })),

    highestLowest: (() => {
      const { highest, lowest } = computeHighestLowestItems(dataset);
      const enrich = (row: (typeof highest)[number]) => ({
        ...row,
        behaviourText: meta(row.itemId).behaviourText,
        competencyName: meta(row.itemId).competencyName,
      });
      return { highest: highest.map(enrich), lowest: lowest.map(enrich) };
    })(),

    developmentPriorities: computeDevelopmentPriorities(dataset).map((row) => ({
      ...row,
      behaviourText: meta(row.itemId).behaviourText,
      competencyName: meta(row.itemId).competencyName,
    })),

    competencyComments: (competencyCommentRows ?? [])
      .map((c) => ({
        competencyNumber: c.competency_number as number,
        competencyName: competencyNameByNumber.get(c.competency_number as number) ?? "",
        text: c.comment_text as string,
      }))
      .sort((a, b) => a.competencyNumber - b.competencyNumber),

    overallComments: (comments ?? [])
      .map((c) => ({
        continueText: c.continue_text as string | null,
        startText: c.start_text as string | null,
        stopText: c.stop_text as string | null,
      }))
      .filter((c) => c.continueText || c.startText || c.stopText),
  };
}

import { createAdminClient } from "@/lib/supabase/admin";
import type { CompetencyVariant, RaterGroup } from "@/lib/types";
import {
  computeBlindSpots,
  computeCompetencyOverview,
  computeDevelopmentPriorities,
  computeHiddenStrengths,
  computeHighestLowestItems,
  computeItemLevelAppendix,
  computeRaterGroupComparison,
  computeResponseRates,
  computeSafeguardingCounts,
  type ScoringDataset,
} from "@/lib/scoring";
import { getCycleItems, type CycleItem } from "./get-cycle-items";
import type { ReportData } from "./types";

/** Returns null when the cycle doesn't exist, so the caller can render a 404
 * instead of a generic crash. Any other failure still throws, to be caught
 * by the nearest error.tsx boundary. */
export async function buildReportData(cycleId: string): Promise<ReportData | null> {
  const supabase = createAdminClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("review_cycles")
    .select(
      "name, period_start, period_end, competency_9_variant, review_subjects(full_name, role_title)",
    )
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleError) throw new Error(cycleError.message);
  if (!cycle) return null;

  const subject = Array.isArray(cycle.review_subjects) ? cycle.review_subjects[0] : cycle.review_subjects;
  const competency9Variant = cycle.competency_9_variant as CompetencyVariant;

  const items = await getCycleItems(supabase, competency9Variant);
  const itemMeta = new Map(items.map((i) => [i.id, i]));

  const [{ data: raters, error: ratersError }] = await Promise.all([
    supabase.from("raters").select("id, rater_group, completed_at").eq("review_cycle_id", cycleId),
  ]);
  if (ratersError) throw new Error(ratersError.message);

  const raterIds = (raters ?? []).map((r) => r.id as string);

  const [
    { data: responses, error: responsesError },
    { data: nominations, error: nominationsError },
    { data: comments, error: commentsError },
  ] = await Promise.all([
    raterIds.length === 0
      ? { data: [], error: null }
      : supabase
          .from("responses")
          .select("rater_id, item_id, scale_value, integrity_value")
          .in("rater_id", raterIds),
    raterIds.length === 0
      ? { data: [], error: null }
      : supabase.from("forced_choice_nominations").select("rater_id, item_id").in("rater_id", raterIds),
    raterIds.length === 0
      ? { data: [], error: null }
      : supabase
          .from("comments")
          .select("rater_id, continue_text, start_text, stop_text")
          .in("rater_id", raterIds),
  ]);
  if (responsesError) throw new Error(responsesError.message);
  if (nominationsError) throw new Error(nominationsError.message);
  if (commentsError) throw new Error(commentsError.message);

  const raterGroupById = new Map((raters ?? []).map((r) => [r.id as string, r.rater_group as RaterGroup]));

  const dataset: ScoringDataset = {
    items: items.map((i) => ({
      id: i.id,
      competencyNumber: i.competencyNumber,
      itemNumber: i.itemNumber,
      isIntegrityItem: i.isIntegrityItem,
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
  };

  function meta(itemId: string): CycleItem {
    const m = itemMeta.get(itemId);
    if (!m) throw new Error(`Unknown item id in scoring result: ${itemId}`);
    return m;
  }

  const competencyNameByNumber = new Map(items.map((i) => [i.competencyNumber, i.competencyName]));

  return {
    leaderName: subject?.full_name ?? "Unknown leader",
    roleTitle: subject?.role_title ?? null,
    cycleName: cycle.name,
    periodStart: cycle.period_start,
    periodEnd: cycle.period_end,
    competency9Variant,

    responseRates: computeResponseRates(
      (raters ?? []).map((r) => ({
        group: r.rater_group as RaterGroup,
        completed: r.completed_at !== null,
      })),
    ),

    competencyOverview: computeCompetencyOverview(dataset).map((row) => ({
      ...row,
      competencyName: competencyNameByNumber.get(row.competencyNumber) ?? "",
    })),

    raterGroupComparison: computeRaterGroupComparison(dataset).map((row) => ({
      ...row,
      competencyName: competencyNameByNumber.get(row.competencyNumber) ?? "",
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

    highestLowestItems: (() => {
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

    itemAppendix: computeItemLevelAppendix(dataset).map((row) => ({
      ...row,
      behaviourText: meta(row.itemId).behaviourText,
      competencyName: meta(row.itemId).competencyName,
    })),

    safeguarding: computeSafeguardingCounts(dataset).map((row) => ({
      ...row,
      behaviourText: meta(row.itemId).behaviourText,
    })),

    comments: (comments ?? [])
      .map((c) => ({
        raterId: c.rater_id as string,
        group: raterGroupById.get(c.rater_id as string) ?? "other",
        continueText: c.continue_text as string | null,
        startText: c.start_text as string | null,
        stopText: c.stop_text as string | null,
      }))
      .filter((c) => c.continueText || c.startText || c.stopText),
  };
}

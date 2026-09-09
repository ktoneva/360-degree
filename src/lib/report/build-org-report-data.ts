import { createAdminClient } from "@/lib/supabase/admin";
import type { CompetencyVariant, LeaderLevel } from "@/lib/types";
import {
  computeOrgOverview,
  type OrgLeaderInput,
  type OrgOverviewRow,
  type RaterGroup as ScoringRaterGroup,
} from "@/lib/scoring";
import { getCycleItems, type CycleItem } from "./get-cycle-items";

export interface OrgReportData {
  organisationName: string;
  /** Distinct completed cycles (= leaders) included, regardless of row-level
   * n>=3 suppression -- shown so "why is this empty" is never a mystery. */
  leaderCount: number;
  rows: OrgOverviewRow[];
  /** Competency 1-8 names, keyed by number. Derived from whichever variant(s)
   * were actually fetched -- either one includes 1-8, since only #9 varies. */
  competencyNames: Record<number, string>;
  /** Competency 9's name for whichever variant(s) are actually in scope. */
  competency9VariantNames: Partial<Record<CompetencyVariant, string>>;
}

/**
 * Returns null when the organisation doesn't exist, so the caller can 404
 * instead of rendering an empty report for a bad id.
 */
export async function buildOrgReportData(
  organisationId: string,
  level: LeaderLevel | null,
): Promise<OrgReportData | null> {
  const supabase = createAdminClient();

  const { data: organisation, error: orgError } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!organisation) return null;

  let cyclesQuery = supabase
    .from("review_cycles")
    .select("id, competency_9_variant, review_subjects(full_name)")
    .eq("organisation_id", organisationId)
    // Only cycles the admin has explicitly marked complete ever feed an
    // aggregate -- an open cycle's numbers could still change.
    .eq("status", "closed");
  if (level) cyclesQuery = cyclesQuery.eq("level", level);

  const { data: cycles, error: cyclesError } = await cyclesQuery;
  if (cyclesError) throw new Error(cyclesError.message);

  if (!cycles || cycles.length === 0) {
    return {
      organisationName: organisation.name,
      leaderCount: 0,
      rows: computeOrgOverview([]),
      competencyNames: {},
      competency9VariantNames: {},
    };
  }

  const itemsByVariant = new Map<CompetencyVariant, CycleItem[]>();
  for (const variant of ["standard", "ops"] as const) {
    if (cycles.some((c) => c.competency_9_variant === variant)) {
      itemsByVariant.set(variant, await getCycleItems(supabase, variant));
    }
  }

  const competencyNames: Record<number, string> = {};
  const competency9VariantNames: Partial<Record<CompetencyVariant, string>> = {};
  for (const [variant, items] of itemsByVariant) {
    for (const item of items) {
      if (item.competencyNumber === 9) {
        competency9VariantNames[variant] = item.competencyName;
      } else {
        competencyNames[item.competencyNumber] = item.competencyName;
      }
    }
  }

  const cycleIds = cycles.map((c) => c.id);
  const { data: raters, error: ratersError } = await supabase
    .from("raters")
    .select("id, review_cycle_id, rater_group")
    .in("review_cycle_id", cycleIds)
    .is("archived_at", null);
  if (ratersError) throw new Error(ratersError.message);

  const raterIds = (raters ?? []).map((r) => r.id as string);
  const { data: responses, error: responsesError } =
    raterIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("responses")
          .select("rater_id, item_id, scale_value, integrity_value")
          .in("rater_id", raterIds);
  if (responsesError) throw new Error(responsesError.message);

  const ratersByCycle = new Map<string, { id: string; group: string }[]>();
  for (const r of raters ?? []) {
    const list = ratersByCycle.get(r.review_cycle_id as string) ?? [];
    list.push({ id: r.id as string, group: r.rater_group as string });
    ratersByCycle.set(r.review_cycle_id as string, list);
  }

  const responsesByRater = new Map<string, typeof responses>();
  for (const resp of responses ?? []) {
    const list = responsesByRater.get(resp.rater_id as string) ?? [];
    list.push(resp);
    responsesByRater.set(resp.rater_id as string, list);
  }

  const leaders: OrgLeaderInput[] = cycles.map((cycle) => {
    const subject = Array.isArray(cycle.review_subjects)
      ? cycle.review_subjects[0]
      : cycle.review_subjects;
    const variant = cycle.competency_9_variant as CompetencyVariant;
    const items = itemsByVariant.get(variant) ?? [];
    const cycleRaters = ratersByCycle.get(cycle.id) ?? [];
    const cycleResponses = cycleRaters.flatMap((r) => responsesByRater.get(r.id) ?? []);

    return {
      leaderId: cycle.id,
      leaderName: subject?.full_name ?? "Unknown leader",
      competency9Variant: variant,
      dataset: {
        items: items.map((i) => ({
          id: i.id,
          competencyNumber: i.competencyNumber,
          itemNumber: i.itemNumber,
          isIntegrityItem: i.isIntegrityItem,
        })),
        raters: cycleRaters.map((r) => ({ id: r.id, group: r.group as ScoringRaterGroup })),
        responses: cycleResponses.map((r) => ({
          raterId: r!.rater_id as string,
          itemId: r!.item_id as string,
          scaleValue: r!.scale_value as number | null,
          integrityValue: r!.integrity_value as "yes" | "no" | "not_observed" | null,
        })),
        nominations: [],
      },
    };
  });

  return {
    organisationName: organisation.name,
    leaderCount: leaders.length,
    rows: computeOrgOverview(leaders),
    competencyNames,
    competency9VariantNames,
  };
}

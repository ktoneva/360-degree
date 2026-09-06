import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompetencyVariant } from "@/lib/types";
import type { ScoringItem } from "@/lib/scoring";

export interface CycleItem extends ScoringItem {
  behaviourText: string;
  competencyName: string;
}

/**
 * Every item in the bank that applies to this cycle: every standard-variant
 * competency plus whichever competency-9 variant the cycle selected —
 * unlike getAssignedItems, not filtered to one rater group, since a report
 * covers every item regardless of who was asked it.
 */
export async function getCycleItems(
  supabase: SupabaseClient,
  competency9Variant: CompetencyVariant,
): Promise<CycleItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, item_number, behaviour_text, is_integrity_item, competencies(number, name, variant)");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const competency = Array.isArray(row.competencies) ? row.competencies[0] : row.competencies;
      return { row, competency } as {
        row: typeof row;
        competency: { number: number; name: string; variant: CompetencyVariant } | null;
      };
    })
    .filter(({ competency }) => {
      if (!competency) return false;
      return competency.number === 9
        ? competency.variant === competency9Variant
        : competency.variant === "standard";
    })
    .map(
      ({ row, competency }): CycleItem => ({
        id: row.id as string,
        competencyNumber: competency!.number,
        competencyName: competency!.name,
        itemNumber: row.item_number as number,
        behaviourText: row.behaviour_text as string,
        isIntegrityItem: row.is_integrity_item as boolean,
      }),
    )
    .sort((a, b) => a.competencyNumber - b.competencyNumber || a.itemNumber - b.itemNumber);
}

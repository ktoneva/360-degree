import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignedItem, CompetencyVariant, RaterGroup } from "@/lib/types";

/**
 * The items a given rater group is asked in a cycle: every standard-variant
 * competency plus whichever competency-9 variant the cycle selected, filtered
 * to items that name this rater group, in competency/item order.
 */
export async function getAssignedItems(
  supabase: SupabaseClient,
  competency9Variant: CompetencyVariant,
  raterGroup: RaterGroup,
): Promise<AssignedItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, item_number, behaviour_text, response_type, is_integrity_item, asked_rater_groups, competencies(number, name, variant)",
    );

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const competency = Array.isArray(row.competencies) ? row.competencies[0] : row.competencies;
      return { row, competency } as { row: typeof row; competency: { number: number; name: string; variant: CompetencyVariant } | null };
    })
    .filter(({ row, competency }) => {
      if (!competency) return false;
      const variantMatches =
        competency.number === 9
          ? competency.variant === competency9Variant
          : competency.variant === "standard";
      const groupMatches = (row.asked_rater_groups as string[]).includes(raterGroup);
      return variantMatches && groupMatches;
    })
    .map(({ row, competency }) => ({
      id: row.id as string,
      competency_number: competency!.number,
      competency_name: competency!.name,
      item_number: row.item_number as number,
      behaviour_text: row.behaviour_text as string,
      response_type: row.response_type as AssignedItem["response_type"],
      is_integrity_item: row.is_integrity_item as boolean,
    }))
    .sort((a, b) => a.competency_number - b.competency_number || a.item_number - b.item_number);
}

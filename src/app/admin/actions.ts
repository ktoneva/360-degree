"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompetencyVariant, RaterGroup } from "@/lib/types";
import type { ActionState } from "@/lib/action-state";

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

export async function createReviewCycle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const leaderName = String(formData.get("leader_name") ?? "").trim();
  const roleTitle = String(formData.get("role_title") ?? "").trim() || null;
  const cycleName = String(formData.get("cycle_name") ?? "").trim();
  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");
  const competency9Variant = String(
    formData.get("competency_9_variant") ?? "standard",
  ) as CompetencyVariant;

  if (!leaderName || !cycleName || !periodStart || !periodEnd) {
    return { error: "Leader name, cycle name, and both dates are required.", successCount: 0 };
  }
  if (periodEnd < periodStart) {
    return { error: "End date can't be before the start date.", successCount: 0 };
  }

  // redirect() throws internally to work — it must never land inside this
  // try/catch, or a successful creation would be swallowed as an error.
  let newCycleId: string;
  try {
    const supabase = createAdminClient();

    const { data: existingSubject, error: findError } = await supabase
      .from("review_subjects")
      .select("id")
      .ilike("full_name", leaderName)
      .maybeSingle();
    if (findError) return { error: findError.message, successCount: 0 };

    let subjectId: string | undefined = existingSubject?.id;

    if (!subjectId) {
      const { data: newSubject, error: subjectError } = await supabase
        .from("review_subjects")
        .insert({ full_name: leaderName, role_title: roleTitle })
        .select("id")
        .single();
      if (subjectError) return { error: subjectError.message, successCount: 0 };
      subjectId = newSubject.id;
    }

    const { data: cycle, error: cycleError } = await supabase
      .from("review_cycles")
      .insert({
        review_subject_id: subjectId,
        name: cycleName,
        period_start: periodStart,
        period_end: periodEnd,
        competency_9_variant: competency9Variant,
      })
      .select("id")
      .single();
    if (cycleError) return { error: cycleError.message, successCount: 0 };

    newCycleId = cycle.id;
  } catch {
    return { error: UNEXPECTED_ERROR, successCount: 0 };
  }

  revalidatePath("/admin");
  redirect(`/admin/cycles/${newCycleId}`);
}

export async function addRater(
  cycleId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const raterGroup = String(formData.get("rater_group") ?? "") as RaterGroup;

  if (!raterGroup) {
    return { error: "Choose a rater group.", successCount: 0 };
  }

  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from("raters").insert({
      review_cycle_id: cycleId,
      rater_group: raterGroup,
      full_name: fullName,
      email,
    });

    if (error) {
      if (error.code === "23505") {
        const message =
          raterGroup === "self"
            ? "This cycle already has a self rater."
            : raterGroup === "manager"
              ? "This cycle already has a manager rater."
              : "That rater couldn't be added (duplicate).";
        return { error: message, successCount: 0 };
      }
      return { error: error.message, successCount: 0 };
    }

    revalidatePath(`/admin/cycles/${cycleId}`);
    return { error: null, successCount: _prevState.successCount + 1 };
  } catch {
    return { error: UNEXPECTED_ERROR, successCount: 0 };
  }
}

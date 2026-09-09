"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/require-admin-user";
import { LEADER_LEVELS } from "@/lib/types";
import type { CompetencyVariant, CycleStatus, LeaderLevel, RaterGroup } from "@/lib/types";
import type { ActionState } from "@/lib/action-state";

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

export async function createReviewCycle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Defense-in-depth: a Server Action is its own POST endpoint and must not
  // rely solely on the middleware redirect holding up.
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError, successCount: 0 };

  const leaderName = String(formData.get("leader_name") ?? "").trim();
  const roleTitle = String(formData.get("role_title") ?? "").trim() || null;
  const organisationId = String(formData.get("organisation_id") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim() as LeaderLevel | "";
  const cycleName = String(formData.get("cycle_name") ?? "").trim();
  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");
  const competency9Variant = String(
    formData.get("competency_9_variant") ?? "standard",
  ) as CompetencyVariant;
  const linkExpiryDaysRaw = String(formData.get("link_expiry_days") ?? "60").trim();
  const linkExpiryDays = Number(linkExpiryDaysRaw);

  if (!leaderName || !cycleName || !periodStart || !periodEnd) {
    return { error: "Leader name, cycle name, and both dates are required.", successCount: 0 };
  }
  if (!organisationId) {
    return { error: "Choose an organisation.", successCount: 0 };
  }
  if (!level || !LEADER_LEVELS.includes(level)) {
    return { error: "Choose the leader's level.", successCount: 0 };
  }
  if (periodEnd < periodStart) {
    return { error: "End date can't be before the start date.", successCount: 0 };
  }
  if (!Number.isInteger(linkExpiryDays) || linkExpiryDays < 1) {
    return { error: "Link expiry must be a whole number of days, 1 or more.", successCount: 0 };
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
        organisation_id: organisationId,
        level,
        name: cycleName,
        period_start: periodStart,
        period_end: periodEnd,
        competency_9_variant: competency9Variant,
        link_expiry_days: linkExpiryDays,
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

  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError, successCount: 0 };

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

export async function updateRater(
  raterId: string,
  cycleId: string,
  fields: { fullName: string; email: string; raterGroup: RaterGroup },
): Promise<{ error: string | null }> {
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError };

  const fullName = fields.fullName.trim() || null;
  const email = fields.email.trim() || null;

  if (!fields.raterGroup) {
    return { error: "Choose a rater group." };
  }

  try {
    const supabase = createAdminClient();

    // Only ever touches raters columns -- name/email/group are metadata
    // about the rater, never the rows in responses/forced_choice_nominations/
    // comments/competency_comments, so a submitted rater's answers are
    // untouched by this, whatever gets corrected here.
    const { error } = await supabase
      .from("raters")
      .update({ full_name: fullName, email, rater_group: fields.raterGroup })
      .eq("id", raterId);

    if (error) {
      if (error.code === "23505") {
        const message =
          fields.raterGroup === "self"
            ? "This cycle already has a self rater."
            : fields.raterGroup === "manager"
              ? "This cycle already has a manager rater."
              : "That rater couldn't be saved (duplicate).";
        return { error: message };
      }
      return { error: error.message };
    }

    revalidatePath(`/admin/cycles/${cycleId}`);
    return { error: null };
  } catch {
    return { error: UNEXPECTED_ERROR };
  }
}

/**
 * Removes a rater. Never trusts the caller about whether they've submitted
 * anything -- re-checks the actual response tables so the decision can't be
 * fooled by a stale admin-console view. A rater with zero rows anywhere is
 * hard-deleted outright; anyone with even one row (a full submission, or a
 * partial in-progress one -- both already feed into live scoring) is
 * archived instead, since a hard delete would cascade and permanently
 * destroy that data.
 */
export async function removeRater(
  raterId: string,
  cycleId: string,
): Promise<{ error: string | null; result?: "deleted" | "archived" }> {
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError };

  try {
    const supabase = createAdminClient();

    const [responses, nominations, comments, competencyComments] = await Promise.all([
      supabase.from("responses").select("id", { count: "exact", head: true }).eq("rater_id", raterId),
      supabase
        .from("forced_choice_nominations")
        .select("id", { count: "exact", head: true })
        .eq("rater_id", raterId),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("rater_id", raterId),
      supabase
        .from("competency_comments")
        .select("id", { count: "exact", head: true })
        .eq("rater_id", raterId),
    ]);
    const countError =
      responses.error ?? nominations.error ?? comments.error ?? competencyComments.error;
    if (countError) return { error: countError.message };

    const hasAnyData =
      (responses.count ?? 0) > 0 ||
      (nominations.count ?? 0) > 0 ||
      (comments.count ?? 0) > 0 ||
      (competencyComments.count ?? 0) > 0;

    if (!hasAnyData) {
      const { error } = await supabase.from("raters").delete().eq("id", raterId);
      if (error) return { error: error.message };
      revalidatePath(`/admin/cycles/${cycleId}`);
      return { error: null, result: "deleted" };
    }

    const { error } = await supabase
      .from("raters")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", raterId);
    if (error) return { error: error.message };

    revalidatePath(`/admin/cycles/${cycleId}`);
    revalidatePath(`/admin/cycles/${cycleId}/report`);
    return { error: null, result: "archived" };
  } catch {
    return { error: UNEXPECTED_ERROR };
  }
}

export async function unarchiveRater(
  raterId: string,
  cycleId: string,
): Promise<{ error: string | null }> {
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("raters")
      .update({ archived_at: null })
      .eq("id", raterId);
    if (error) return { error: error.message };

    revalidatePath(`/admin/cycles/${cycleId}`);
    revalidatePath(`/admin/cycles/${cycleId}/report`);
    return { error: null };
  } catch {
    return { error: UNEXPECTED_ERROR };
  }
}

export async function updateLinkExpiry(
  cycleId: string,
  days: number,
): Promise<{ error: string | null }> {
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError };

  if (!Number.isInteger(days) || days < 1) {
    return { error: "Link expiry must be a whole number of days, 1 or more." };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("review_cycles")
      .update({ link_expiry_days: days })
      .eq("id", cycleId);

    if (error) return { error: error.message };

    revalidatePath(`/admin/cycles/${cycleId}`);
    return { error: null };
  } catch {
    return { error: UNEXPECTED_ERROR };
  }
}

export async function createOrganisation(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError, successCount: 0 };

  const name = String(formData.get("name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;

  if (!name) {
    return { error: "Organisation name is required.", successCount: 0 };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("organisations").insert({
      name,
      contact_name: contactName,
      contact_email: contactEmail,
    });
    if (error) return { error: error.message, successCount: 0 };

    revalidatePath("/admin/organisations");
    revalidatePath("/admin/new");
    return { error: null, successCount: _prevState.successCount + 1 };
  } catch {
    return { error: UNEXPECTED_ERROR, successCount: 0 };
  }
}

const CLOSABLE_STATUSES: CycleStatus[] = ["draft", "open", "closed"];

export async function setCycleStatus(
  cycleId: string,
  status: CycleStatus,
): Promise<{ error: string | null }> {
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError };

  if (!CLOSABLE_STATUSES.includes(status)) {
    return { error: "Not a valid status." };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("review_cycles")
      .update({ status, completed_at: status === "closed" ? new Date().toISOString() : null })
      .eq("id", cycleId);
    if (error) return { error: error.message };

    revalidatePath(`/admin/cycles/${cycleId}`);
    revalidatePath(`/admin/cycles/${cycleId}/report`);
    return { error: null };
  } catch {
    return { error: UNEXPECTED_ERROR };
  }
}

export async function reopenRater(
  raterId: string,
  cycleId: string,
): Promise<{ error: string | null }> {
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError };

  try {
    const supabase = createAdminClient();
    // Clears completed_at only — prior answers stay in place so the rater's
    // existing responses appear pre-filled and only need correcting, not
    // redoing. The token itself never changes, since the same link is what
    // the admin has already shared with this rater.
    const { error } = await supabase
      .from("raters")
      .update({ completed_at: null })
      .eq("id", raterId);

    if (error) return { error: error.message };

    revalidatePath(`/admin/cycles/${cycleId}`);
    return { error: null };
  } catch {
    return { error: UNEXPECTED_ERROR };
  }
}

const NOTE_CARDS = ["strengths", "gaps", "stretch", "development"] as const;

export async function saveTeamReportNote(
  organisationId: string,
  level: LeaderLevel,
  card: (typeof NOTE_CARDS)[number],
  position: 1 | 2,
  who: string,
  what: string,
): Promise<{ error: string | null }> {
  const { error: authError } = await requireAdminUser();
  if (authError) return { error: authError };

  if (!NOTE_CARDS.includes(card) || (position !== 1 && position !== 2)) {
    return { error: "Not a valid card or position." };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("team_report_notes").upsert(
      { organisation_id: organisationId, level, card, position, who: who.trim(), what: what.trim() },
      { onConflict: "organisation_id,level,card,position" },
    );
    if (error) return { error: error.message };

    revalidatePath(`/admin/organisations/${organisationId}/team-report`);
    return { error: null };
  } catch {
    return { error: UNEXPECTED_ERROR };
  }
}

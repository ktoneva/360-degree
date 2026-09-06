"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssignedItems } from "@/lib/respond/assigned-items";
import type { CommentsValue, CompetencyVariant, RaterGroup, ResponseValue } from "@/lib/types";

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const INVALID_LINK_ERROR = "This link isn't valid.";
const ALREADY_SUBMITTED_ERROR = "This questionnaire has already been submitted.";

interface ActiveRater {
  id: string;
  review_cycle_id: string;
  rater_group: string;
  completed_at: string | null;
}

/**
 * Looks up the rater for a token. Never throws — every possible failure
 * (bad token, deleted cycle, a transient DB error) resolves to a null rater
 * or a caller-safe error string, since every action below is a server action
 * a client component calls directly and must never leave hanging on an
 * unhandled rejection.
 */
async function getActiveRater(
  token: string,
): Promise<{ supabase: ReturnType<typeof createAdminClient>; rater: ActiveRater | null; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const { data: rater, error } = await supabase
      .from("raters")
      .select("id, review_cycle_id, rater_group, completed_at")
      .eq("token", token)
      .maybeSingle();

    if (error) return { supabase, rater: null, error: GENERIC_ERROR };
    return { supabase, rater, error: null };
  } catch {
    // createAdminClient() itself can throw (e.g. missing env vars in a
    // misconfigured deployment) — still must not crash the caller.
    return { supabase: null as unknown as ReturnType<typeof createAdminClient>, rater: null, error: GENERIC_ERROR };
  }
}

export async function saveResponse(
  token: string,
  itemId: string,
  value: ResponseValue,
): Promise<{ error: string | null }> {
  try {
    const { supabase, rater, error: lookupError } = await getActiveRater(token);
    if (lookupError) return { error: lookupError };
    if (!rater) return { error: INVALID_LINK_ERROR };
    if (rater.completed_at) return { error: ALREADY_SUBMITTED_ERROR };

    const { error } = await supabase.from("responses").upsert(
      {
        rater_id: rater.id,
        item_id: itemId,
        scale_value: value.scale_value,
        not_observed: value.not_observed,
        integrity_value: value.integrity_value,
      },
      { onConflict: "rater_id,item_id" },
    );
    if (error) return { error: GENERIC_ERROR };

    await supabase
      .from("raters")
      .update({ started_at: new Date().toISOString() })
      .eq("id", rater.id)
      .is("started_at", null);

    return { error: null };
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function saveForcedChoice(
  token: string,
  itemIds: string[],
): Promise<{ error: string | null }> {
  if (itemIds.length > 2) return { error: "You can only choose 2." };

  try {
    const { supabase, rater, error: lookupError } = await getActiveRater(token);
    if (lookupError) return { error: lookupError };
    if (!rater) return { error: INVALID_LINK_ERROR };
    if (rater.completed_at) return { error: ALREADY_SUBMITTED_ERROR };

    const { error: deleteError } = await supabase
      .from("forced_choice_nominations")
      .delete()
      .eq("rater_id", rater.id);
    if (deleteError) return { error: GENERIC_ERROR };

    if (itemIds.length > 0) {
      const rows = itemIds.map((itemId, index) => ({
        rater_id: rater.id,
        item_id: itemId,
        priority_rank: index + 1,
      }));
      const { error: insertError } = await supabase.from("forced_choice_nominations").insert(rows);
      if (insertError) return { error: GENERIC_ERROR };
    }

    return { error: null };
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function saveComments(
  token: string,
  values: CommentsValue,
): Promise<{ error: string | null }> {
  try {
    const { supabase, rater, error: lookupError } = await getActiveRater(token);
    if (lookupError) return { error: lookupError };
    if (!rater) return { error: INVALID_LINK_ERROR };
    if (rater.completed_at) return { error: ALREADY_SUBMITTED_ERROR };

    const { error } = await supabase.from("comments").upsert(
      {
        rater_id: rater.id,
        continue_text: values.continue_text || null,
        start_text: values.start_text || null,
        stop_text: values.stop_text || null,
      },
      { onConflict: "rater_id" },
    );
    if (error) return { error: GENERIC_ERROR };
    return { error: null };
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function submitQuestionnaire(
  token: string,
  comments: CommentsValue,
): Promise<{ error: string | null }> {
  try {
    const { supabase, rater, error: lookupError } = await getActiveRater(token);
    if (lookupError) return { error: lookupError };
    if (!rater) return { error: INVALID_LINK_ERROR };
    if (rater.completed_at) return { error: null };

    const commentsResult = await saveComments(token, comments);
    if (commentsResult.error) return commentsResult;

    const { data: cycle, error: cycleError } = await supabase
      .from("review_cycles")
      .select("competency_9_variant")
      .eq("id", rater.review_cycle_id)
      .maybeSingle();
    if (cycleError) return { error: GENERIC_ERROR };
    if (!cycle) {
      return { error: "This review cycle no longer exists. Please contact whoever invited you." };
    }

    const assignedItems = await getAssignedItems(
      supabase,
      cycle.competency_9_variant as CompetencyVariant,
      rater.rater_group as RaterGroup,
    );

    const { data: responses, error: responsesError } = await supabase
      .from("responses")
      .select("item_id")
      .eq("rater_id", rater.id);
    if (responsesError) return { error: GENERIC_ERROR };

    const answeredIds = new Set((responses ?? []).map((r) => r.item_id as string));
    const missingCount = assignedItems.filter((item) => !answeredIds.has(item.id)).length;

    const { count: nominationCount, error: nominationsError } = await supabase
      .from("forced_choice_nominations")
      .select("id", { count: "exact", head: true })
      .eq("rater_id", rater.id);
    if (nominationsError) return { error: GENERIC_ERROR };

    const problems: string[] = [];
    if (missingCount > 0) {
      problems.push(
        `${missingCount} statement${missingCount === 1 ? "" : "s"} still need${missingCount === 1 ? "s" : ""} an answer.`,
      );
    }
    if ((nominationCount ?? 0) !== 2) {
      problems.push("Choose exactly 2 development priorities.");
    }

    if (problems.length > 0) {
      return { error: problems.join(" ") };
    }

    const { error: completeError } = await supabase
      .from("raters")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", rater.id);
    if (completeError) return { error: GENERIC_ERROR };

    revalidatePath(`/respond/${token}`);
    return { error: null };
  } catch {
    return { error: GENERIC_ERROR };
  }
}

import { createAdminClient } from "@/lib/supabase/admin";
import { getAssignedItems } from "@/lib/respond/assigned-items";
import { isLinkExpired } from "@/lib/respond/expiry";
import { checkRateLimit, getClientIp } from "@/lib/respond/rate-limit";
import type { CompetencyVariant, RaterGroup } from "@/lib/types";
import { Questionnaire } from "./questionnaire";

// Explicit, since Supabase-js calls aren't native fetch() and Next's static
// analysis can't otherwise tell this page depends on live data — this must
// never serve a stale cached page for a different rater's token.
export const dynamic = "force-dynamic";

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600">{body}</p>
    </div>
  );
}

const TRY_AGAIN_MESSAGE =
  "Something went wrong loading this questionnaire. Please refresh the page, or try again in a few minutes.";

export default async function RespondPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const ip = await getClientIp();
  const withinLimit = await checkRateLimit(`respond_page:${ip}`, 60, 600);
  if (!withinLimit) {
    return (
      <CenteredMessage
        title="Too many requests"
        body="You've made too many requests in a short time. Please wait a few minutes and try again."
      />
    );
  }

  const supabase = createAdminClient();

  const { data: rater, error: raterError } = await supabase
    .from("raters")
    .select("id, rater_group, completed_at, invited_at, review_cycle_id")
    .eq("token", token)
    .maybeSingle();

  if (raterError) {
    return <CenteredMessage title="Something went wrong" body={TRY_AGAIN_MESSAGE} />;
  }

  if (!rater) {
    return (
      <CenteredMessage
        title="Link not found"
        body="This link doesn't match an active questionnaire. Please check the link you were sent, or contact whoever invited you."
      />
    );
  }

  const { data: cycle, error: cycleError } = await supabase
    .from("review_cycles")
    .select("competency_9_variant, link_expiry_days, review_subjects(full_name)")
    .eq("id", rater.review_cycle_id)
    .maybeSingle();

  if (cycleError) {
    return <CenteredMessage title="Something went wrong" body={TRY_AGAIN_MESSAGE} />;
  }

  if (!cycle) {
    return (
      <CenteredMessage
        title="Review no longer available"
        body="This review cycle doesn't exist any more. Please contact whoever invited you."
      />
    );
  }

  const subject = Array.isArray(cycle.review_subjects)
    ? cycle.review_subjects[0]
    : cycle.review_subjects;
  const leaderName = subject?.full_name ?? "this leader";

  if (rater.completed_at) {
    return (
      <CenteredMessage
        title="Thank you"
        body={`Your feedback on ${leaderName} has been recorded. Honest feedback is a favour, not a formality — thank you for taking the time.`}
      />
    );
  }

  if (isLinkExpired(rater.invited_at, cycle.link_expiry_days)) {
    return (
      <CenteredMessage
        title="This link has expired"
        body="This questionnaire link is no longer active. Please contact whoever invited you if you still need to give feedback."
      />
    );
  }

  let items;
  try {
    items = await getAssignedItems(
      supabase,
      cycle.competency_9_variant as CompetencyVariant,
      rater.rater_group as RaterGroup,
    );
  } catch {
    return <CenteredMessage title="Something went wrong" body={TRY_AGAIN_MESSAGE} />;
  }

  if (items.length === 0) {
    return (
      <CenteredMessage
        title="Nothing to answer yet"
        body="There aren't any questions set up for your rater group on this review yet. Please contact whoever invited you."
      />
    );
  }

  const [
    { data: responses, error: responsesError },
    { data: nominations, error: nominationsError },
    { data: comments, error: commentsError },
  ] = await Promise.all([
    supabase
      .from("responses")
      .select("item_id, scale_value, not_observed, integrity_value")
      .eq("rater_id", rater.id),
    supabase.from("forced_choice_nominations").select("item_id").eq("rater_id", rater.id),
    supabase
      .from("comments")
      .select("continue_text, start_text, stop_text")
      .eq("rater_id", rater.id)
      .maybeSingle(),
  ]);

  if (responsesError || nominationsError || commentsError) {
    return <CenteredMessage title="Something went wrong" body={TRY_AGAIN_MESSAGE} />;
  }

  return (
    <Questionnaire
      token={token}
      leaderName={leaderName}
      raterGroup={rater.rater_group as RaterGroup}
      items={items}
      initialResponses={responses ?? []}
      initialNominationIds={(nominations ?? []).map((n) => n.item_id as string)}
      initialComments={{
        continue_text: comments?.continue_text ?? "",
        start_text: comments?.start_text ?? "",
        stop_text: comments?.stop_text ?? "",
      }}
    />
  );
}

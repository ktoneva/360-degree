"use client";

import { useMemo, useState, useTransition } from "react";
import { submitQuestionnaire } from "./actions";
import { ItemQuestion } from "./item-question";
import { ForcedChoice } from "./forced-choice";
import { CommentsSection } from "./comments-section";
import { CompetencyCommentBox } from "./competency-comment-box";
import { generalIntro, groupWording } from "@/lib/respond/briefing";
import { RespondHeader } from "./respond-header";
import { FORCED_CHOICE_PRIORITY_COUNT } from "@/lib/types";
import type { AssignedItem, CommentsValue, RaterGroup, ResponseValue } from "@/lib/types";

type ResponseRow = { item_id: string; scale_value: number | null; not_observed: boolean; integrity_value: string | null };

type Phase = "intro" | "group" | "form";

export function Questionnaire({
  token,
  leaderName,
  raterGroup,
  items,
  initialResponses,
  initialNominationIds,
  initialComments,
  initialCompetencyComments,
}: {
  token: string;
  leaderName: string;
  raterGroup: RaterGroup;
  items: AssignedItem[];
  initialResponses: ResponseRow[];
  initialNominationIds: string[];
  initialComments: CommentsValue;
  initialCompetencyComments: Record<number, string>;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(
    () => new Set(initialResponses.map((r) => r.item_id)),
  );
  const [nominationCount, setNominationCount] = useState(initialNominationIds.length);
  const [comments, setComments] = useState<CommentsValue>(initialComments);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const responsesByItem = useMemo(() => {
    const map = new Map<string, ResponseValue>();
    for (const row of initialResponses) {
      map.set(row.item_id, {
        scale_value: row.scale_value,
        not_observed: row.not_observed,
        integrity_value: row.integrity_value as ResponseValue["integrity_value"],
      });
    }
    return map;
    // Seed once; per-item components own their own live state after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const competencyGroups = useMemo(() => {
    const groups = new Map<number, { name: string; items: AssignedItem[] }>();
    for (const item of items) {
      if (!groups.has(item.competency_number)) {
        groups.set(item.competency_number, { name: item.competency_name, items: [] });
      }
      groups.get(item.competency_number)!.items.push(item);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [items]);

  function markAnswered(itemId: string) {
    setAnsweredIds((prev) => new Set(prev).add(itemId));
  }

  function handleSubmit() {
    setSubmitError(null);
    startSubmit(async () => {
      try {
        // On success the action revalidates this route, and the server
        // component re-renders straight to its "already submitted" branch —
        // there's no separate client success state to set here.
        const result = await submitQuestionnaire(token, comments);
        if (result.error) {
          setSubmitError(result.error);
        }
      } catch {
        setSubmitError("Couldn't submit — check your connection and try again.");
      }
    });
  }

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-white">
        <RespondHeader />
        <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-14">
          <h1 className="text-xl font-semibold text-brand-navy">Leadership feedback</h1>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
            {generalIntro(leaderName)}
          </p>
          <button
            type="button"
            onClick={() => setPhase("group")}
            className="mt-8 w-full rounded-md bg-brand-gold px-4 py-3 text-sm font-medium text-brand-navy hover:bg-brand-gold-dark"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (phase === "group") {
    return (
      <div className="min-h-screen bg-white">
        <RespondHeader />
        <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-14">
          <h1 className="text-xl font-semibold text-brand-navy">Before you start</h1>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
            {groupWording(
              raterGroup,
              leaderName,
              competencyGroups.map(([, group]) => group.name),
            )}
          </p>
          <button
            type="button"
            onClick={() => setPhase("form")}
            className="mt-8 w-full rounded-md bg-brand-gold px-4 py-3 text-sm font-medium text-brand-navy hover:bg-brand-gold-dark"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  const total = items.length;
  const answeredCount = answeredIds.size;
  const isComplete = total > 0 && answeredCount === total;

  return (
    <div className="min-h-screen bg-white pb-24">
      <RespondHeader />
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium text-zinc-600">
            {answeredCount} of {total} answered
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full transition-all ${
                isComplete
                  ? "bg-gradient-to-r from-[#B8872B] to-[#E8CE60]"
                  : "bg-brand-amber"
              }`}
              style={{ width: `${total === 0 ? 0 : (answeredCount / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-10 px-4 py-6">
        {competencyGroups.map(([competencyNumber, group]) => {
          const scoredItems = group.items.filter((item) => !item.is_integrity_item);
          const integrityItems = group.items.filter((item) => item.is_integrity_item);

          return (
            <section key={competencyNumber}>
              <h2 className="mb-3 text-lg font-semibold text-brand-gold">
                {competencyNumber}. {group.name}
              </h2>

              <div className="space-y-3">
                {scoredItems.map((item) => (
                  <ItemQuestion
                    key={item.id}
                    token={token}
                    item={item}
                    initialValue={responsesByItem.get(item.id)}
                    onSaved={markAnswered}
                  />
                ))}
              </div>

              {integrityItems.length > 0 && (
                <div className="mt-5 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/40 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Safeguarding practice — not scored
                  </p>
                  <div className="space-y-3">
                    {integrityItems.map((item) => (
                      <ItemQuestion
                        key={item.id}
                        token={token}
                        item={item}
                        initialValue={responsesByItem.get(item.id)}
                        onSaved={markAnswered}
                        className="border-amber-200"
                      />
                    ))}
                  </div>
                </div>
              )}

              <CompetencyCommentBox
                token={token}
                competencyNumber={competencyNumber}
                initialValue={initialCompetencyComments[competencyNumber] ?? ""}
              />
            </section>
          );
        })}

        <ForcedChoice
          token={token}
          items={items}
          initialSelectedIds={initialNominationIds}
          onSelectionChange={setNominationCount}
        />

        <CommentsSection token={token} value={comments} onChange={setComments} />

        <div className="border-t border-zinc-200 pt-6">
          {submitError && (
            <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{submitError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full rounded-md bg-brand-gold px-4 py-3 text-sm font-medium text-brand-navy hover:bg-brand-gold-dark disabled:opacity-50"
          >
            {isSubmitting ? "Submitting…" : "Submit my feedback"}
          </button>
          <p className="mt-2 text-center text-xs text-zinc-500">
            {answeredCount} of {total} statements answered &middot; {nominationCount} of{" "}
            {FORCED_CHOICE_PRIORITY_COUNT} priorities chosen
          </p>
        </div>
      </div>
    </div>
  );
}

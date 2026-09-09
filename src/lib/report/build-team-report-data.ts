import { createAdminClient } from "@/lib/supabase/admin";
import { LEADER_LEVEL_LABELS, type CompetencyVariant, type LeaderLevel, type RaterGroup } from "@/lib/types";
import {
  computeTeamItemAggregate,
  computeTeamMatrix,
  computeTeamPatternCandidates,
  round1,
  type TeamCompetencyMatrix,
  type TeamLeaderInput,
} from "@/lib/scoring";
import { getCycleItems, type CycleItem } from "./get-cycle-items";

export interface TeamReportLeader {
  leaderId: string;
  leaderName: string;
  initials: string;
}

export interface TeamReportNote {
  who: string;
  what: string;
}

export interface TeamReportMatrixRow {
  itemId: string;
  itemNumber: number;
  behaviourText: string;
  cells: { leaderId: string; allOthers: number | null }[];
}

export interface TeamReportMatrix {
  competencyNumber: number;
  competencyName: string;
  items: TeamReportMatrixRow[];
  strength: { leaderName: string; behaviourText: string; score: number } | null;
  gap: { leaderName: string; behaviourText: string; selfScore: number; othersScore: number } | null;
}

export interface TeamReportData {
  organisationName: string;
  levelLabel: string;
  leaders: TeamReportLeader[];
  periodStart: string | null;
  periodEnd: string | null;
  matrices: TeamReportMatrix[];
  notes: {
    strengths: TeamReportNote[];
    gaps: TeamReportNote[];
    stretch: TeamReportNote[];
    development: TeamReportNote[];
  };
}

const NOTE_CARDS = ["strengths", "gaps", "stretch", "development"] as const;
type NoteCard = (typeof NOTE_CARDS)[number];

function computeInitials(names: string[]): Map<string, string> {
  const used = new Set<string>();
  const result = new Map<string, string>();
  for (const name of names) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    let base = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    result.set(name, candidate);
  }
  return result;
}

/**
 * Returns null when the organisation doesn't exist. Returns a data object
 * with an empty leaders array (rather than null) when the org exists but no
 * completed cycles match this level yet, so the caller can say exactly that
 * rather than 404.
 */
export async function buildTeamReportData(
  organisationId: string,
  level: LeaderLevel,
): Promise<TeamReportData | null> {
  const supabase = createAdminClient();

  const { data: organisation, error: orgError } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!organisation) return null;

  const { data: cycles, error: cyclesError } = await supabase
    .from("review_cycles")
    .select("id, competency_9_variant, period_start, period_end, review_subjects(full_name)")
    .eq("organisation_id", organisationId)
    .eq("level", level)
    // Only cycles manually marked complete ever feed this report -- an open
    // cycle's numbers could still change.
    .eq("status", "closed");
  if (cyclesError) throw new Error(cyclesError.message);

  const emptyNotes = { strengths: [], gaps: [], stretch: [], development: [] };
  if (!cycles || cycles.length === 0) {
    return {
      organisationName: organisation.name,
      levelLabel: LEADER_LEVEL_LABELS[level],
      leaders: [],
      periodStart: null,
      periodEnd: null,
      matrices: [],
      notes: emptyNotes,
    };
  }

  const variant = cycles[0].competency_9_variant as CompetencyVariant;
  const items = await getCycleItems(supabase, variant);
  const itemMeta = new Map(items.map((i) => [i.id, i]));
  const competencyNameByNumber = new Map(items.map((i) => [i.competencyNumber, i.competencyName]));

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

  const leaderNames = new Map<string, string>();
  const teamLeaders: TeamLeaderInput[] = cycles.map((cycle) => {
    const subject = Array.isArray(cycle.review_subjects) ? cycle.review_subjects[0] : cycle.review_subjects;
    const leaderName = subject?.full_name ?? "Unknown leader";
    leaderNames.set(cycle.id, leaderName);
    const cycleRaters = ratersByCycle.get(cycle.id) ?? [];
    const cycleResponses = cycleRaters.flatMap((r) => responsesByRater.get(r.id) ?? []);

    return {
      leaderId: cycle.id,
      dataset: {
        items: items.map((i) => ({
          id: i.id,
          competencyNumber: i.competencyNumber,
          itemNumber: i.itemNumber,
          isIntegrityItem: i.isIntegrityItem,
        })),
        raters: cycleRaters.map((r) => ({ id: r.id, group: r.group as RaterGroup })),
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

  const initialsByName = computeInitials([...leaderNames.values()]);
  const leaders: TeamReportLeader[] = teamLeaders.map((l) => {
    const name = leaderNames.get(l.leaderId)!;
    return { leaderId: l.leaderId, leaderName: name, initials: initialsByName.get(name)! };
  });
  const leaderNameById = new Map(leaders.map((l) => [l.leaderId, l.leaderName]));

  const rawMatrices: TeamCompetencyMatrix[] = computeTeamMatrix(teamLeaders);
  const matrices: TeamReportMatrix[] = rawMatrices.map((m) => ({
    competencyNumber: m.competencyNumber,
    competencyName: competencyNameByNumber.get(m.competencyNumber) ?? "",
    items: m.items.map((row) => ({
      itemId: row.itemId,
      itemNumber: row.itemNumber,
      behaviourText: itemMeta.get(row.itemId)?.behaviourText ?? "",
      cells: row.cells.map((c) => ({ leaderId: c.leaderId, allOthers: c.allOthers === null ? null : round1(c.allOthers) })),
    })),
    strength: m.strengthInsight
      ? {
          leaderName: leaderNameById.get(m.strengthInsight.leaderId) ?? "Unknown leader",
          behaviourText: itemMeta.get(m.strengthInsight.itemId)?.behaviourText ?? "",
          score: round1(m.strengthInsight.score),
        }
      : null,
    gap: m.gapInsight
      ? {
          leaderName: leaderNameById.get(m.gapInsight.leaderId) ?? "Unknown leader",
          behaviourText: itemMeta.get(m.gapInsight.itemId)?.behaviourText ?? "",
          selfScore: round1(m.gapInsight.selfScore),
          othersScore: round1(m.gapInsight.othersScore),
        }
      : null,
  }));

  // Starting-point candidates for the editable "whole team, at a glance"
  // page -- computed fresh every time as a fallback, overridden per-slot by
  // whatever the consultant has actually saved.
  const allItemIds = items.filter((i) => !i.isIntegrityItem).map((i) => i.id);
  const itemAggregates = allItemIds
    .map((itemId) => ({ itemId, aggregate: computeTeamItemAggregate(teamLeaders, itemId) }))
    .filter((r) => r.aggregate.mode !== "insufficient")
    .map((r) => ({
      itemId: r.itemId,
      mean: (r.aggregate as { mean: number }).mean,
      leaderCount: r.aggregate.mode === "separate" || r.aggregate.mode === "merged" ? r.aggregate.leaderCount : 0,
    }));

  const byMeanDesc = [...itemAggregates].sort((a, b) => b.mean - a.mean);
  const byMeanAsc = [...itemAggregates].sort((a, b) => a.mean - b.mean);

  const overallStrength = matrices
    .flatMap((m) => (m.strength ? [{ ...m.strength }] : []))
    .sort((a, b) => b.score - a.score)[0];
  const overallGap = matrices
    .flatMap((m) => (m.gap ? [{ ...m.gap, gap: m.gap.selfScore - m.gap.othersScore }] : []))
    .sort((a, b) => b.gap - a.gap)[0];

  const { stretch, development } = computeTeamPatternCandidates(teamLeaders);

  const defaultNotes: Record<NoteCard, TeamReportNote[]> = {
    strengths: [
      byMeanDesc[0]
        ? {
            who: itemMeta.get(byMeanDesc[0].itemId)?.behaviourText ?? "",
            what: `Team-wide average ${round1(byMeanDesc[0].mean)} across ${byMeanDesc[0].leaderCount} leader${byMeanDesc[0].leaderCount === 1 ? "" : "s"}`,
          }
        : { who: "", what: "" },
      overallStrength
        ? { who: overallStrength.leaderName, what: `Rated ${overallStrength.score} on "${overallStrength.behaviourText}"` }
        : { who: "", what: "" },
    ],
    gaps: [
      byMeanAsc[0]
        ? {
            who: itemMeta.get(byMeanAsc[0].itemId)?.behaviourText ?? "",
            what: `Team-wide average ${round1(byMeanAsc[0].mean)} across ${byMeanAsc[0].leaderCount} leader${byMeanAsc[0].leaderCount === 1 ? "" : "s"}`,
          }
        : { who: "", what: "" },
      overallGap
        ? {
            who: overallGap.leaderName,
            what: `Self ${overallGap.selfScore}, team ${overallGap.othersScore} on "${overallGap.behaviourText}"`,
          }
        : { who: "", what: "" },
    ],
    stretch: [0, 1].map((i) =>
      stretch[i]
        ? {
            who: leaderNameById.get(stretch[i].leaderId) ?? "",
            what: `${stretch[i].count} item${stretch[i].count === 1 ? "" : "s"} where colleagues rate them higher than they rate themselves`,
          }
        : { who: "", what: "" },
    ),
    development: [0, 1].map((i) =>
      development[i]
        ? {
            who: leaderNameById.get(development[i].leaderId) ?? "",
            what: `${development[i].count} item${development[i].count === 1 ? "" : "s"} where they rate themselves higher than their colleagues do`,
          }
        : { who: "", what: "" },
    ),
  };

  const { data: savedNotes, error: notesError } = await supabase
    .from("team_report_notes")
    .select("card, position, who, what")
    .eq("organisation_id", organisationId)
    .eq("level", level);
  if (notesError) throw new Error(notesError.message);

  const notes = { strengths: [...defaultNotes.strengths], gaps: [...defaultNotes.gaps], stretch: [...defaultNotes.stretch], development: [...defaultNotes.development] };
  for (const row of savedNotes ?? []) {
    const card = row.card as NoteCard;
    const idx = (row.position as number) - 1;
    if (NOTE_CARDS.includes(card) && (idx === 0 || idx === 1) && (row.who || row.what)) {
      notes[card][idx] = { who: row.who as string, what: row.what as string };
    }
  }

  return {
    organisationName: organisation.name,
    levelLabel: LEADER_LEVEL_LABELS[level],
    leaders,
    periodStart: cycles.map((c) => c.period_start as string).sort()[0] ?? null,
    periodEnd: cycles.map((c) => c.period_end as string).sort().slice(-1)[0] ?? null,
    matrices,
    notes,
  };
}

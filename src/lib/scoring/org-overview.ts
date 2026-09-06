import { competencyGroupMean } from "./means";
import { computeCompetencyOverview } from "./competency-overview";
import type { ScoringDataset } from "./types";

/** Deliberately a local type, not imported from the app's CompetencyVariant —
 * this module stays independent of the Supabase schema and the UI, same as
 * the rest of src/lib/scoring. */
export type OrgCompetency9Variant = "standard" | "ops";

export interface OrgLeaderInput {
  leaderId: string;
  leaderName: string;
  /** Which competency-9 variant this leader's cycle used. Competencies 1-8
   * are unaffected; the two variants measure different constructs for #9,
   * so they're never pooled or averaged together. */
  competency9Variant: OrgCompetency9Variant;
  /** This leader's own complete dataset (their items already reflect their
   * own competency9Variant — getAssignedItems/getCycleItems only ever
   * include one variant's items for a given cycle). */
  dataset: ScoringDataset;
}

export interface OrgLeaderFigures {
  leaderId: string;
  leaderName: string;
  self: number | null;
  manager: number | null;
  allOthers: number | null;
}

interface OrgOverviewRowBase {
  competencyNumber: number;
  /** Set only for competencyNumber === 9, to say which of the two rows this is. */
  competency9Variant: OrgCompetency9Variant | null;
  /** Leaders relevant to *this row* — for competency 9 this is only the
   * leaders on the matching variant, which is why a level can clear n>=3
   * overall but still fall under it for one of the two competency-9 rows. */
  leaderCount: number;
}

export type OrgOverviewRow =
  | (OrgOverviewRowBase & {
      /** n>=3 relevant leaders: each leader's own (unchanged)
       * competency-overview figures shown individually, plus a summary
       * that's the mean of those leaders' figures — one leader, one vote,
       * regardless of how many raters any single leader had. Mirrors how
       * the platform already combines rater-group means (e.g. "all
       * others") rather than pooling every individual rating. */
      mode: "separate";
      self: { mean: number | null; leaderCount: number };
      manager: { mean: number | null; leaderCount: number };
      allOthers: { mean: number | null; leaderCount: number };
      perLeader: OrgLeaderFigures[];
    })
  | (OrgOverviewRowBase & {
      /** 1-2 relevant leaders: no per-leader breakdown (it would identify
       * them), one pooled mean instead — flat-pooling every real individual
       * rating from every rater of those leaders, matching the platform's
       * established anonymity-merge convention (pool raw data, never an
       * average of pre-computed means, for exactly this situation). */
      mode: "merged";
      pooledMean: number;
      respondentCount: number;
    })
  | (OrgOverviewRowBase & {
      /** 0 relevant leaders, or a merged pool with zero real ratings. */
      mode: "insufficient";
    });

function meanAcrossLeaders(values: (number | null)[]): { mean: number | null; leaderCount: number } {
  const real = values.filter((v): v is number => v !== null);
  if (real.length === 0) return { mean: null, leaderCount: 0 };
  return { mean: real.reduce((sum, v) => sum + v, 0) / real.length, leaderCount: real.length };
}

interface RowKey {
  competencyNumber: number;
  competency9Variant: OrgCompetency9Variant | null;
}

function rowKeysFor(leaders: OrgLeaderInput[]): RowKey[] {
  const keys: RowKey[] = [];
  for (let n = 1; n <= 8; n++) keys.push({ competencyNumber: n, competency9Variant: null });
  if (leaders.some((l) => l.competency9Variant === "standard")) {
    keys.push({ competencyNumber: 9, competency9Variant: "standard" });
  }
  if (leaders.some((l) => l.competency9Variant === "ops")) {
    keys.push({ competencyNumber: 9, competency9Variant: "ops" });
  }
  return keys;
}

function leadersRelevantToKey(leaders: OrgLeaderInput[], key: RowKey): OrgLeaderInput[] {
  if (key.competencyNumber !== 9) return leaders;
  return leaders.filter((l) => l.competency9Variant === key.competency9Variant);
}

function computeRow(key: RowKey, relevantLeaders: OrgLeaderInput[]): OrgOverviewRow {
  const leaderCount = relevantLeaders.length;

  if (leaderCount === 0) {
    return { ...key, mode: "insufficient", leaderCount: 0 };
  }

  if (leaderCount < 3) {
    const combinedResponses = relevantLeaders.flatMap((l) => l.dataset.responses);
    const combinedItemIds = relevantLeaders.flatMap((l) =>
      l.dataset.items
        .filter((i) => i.competencyNumber === key.competencyNumber && !i.isIntegrityItem)
        .map((i) => i.id),
    );
    const combinedRaterIds = relevantLeaders.flatMap((l) => l.dataset.raters.map((r) => r.id));

    const { mean, respondentCount } = competencyGroupMean(
      combinedResponses,
      combinedItemIds,
      combinedRaterIds,
    );
    if (mean === null) {
      return { ...key, mode: "insufficient", leaderCount };
    }
    return { ...key, mode: "merged", leaderCount, pooledMean: mean, respondentCount };
  }

  const perLeader: OrgLeaderFigures[] = relevantLeaders.map((leader) => {
    const row = computeCompetencyOverview(leader.dataset).find(
      (r) => r.competencyNumber === key.competencyNumber,
    );
    return {
      leaderId: leader.leaderId,
      leaderName: leader.leaderName,
      self: row?.self ?? null,
      manager: row?.manager ?? null,
      allOthers: row?.allOthers ?? null,
    };
  });

  return {
    ...key,
    mode: "separate",
    leaderCount,
    self: meanAcrossLeaders(perLeader.map((p) => p.self)),
    manager: meanAcrossLeaders(perLeader.map((p) => p.manager)),
    allOthers: meanAcrossLeaders(perLeader.map((p) => p.allOthers)),
    perLeader,
  };
}

/**
 * Competency figures aggregated across every leader passed in (already
 * filtered by organisation and, optionally, level, and to only completed
 * cycles, by the caller). Applies the leader-level n>=3 rule per row: a
 * competency-9 row only counts the leaders on its own variant, so a level
 * can clear the threshold for competencies 1-8 while still falling under it
 * for (say) the ops-variant row if few leaders there use it.
 */
export function computeOrgOverview(leaders: OrgLeaderInput[]): OrgOverviewRow[] {
  return rowKeysFor(leaders).map((key) => computeRow(key, leadersRelevantToKey(leaders, key)));
}

-- Development priorities now asks for 3 behaviours instead of 2 (v10 of the
-- spec). Widens the rank constraint only -- existing rows using ranks 1-2
-- already satisfy the wider set, so no data rewrite is needed here. The
-- application-level completion check (all 3 required to count) lives in
-- src/lib/scoring/development-priorities.ts, not in the database.

alter table forced_choice_nominations
  drop constraint if exists forced_choice_nominations_priority_rank_check;

alter table forced_choice_nominations
  add constraint forced_choice_nominations_priority_rank_check
    check (priority_rank in (1, 2, 3));

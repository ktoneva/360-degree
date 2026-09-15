-- Deliberate, one-off override of the platform-wide n>=3 anonymity
-- threshold, scoped to a single named cycle's report. Never exposed in the
-- cycle-creation UI or any other admin control -- the only way to set this
-- column is a direct, documented SQL statement like the one below. Null
-- means the standard threshold (3) applies, which is every cycle except the
-- one exception this migration creates.
alter table review_cycles
  add column anonymity_threshold_override smallint
  check (anonymity_threshold_override is null or anonymity_threshold_override >= 1);

comment on column review_cycles.anonymity_threshold_override is 'Deliberate, one-off override of the standard n>=3 anonymity threshold for this cycle''s report only. Null means the standard threshold (3) applies. Never exposed in the cycle-creation UI -- set directly via a documented migration for a specific, named exception. Applies everywhere the standard threshold is checked for this cycle''s report: competency-level (Rater group comparison logic), item-level (Blind spots logic, which per Design decision 21 also governs hidden strengths, highest/lowest, and competency-detail item rows), and any team/org report a closed instance of this cycle later appears in. See 360_educational_leaders_v15.xlsx, Design decisions tab, row 25.';

-- One-off exception for Charlotte Brennan (cycle
-- beca9ad7-71d1-4646-bf45-74f3736eecd1): new starter, entire eligible rater
-- pool is external and finite (previous colleagues at other schools). 5
-- peers invited, 2 responded, 3 never started, response deadline passed.
-- The standard n>=3 threshold cannot be met for her and will not resolve
-- itself -- not a low-response-on-one-item situation, a genuinely finite
-- rater pool. Decided once, for this report only, not a precedent for
-- future similar cases.
update review_cycles
set anonymity_threshold_override = 2
where id = 'beca9ad7-71d1-4646-bf45-74f3736eecd1';

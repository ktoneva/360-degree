-- Lets an admin correct or remove a rater from the console without ever
-- cascade-deleting response data that may already be reflected in a report.
alter table raters add column archived_at timestamptz;

comment on column raters.archived_at is 'Set when an admin removes a rater who already has response data (responses/forced_choice_nominations/comments/competency_comments). Archived raters are excluded from all scoring, anonymity counts, and reports, but their row and all response data are kept intact and reversible -- unlike a hard delete, which cascades and destroys that data permanently.';

-- Recreated to ignore archived raters, so archiving a mistaken self/manager
-- rater doesn't permanently block inviting the correct one in their place.
drop index raters_one_self_per_cycle;
drop index raters_one_manager_per_cycle;

create unique index raters_one_self_per_cycle
  on raters(review_cycle_id) where (rater_group = 'self' and archived_at is null);
create unique index raters_one_manager_per_cycle
  on raters(review_cycle_id) where (rater_group = 'manager' and archived_at is null);

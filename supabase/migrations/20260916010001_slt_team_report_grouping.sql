-- SLT combined team report (Design decisions, row 26): a new report-time
-- grouping, 'slt', that pools headteacher, deputy_head and assistant_head
-- into a single comparison group. It is never a real leader's own level --
-- review_cycles.level must stay exactly one of the 5 real leader_level enum
-- values, so that enum is deliberately left untouched. team_report_notes is
-- the only place that needs to store a row under this pseudo-level (the
-- "whole team, at a glance" notes for an SLT report), so only its level
-- column widens, from the enum to text with an explicit allow-list.
alter table team_report_notes alter column level type text using level::text;

alter table team_report_notes add constraint team_report_notes_level_check
  check (level in (
    'headteacher',
    'deputy_head',
    'assistant_head',
    'middle_leader',
    'operational_business_leader',
    'slt'
  ));

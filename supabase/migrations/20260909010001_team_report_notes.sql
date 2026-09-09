-- The team report's "whole team, at a glance" page (section 3) is
-- deliberately editable, not fully automatic: named-versus-grouped for a
-- finding is a per-finding judgement call the consultant makes, confirmed
-- explicitly with the user rather than assumed. The report generator seeds
-- each slot with a data-grounded starting suggestion; this table holds
-- whatever the consultant has actually written for it. Exactly 4 cards x 2
-- slots per (organisation, level) team report.

create table team_report_notes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  level leader_level not null,
  card text not null check (card in ('strengths', 'gaps', 'stretch', 'development')),
  position smallint not null check (position in (1, 2)),
  who text not null default '',
  what text not null default '',
  updated_at timestamptz not null default now(),
  unique (organisation_id, level, card, position)
);

comment on table team_report_notes is 'Consultant-edited content for the team report''s 4-card team-at-a-glance page. Absent rows fall back to a computed starting suggestion rather than an empty card.';

alter table team_report_notes enable row level security;

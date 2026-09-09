-- Per-competency free text was decided in the spec (Design decisions tab:
-- "one optional free-text box after the items in every competency") but
-- never actually built into the questionnaire -- only the 3 overall
-- continue/start/stop questions exist today. The individual report's
-- Written comments page needs this data, so adding the missing piece now.

create table competency_comments (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references raters(id) on delete cascade,
  competency_number smallint not null,
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rater_id, competency_number)
);

comment on table competency_comments is 'One optional free-text comment per rater per competency, prompted "Anything else you''d add about this area?" after that competency''s items. Not scored, not counted toward completion, never suppressed by n>=3 (same anonymisation-by-detail-removal treatment as the 3 overall comments, not by count).';

create index competency_comments_rater_id_idx on competency_comments(rater_id);

alter table competency_comments enable row level security;

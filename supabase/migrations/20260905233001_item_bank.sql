-- Item bank: competencies (including the 9-OPS variant) and their behaviour items.

create extension if not exists pgcrypto;

create type rater_group as enum ('self', 'manager', 'peer', 'direct_report', 'other');
create type item_response_type as enum ('scale', 'yes_no_not_observed');
create type competency_variant as enum ('standard', 'ops');

-- The 9 numbered competencies. Competency 9 has two variants (teaching vs.
-- non-teaching/ops) that share a number but carry different names and items.
create table competencies (
  id uuid primary key default gen_random_uuid(),
  number smallint not null check (number between 1 and 9),
  variant competency_variant not null default 'standard',
  name text not null,
  created_at timestamptz not null default now(),
  unique (number, variant)
);

comment on table competencies is
  'The 9 leadership competencies. Competency 9 has a standard (teaching) and an ops variant; only one is used per review cycle.';

-- One row per behaviour statement (90 standard + 10 ops = 100 rows).
create table items (
  id uuid primary key default gen_random_uuid(),
  competency_id uuid not null references competencies(id) on delete restrict,
  item_number smallint not null check (item_number between 1 and 10),
  behaviour_text text not null,
  asked_rater_groups rater_group[] not null,
  response_type item_response_type not null default 'scale',
  is_integrity_item boolean not null default false,
  -- For an ops item, the standard-competency-9 item it stands in for (same
  -- item_number, different wording), so scores stay comparable across a
  -- leadership team that mixes teaching and non-teaching leaders.
  equivalent_item_id uuid references items(id) on delete set null,
  design_note text,
  created_at timestamptz not null default now(),
  unique (competency_id, item_number),
  check (
    (is_integrity_item and response_type = 'yes_no_not_observed')
    or (not is_integrity_item and response_type = 'scale')
  )
);

comment on table items is
  'The behaviour statements raters are asked about. is_integrity_item marks 7.5/7.6 (safeguarding), which use a yes/no/not-observed response instead of the 6-point scale and are excluded from scored profiles.';

create index items_competency_id_idx on items(competency_id);

alter table competencies enable row level security;
alter table items enable row level security;

-- Organisation-wide reporting: each cycle belongs to one organisation and
-- names its leader's level, both nullable so existing cycles aren't forced
-- to backfill data that was never collected for them. New cycles going
-- forward are expected to always set both (enforced in the admin UI, not
-- the database, since a leader's level or org is a business fact the app
-- can't safely infer).

create table organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  created_at timestamptz not null default now()
);

comment on table organisations is 'A school or trust whose leaders are reviewed. Every review_cycle belongs to exactly one.';

alter table organisations enable row level security;

alter table review_cycles
  add column organisation_id uuid references organisations(id) on delete restrict;

comment on column review_cycles.organisation_id is 'Nullable for cycles created before organisations existed. New cycles are required to set this in the admin UI.';

-- Extend later with: alter type leader_level add value 'new_level';
create type leader_level as enum (
  'headteacher',
  'deputy_head',
  'assistant_head',
  'middle_leader',
  'operational_business_leader'
);

alter table review_cycles
  add column level leader_level;

comment on column review_cycles.level is 'The cycle leader''s level as of this cycle -- lives on the cycle, not the leader, since the same person can be promoted or move organisation between cycles. Nullable for the same backward-compatibility reason as organisation_id.';

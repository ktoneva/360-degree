-- Review subjects, cycles, raters, responses, forced-choice priorities and
-- open comments.

create table review_subjects (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table review_subjects is 'A leader (headteacher, deputy, business manager, etc.) who is reviewed, potentially across multiple cycles.';

-- One leader, one time period.
create table review_cycles (
  id uuid primary key default gen_random_uuid(),
  review_subject_id uuid not null references review_subjects(id) on delete cascade,
  name text not null,
  period_start date not null,
  period_end date not null,
  -- Which competency 9 to use for this cycle's leader: the teaching version,
  -- or the ops version for non-teaching senior leaders.
  competency_9_variant competency_variant not null default 'standard',
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

comment on table review_cycles is 'A single review window for one review_subject. competency_9_variant selects which competency-9 item set that cycle''s raters see.';

create index review_cycles_review_subject_id_idx on review_cycles(review_subject_id);

-- Everyone invited to rate a leader in a given cycle.
create table raters (
  id uuid primary key default gen_random_uuid(),
  review_cycle_id uuid not null references review_cycles(id) on delete cascade,
  rater_group rater_group not null,
  full_name text,
  email text,
  -- Unguessable link token, e.g. used as /respond/{token}. 32 random bytes,
  -- hex-encoded, never derived from anything predictable.
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

comment on table raters is 'A person invited to rate a leader in a specific cycle. token is the unguessable identifier used in their response link.';

create index raters_review_cycle_id_idx on raters(review_cycle_id);

-- Exactly one self rater and at most one manager rater per cycle (the spec
-- reports the manager separately, as a single identifiable rater).
create unique index raters_one_self_per_cycle
  on raters(review_cycle_id) where (rater_group = 'self');
create unique index raters_one_manager_per_cycle
  on raters(review_cycle_id) where (rater_group = 'manager');

-- One row per rater per item they answered.
create table responses (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references raters(id) on delete cascade,
  item_id uuid not null references items(id) on delete restrict,
  scale_value smallint check (scale_value between 1 and 6),
  not_observed boolean not null default false,
  integrity_value text check (integrity_value in ('yes', 'no', 'not_observed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rater_id, item_id),
  -- Exactly one of: a scale rating, a "not able to comment" on a scale item,
  -- or a yes/no/not_observed integrity answer.
  check (
    (scale_value is not null and not_observed = false and integrity_value is null)
    or (scale_value is null and not_observed = true and integrity_value is null)
    or (scale_value is null and not_observed = false and integrity_value is not null)
  )
);

comment on table responses is 'A rater''s answer to one item: either a 1-6 scale value, "not able to comment", or a yes/no/not_observed integrity answer.';

create index responses_rater_id_idx on responses(rater_id);
create index responses_item_id_idx on responses(item_id);

-- Enforces that a response's shape (scale vs. integrity) matches the item it
-- answers, which a plain check constraint can't do across tables.
create function validate_response_matches_item() returns trigger as $$
declare
  item_response_type item_response_type;
begin
  select response_type into item_response_type from items where id = new.item_id;

  if item_response_type = 'scale' and new.integrity_value is not null then
    raise exception 'item % takes a scale response, not an integrity value', new.item_id;
  end if;

  if item_response_type = 'yes_no_not_observed' and (new.scale_value is not null or new.not_observed) then
    raise exception 'item % takes an integrity value, not a scale response', new.item_id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger responses_validate_item_match
  before insert or update on responses
  for each row execute function validate_response_matches_item();

-- Forced choice: the 2 items each rater nominates as having the biggest
-- potential impact if improved. Safeguarding integrity items are excluded.
create table forced_choice_nominations (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references raters(id) on delete cascade,
  item_id uuid not null references items(id) on delete restrict,
  priority_rank smallint not null check (priority_rank in (1, 2)),
  created_at timestamptz not null default now(),
  unique (rater_id, item_id),
  unique (rater_id, priority_rank)
);

comment on table forced_choice_nominations is 'The 2 items (equal weight) a rater nominated as development priorities. 1st/2nd rank is stored but not weighted differently when scoring.';

create index forced_choice_nominations_rater_id_idx on forced_choice_nominations(rater_id);

create function validate_nomination_not_integrity_item() returns trigger as $$
declare
  item_is_integrity boolean;
begin
  select is_integrity_item into item_is_integrity from items where id = new.item_id;

  if item_is_integrity then
    raise exception 'item % is a safeguarding integrity item and cannot be a forced-choice nomination', new.item_id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger forced_choice_nominations_validate_item
  before insert or update on forced_choice_nominations
  for each row execute function validate_nomination_not_integrity_item();

-- Open comments: one continue/start/stop set per rater per cycle.
create table comments (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null unique references raters(id) on delete cascade,
  continue_text text,
  start_text text,
  stop_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table comments is 'A rater''s open-text continue/start/stop feedback for the cycle. One row per rater.';

alter table review_subjects enable row level security;
alter table review_cycles enable row level security;
alter table raters enable row level security;
alter table responses enable row level security;
alter table forced_choice_nominations enable row level security;
alter table comments enable row level security;

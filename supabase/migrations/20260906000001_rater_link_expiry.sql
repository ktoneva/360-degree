-- Rater links expire a configurable number of days after being invited, so a
-- stale/leaked link doesn't stay usable forever. Defaults to 60 days but is
-- editable per cycle from the admin console.

alter table review_cycles
  add column link_expiry_days integer not null default 60
    check (link_expiry_days > 0);

comment on column review_cycles.link_expiry_days is 'How many days after a rater''s invited_at their /respond link keeps working.';

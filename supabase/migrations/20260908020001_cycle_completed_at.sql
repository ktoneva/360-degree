-- The individual report's cover page needs the actual date a cycle was
-- marked complete, not updated_at (which changes for unrelated reasons,
-- e.g. editing link_expiry_days after the cycle closed).

alter table review_cycles
  add column completed_at timestamptz;

comment on column review_cycles.completed_at is 'Set when status transitions to closed via the admin "Mark cycle as complete" action; cleared on reopen. Drives the report cover page''s "Review completed" date.';

-- Fixed-window rate limiting for the unauthenticated /respond/[token] flow,
-- keyed by client IP. Needed so scripting through thousands of token guesses
-- isn't feasible, without blocking a genuine rater's normal use of their own
-- link. Backed by Postgres (not in-memory) because Vercel serverless
-- functions share no memory across invocations or cold starts.

create table respond_rate_limits (
  bucket_key text primary key,
  window_start timestamptz not null,
  request_count integer not null default 0
);

comment on table respond_rate_limits is 'Fixed-window counters for rate limiting /respond/[token]. Rows self-expire logically once window_start is outside the caller''s window; check_respond_rate_limit() opportunistically deletes stale rows.';

-- No policies: only the service-role client (which bypasses RLS) ever
-- touches this table. Enabling RLS with zero policies blocks the anon key
-- from reading or resetting rate-limit counters via the public REST API,
-- which would otherwise let an attacker just delete their own bucket row
-- before each burst.
alter table respond_rate_limits enable row level security;

-- Atomic check-and-increment: a single upsert avoids the read-then-write race
-- that would otherwise let concurrent requests all slip through under the
-- same limit.
create function check_respond_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  insert into respond_rate_limits (bucket_key, window_start, request_count)
  values (p_key, v_now, 1)
  on conflict (bucket_key) do update
    set request_count = case
          when respond_rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else respond_rate_limits.request_count + 1
        end,
        window_start = case
          when respond_rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else respond_rate_limits.window_start
        end
  returning window_start, request_count into v_window_start, v_count;

  -- Opportunistic cleanup so this table doesn't grow unbounded; cheap at
  -- pilot scale and avoids needing a separate scheduled job.
  delete from respond_rate_limits
    where window_start < v_now - interval '1 day';

  return v_count <= p_max_requests;
end;
$$ language plpgsql;

comment on function check_respond_rate_limit is 'Returns true if the caller is still within (p_max_requests per p_window_seconds) for bucket p_key, incrementing its counter as a side effect.';

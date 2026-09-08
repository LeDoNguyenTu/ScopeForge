create or replace function public.recover_worker_state(
  target_now timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  effective_now timestamptz;
  runtime_cancelled_count integer;
  leased_count integer;
  unleased_count integer;
  runtime_unleased_count integer;
  runtime_reconciled_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  effective_now := coalesce(target_now, clock_timestamp());

  runtime_cancelled_count := private.recover_cancelled_runtime_worker_tasks(effective_now);
  leased_count := public.recover_expired_worker_attempts_leased_only(effective_now);
  unleased_count := private.recover_expired_unleased_worker_tasks(effective_now);
  runtime_unleased_count := private.recover_expired_runtime_worker_tasks(effective_now);
  runtime_reconciled_count := private.reconcile_dead_letter_runtime_worker_jobs(effective_now);

  return runtime_cancelled_count
    + leased_count
    + unleased_count
    + runtime_unleased_count
    + runtime_reconciled_count;
end;
$$;

create or replace function public.recover_expired_worker_attempts(
  target_now timestamptz default null
)
returns integer
language sql
security definer
set search_path = ''
as $$
  -- Compatibility entrypoint used by the current supervisor. Live recovery must
  -- sample its cutoff after serialization, not reuse a caller-side timestamp.
  select public.recover_worker_state(null);
$$;

revoke all on function public.recover_worker_state(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.recover_worker_state(timestamptz)
  to service_role;

revoke all on function public.recover_expired_worker_attempts(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.recover_expired_worker_attempts(timestamptz)
  to service_role;

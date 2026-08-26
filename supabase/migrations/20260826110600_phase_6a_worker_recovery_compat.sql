alter function public.recover_expired_worker_attempts(timestamptz)
  rename to recover_expired_worker_attempts_leased_only;

create or replace function public.recover_worker_state(
  target_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  unleased_count integer;
  leased_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));
  leased_count := public.recover_expired_worker_attempts_leased_only(target_now);
  unleased_count := private.recover_expired_unleased_worker_tasks(target_now);
  return unleased_count + leased_count;
end;
$$;

create or replace function public.recover_expired_worker_attempts(
  target_now timestamptz default now()
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.recover_worker_state(target_now);
$$;

revoke all on function public.recover_expired_worker_attempts_leased_only(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.recover_worker_state(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.recover_expired_worker_attempts(timestamptz) from public, anon, authenticated;
grant execute on function public.recover_expired_worker_attempts(timestamptz) to service_role;

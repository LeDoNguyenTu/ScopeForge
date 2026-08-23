create or replace function private.enforce_verification_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta integer;
  asset_attempts integer;
  workspace_attempts integer;
  usage_date date;
begin
  delta := new.attempt_count - old.attempt_count;
  if delta <= 0 then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.workspace_id::text, 1));

  select coalesce(sum(c.attempt_count), 0)::integer
    into asset_attempts
    from public.asset_verification_challenges c
    where c.asset_id = new.asset_id
      and c.created_at >= now() - interval '1 hour';

  if asset_attempts >= 5 then
    raise exception using errcode = 'P0001', message = 'VERIFICATION_RATE_LIMITED';
  end if;

  select verification_attempts_today, verification_attempt_date
    into workspace_attempts, usage_date
    from public.workspace_usage
    where workspace_id = new.workspace_id;

  if usage_date = current_date and coalesce(workspace_attempts, 0) >= 100 then
    raise exception using errcode = 'P0001', message = 'VERIFICATION_RATE_LIMITED';
  end if;

  return new;
end;
$$;

create trigger verification_enforce_quota_before_update
before update of attempt_count on public.asset_verification_challenges
for each row execute function private.enforce_verification_quota();

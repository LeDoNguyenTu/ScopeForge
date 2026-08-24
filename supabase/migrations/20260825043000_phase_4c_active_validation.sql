alter type public.scan_job_kind
  add value if not exists 'active_validation';

alter table public.scan_jobs
  add column validation_profile_id text,
  add column validation_profile_version integer,
  add column authorization_granted_at timestamptz;

alter table public.scan_jobs
  add constraint scan_jobs_active_validation_snapshot_check check (
    job_kind::text <> 'active_validation'
    or (
      authorization_canonical_target is not null
      and char_length(authorization_canonical_target) between 1 and 2048
      and authorization_asset_kind in ('web_application'::public.asset_kind, 'api'::public.asset_kind)
      and authorization_verified_at is not null
      and validation_profile_id = 'cors-origin-policy'
      and validation_profile_version = 1
      and authorization_granted_at is not null
    )
  ),
  add constraint scan_jobs_active_validation_budget_check check (
    job_kind::text <> 'active_validation'
    or (
      jsonb_typeof(budget) = 'object'
      and pg_column_size(budget) <= 2048
      and budget = '{"maxRequests":1,"maxRedirects":0,"perRequestTimeoutMs":5000,"totalTimeoutMs":10000,"maxObservationBytes":32768}'::jsonb
    )
  );

alter table public.scan_jobs
  drop constraint if exists scan_jobs_passive_runtime_timestamps_check;

alter table public.scan_jobs
  add constraint scan_jobs_runtime_timestamps_check check (
    job_kind::text not in ('passive_runtime', 'active_validation')
    or case status
      when 'queued'::public.scan_job_status then started_at is null and finished_at is null
      when 'running'::public.scan_job_status then started_at is not null and finished_at is null
      else finished_at is not null
    end
  );

create or replace function private.guard_runtime_scan_job_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.asset_id is distinct from old.asset_id
     or new.job_kind is distinct from old.job_kind
     or new.requested_by is distinct from old.requested_by
     or new.authorization_canonical_target is distinct from old.authorization_canonical_target
     or new.authorization_asset_kind is distinct from old.authorization_asset_kind
     or new.authorization_verified_at is distinct from old.authorization_verified_at
     or new.validation_profile_id is distinct from old.validation_profile_id
     or new.validation_profile_version is distinct from old.validation_profile_version
     or new.authorization_granted_at is distinct from old.authorization_granted_at
     or new.budget is distinct from old.budget
     or new.created_at is distinct from old.created_at then
    raise exception 'Runtime job authorization snapshot fields are immutable';
  end if;

  if new.cancel_requested_at is distinct from old.cancel_requested_at then
    if old.cancel_requested_at is not null
       or new.cancel_requested_at is null
       or old.status not in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
      raise exception 'Invalid runtime cancellation request transition';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'queued'::public.scan_job_status
       and new.status not in ('running'::public.scan_job_status, 'blocked'::public.scan_job_status, 'cancelled'::public.scan_job_status) then
      raise exception 'Invalid runtime job transition';
    elsif old.status = 'running'::public.scan_job_status
       and new.status not in ('succeeded'::public.scan_job_status, 'failed'::public.scan_job_status, 'blocked'::public.scan_job_status, 'cancelled'::public.scan_job_status) then
      raise exception 'Invalid runtime job transition';
    elsif old.status in ('succeeded'::public.scan_job_status, 'failed'::public.scan_job_status, 'blocked'::public.scan_job_status, 'cancelled'::public.scan_job_status) then
      raise exception 'Runtime job terminal states are immutable';
    end if;

    if new.status = 'succeeded'::public.scan_job_status
       and (old.cancel_requested_at is not null or new.cancel_requested_at is not null) then
      raise exception 'A cancelled runtime job cannot succeed';
    end if;
  end if;

  return new;
end;
$$;

alter table public.runtime_observations
  drop constraint if exists runtime_observations_kind_check;

alter table public.runtime_observations
  add constraint runtime_observations_kind_check check (
    kind in ('http-status', 'redirect', 'header', 'cookie', 'tls', 'cors-policy')
  );

create or replace function private.guard_runtime_observation_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  job_kind_text text;
  job_status text;
  job_cancel_requested_at timestamptz;
begin
  select job_kind::text, status::text, cancel_requested_at
    into job_kind_text, job_status, job_cancel_requested_at
    from public.scan_jobs
   where id = new.job_id
     and workspace_id = new.workspace_id
     and asset_id = new.asset_id
   for update;

  if job_kind_text is null then
    raise exception 'Runtime observation job is not available';
  end if;

  if job_status <> 'running' or job_cancel_requested_at is not null then
    raise exception 'Runtime observations require a running uncancelled job';
  end if;

  if new.kind = 'cors-policy' and job_kind_text <> 'active_validation' then
    raise exception 'CORS policy observations require an active validation job';
  end if;

  if new.kind <> 'cors-policy' and job_kind_text <> 'passive_runtime' then
    raise exception 'Passive runtime observations require a passive runtime job';
  end if;

  return new;
end;
$$;

create trigger runtime_observations_guard_job_kind
before insert on public.runtime_observations
for each row execute function private.guard_runtime_observation_insert();

create index scan_jobs_active_status_created_idx
  on public.scan_jobs(status, created_at)
  where job_kind::text = 'active_validation';

revoke all on table public.runtime_observations from anon, authenticated;
grant select on table public.runtime_observations to authenticated;

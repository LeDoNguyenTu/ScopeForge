alter table public.scan_jobs
  drop constraint if exists scan_jobs_check;

alter table public.scan_jobs
  alter column status drop default;

create type public.scan_job_status_phase4b as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'blocked',
  'cancelled'
);

alter table public.scan_jobs
  alter column status type public.scan_job_status_phase4b
  using status::text::public.scan_job_status_phase4b;

drop type public.scan_job_status;
alter type public.scan_job_status_phase4b rename to scan_job_status;

alter table public.scan_jobs
  alter column status set default 'queued'::public.scan_job_status;

create type public.scan_job_kind as enum ('phase2_blocked', 'passive_runtime');

alter table public.scan_jobs
  add column job_kind public.scan_job_kind not null default 'phase2_blocked',
  add column authorization_canonical_target text,
  add column authorization_asset_kind public.asset_kind,
  add column authorization_verified_at timestamptz,
  add column budget jsonb not null default '{}'::jsonb,
  add column cancel_requested_at timestamptz,
  add column started_at timestamptz,
  add column finished_at timestamptz,
  add column failure_code text,
  add column request_count integer not null default 0,
  add column redirect_count integer not null default 0,
  add column finding_count integer not null default 0;

alter table public.scan_jobs
  alter column job_kind set default 'passive_runtime'::public.scan_job_kind,
  alter column blocked_reason drop not null,
  alter column blocked_reason drop default;

alter table public.scan_jobs
  add constraint scan_jobs_runtime_identity_key unique (id, workspace_id, asset_id),
  add constraint scan_jobs_budget_object_check check (
    jsonb_typeof(budget) = 'object'
    and pg_column_size(budget) <= 2048
  ),
  add constraint scan_jobs_runtime_counts_check check (
    request_count >= 0
    and redirect_count >= 0
    and finding_count >= 0
  ),
  add constraint scan_jobs_failure_code_check check (
    failure_code is null or char_length(failure_code) between 1 and 64
  ),
  add constraint scan_jobs_blocked_reason_check check (
    blocked_reason is null or char_length(blocked_reason) between 1 and 500
  ),
  add constraint scan_jobs_passive_runtime_snapshot_check check (
    job_kind <> 'passive_runtime'::public.scan_job_kind
    or (
      authorization_canonical_target is not null
      and char_length(authorization_canonical_target) between 1 and 2048
      and authorization_asset_kind in ('web_application'::public.asset_kind, 'api'::public.asset_kind)
      and authorization_verified_at is not null
    )
  ),
  add constraint scan_jobs_passive_runtime_timestamps_check check (
    job_kind <> 'passive_runtime'::public.scan_job_kind
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
  end if;

  return new;
end;
$$;

create trigger scan_jobs_guard_runtime_update
before update on public.scan_jobs
for each row execute function private.guard_runtime_scan_job_update();

create table public.runtime_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null,
  asset_id uuid not null,
  sequence integer not null check (sequence >= 0),
  kind text not null check (kind in ('http-status', 'redirect', 'header', 'cookie', 'tls')),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and pg_column_size(payload) <= 8192
  ),
  created_at timestamptz not null default now(),
  unique (job_id, sequence),
  constraint runtime_observations_job_workspace_asset_fkey
    foreign key (job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade,
  constraint runtime_observations_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade
);

create index scan_jobs_workspace_kind_created_idx
  on public.scan_jobs(workspace_id, job_kind, created_at desc);
create index scan_jobs_runtime_status_created_idx
  on public.scan_jobs(status, created_at)
  where job_kind = 'passive_runtime'::public.scan_job_kind;
create index runtime_observations_workspace_job_sequence_idx
  on public.runtime_observations(workspace_id, job_id, sequence);
create index runtime_observations_asset_created_idx
  on public.runtime_observations(asset_id, created_at desc);

alter table public.runtime_observations enable row level security;

create policy runtime_observations_select_member on public.runtime_observations
for select to authenticated
using (private.is_workspace_member(workspace_id));

revoke all on table public.runtime_observations from anon, authenticated;
grant select on table public.runtime_observations to authenticated;

alter table private.worker_nodes
  drop constraint if exists worker_nodes_execution_class_check;

alter table private.worker_nodes
  add constraint worker_nodes_execution_class_check check (
    execution_class in (
      'foundation_no_egress_v1',
      'repository_snapshot_github_public_v1',
      'phase3_repository_scan_no_egress_v1'
    )
  );

alter table private.worker_tasks
  drop constraint if exists worker_tasks_execution_class_check;

alter table private.worker_tasks
  add constraint worker_tasks_execution_class_check check (
    execution_class in (
      'foundation_no_egress_v1',
      'repository_snapshot_github_public_v1',
      'phase3_repository_scan_no_egress_v1'
    )
  );

alter table public.scan_jobs
  add constraint scan_jobs_repository_scan_contract_check check (
    job_kind <> 'repository_scan'::public.scan_job_kind
    or (
      blocked_reason is null
      and authorization_canonical_target is null
      and authorization_asset_kind is null
      and authorization_verified_at is null
      and validation_profile_id is null
      and validation_profile_version is null
      and authorization_granted_at is null
      and budget = '{"maxWallTimeMs":300000,"maxCpuTimeMs":300000,"maxMemoryBytes":1073741824,"maxProcesses":64,"maxInputFiles":20000,"maxInputBytes":268435456,"maxScratchBytes":268435456,"maxOutputBytes":3670016}'::jsonb
      and request_count = 0
      and redirect_count = 0
      and finding_count between 0 and 500
    )
  );

alter table public.repository_source_snapshots
  add constraint repository_source_snapshots_id_workspace_asset_key
  unique (id, workspace_id, asset_id);

create table private.repository_scan_tasks (
  task_id uuid primary key references private.worker_tasks(id) on delete cascade,
  scan_job_id uuid not null unique,
  workspace_id uuid not null,
  asset_id uuid not null,
  snapshot_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  schema_version smallint not null default 1 check (schema_version = 1),
  scanner_profile_id text not null default 'phase3-hosted-static-v1'
    check (scanner_profile_id = 'phase3-hosted-static-v1'),
  scanner_profile_version smallint not null default 1
    check (scanner_profile_version = 1),
  created_at timestamptz not null default now(),
  constraint repository_scan_tasks_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  constraint repository_scan_tasks_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade,
  constraint repository_scan_tasks_snapshot_workspace_asset_fkey
    foreign key (snapshot_id, workspace_id, asset_id)
    references public.repository_source_snapshots(id, workspace_id, asset_id)
    on delete cascade
);

create table public.repository_scan_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null,
  snapshot_id uuid not null,
  scan_job_id uuid not null unique,
  requested_by uuid not null references auth.users(id) on delete restrict,
  schema_version smallint not null default 1 check (schema_version = 1),
  scanner_profile_id text not null default 'phase3-hosted-static-v1'
    check (scanner_profile_id = 'phase3-hosted-static-v1'),
  scanner_profile_version smallint not null default 1
    check (scanner_profile_version = 1),
  tool_version text not null check (char_length(tool_version) between 1 and 64),
  resolved_commit_sha text not null check (resolved_commit_sha ~ '^[a-f0-9]{40}$'),
  snapshot_content_digest text not null check (snapshot_content_digest ~ '^[a-f0-9]{64}$'),
  snapshot_artifact_digest text not null check (snapshot_artifact_digest ~ '^[a-f0-9]{64}$'),
  run_ref text not null check (run_ref ~ '^sfh1:[a-f0-9]{64}$'),
  scan_started_at timestamptz not null,
  scan_duration_ms integer not null check (scan_duration_ms between 0 and 300000),
  scanner_descriptors jsonb not null check (
    scanner_descriptors = '["iac@1.0.0","jsts@1.0.0","sca@1.0.0","secrets@1.0.0"]'::jsonb
  ),
  files_analyzed integer not null check (files_analyzed between 0 and 20000),
  files_skipped integer not null check (files_skipped between 0 and 50000),
  total_bytes bigint not null check (total_bytes between 0 and 268435456),
  finding_count integer not null check (finding_count between 0 and 500),
  result_digest text not null check (result_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (workspace_id, asset_id, run_ref),
  constraint repository_scan_runs_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  constraint repository_scan_runs_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade,
  constraint repository_scan_runs_snapshot_workspace_asset_fkey
    foreign key (snapshot_id, workspace_id, asset_id)
    references public.repository_source_snapshots(id, workspace_id, asset_id)
    on delete cascade
);

create index repository_scan_tasks_job_workspace_asset_idx
  on private.repository_scan_tasks(scan_job_id, workspace_id, asset_id);

create index repository_scan_tasks_snapshot_workspace_asset_idx
  on private.repository_scan_tasks(snapshot_id, workspace_id, asset_id);

create index repository_scan_tasks_asset_workspace_idx
  on private.repository_scan_tasks(asset_id, workspace_id);

create index repository_scan_runs_job_workspace_asset_idx
  on public.repository_scan_runs(scan_job_id, workspace_id, asset_id);

create index repository_scan_runs_snapshot_workspace_asset_idx
  on public.repository_scan_runs(snapshot_id, workspace_id, asset_id);

create index repository_scan_runs_asset_workspace_idx
  on public.repository_scan_runs(asset_id, workspace_id);

create index repository_scan_runs_workspace_asset_created_idx
  on public.repository_scan_runs(workspace_id, asset_id, created_at desc);

create or replace function private.reject_repository_scan_run_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Repository scan run rows are immutable';
end;
$$;

create trigger repository_scan_runs_guard_update
before update on public.repository_scan_runs
for each row execute function private.reject_repository_scan_run_mutation();

create trigger repository_scan_runs_guard_delete
before delete on public.repository_scan_runs
for each row execute function private.reject_repository_scan_run_mutation();

alter table public.repository_scan_runs enable row level security;

create policy repository_scan_runs_member_select
on public.repository_scan_runs
for select to authenticated
using (private.is_workspace_member(workspace_id));

revoke all on table public.repository_scan_runs from public, anon, authenticated, service_role;
grant select on table public.repository_scan_runs to authenticated;

revoke all on table private.repository_scan_tasks from public, anon, authenticated, service_role;
revoke all on function private.reject_repository_scan_run_mutation() from public, anon, authenticated, service_role;
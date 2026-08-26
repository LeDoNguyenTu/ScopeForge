alter table private.worker_nodes
  drop constraint if exists worker_nodes_execution_class_check;

alter table private.worker_nodes
  add constraint worker_nodes_execution_class_check check (
    execution_class in (
      'foundation_no_egress_v1',
      'repository_snapshot_github_public_v1'
    )
  );

alter table private.worker_tasks
  drop constraint if exists worker_tasks_execution_class_check;

alter table private.worker_tasks
  add constraint worker_tasks_execution_class_check check (
    execution_class in (
      'foundation_no_egress_v1',
      'repository_snapshot_github_public_v1'
    )
  );

alter table public.scan_jobs
  add constraint scan_jobs_repository_snapshot_contract_check check (
    job_kind <> 'repository_snapshot'::public.scan_job_kind
    or (
      blocked_reason is null
      and authorization_canonical_target is null
      and authorization_asset_kind is null
      and authorization_verified_at is null
      and validation_profile_id is null
      and validation_profile_version is null
      and authorization_granted_at is null
      and budget = '{}'::jsonb
      and request_count = 0
      and redirect_count = 0
      and finding_count = 0
    )
  );

create table public.repository_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null,
  scan_job_id uuid not null unique,
  requested_by uuid not null references auth.users(id) on delete restrict,
  source_kind text not null default 'github_public_archive'
    check (source_kind = 'github_public_archive'),
  schema_version smallint not null default 1 check (schema_version = 1),
  canonical_repository_url text not null check (
    char_length(canonical_repository_url) between 1 and 512
    and canonical_repository_url ~ '^https://github[.]com/[^/?#]+/[^/?#]+$'
  ),
  default_branch text not null check (
    octet_length(default_branch) between 1 and 255
  ),
  resolved_commit_sha text not null check (resolved_commit_sha ~ '^[a-f0-9]{40}$'),
  content_digest text not null check (content_digest ~ '^[a-f0-9]{64}$'),
  artifact_digest text not null check (artifact_digest ~ '^[a-f0-9]{64}$'),
  compressed_bytes bigint not null check (compressed_bytes between 0 and 134217728),
  expanded_bytes bigint not null check (expanded_bytes between 0 and 536870912),
  retained_file_count integer not null check (retained_file_count between 0 and 20000),
  retained_bytes bigint not null check (retained_bytes between 0 and 268435456),
  stored_artifact_bytes bigint not null check (stored_artifact_bytes between 1 and 335544320),
  skip_counts jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint repository_source_snapshots_byte_relation_check check (
    expanded_bytes >= retained_bytes
  ),
  constraint repository_source_snapshots_expiry_check check (
    expires_at = created_at + interval '7 days'
  ),
  constraint repository_source_snapshots_skip_counts_check check (
    jsonb_typeof(skip_counts) = 'object'
    and skip_counts ?& array[
      'symlink',
      'hardlink',
      'fileTooLarge',
      'retainedFileLimit',
      'retainedBytesLimit'
    ]
    and (skip_counts - array[
      'symlink',
      'hardlink',
      'fileTooLarge',
      'retainedFileLimit',
      'retainedBytesLimit'
    ]) = '{}'::jsonb
    and skip_counts->>'symlink' ~ '^[0-9]+$'
    and skip_counts->>'hardlink' ~ '^[0-9]+$'
    and skip_counts->>'fileTooLarge' ~ '^[0-9]+$'
    and skip_counts->>'retainedFileLimit' ~ '^[0-9]+$'
    and skip_counts->>'retainedBytesLimit' ~ '^[0-9]+$'
    and (skip_counts->>'symlink')::bigint between 0 and 50000
    and (skip_counts->>'hardlink')::bigint between 0 and 50000
    and (skip_counts->>'fileTooLarge')::bigint between 0 and 50000
    and (skip_counts->>'retainedFileLimit')::bigint between 0 and 50000
    and (skip_counts->>'retainedBytesLimit')::bigint between 0 and 50000
    and pg_column_size(skip_counts) <= 1024
  ),
  constraint repository_source_snapshots_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  constraint repository_source_snapshots_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade
);

create table private.repository_snapshot_tasks (
  task_id uuid primary key references private.worker_tasks(id) on delete cascade,
  scan_job_id uuid not null unique,
  workspace_id uuid not null,
  asset_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  schema_version smallint not null default 1 check (schema_version = 1),
  owner_name text not null check (
    char_length(owner_name) between 1 and 100
    and owner_name !~ '[/\\?#]'
  ),
  repository_name text not null check (
    char_length(repository_name) between 1 and 100
    and repository_name !~ '[/\\?#]'
  ),
  canonical_repository_url text not null check (
    char_length(canonical_repository_url) between 1 and 512
    and canonical_repository_url ~ '^https://github[.]com/[^/?#]+/[^/?#]+$'
  ),
  created_at timestamptz not null default now(),
  constraint repository_snapshot_tasks_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  constraint repository_snapshot_tasks_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade
);

create table private.repository_snapshot_attempt_uploads (
  attempt_id uuid primary key references private.worker_attempts(id) on delete cascade,
  task_id uuid not null references private.worker_tasks(id) on delete cascade,
  object_key text not null unique check (
    object_key ~ '^repository-source/[a-f0-9]{64}[.]tar[.]gz$'
  ),
  created_at timestamptz not null default now()
);

create table private.repository_source_artifacts (
  snapshot_id uuid primary key
    references public.repository_source_snapshots(id) on delete cascade,
  provider text not null default 'r2' check (provider = 'r2'),
  object_key text not null unique check (
    object_key ~ '^repository-source/[a-f0-9]{64}[.]tar[.]gz$'
  ),
  stored_byte_count bigint not null check (stored_byte_count between 1 and 335544320),
  artifact_digest text not null check (artifact_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  deletion_status text not null default 'active' check (
    deletion_status in ('active', 'deleted')
  ),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint repository_source_artifacts_deletion_check check (
    (deletion_status = 'active' and deleted_at is null)
    or (deletion_status = 'deleted' and deleted_at is not null)
  )
);

create index repository_source_snapshots_asset_workspace_idx
  on public.repository_source_snapshots(asset_id, workspace_id);

create index repository_source_snapshots_job_workspace_asset_idx
  on public.repository_source_snapshots(scan_job_id, workspace_id, asset_id);

create index repository_source_snapshots_workspace_asset_created_idx
  on public.repository_source_snapshots(workspace_id, asset_id, created_at desc);

create index repository_snapshot_tasks_asset_workspace_idx
  on private.repository_snapshot_tasks(asset_id, workspace_id);

create index repository_snapshot_tasks_job_workspace_asset_idx
  on private.repository_snapshot_tasks(scan_job_id, workspace_id, asset_id);

create index repository_snapshot_attempt_uploads_task_idx
  on private.repository_snapshot_attempt_uploads(task_id);

create index repository_source_artifacts_expiry_idx
  on private.repository_source_artifacts(expires_at)
  where deletion_status = 'active';

create or replace function private.reject_repository_source_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Repository source snapshot rows are immutable';
end;
$$;

create trigger repository_source_snapshots_guard_update
before update on public.repository_source_snapshots
for each row execute function private.reject_repository_source_snapshot_mutation();

create trigger repository_source_snapshots_guard_delete
before delete on public.repository_source_snapshots
for each row execute function private.reject_repository_source_snapshot_mutation();

alter table public.repository_source_snapshots enable row level security;

create policy repository_source_snapshots_member_select
on public.repository_source_snapshots
for select to authenticated
using (private.is_workspace_member(workspace_id));

revoke all on table public.repository_source_snapshots from public, anon, authenticated;
grant select on table public.repository_source_snapshots to authenticated;
revoke insert, update, delete on table public.repository_source_snapshots from authenticated;

revoke all on table private.repository_snapshot_tasks from public, anon, authenticated, service_role;
revoke all on table private.repository_snapshot_attempt_uploads from public, anon, authenticated, service_role;
revoke all on table private.repository_source_artifacts from public, anon, authenticated, service_role;

revoke all on function private.reject_repository_source_snapshot_mutation() from public, anon, authenticated, service_role;

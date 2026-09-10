create table public.github_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  installation_id bigint not null unique check (installation_id > 0),
  account_id bigint not null check (account_id > 0),
  account_login text not null check (char_length(trim(account_login)) between 1 and 100),
  account_type text not null check (account_type in ('User', 'Organization')),
  repository_selection text not null check (repository_selection in ('all', 'selected')),
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  installed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.github_repository_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  github_connection_id uuid not null,
  asset_id uuid not null unique,
  repository_id bigint not null check (repository_id > 0),
  owner_login text not null check (char_length(trim(owner_login)) between 1 and 100),
  repository_name text not null check (char_length(trim(repository_name)) between 1 and 100),
  full_name text not null check (char_length(full_name) between 3 and 220),
  default_branch text not null check (char_length(default_branch) between 1 and 255),
  is_private boolean not null,
  html_url text not null check (
    char_length(html_url) between 19 and 2048
    and html_url like 'https://github.com/%'
  ),
  auto_scan_enabled boolean not null default true,
  access_status text not null default 'active' check (access_status in ('active', 'inaccessible', 'removed')),
  project_scan_state text not null default 'idle' check (
    project_scan_state in (
      'idle',
      'snapshot_queued',
      'waiting_scan_runtime',
      'scan_queued',
      'retry_pending'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, repository_id),
  unique (id, workspace_id),
  constraint github_repository_links_connection_workspace_fkey
    foreign key (github_connection_id, workspace_id)
    references public.github_connections(id, workspace_id)
    on delete cascade,
  constraint github_repository_links_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade
);

create table private.github_project_scan_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  link_id uuid not null,
  asset_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  snapshot_task_id uuid,
  snapshot_id uuid,
  scan_job_id uuid,
  scan_task_id uuid,
  state text not null default 'idle' check (
    state in (
      'idle',
      'snapshot_queued',
      'waiting_scan_runtime',
      'scan_queued',
      'retry_pending'
    )
  ),
  last_error_code text check (
    last_error_code is null
    or (
      char_length(last_error_code) between 1 and 100
      and last_error_code ~ '^[A-Z0-9_]+$'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (link_id),
  constraint github_project_scan_intents_link_workspace_fkey
    foreign key (link_id, workspace_id)
    references public.github_repository_links(id, workspace_id)
    on delete cascade,
  constraint github_project_scan_intents_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade
);

create index github_connections_workspace_status_idx
  on public.github_connections(workspace_id, status, updated_at desc);
create index github_repository_links_connection_idx
  on public.github_repository_links(github_connection_id, created_at desc);
create index github_repository_links_workspace_access_idx
  on public.github_repository_links(workspace_id, access_status, updated_at desc);
create index github_project_scan_intents_workspace_state_idx
  on private.github_project_scan_intents(workspace_id, state, updated_at desc);
create unique index github_project_scan_intents_snapshot_task_idx
  on private.github_project_scan_intents(snapshot_task_id)
  where snapshot_task_id is not null;

create trigger github_connections_set_updated_at
before update on public.github_connections
for each row execute function private.set_updated_at();

create trigger github_repository_links_set_updated_at
before update on public.github_repository_links
for each row execute function private.set_updated_at();

create trigger github_project_scan_intents_set_updated_at
before update on private.github_project_scan_intents
for each row execute function private.set_updated_at();

alter table public.github_connections enable row level security;
alter table public.github_repository_links enable row level security;
alter table private.github_project_scan_intents enable row level security;

revoke all on table public.github_connections from public, anon, authenticated;
revoke all on table public.github_repository_links from public, anon, authenticated;
revoke all on table private.github_project_scan_intents from public, anon, authenticated, service_role;

grant select on table public.github_connections to authenticated;
grant select on table public.github_repository_links to authenticated;

grant select, insert, update, delete on table public.github_connections to service_role;
grant select, insert, update, delete on table public.github_repository_links to service_role;

create policy github_connections_select_member
  on public.github_connections
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy github_repository_links_select_member
  on public.github_repository_links
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create or replace function public.enqueue_connected_project_snapshot(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid,
  target_link_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_record public.github_repository_links%rowtype;
  connection_record public.github_connections%rowtype;
  asset_record public.assets%rowtype;
  snapshot_enqueue_result jsonb;
  queued_task_id uuid;
begin
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null
     or target_link_id is null then
    raise exception 'PROJECT_SCAN_REQUEST_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-connected-project-scan:' || target_link_id::text, 0)
  );

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = target_workspace_id
       and user_id = target_actor_id
       and role::text in ('owner', 'admin')
  ) then
    raise exception 'PROJECT_SCAN_ACCESS_DENIED';
  end if;

  select * into link_record
    from public.github_repository_links
   where id = target_link_id
     and workspace_id = target_workspace_id
     and asset_id = target_asset_id
   for update;

  if link_record.id is null
     or link_record.access_status <> 'active'
     or link_record.is_private then
    raise exception 'PROJECT_SCAN_LINK_INELIGIBLE';
  end if;

  select * into connection_record
    from public.github_connections
   where id = link_record.github_connection_id
     and workspace_id = target_workspace_id
   for update;
  if connection_record.id is null or connection_record.status <> 'active' then
    raise exception 'PROJECT_SCAN_CONNECTION_INACTIVE';
  end if;

  select * into asset_record
    from public.assets
   where id = target_asset_id
     and workspace_id = target_workspace_id
   for update;
  if asset_record.id is null
     or asset_record.kind <> 'repository'::public.asset_kind
     or asset_record.canonical_target <> link_record.html_url then
    raise exception 'PROJECT_SCAN_REPOSITORY_MISMATCH';
  end if;

  snapshot_enqueue_result := public.enqueue_repository_snapshot_worker_task(
    target_workspace_id,
    target_asset_id,
    target_actor_id
  );
  queued_task_id := nullif(snapshot_enqueue_result->>'taskId', '')::uuid;
  if queued_task_id is null then
    raise exception 'PROJECT_SCAN_SNAPSHOT_ENQUEUE_INVALID';
  end if;

  insert into private.github_project_scan_intents (
    workspace_id,
    link_id,
    asset_id,
    requested_by,
    snapshot_task_id,
    snapshot_id,
    scan_job_id,
    scan_task_id,
    state,
    last_error_code
  ) values (
    target_workspace_id,
    target_link_id,
    target_asset_id,
    target_actor_id,
    queued_task_id,
    null,
    null,
    null,
    'snapshot_queued',
    null
  )
  on conflict (link_id) do update
    set workspace_id = excluded.workspace_id,
        asset_id = excluded.asset_id,
        requested_by = excluded.requested_by,
        snapshot_task_id = excluded.snapshot_task_id,
        snapshot_id = null,
        scan_job_id = null,
        scan_task_id = null,
        state = 'snapshot_queued',
        last_error_code = null,
        updated_at = now();

  update public.github_repository_links
     set project_scan_state = 'snapshot_queued'
   where id = target_link_id
     and workspace_id = target_workspace_id;

  return snapshot_enqueue_result;
end;
$$;

create or replace function public.get_connected_project_snapshot_continuation(
  target_snapshot_task_id uuid,
  target_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.github_project_scan_intents%rowtype;
  snapshot_task_record private.repository_snapshot_tasks%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  link_record public.github_repository_links%rowtype;
begin
  if target_snapshot_task_id is null or target_snapshot_id is null then
    raise exception 'PROJECT_SCAN_CONTINUATION_INVALID';
  end if;

  select * into intent_record
    from private.github_project_scan_intents
   where snapshot_task_id = target_snapshot_task_id;

  if intent_record.id is null then
    return null;
  end if;

  select * into snapshot_task_record
    from private.repository_snapshot_tasks
   where task_id = target_snapshot_task_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id;

  select * into snapshot_record
    from public.repository_source_snapshots
   where id = target_snapshot_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id;

  if snapshot_task_record.task_id is null
     or snapshot_record.id is null
     or snapshot_record.scan_job_id <> snapshot_task_record.scan_job_id then
    raise exception 'PROJECT_SCAN_SNAPSHOT_MISMATCH';
  end if;

  select * into link_record
    from public.github_repository_links
   where id = intent_record.link_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id;

  if link_record.id is null then
    raise exception 'PROJECT_SCAN_LINK_MISSING';
  end if;

  return jsonb_build_object(
    'workspaceId', intent_record.workspace_id,
    'assetId', intent_record.asset_id,
    'actorId', intent_record.requested_by,
    'linkId', intent_record.link_id,
    'repositoryId', link_record.repository_id,
    'canonicalTarget', link_record.html_url,
    'isPrivate', link_record.is_private,
    'accessStatus', link_record.access_status,
    'snapshotTaskId', target_snapshot_task_id,
    'snapshotId', target_snapshot_id,
    'state', intent_record.state
  );
end;
$$;

create or replace function public.mark_connected_project_scan_waiting(
  target_snapshot_task_id uuid,
  target_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  continuation jsonb;
  target_link_id uuid;
begin
  continuation := public.get_connected_project_snapshot_continuation(
    target_snapshot_task_id,
    target_snapshot_id
  );
  if continuation is null then
    return null;
  end if;
  target_link_id := (continuation->>'linkId')::uuid;

  update private.github_project_scan_intents
     set snapshot_id = target_snapshot_id,
         state = 'waiting_scan_runtime',
         last_error_code = null
   where link_id = target_link_id
     and snapshot_task_id = target_snapshot_task_id;

  update public.github_repository_links
     set project_scan_state = 'waiting_scan_runtime'
   where id = target_link_id
     and workspace_id = (continuation->>'workspaceId')::uuid;

  return jsonb_build_object('state', 'waiting_scan_runtime');
end;
$$;

create or replace function public.record_connected_project_scan_retry(
  target_snapshot_task_id uuid,
  target_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  continuation jsonb;
  target_link_id uuid;
begin
  continuation := public.get_connected_project_snapshot_continuation(
    target_snapshot_task_id,
    target_snapshot_id
  );
  if continuation is null then
    return null;
  end if;
  target_link_id := (continuation->>'linkId')::uuid;

  update private.github_project_scan_intents
     set snapshot_id = target_snapshot_id,
         state = 'retry_pending',
         last_error_code = 'PROJECT_SCAN_CONTINUATION_RETRY'
   where link_id = target_link_id
     and snapshot_task_id = target_snapshot_task_id;

  update public.github_repository_links
     set project_scan_state = 'retry_pending'
   where id = target_link_id
     and workspace_id = (continuation->>'workspaceId')::uuid;

  return jsonb_build_object('state', 'retry_pending');
end;
$$;

create or replace function public.enqueue_connected_project_scan_continuation(
  target_snapshot_task_id uuid,
  target_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.github_project_scan_intents%rowtype;
  continuation jsonb;
  scan_enqueue_result jsonb;
  queued_scan_task_id uuid;
  queued_scan_job_id uuid;
begin
  if target_snapshot_task_id is null or target_snapshot_id is null then
    raise exception 'PROJECT_SCAN_CONTINUATION_INVALID';
  end if;

  select * into intent_record
    from private.github_project_scan_intents
   where snapshot_task_id = target_snapshot_task_id
   for update;

  if intent_record.id is null then
    return null;
  end if;

  continuation := public.get_connected_project_snapshot_continuation(
    target_snapshot_task_id,
    target_snapshot_id
  );

  if intent_record.state = 'scan_queued' then
    if intent_record.snapshot_id <> target_snapshot_id
       or intent_record.scan_task_id is null
       or intent_record.scan_job_id is null then
      raise exception 'PROJECT_SCAN_SNAPSHOT_MISMATCH';
    end if;
    return jsonb_build_object(
      'taskId', intent_record.scan_task_id,
      'scanJobId', intent_record.scan_job_id,
      'snapshotId', intent_record.snapshot_id,
      'replayed', true
    );
  end if;

  if intent_record.state not in (
    'snapshot_queued',
    'waiting_scan_runtime',
    'retry_pending'
  ) then
    raise exception 'PROJECT_SCAN_STATE_INVALID';
  end if;

  if (continuation->>'isPrivate')::boolean
     or continuation->>'accessStatus' <> 'active' then
    raise exception 'PROJECT_SCAN_LINK_INELIGIBLE';
  end if;

  scan_enqueue_result := public.enqueue_repository_scan_worker_task(
    intent_record.workspace_id,
    intent_record.asset_id,
    intent_record.requested_by
  );

  if scan_enqueue_result->>'snapshotId' is distinct from target_snapshot_id::text then
    raise exception 'PROJECT_SCAN_SNAPSHOT_MISMATCH';
  end if;

  queued_scan_task_id := nullif(scan_enqueue_result->>'taskId', '')::uuid;
  queued_scan_job_id := nullif(scan_enqueue_result->>'scanJobId', '')::uuid;
  if queued_scan_task_id is null or queued_scan_job_id is null then
    raise exception 'PROJECT_SCAN_SCAN_ENQUEUE_INVALID';
  end if;

  update private.github_project_scan_intents
     set snapshot_id = target_snapshot_id,
         scan_task_id = queued_scan_task_id,
         scan_job_id = queued_scan_job_id,
         state = 'scan_queued',
         last_error_code = null
   where id = intent_record.id;

  update public.github_repository_links
     set project_scan_state = 'scan_queued'
   where id = intent_record.link_id
     and workspace_id = intent_record.workspace_id;

  return jsonb_build_object(
    'taskId', queued_scan_task_id,
    'scanJobId', queued_scan_job_id,
    'snapshotId', target_snapshot_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.enqueue_connected_project_snapshot(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_connected_project_snapshot(uuid, uuid, uuid, uuid)
  to service_role;

revoke all on function public.get_connected_project_snapshot_continuation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_connected_project_snapshot_continuation(uuid, uuid)
  to service_role;

revoke all on function public.mark_connected_project_scan_waiting(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mark_connected_project_scan_waiting(uuid, uuid)
  to service_role;

revoke all on function public.record_connected_project_scan_retry(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_connected_project_scan_retry(uuid, uuid)
  to service_role;

revoke all on function public.enqueue_connected_project_scan_continuation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_connected_project_scan_continuation(uuid, uuid)
  to service_role;

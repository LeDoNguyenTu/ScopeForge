-- Phase 10A3: authenticated GitHub App webhook replay protection, provider reconciliation,
-- and latest-head-wins automatic connected-project scan scheduling.
-- Raw webhook bytes, signatures, provider credentials, temporary archive URLs, and source
-- material are intentionally never persisted by this migration.

create table private.github_webhook_deliveries (
  delivery_id uuid primary key,
  event_name text not null,
  action text,
  installation_id bigint,
  repository_id bigint,
  push_after_sha text,
  processing_state text not null default 'received',
  result_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint github_webhook_deliveries_event_name_check check (
    char_length(event_name) between 1 and 64
    and event_name ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint github_webhook_deliveries_action_check check (
    action is null or (
      char_length(action) between 1 and 64
      and action ~ '^[A-Za-z0-9_.-]+$'
    )
  ),
  constraint github_webhook_deliveries_installation_id_check check (
    installation_id is null or installation_id > 0
  ),
  constraint github_webhook_deliveries_repository_id_check check (
    repository_id is null or repository_id > 0
  ),
  constraint github_webhook_deliveries_push_after_sha_check check (
    push_after_sha is null or push_after_sha ~ '^[a-f0-9]{40}$'
  ),
  constraint github_webhook_deliveries_processing_state_check check (
    processing_state in ('received', 'processed', 'ignored', 'failed')
  ),
  constraint github_webhook_deliveries_result_code_check check (
    result_code is null or (
      char_length(result_code) between 1 and 64
      and result_code ~ '^[A-Z0-9_]+$'
    )
  ),
  constraint github_webhook_deliveries_processed_at_check check (
    processed_at is null or processed_at >= received_at
  )
);

alter table private.github_webhook_deliveries enable row level security;
revoke all on table private.github_webhook_deliveries from public, anon, authenticated, service_role;

create index github_webhook_deliveries_received_idx
  on private.github_webhook_deliveries(received_at desc);
create index github_webhook_deliveries_installation_repository_idx
  on private.github_webhook_deliveries(installation_id, repository_id, received_at desc)
  where installation_id is not null and repository_id is not null;

create table private.github_repository_auto_scan_state (
  link_id uuid primary key,
  workspace_id uuid not null,
  repository_id bigint not null,
  desired_commit_sha text,
  successful_commit_sha text,
  latest_delivery_id uuid,
  pending boolean not null default false,
  provider_archived boolean not null default false,
  last_outcome_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint github_repository_auto_scan_state_link_workspace_fkey
    foreign key (link_id, workspace_id)
    references public.github_repository_links(id, workspace_id)
    on delete cascade,
  constraint github_repository_auto_scan_state_workspace_repository_key
    unique (workspace_id, repository_id),
  constraint github_repository_auto_scan_state_repository_id_check check (repository_id > 0),
  constraint github_repository_auto_scan_state_desired_sha_check check (
    desired_commit_sha is null or desired_commit_sha ~ '^[a-f0-9]{40}$'
  ),
  constraint github_repository_auto_scan_state_successful_sha_check check (
    successful_commit_sha is null or successful_commit_sha ~ '^[a-f0-9]{40}$'
  ),
  constraint github_repository_auto_scan_state_outcome_check check (
    last_outcome_code is null or (
      char_length(last_outcome_code) between 1 and 64
      and last_outcome_code ~ '^[A-Z0-9_]+$'
    )
  )
);

alter table private.github_repository_auto_scan_state enable row level security;
revoke all on table private.github_repository_auto_scan_state from public, anon, authenticated, service_role;

create index github_repository_auto_scan_state_pending_idx
  on private.github_repository_auto_scan_state(workspace_id, updated_at)
  where pending;

alter table private.github_project_scan_intents
  add column trigger_kind text not null default 'manual';
alter table private.github_project_scan_intents
  add column trigger_delivery_id uuid;
alter table private.github_project_scan_intents
  add column trigger_commit_sha text;

alter table private.github_project_scan_intents
  add constraint github_project_scan_intents_trigger_kind_check check (
    trigger_kind in ('manual', 'github_webhook')
  );
alter table private.github_project_scan_intents
  add constraint github_project_scan_intents_trigger_commit_sha_check check (
    trigger_commit_sha is null or trigger_commit_sha ~ '^[a-f0-9]{40}$'
  );
alter table private.github_project_scan_intents
  add constraint github_project_scan_intents_trigger_shape_check check (
    (trigger_kind = 'manual' and trigger_delivery_id is null and trigger_commit_sha is null)
    or
    (trigger_kind = 'github_webhook' and trigger_delivery_id is not null and trigger_commit_sha is not null)
  );

create or replace function public.admit_github_webhook_delivery(
  target_delivery_id uuid,
  target_event_name text,
  target_action text,
  target_installation_id bigint,
  target_repository_id bigint,
  target_push_after_sha text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admitted_id uuid;
begin
  if target_delivery_id is null
     or target_event_name is null
     or char_length(target_event_name) not between 1 and 64
     or target_event_name !~ '^[a-z][a-z0-9_]*$'
     or (target_action is not null and (
       char_length(target_action) not between 1 and 64
       or target_action !~ '^[A-Za-z0-9_.-]+$'
     ))
     or (target_installation_id is not null and target_installation_id <= 0)
     or (target_repository_id is not null and target_repository_id <= 0)
     or (target_push_after_sha is not null and target_push_after_sha !~ '^[a-f0-9]{40}$') then
    raise exception 'GITHUB_WEBHOOK_DELIVERY_INVALID';
  end if;

  insert into private.github_webhook_deliveries (
    delivery_id, event_name, action, installation_id, repository_id,
    push_after_sha, processing_state, received_at
  ) values (
    target_delivery_id, target_event_name, target_action, target_installation_id,
    target_repository_id, target_push_after_sha, 'received', now()
  )
  on conflict (delivery_id) do nothing
  returning delivery_id into admitted_id;

  if admitted_id is null then
    return jsonb_build_object(
      'admitted', false,
      'replayed', true,
      'deliveryId', target_delivery_id
    );
  end if;

  return jsonb_build_object(
    'admitted', true,
    'replayed', false,
    'deliveryId', admitted_id
  );
end;
$$;
revoke all on function public.admit_github_webhook_delivery(uuid, text, text, bigint, bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.admit_github_webhook_delivery(uuid, text, text, bigint, bigint, text) to service_role;

create or replace function public.get_github_webhook_repository_context(
  target_installation_id bigint,
  target_repository_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.github_connections%rowtype;
  link_record public.github_repository_links%rowtype;
  auto_record private.github_repository_auto_scan_state%rowtype;
begin
  if target_installation_id is null or target_installation_id <= 0
     or target_repository_id is null or target_repository_id <= 0 then
    raise exception 'GITHUB_WEBHOOK_CONTEXT_INVALID';
  end if;

  select * into connection_record
    from public.github_connections
   where installation_id = target_installation_id;
  if connection_record.id is null then
    return null;
  end if;

  select * into link_record
    from public.github_repository_links
   where workspace_id = connection_record.workspace_id
     and github_connection_id = connection_record.id
     and repository_id = target_repository_id;
  if link_record.id is null then
    return null;
  end if;

  select * into auto_record
    from private.github_repository_auto_scan_state
   where link_id = link_record.id
     and workspace_id = link_record.workspace_id;

  return jsonb_build_object(
    'workspaceId', link_record.workspace_id,
    'connectionId', connection_record.id,
    'linkId', link_record.id,
    'assetId', link_record.asset_id,
    'installationId', connection_record.installation_id,
    'repositoryId', link_record.repository_id,
    'installedBy', connection_record.installed_by,
    'connectionStatus', connection_record.status,
    'accessStatus', link_record.access_status,
    'autoScanEnabled', link_record.auto_scan_enabled,
    'ownerLogin', link_record.owner_login,
    'repositoryName', link_record.repository_name,
    'fullName', link_record.full_name,
    'defaultBranch', link_record.default_branch,
    'isPrivate', link_record.is_private,
    'htmlUrl', link_record.html_url,
    'providerArchived', coalesce(auto_record.provider_archived, false),
    'desiredCommitSha', auto_record.desired_commit_sha,
    'successfulCommitSha', auto_record.successful_commit_sha,
    'pending', coalesce(auto_record.pending, false)
  );
end;
$$;
revoke all on function public.get_github_webhook_repository_context(bigint, bigint) from public, anon, authenticated, service_role;
grant execute on function public.get_github_webhook_repository_context(bigint, bigint) to service_role;

create or replace function public.record_github_webhook_push_head(
  target_workspace_id uuid,
  target_link_id uuid,
  target_repository_id bigint,
  target_delivery_id uuid,
  target_commit_sha text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_record public.github_repository_links%rowtype;
  connection_record public.github_connections%rowtype;
  auto_record private.github_repository_auto_scan_state%rowtype;
  intent_record private.github_project_scan_intents%rowtype;
  already_active boolean := false;
begin
  if target_workspace_id is null or target_link_id is null or target_delivery_id is null
     or target_repository_id is null or target_repository_id <= 0
     or target_commit_sha is null or target_commit_sha !~ '^[a-f0-9]{40}$' then
    raise exception 'GITHUB_WEBHOOK_PUSH_HEAD_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-auto-scan-link:' || target_link_id::text, 0)
  );

  select * into link_record
    from public.github_repository_links
   where id = target_link_id
     and workspace_id = target_workspace_id
     and repository_id = target_repository_id
   for update;
  if link_record.id is null then
    raise exception 'GITHUB_WEBHOOK_REPOSITORY_UNAVAILABLE';
  end if;

  select * into connection_record
    from public.github_connections
   where id = link_record.github_connection_id
     and workspace_id = target_workspace_id
   for update;
  if connection_record.id is null
     or connection_record.status <> 'active'
     or link_record.access_status <> 'active'
     or not link_record.auto_scan_enabled then
    return jsonb_build_object(
      'replayed', false,
      'shouldEnqueue', false,
      'ignored', true,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  if not exists (
    select 1 from private.github_webhook_deliveries
     where delivery_id = target_delivery_id
  ) then
    raise exception 'GITHUB_WEBHOOK_DELIVERY_UNKNOWN';
  end if;

  insert into private.github_repository_auto_scan_state (
    link_id, workspace_id, repository_id, latest_delivery_id, pending,
    provider_archived, created_at, updated_at
  ) values (
    link_record.id, link_record.workspace_id, link_record.repository_id,
    target_delivery_id, false, false, now(), now()
  )
  on conflict (link_id) do nothing;

  select * into auto_record
    from private.github_repository_auto_scan_state
   where link_id = link_record.id
     and workspace_id = link_record.workspace_id
   for update;

  if auto_record.provider_archived then
    update private.github_repository_auto_scan_state
       set latest_delivery_id = target_delivery_id,
           pending = false,
           last_outcome_code = 'IGNORED_ARCHIVED',
           updated_at = now()
     where link_id = link_record.id;
    return jsonb_build_object(
      'replayed', false,
      'shouldEnqueue', false,
      'ignored', true,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  if auto_record.successful_commit_sha = target_commit_sha
     and not auto_record.pending then
    update private.github_repository_auto_scan_state
       set desired_commit_sha = target_commit_sha,
           latest_delivery_id = target_delivery_id,
           last_outcome_code = 'SEMANTIC_REPLAY',
           updated_at = now()
     where link_id = link_record.id;
    return jsonb_build_object(
      'replayed', true,
      'shouldEnqueue', false,
      'ignored', false,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  select * into intent_record
    from private.github_project_scan_intents
   where link_id = link_record.id
   for update;
  already_active := intent_record.id is not null and intent_record.state <> 'idle';

  if auto_record.desired_commit_sha = target_commit_sha and auto_record.pending then
    update private.github_repository_auto_scan_state
       set latest_delivery_id = target_delivery_id,
           last_outcome_code = 'SEMANTIC_REPLAY',
           updated_at = now()
     where link_id = link_record.id;
    return jsonb_build_object(
      'replayed', true,
      'shouldEnqueue', false,
      'ignored', false,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  update private.github_repository_auto_scan_state
     set desired_commit_sha = target_commit_sha,
         latest_delivery_id = target_delivery_id,
         pending = true,
         last_outcome_code = case when already_active then 'COALESCED' else 'READY' end,
         updated_at = now()
   where link_id = link_record.id;

  return jsonb_build_object(
    'replayed', false,
    'shouldEnqueue', not already_active,
    'coalesced', already_active,
    'ignored', false,
    'desiredCommitSha', target_commit_sha
  );
end;
$$;
revoke all on function public.record_github_webhook_push_head(uuid, uuid, bigint, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.record_github_webhook_push_head(uuid, uuid, bigint, uuid, text) to service_role;

create or replace function public.enqueue_github_webhook_project_snapshot(
  target_workspace_id uuid,
  target_link_id uuid,
  target_delivery_id uuid,
  target_commit_sha text
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
  auto_record private.github_repository_auto_scan_state%rowtype;
  intent_record private.github_project_scan_intents%rowtype;
  job_record public.scan_jobs%rowtype;
  task_record private.worker_tasks%rowtype;
  execution_class text;
  request_now timestamptz := now();
  utc_day_start timestamptz := (
    date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
  );
begin
  if target_workspace_id is null or target_link_id is null or target_delivery_id is null
     or target_commit_sha is null or target_commit_sha !~ '^[a-f0-9]{40}$' then
    raise exception 'GITHUB_WEBHOOK_SCAN_REQUEST_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-auto-scan-link:' || target_link_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-repository-snapshot-workspace:' || target_workspace_id::text, 0)
  );

  select * into link_record
    from public.github_repository_links
   where id = target_link_id
     and workspace_id = target_workspace_id
   for update;
  if link_record.id is null then
    raise exception 'GITHUB_WEBHOOK_REPOSITORY_UNAVAILABLE';
  end if;

  select * into connection_record
    from public.github_connections
   where id = link_record.github_connection_id
     and workspace_id = target_workspace_id
   for update;
  if connection_record.id is null
     or connection_record.status <> 'active'
     or link_record.access_status <> 'active'
     or not link_record.auto_scan_enabled then
    raise exception 'GITHUB_WEBHOOK_REPOSITORY_UNAVAILABLE';
  end if;

  select * into auto_record
    from private.github_repository_auto_scan_state
   where link_id = link_record.id
     and workspace_id = link_record.workspace_id
   for update;
  if auto_record.link_id is null
     or auto_record.provider_archived
     or auto_record.desired_commit_sha is distinct from target_commit_sha
     or auto_record.latest_delivery_id is distinct from target_delivery_id then
    raise exception 'GITHUB_WEBHOOK_SCAN_STALE';
  end if;

  if auto_record.successful_commit_sha = target_commit_sha then
    update private.github_repository_auto_scan_state
       set pending = false,
           last_outcome_code = 'SEMANTIC_REPLAY',
           updated_at = request_now
     where link_id = link_record.id;
    return jsonb_build_object(
      'replayed', true,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  select * into intent_record
    from private.github_project_scan_intents
   where link_id = link_record.id
   for update;
  if intent_record.id is not null and intent_record.state <> 'idle' then
    return jsonb_build_object(
      'replayed', true,
      'taskId', intent_record.snapshot_task_id,
      'desiredCommitSha', auto_record.desired_commit_sha
    );
  end if;

  select * into asset_record
    from public.assets
   where id = link_record.asset_id
     and workspace_id = target_workspace_id
   for update;
  if asset_record.id is null
     or asset_record.kind <> 'repository'::public.asset_kind
     or asset_record.canonical_target <> link_record.html_url then
    raise exception 'REPOSITORY_SNAPSHOT_ASSET_MISMATCH';
  end if;

  if exists (
    select 1 from public.scan_jobs
     where workspace_id = target_workspace_id
       and job_kind = 'repository_snapshot'::public.scan_job_kind
       and status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
  ) then
    raise exception 'REPOSITORY_SNAPSHOT_ACTIVE_LIMIT';
  end if;

  if (
    select count(*) from public.scan_jobs
     where workspace_id = target_workspace_id
       and job_kind = 'repository_snapshot'::public.scan_job_kind
       and created_at >= utc_day_start
  ) >= 20 then
    raise exception 'REPOSITORY_SNAPSHOT_DAILY_LIMIT';
  end if;

  execution_class := case
    when link_record.is_private then 'repository_snapshot_github_private_v1'
    else 'repository_snapshot_github_public_v1'
  end;

  insert into public.scan_jobs (
    workspace_id, asset_id, job_kind, status, requested_by,
    blocked_reason, authorization_canonical_target, authorization_asset_kind,
    authorization_verified_at, validation_profile_id, validation_profile_version,
    authorization_granted_at, budget, request_count, redirect_count, finding_count
  ) values (
    target_workspace_id, link_record.asset_id,
    'repository_snapshot'::public.scan_job_kind,
    'queued'::public.scan_job_status,
    connection_record.installed_by,
    null, null, null, null, null, null, null,
    '{"maxWallTimeMs":300000,"maxCpuTimeMs":120000,"maxMemoryBytes":536870912,"maxProcesses":1,"maxInputFiles":20000,"maxInputBytes":268435456,"maxScratchBytes":536870912,"maxOutputBytes":65536}'::jsonb,
    0, 0, 0
  ) returning * into job_record;

  insert into private.worker_tasks (
    scan_job_id, workspace_id, asset_id, execution_class, state,
    priority, available_at, attempt_count, max_attempts, absolute_deadline_at
  ) values (
    job_record.id, job_record.workspace_id, job_record.asset_id,
    execution_class, 'queued', 0, request_now, 0, 3,
    request_now + interval '20 minutes'
  ) returning * into task_record;

  insert into private.repository_snapshot_tasks (
    task_id, scan_job_id, workspace_id, asset_id, requested_by,
    schema_version, owner_name, repository_name, canonical_repository_url,
    github_repository_link_id, created_at
  ) values (
    task_record.id, job_record.id, target_workspace_id, link_record.asset_id,
    connection_record.installed_by, 1, link_record.owner_login,
    link_record.repository_name, link_record.html_url, link_record.id, request_now
  );

  insert into private.github_project_scan_intents (
    workspace_id, link_id, asset_id, requested_by, snapshot_task_id,
    snapshot_id, scan_job_id, scan_task_id, state, last_error_code,
    trigger_kind, trigger_delivery_id, trigger_commit_sha, created_at, updated_at
  ) values (
    target_workspace_id, link_record.id, link_record.asset_id, connection_record.installed_by,
    task_record.id, null, null, null, 'snapshot_queued', null,
    'github_webhook', target_delivery_id, target_commit_sha, request_now, request_now
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
        trigger_kind = 'github_webhook',
        trigger_delivery_id = excluded.trigger_delivery_id,
        trigger_commit_sha = excluded.trigger_commit_sha,
        updated_at = excluded.updated_at;

  update public.github_repository_links
     set project_scan_state = 'snapshot_queued',
         updated_at = request_now
   where id = link_record.id
     and workspace_id = target_workspace_id;

  update private.github_repository_auto_scan_state
     set pending = true,
         last_outcome_code = 'SNAPSHOT_QUEUED',
         updated_at = request_now
   where link_id = link_record.id;

  perform private.record_worker_event(
    'worker.task_queued', task_record.workspace_id, null, task_record.id,
    jsonb_build_object(
      'scanJobId', task_record.scan_job_id,
      'executionClass', task_record.execution_class,
      'triggerKind', 'github_webhook'
    )
  );

  return jsonb_build_object(
    'replayed', false,
    'scanJobId', job_record.id,
    'taskId', task_record.id,
    'executionClass', task_record.execution_class,
    'desiredCommitSha', target_commit_sha,
    'absoluteDeadlineAt', task_record.absolute_deadline_at
  );
end;
$$;
revoke all on function public.enqueue_github_webhook_project_snapshot(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_github_webhook_project_snapshot(uuid, uuid, uuid, text) to service_role;

create or replace function public.record_github_webhook_delivery_result(
  target_delivery_id uuid,
  target_state text,
  target_result_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_id uuid;
begin
  if target_delivery_id is null
     or target_state not in ('processed', 'ignored', 'failed')
     or (target_result_code is not null and (
       char_length(target_result_code) not between 1 and 64
       or target_result_code !~ '^[A-Z0-9_]+$'
     )) then
    raise exception 'GITHUB_WEBHOOK_DELIVERY_RESULT_INVALID';
  end if;

  update private.github_webhook_deliveries
     set processing_state = target_state,
         result_code = target_result_code,
         processed_at = now()
   where delivery_id = target_delivery_id
  returning delivery_id into updated_id;

  if updated_id is null then
    raise exception 'GITHUB_WEBHOOK_DELIVERY_UNKNOWN';
  end if;

  return jsonb_build_object(
    'deliveryId', updated_id,
    'state', target_state,
    'resultCode', target_result_code
  );
end;
$$;
revoke all on function public.record_github_webhook_delivery_result(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_github_webhook_delivery_result(uuid, text, text) to service_role;

create or replace function public.reconcile_github_webhook_connection_state(
  target_installation_id bigint,
  target_status text,
  target_account_id bigint,
  target_account_login text,
  target_account_type text,
  target_repository_selection text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.github_connections%rowtype;
  reconciled_status text;
begin
  if target_installation_id is null or target_installation_id <= 0
     or target_status not in ('active', 'suspended', 'removed') then
    raise exception 'GITHUB_WEBHOOK_CONNECTION_INVALID';
  end if;

  if target_status = 'active' and (
    target_account_id is null or target_account_id <= 0
    or target_account_login is null or char_length(target_account_login) not between 1 and 100
    or target_account_type not in ('User', 'Organization')
    or target_repository_selection not in ('all', 'selected')
  ) then
    raise exception 'GITHUB_WEBHOOK_CONNECTION_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-installation:' || target_installation_id::text, 0)
  );

  select * into connection_record
    from public.github_connections
   where installation_id = target_installation_id
   for update;
  if connection_record.id is null then
    return jsonb_build_object('matched', false, 'installationId', target_installation_id);
  end if;

  reconciled_status := target_status;
  update public.github_connections
     set account_id = case when target_status = 'active' then target_account_id else account_id end,
         account_login = case when target_status = 'active' then target_account_login else account_login end,
         account_type = case when target_status = 'active' then target_account_type else account_type end,
         repository_selection = case when target_status = 'active' then target_repository_selection else repository_selection end,
         status = reconciled_status,
         updated_at = now()
   where id = connection_record.id
     and workspace_id = connection_record.workspace_id;

  if target_status = 'suspended' then
    update public.github_repository_links
       set access_status = 'inaccessible',
           project_scan_state = 'idle',
           updated_at = now()
     where github_connection_id = connection_record.id
       and workspace_id = connection_record.workspace_id
       and access_status <> 'removed';
    update private.github_repository_auto_scan_state
       set pending = false,
           last_outcome_code = 'IGNORED_CONNECTION_SUSPENDED',
           updated_at = now()
     where workspace_id = connection_record.workspace_id;
  elsif target_status = 'removed' then
    update public.github_repository_links
       set access_status = 'removed',
           project_scan_state = 'idle',
           updated_at = now()
     where github_connection_id = connection_record.id
       and workspace_id = connection_record.workspace_id;
    update private.github_repository_auto_scan_state
       set pending = false,
           last_outcome_code = 'IGNORED_CONNECTION_REMOVED',
           updated_at = now()
     where workspace_id = connection_record.workspace_id;
  end if;

  return jsonb_build_object(
    'matched', true,
    'workspaceId', connection_record.workspace_id,
    'connectionId', connection_record.id,
    'installationId', target_installation_id,
    'status', reconciled_status
  );
end;
$$;
revoke all on function public.reconcile_github_webhook_connection_state(bigint, text, bigint, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_github_webhook_connection_state(bigint, text, bigint, text, text, text) to service_role;

create or replace function public.reconcile_github_webhook_repository_state(
  target_installation_id bigint,
  target_repository_id bigint,
  target_owner_login text,
  target_repository_name text,
  target_full_name text,
  target_default_branch text,
  target_is_private boolean,
  target_html_url text,
  target_provider_archived boolean,
  target_access_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.github_connections%rowtype;
  link_record public.github_repository_links%rowtype;
  effective_access_status text;
begin
  if target_installation_id is null or target_installation_id <= 0
     or target_repository_id is null or target_repository_id <= 0
     or target_owner_login is null or char_length(target_owner_login) not between 1 and 100
     or target_repository_name is null or char_length(target_repository_name) not between 1 and 100
     or target_full_name <> target_owner_login || '/' || target_repository_name
     or target_default_branch is null or char_length(target_default_branch) not between 1 and 255
     or target_html_url <> 'https://github.com/' || target_full_name
     or target_is_private is null
     or target_provider_archived is null
     or target_access_status not in ('active', 'inaccessible', 'removed') then
    raise exception 'GITHUB_WEBHOOK_REPOSITORY_STATE_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-installation:' || target_installation_id::text, 0)
  );

  select * into connection_record
    from public.github_connections
   where installation_id = target_installation_id
   for update;
  if connection_record.id is null then
    return jsonb_build_object('matched', false, 'installationId', target_installation_id);
  end if;

  select * into link_record
    from public.github_repository_links
   where workspace_id = connection_record.workspace_id
     and github_connection_id = connection_record.id
     and repository_id = target_repository_id
   for update;
  if link_record.id is null then
    return jsonb_build_object(
      'matched', false,
      'workspaceId', connection_record.workspace_id,
      'repositoryId', target_repository_id
    );
  end if;

  effective_access_status := case
    when connection_record.status <> 'active' then 'inaccessible'
    else target_access_status
  end;

  update public.github_repository_links
     set owner_login = target_owner_login,
         repository_name = target_repository_name,
         full_name = target_full_name,
         default_branch = target_default_branch,
         is_private = target_is_private,
         html_url = target_html_url,
         access_status = effective_access_status,
         project_scan_state = case
           when effective_access_status <> 'active' or target_provider_archived then 'idle'
           else project_scan_state
         end,
         updated_at = now()
   where id = link_record.id
     and workspace_id = connection_record.workspace_id;

  insert into private.github_repository_auto_scan_state (
    link_id, workspace_id, repository_id, pending, provider_archived,
    last_outcome_code, created_at, updated_at
  ) values (
    link_record.id, connection_record.workspace_id, target_repository_id,
    false, target_provider_archived,
    case
      when target_provider_archived then 'IGNORED_ARCHIVED'
      when effective_access_status <> 'active' then 'IGNORED_INACCESSIBLE'
      else null
    end,
    now(), now()
  )
  on conflict (link_id) do update
    set repository_id = excluded.repository_id,
        provider_archived = excluded.provider_archived,
        pending = case
          when excluded.provider_archived or effective_access_status <> 'active' then false
          else private.github_repository_auto_scan_state.pending
        end,
        last_outcome_code = case
          when excluded.provider_archived then 'IGNORED_ARCHIVED'
          when effective_access_status <> 'active' then 'IGNORED_INACCESSIBLE'
          else private.github_repository_auto_scan_state.last_outcome_code
        end,
        updated_at = now();

  return jsonb_build_object(
    'matched', true,
    'workspaceId', connection_record.workspace_id,
    'connectionId', connection_record.id,
    'linkId', link_record.id,
    'assetId', link_record.asset_id,
    'repositoryId', target_repository_id,
    'installedBy', connection_record.installed_by,
    'autoScanEnabled', link_record.auto_scan_enabled,
    'accessStatus', effective_access_status,
    'providerArchived', target_provider_archived,
    'defaultBranch', target_default_branch,
    'isPrivate', target_is_private,
    'htmlUrl', target_html_url
  );
end;
$$;
revoke all on function public.reconcile_github_webhook_repository_state(bigint, bigint, text, text, text, text, boolean, text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_github_webhook_repository_state(bigint, bigint, text, text, text, text, boolean, text, boolean, text) to service_role;

create or replace function public.complete_github_webhook_project_scan(
  target_link_id uuid,
  target_trigger_commit_sha text,
  target_succeeded boolean,
  target_result_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_record public.github_repository_links%rowtype;
  auto_record private.github_repository_auto_scan_state%rowtype;
  intent_record private.github_project_scan_intents%rowtype;
  follow_up_required boolean := false;
  outcome_code text;
begin
  if target_link_id is null
     or target_trigger_commit_sha is null
     or target_trigger_commit_sha !~ '^[a-f0-9]{40}$'
     or target_succeeded is null
     or (target_result_code is not null and (
       char_length(target_result_code) not between 1 and 64
       or target_result_code !~ '^[A-Z0-9_]+$'
     )) then
    raise exception 'GITHUB_WEBHOOK_SCAN_COMPLETION_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-auto-scan-link:' || target_link_id::text, 0)
  );

  select * into link_record
    from public.github_repository_links
   where id = target_link_id
   for update;
  if link_record.id is null then
    return jsonb_build_object('matched', false, 'linkId', target_link_id);
  end if;

  select * into auto_record
    from private.github_repository_auto_scan_state
   where link_id = target_link_id
     and workspace_id = link_record.workspace_id
   for update;
  select * into intent_record
    from private.github_project_scan_intents
   where link_id = target_link_id
   for update;

  if auto_record.link_id is null
     or intent_record.id is null
     or intent_record.trigger_kind <> 'github_webhook'
     or intent_record.trigger_commit_sha is distinct from target_trigger_commit_sha then
    return jsonb_build_object('matched', false, 'linkId', target_link_id);
  end if;

  if target_succeeded then
    update private.github_repository_auto_scan_state
       set successful_commit_sha = target_trigger_commit_sha,
           updated_at = now()
     where link_id = target_link_id;
    auto_record.successful_commit_sha := target_trigger_commit_sha;
    outcome_code := coalesce(target_result_code, 'SCAN_SUCCEEDED');
  else
    outcome_code := coalesce(target_result_code, 'SCAN_FAILED');
  end if;

  follow_up_required :=
    auto_record.desired_commit_sha is not null
    and auto_record.desired_commit_sha is distinct from target_trigger_commit_sha
    and link_record.auto_scan_enabled
    and link_record.access_status = 'active'
    and not auto_record.provider_archived;

  update private.github_repository_auto_scan_state
     set pending = follow_up_required,
         last_outcome_code = outcome_code,
         updated_at = now()
   where link_id = target_link_id;

  update private.github_project_scan_intents
     set snapshot_task_id = null,
         snapshot_id = null,
         scan_job_id = null,
         scan_task_id = null,
         state = 'idle',
         last_error_code = case when target_succeeded then null else outcome_code end,
         updated_at = now()
   where id = intent_record.id;

  update public.github_repository_links
     set project_scan_state = 'idle',
         updated_at = now()
   where id = link_record.id
     and workspace_id = link_record.workspace_id;

  return jsonb_build_object(
    'matched', true,
    'succeeded', target_succeeded,
    'followUpRequired', follow_up_required,
    'desiredCommitSha', auto_record.desired_commit_sha,
    'successfulCommitSha', case
      when target_succeeded then target_trigger_commit_sha
      else auto_record.successful_commit_sha
    end,
    'resultCode', outcome_code
  );
end;
$$;
revoke all on function public.complete_github_webhook_project_scan(uuid, text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.complete_github_webhook_project_scan(uuid, text, boolean, text) to service_role;

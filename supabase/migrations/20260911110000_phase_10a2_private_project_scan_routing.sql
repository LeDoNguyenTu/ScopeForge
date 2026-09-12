-- Phase 10A2: connect private repository acquisition to the existing exact-snapshot
-- project scan continuation and recovery flow. Public Phase 10A1 behavior remains intact.

create or replace function public.enqueue_connected_private_project_snapshot(
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
  snapshot_enqueue_result jsonb;
  queued_task_id uuid;
begin
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null
     or target_link_id is null then
    raise exception 'PROJECT_SCAN_REQUEST_INVALID';
  end if;

  -- The private enqueue RPC performs the authoritative membership, link visibility,
  -- connection status, asset identity, quota, and worker-class checks atomically.
  snapshot_enqueue_result := public.enqueue_private_repository_snapshot_worker_task(
    target_workspace_id,
    target_asset_id,
    target_actor_id,
    target_link_id
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
     and workspace_id = target_workspace_id
     and asset_id = target_asset_id
     and is_private
     and access_status = 'active';

  if not found then
    raise exception 'PROJECT_SCAN_LINK_INELIGIBLE';
  end if;

  return snapshot_enqueue_result;
end;
$$;

revoke all on function public.enqueue_connected_private_project_snapshot(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_connected_private_project_snapshot(uuid, uuid, uuid, uuid)
  to service_role;

-- Phase 10A1 recovery intentionally excluded private links. Phase 10A2 widens the
-- read boundary only after the private acquisition class exists, while retaining
-- owner/admin authorization and active link/connection requirements.
create or replace function public.get_connected_project_scan_recovery(
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
  intent_record private.github_project_scan_intents%rowtype;
begin
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null
     or target_link_id is null then
    raise exception 'PROJECT_SCAN_RECOVERY_INVALID';
  end if;

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = target_workspace_id
       and user_id = target_actor_id
       and role::text in ('owner', 'admin')
  ) then
    raise exception 'PROJECT_SCAN_ACCESS_DENIED';
  end if;

  select i.* into intent_record
    from private.github_project_scan_intents i
    join public.github_repository_links l
      on l.id = i.link_id
     and l.workspace_id = i.workspace_id
     and l.asset_id = i.asset_id
    join public.github_connections c
      on c.id = l.github_connection_id
     and c.workspace_id = l.workspace_id
   where i.workspace_id = target_workspace_id
     and i.asset_id = target_asset_id
     and i.link_id = target_link_id
     and i.state in (
       'waiting_scan_runtime',
       'retry_pending',
       'scan_queued'
     )
     and i.snapshot_task_id is not null
     and i.snapshot_id is not null
     and l.access_status = 'active'
     and c.status = 'active'
   limit 1;

  if intent_record.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'snapshotTaskId', intent_record.snapshot_task_id,
    'snapshotId', intent_record.snapshot_id,
    'state', intent_record.state
  );
end;
$$;

revoke all on function public.get_connected_project_scan_recovery(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_connected_project_scan_recovery(uuid, uuid, uuid, uuid)
  to service_role;

-- Continue both public and private connected projects through the same no-egress
-- scanner, but only against the exact immutable snapshot just published.
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
  if continuation is null then
    raise exception 'PROJECT_SCAN_SNAPSHOT_MISMATCH';
  end if;

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

  if continuation->>'accessStatus' <> 'active' then
    raise exception 'PROJECT_SCAN_LINK_INELIGIBLE';
  end if;

  scan_enqueue_result := public.enqueue_repository_scan_worker_task_for_snapshot(
    intent_record.workspace_id,
    intent_record.asset_id,
    intent_record.requested_by,
    target_snapshot_id
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
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and access_status = 'active';

  if not found then
    raise exception 'PROJECT_SCAN_LINK_INELIGIBLE';
  end if;

  return jsonb_build_object(
    'taskId', queued_scan_task_id,
    'scanJobId', queued_scan_job_id,
    'snapshotId', target_snapshot_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.enqueue_connected_project_scan_continuation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_connected_project_scan_continuation(uuid, uuid)
  to service_role;

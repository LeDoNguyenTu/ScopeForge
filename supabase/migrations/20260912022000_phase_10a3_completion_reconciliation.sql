-- Phase 10A3 Task 6: bind automatic completion to the exact immutable snapshot.
-- This forward-only correction removes the earlier trigger-SHA completion overload so
-- successful state can only advance from a persisted repository_source_snapshots row.

drop function if exists public.complete_github_webhook_project_scan(uuid, text, boolean, text);

create or replace function public.complete_github_webhook_project_scan(
  target_snapshot_task_id uuid,
  target_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_intent private.github_project_scan_intents%rowtype;
  intent_record private.github_project_scan_intents%rowtype;
  snapshot_task_record private.repository_snapshot_tasks%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  link_record public.github_repository_links%rowtype;
  connection_record public.github_connections%rowtype;
  auto_record private.github_repository_auto_scan_state%rowtype;
  follow_up_required boolean := false;
begin
  if target_snapshot_task_id is null or target_snapshot_id is null then
    raise exception 'GITHUB_WEBHOOK_SCAN_COMPLETION_INVALID';
  end if;

  -- Resolve the link first without a row lock so every writer can acquire the
  -- per-link advisory lock before taking mutable row locks.
  select * into initial_intent
    from private.github_project_scan_intents
   where snapshot_task_id = target_snapshot_task_id;

  if initial_intent.id is null
     or initial_intent.trigger_kind <> 'github_webhook'
     or initial_intent.trigger_commit_sha is null then
    return jsonb_build_object(
      'matched', false,
      'replayed', true
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-auto-scan-link:' || initial_intent.link_id::text, 0)
  );

  select * into intent_record
    from private.github_project_scan_intents
   where snapshot_task_id = target_snapshot_task_id
   for update;

  if intent_record.id is null
     or intent_record.link_id <> initial_intent.link_id
     or intent_record.trigger_kind <> 'github_webhook'
     or intent_record.trigger_commit_sha is null then
    return jsonb_build_object(
      'matched', false,
      'replayed', true
    );
  end if;

  if intent_record.state <> 'scan_queued'
     or intent_record.snapshot_id is distinct from target_snapshot_id then
    return jsonb_build_object(
      'matched', false,
      'replayed', true,
      'linkId', intent_record.link_id
    );
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
    raise exception 'GITHUB_WEBHOOK_SCAN_COMPLETION_SNAPSHOT_MISMATCH';
  end if;

  select * into link_record
    from public.github_repository_links
   where id = intent_record.link_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
   for update;
  if link_record.id is null then
    return jsonb_build_object(
      'matched', false,
      'replayed', true
    );
  end if;

  select * into connection_record
    from public.github_connections
   where id = link_record.github_connection_id
     and workspace_id = link_record.workspace_id
   for update;
  if connection_record.id is null then
    return jsonb_build_object(
      'matched', false,
      'replayed', true,
      'linkId', link_record.id
    );
  end if;

  select * into auto_record
    from private.github_repository_auto_scan_state
   where link_id = link_record.id
     and workspace_id = link_record.workspace_id
   for update;

  if auto_record.link_id is null
     or auto_record.latest_delivery_id is null then
    return jsonb_build_object(
      'matched', false,
      'replayed', true,
      'linkId', link_record.id
    );
  end if;

  update private.github_repository_auto_scan_state
     set successful_commit_sha = snapshot_record.resolved_commit_sha,
         last_outcome_code = 'SCAN_SUCCEEDED',
         updated_at = now()
   where link_id = link_record.id;
  auto_record.successful_commit_sha := snapshot_record.resolved_commit_sha;

  follow_up_required :=
    auto_record.desired_commit_sha is not null
    and auto_record.desired_commit_sha is distinct from snapshot_record.resolved_commit_sha
    and connection_record.status = 'active'
    and link_record.auto_scan_enabled
    and link_record.access_status = 'active'
    and not auto_record.provider_archived;

  update private.github_repository_auto_scan_state
     set pending = follow_up_required,
         last_outcome_code = 'SCAN_SUCCEEDED',
         updated_at = now()
   where link_id = link_record.id;

  -- Clearing the exact task/snapshot binding makes replayed worker finalization
  -- unable to advance the successful watermark a second time.
  update private.github_project_scan_intents
     set snapshot_task_id = null,
         snapshot_id = null,
         scan_job_id = null,
         scan_task_id = null,
         state = 'idle',
         last_error_code = null,
         updated_at = now()
   where id = intent_record.id;

  update public.github_repository_links
     set project_scan_state = 'idle',
         updated_at = now()
   where id = link_record.id
     and workspace_id = link_record.workspace_id;

  return jsonb_build_object(
    'matched', true,
    'replayed', false,
    'followUpRequired', follow_up_required,
    'workspaceId', link_record.workspace_id,
    'linkId', link_record.id,
    'installationId', connection_record.installation_id,
    'repositoryId', link_record.repository_id,
    'latestDeliveryId', auto_record.latest_delivery_id,
    'defaultBranch', link_record.default_branch,
    'isPrivate', link_record.is_private,
    'htmlUrl', link_record.html_url,
    'accessStatus', link_record.access_status,
    'autoScanEnabled', link_record.auto_scan_enabled,
    'providerArchived', auto_record.provider_archived,
    'desiredCommitSha', auto_record.desired_commit_sha,
    'successfulCommitSha', snapshot_record.resolved_commit_sha
  );
end;
$$;

revoke all on function public.complete_github_webhook_project_scan(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_github_webhook_project_scan(uuid, uuid)
  to service_role;

-- Phase 10A3 release hardening: an immutable snapshot is acquisition evidence,
-- not evidence that its repository scan and findings publication succeeded.
-- Settle webhook state only from the exact terminal repository-scan task.

drop function if exists public.complete_github_webhook_project_scan(uuid, uuid);

create or replace function public.settle_github_webhook_project_scan_terminal(
  target_scan_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_intent private.github_project_scan_intents%rowtype;
  intent_record private.github_project_scan_intents%rowtype;
  task_record private.worker_tasks%rowtype;
  job_record public.scan_jobs%rowtype;
  repository_scan_record private.repository_scan_tasks%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  link_record public.github_repository_links%rowtype;
  connection_record public.github_connections%rowtype;
  auto_record private.github_repository_auto_scan_state%rowtype;
  terminal_succeeded boolean := false;
  terminal_state boolean := false;
  follow_up_required boolean := false;
begin
  if target_scan_task_id is null then
    raise exception 'GITHUB_WEBHOOK_SCAN_TERMINAL_INVALID';
  end if;

  -- Resolve the owning link before mutable row locks so competing writers use
  -- the same per-link advisory lock order.
  select * into initial_intent
    from private.github_project_scan_intents
   where scan_task_id = target_scan_task_id;

  if initial_intent.id is null
     or initial_intent.trigger_kind <> 'github_webhook' then
    return jsonb_build_object('matched', false, 'replayed', true);
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-auto-scan-link:' || initial_intent.link_id::text, 0)
  );

  select * into intent_record
    from private.github_project_scan_intents
   where scan_task_id = target_scan_task_id
   for update;

  if intent_record.id is null
     or intent_record.link_id <> initial_intent.link_id
     or intent_record.trigger_kind <> 'github_webhook'
     or intent_record.trigger_commit_sha is null
     or intent_record.state <> 'scan_queued' then
    return jsonb_build_object('matched', false, 'replayed', true);
  end if;

  select * into task_record
    from private.worker_tasks
   where id = target_scan_task_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and execution_class = 'phase3_repository_scan_no_egress_v1'
   for update;

  select * into job_record
    from public.scan_jobs
   where id = intent_record.scan_job_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and job_kind = 'repository_scan'::public.scan_job_kind
   for update;

  if task_record.id is null
     or job_record.id is null
     or task_record.scan_job_id is distinct from job_record.id
     or intent_record.scan_task_id is distinct from task_record.id then
    raise exception 'GITHUB_WEBHOOK_SCAN_TERMINAL_MISMATCH';
  end if;

  terminal_succeeded := task_record.state = 'completed' and job_record.status = 'succeeded';
  terminal_state :=
    (task_record.state = 'completed' and job_record.status = 'succeeded')
    or (task_record.state = 'cancelled' and job_record.status = 'cancelled')
    or (task_record.state = 'dead_letter' and job_record.status = 'failed');

  -- queued, leased, and retry_wait remain active and retain the exact intent.
  if not terminal_state then
    return jsonb_build_object('matched', false, 'replayed', true);
  end if;

  select * into repository_scan_record
    from private.repository_scan_tasks
   where task_id = target_scan_task_id
     and scan_job_id = job_record.id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id;

  if repository_scan_record.task_id is null then
    raise exception 'GITHUB_WEBHOOK_SCAN_TERMINAL_SCAN_MISMATCH';
  end if;

  select * into snapshot_record
    from public.repository_source_snapshots
   where id = repository_scan_record.snapshot_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id;

  if snapshot_record.id is null
     or intent_record.snapshot_id is distinct from snapshot_record.id
     or intent_record.trigger_commit_sha is distinct from snapshot_record.resolved_commit_sha then
    raise exception 'GITHUB_WEBHOOK_SCAN_TERMINAL_SNAPSHOT_MISMATCH';
  end if;

  select * into link_record
    from public.github_repository_links
   where id = intent_record.link_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
   for update;

  if link_record.id is null then
    raise exception 'GITHUB_WEBHOOK_SCAN_TERMINAL_LINK_MISMATCH';
  end if;

  select * into connection_record
    from public.github_connections
   where id = link_record.github_connection_id
     and workspace_id = link_record.workspace_id
   for update;

  select * into auto_record
    from private.github_repository_auto_scan_state
   where link_id = link_record.id
     and workspace_id = link_record.workspace_id
   for update;

  if connection_record.id is null
     or auto_record.link_id is null
     or auto_record.latest_delivery_id is null then
    raise exception 'GITHUB_WEBHOOK_SCAN_TERMINAL_STATE_MISMATCH';
  end if;

  if terminal_succeeded then
    update private.github_repository_auto_scan_state
       set successful_commit_sha = snapshot_record.resolved_commit_sha,
           updated_at = now()
     where link_id = link_record.id;
    auto_record.successful_commit_sha := snapshot_record.resolved_commit_sha;
  end if;

  follow_up_required :=
    auto_record.desired_commit_sha is not null
    and auto_record.desired_commit_sha is distinct from snapshot_record.resolved_commit_sha
    and connection_record.status = 'active'
    and link_record.auto_scan_enabled
    and link_record.access_status = 'active'
    and not auto_record.provider_archived;

  update private.github_repository_auto_scan_state
     set pending = follow_up_required,
         last_outcome_code = case when terminal_succeeded then 'SCAN_SUCCEEDED' else 'SCAN_FAILED' end,
         updated_at = now()
   where link_id = link_record.id;

  -- Release only this exact terminal chain. A replay cannot match it again.
  update private.github_project_scan_intents
     set snapshot_task_id = null,
         snapshot_id = null,
         scan_job_id = null,
         scan_task_id = null,
         state = 'idle',
         last_error_code = case when terminal_succeeded then null else 'SCAN_FAILED' end,
         updated_at = now()
   where id = intent_record.id;

  update public.github_repository_links
     set project_scan_state = 'idle',
         updated_at = now()
   where id = link_record.id
     and workspace_id = link_record.workspace_id;

  if not follow_up_required then
    return jsonb_build_object(
      'matched', true,
      'replayed', false,
      'followUpRequired', false,
      'terminalSucceeded', terminal_succeeded,
      'successfulCommitSha', auto_record.successful_commit_sha
    );
  end if;

  return jsonb_build_object(
    'matched', true,
    'replayed', false,
    'followUpRequired', true,
    'terminalSucceeded', terminal_succeeded,
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
    'successfulCommitSha', auto_record.successful_commit_sha
  );
end;
$$;

revoke all on function public.settle_github_webhook_project_scan_terminal(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.settle_github_webhook_project_scan_terminal(uuid)
  to service_role;

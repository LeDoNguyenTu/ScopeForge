-- Phase 10A3 release hardening: a webhook push can arrive while a manual connected-project
-- scan owns the per-link intent. Release that manual intent only after the exact persisted
-- repository scan task/job is truly terminal, then preserve or enqueue the newest automatic
-- desired head without weakening retry/backpressure or public/private execution boundaries.

create unique index if not exists github_project_scan_intents_scan_task_unique_idx
  on private.github_project_scan_intents(scan_task_id)
  where scan_task_id is not null;

create or replace function public.settle_manual_connected_project_scan_terminal(
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
    raise exception 'CONNECTED_PROJECT_SCAN_TERMINAL_INVALID';
  end if;

  -- Resolve the owning link before locking mutable state so every competing webhook/manual
  -- writer takes the same per-link advisory lock first.
  select * into initial_intent
    from private.github_project_scan_intents
   where scan_task_id = target_scan_task_id;

  if initial_intent.id is null
     or initial_intent.trigger_kind <> 'manual' then
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
     or intent_record.trigger_kind <> 'manual'
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
    raise exception 'CONNECTED_PROJECT_SCAN_TERMINAL_MISMATCH';
  end if;

  terminal_succeeded := task_record.state = 'completed' and job_record.status = 'succeeded';
  terminal_state :=
    (task_record.state = 'completed' and job_record.status = 'succeeded')
    or (task_record.state = 'cancelled' and job_record.status = 'cancelled')
    or (task_record.state = 'dead_letter' and job_record.status = 'failed');

  -- queued/leased/retry_wait are deliberately not terminal. In particular, a failed attempt
  -- can enter retry_wait and must keep owning the connected-project intent.
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
    raise exception 'CONNECTED_PROJECT_SCAN_TERMINAL_SCAN_MISMATCH';
  end if;

  if terminal_succeeded then
    select * into snapshot_record
      from public.repository_source_snapshots
     where id = repository_scan_record.snapshot_id
       and workspace_id = intent_record.workspace_id
       and asset_id = intent_record.asset_id;
    if snapshot_record.id is null
       or intent_record.snapshot_id is distinct from snapshot_record.id then
      raise exception 'CONNECTED_PROJECT_SCAN_TERMINAL_SNAPSHOT_MISMATCH';
    end if;
  end if;

  select * into link_record
    from public.github_repository_links
   where id = intent_record.link_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
   for update;

  if link_record.id is null then
    raise exception 'CONNECTED_PROJECT_SCAN_TERMINAL_LINK_MISMATCH';
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

  -- A successful manual scan is allowed to satisfy the automatic watermark only when the
  -- immutable snapshot actually scanned is exactly the currently desired provider head.
  if terminal_succeeded
     and auto_record.link_id is not null
     and auto_record.pending
     and auto_record.desired_commit_sha is not null
     and snapshot_record.resolved_commit_sha = auto_record.desired_commit_sha then
    update private.github_repository_auto_scan_state
       set successful_commit_sha = snapshot_record.resolved_commit_sha,
           pending = false,
           last_outcome_code = 'MANUAL_SCAN_SATISFIED',
           updated_at = now()
     where link_id = link_record.id;
    auto_record.successful_commit_sha := snapshot_record.resolved_commit_sha;
    auto_record.pending := false;
  end if;

  follow_up_required :=
    auto_record.link_id is not null
    and auto_record.pending
    and auto_record.desired_commit_sha is not null
    and auto_record.latest_delivery_id is not null
    and connection_record.id is not null
    and connection_record.status = 'active'
    and link_record.access_status = 'active'
    and link_record.auto_scan_enabled
    and not auto_record.provider_archived;

  if auto_record.link_id is not null and auto_record.pending and not follow_up_required then
    update private.github_repository_auto_scan_state
       set pending = false,
           last_outcome_code = case
             when terminal_succeeded and snapshot_record.resolved_commit_sha = auto_record.desired_commit_sha
               then 'MANUAL_SCAN_SATISFIED'
             else 'INELIGIBLE'
           end,
           updated_at = now()
     where link_id = link_record.id;
    auto_record.pending := false;
  end if;

  -- Release only this exact terminal manual chain. Replayed finalization cannot match again.
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

  if not follow_up_required then
    return jsonb_build_object(
      'matched', true,
      'replayed', false,
      'followUpRequired', false
    );
  end if;

  return jsonb_build_object(
    'matched', true,
    'replayed', false,
    'followUpRequired', true,
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

revoke all on function public.settle_manual_connected_project_scan_terminal(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.settle_manual_connected_project_scan_terminal(uuid)
  to service_role;

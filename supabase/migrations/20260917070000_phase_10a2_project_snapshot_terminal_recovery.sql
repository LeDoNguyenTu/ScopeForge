-- Release connected-project orchestration after a repository snapshot task reaches
-- a durable failed or cancelled terminal state. Retriable worker attempts remain
-- snapshot_queued until their task is actually terminal.

create or replace function public.reconcile_connected_project_snapshot_terminal(
  target_snapshot_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.github_project_scan_intents%rowtype;
  task_record private.worker_tasks%rowtype;
  job_record public.scan_jobs%rowtype;
  terminal_error_code text;
begin
  if target_snapshot_task_id is null then
    raise exception 'PROJECT_SCAN_REQUEST_INVALID';
  end if;

  select * into intent_record
    from private.github_project_scan_intents
   where snapshot_task_id = target_snapshot_task_id;

  if intent_record.id is null then
    return jsonb_build_object('reconciled', false, 'state', null);
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-connected-project-scan:' || intent_record.link_id::text, 0)
  );

  select * into intent_record
    from private.github_project_scan_intents
   where snapshot_task_id = target_snapshot_task_id
   for update;

  if intent_record.id is null or intent_record.state <> 'snapshot_queued' then
    return jsonb_build_object(
      'reconciled', false,
      'state', coalesce(intent_record.state, 'idle')
    );
  end if;

  select * into task_record
    from private.worker_tasks
   where id = target_snapshot_task_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and execution_class in (
       'repository_snapshot_github_public_v1',
       'repository_snapshot_github_private_v1'
     )
   for update;

  if task_record.id is null then
    raise exception 'PROJECT_SCAN_SNAPSHOT_MISMATCH';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and job_kind = 'repository_snapshot'::public.scan_job_kind
   for update;

  if job_record.id is null then
    raise exception 'PROJECT_SCAN_SNAPSHOT_MISMATCH';
  end if;

  if task_record.state not in ('completed', 'dead_letter')
     or job_record.status not in (
       'failed'::public.scan_job_status,
       'cancelled'::public.scan_job_status
     ) then
    return jsonb_build_object('reconciled', false, 'state', intent_record.state);
  end if;

  terminal_error_code := coalesce(
    job_record.failure_code,
    case
      when job_record.status = 'cancelled'::public.scan_job_status
        then 'REPOSITORY_SNAPSHOT_CANCELLED'
      else 'REPOSITORY_SNAPSHOT_FAILED'
    end
  );

  update private.github_project_scan_intents
     set state = 'idle',
         snapshot_id = null,
         scan_job_id = null,
         scan_task_id = null,
         last_error_code = terminal_error_code,
         updated_at = now()
   where id = intent_record.id
     and snapshot_task_id = target_snapshot_task_id
     and state = 'snapshot_queued';

  update public.github_repository_links
     set project_scan_state = 'idle'
   where id = intent_record.link_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and project_scan_state = 'snapshot_queued';

  return jsonb_build_object(
    'reconciled', true,
    'state', 'idle',
    'failureCode', terminal_error_code
  );
end;
$$;

revoke all on function public.reconcile_connected_project_snapshot_terminal(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_connected_project_snapshot_terminal(uuid)
  to service_role;

-- Reconcile any terminal task that completed between the original Phase 10A2
-- migrations and this forward-only repair.
do $$
declare
  pending record;
begin
  for pending in
    select snapshot_task_id
      from private.github_project_scan_intents
     where state = 'snapshot_queued'
       and snapshot_task_id is not null
  loop
    perform public.reconcile_connected_project_snapshot_terminal(pending.snapshot_task_id);
  end loop;
end;
$$;

-- Release connected-project scan orchestration only after a repository scan
-- reaches a durable failed or cancelled terminal state. Retriable attempts stay
-- scan_queued, and the published immutable snapshot remains available for retry.

create or replace function public.reconcile_connected_project_scan_terminal(
  target_scan_task_id uuid
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
  if target_scan_task_id is null then
    raise exception 'PROJECT_SCAN_REQUEST_INVALID';
  end if;

  select * into intent_record
    from private.github_project_scan_intents
   where scan_task_id = target_scan_task_id;

  if intent_record.id is null then
    return jsonb_build_object('reconciled', false, 'state', null);
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-connected-project-scan:' || intent_record.link_id::text, 0)
  );

  select * into intent_record
    from private.github_project_scan_intents
   where scan_task_id = target_scan_task_id
   for update;

  if intent_record.id is null or intent_record.state <> 'scan_queued' then
    return jsonb_build_object(
      'reconciled', false,
      'state', coalesce(intent_record.state, 'idle')
    );
  end if;

  select * into task_record
    from private.worker_tasks
   where id = target_scan_task_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and execution_class = 'phase3_repository_scan_no_egress_v1'
   for update;

  if task_record.id is null then
    raise exception 'PROJECT_SCAN_TASK_MISMATCH';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and job_kind = 'repository_scan'::public.scan_job_kind
   for update;

  if job_record.id is null then
    raise exception 'PROJECT_SCAN_TASK_MISMATCH';
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
        then 'REPOSITORY_SCAN_CANCELLED'
      else 'REPOSITORY_SCAN_FAILED'
    end
  );

  update private.github_project_scan_intents
     set state = 'retry_pending',
         scan_task_id = null,
         scan_job_id = null,
         last_error_code = terminal_error_code,
         updated_at = now()
   where id = intent_record.id
     and scan_task_id = target_scan_task_id
     and state = 'scan_queued';

  update public.github_repository_links
     set project_scan_state = 'retry_pending'
   where id = intent_record.link_id
     and workspace_id = intent_record.workspace_id
     and asset_id = intent_record.asset_id
     and project_scan_state = 'scan_queued';

  return jsonb_build_object(
    'reconciled', true,
    'state', 'retry_pending',
    'failureCode', terminal_error_code
  );
end;
$$;

revoke all on function public.reconcile_connected_project_scan_terminal(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_connected_project_scan_terminal(uuid)
  to service_role;

-- Reconcile scans that became terminal before this forward-only repair.
do $$
declare
  pending record;
begin
  for pending in
    select scan_task_id
      from private.github_project_scan_intents
     where state = 'scan_queued'
       and scan_task_id is not null
  loop
    perform public.reconcile_connected_project_scan_terminal(pending.scan_task_id);
  end loop;
end;
$$;

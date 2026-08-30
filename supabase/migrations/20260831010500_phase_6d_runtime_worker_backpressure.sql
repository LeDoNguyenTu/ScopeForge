create or replace function public.claim_runtime_worker_task(
  target_worker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  runtime_task private.runtime_worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  claim_now timestamptz := now();
  lease_token bytea;
  lease_token_text text;
  lease_expiry timestamptz;
  execution_budget jsonb;
  input_kind text;
begin
  if target_worker_id is null then
    raise exception 'WORKER_NOT_AVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scopeforge-runtime-worker-claim-v1', 0));

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id
   for update;

  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;
  if worker_record.execution_class not in (
    'passive_runtime_observation_v1',
    'active_cors_validation_v1'
  ) then
    raise exception 'WORKER_CLASS_UNAVAILABLE';
  end if;

  -- Preserve the fleet-wide Phase 6A ceiling as an additional safety bound.
  if (
    select count(*)
      from private.worker_tasks
     where state = 'leased'
  ) >= 4 then
    return null;
  end if;

  -- Network-capable classes have deliberately tighter independent ceilings.
  if worker_record.execution_class = 'passive_runtime_observation_v1'
     and (
       select count(*)
         from private.worker_tasks
        where execution_class = 'passive_runtime_observation_v1'
          and state = 'leased'
     ) >= 2 then
    return null;
  end if;

  if worker_record.execution_class = 'active_cors_validation_v1'
     and (
       select count(*)
         from private.worker_tasks
        where execution_class = 'active_cors_validation_v1'
          and state = 'leased'
     ) >= 1 then
    return null;
  end if;

  select t.* into task_record
    from private.worker_tasks t
    join private.runtime_worker_tasks rwt
      on rwt.task_id = t.id
     and rwt.scan_job_id = t.scan_job_id
     and rwt.workspace_id = t.workspace_id
     and rwt.asset_id = t.asset_id
    join public.scan_jobs j
      on j.id = t.scan_job_id
     and j.workspace_id = t.workspace_id
     and j.asset_id = t.asset_id
   where t.execution_class = worker_record.execution_class
     and t.execution_class in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     )
     and t.state = 'queued'
     and t.attempt_count < t.max_attempts
     and t.available_at <= claim_now
     and t.absolute_deadline_at > claim_now
     and j.status = 'queued'::public.scan_job_status
     and j.cancel_requested_at is null
     and (
       (t.execution_class = 'passive_runtime_observation_v1'
         and rwt.domain_job_kind = 'passive_runtime'::public.scan_job_kind
         and j.job_kind = 'passive_runtime'::public.scan_job_kind)
       or
       (t.execution_class = 'active_cors_validation_v1'
         and rwt.domain_job_kind = 'active_validation'::public.scan_job_kind
         and j.job_kind = 'active_validation'::public.scan_job_kind)
     )
     and not exists (
       select 1
         from private.worker_tasks active_task
        where active_task.workspace_id = t.workspace_id
          and active_task.execution_class in (
            'passive_runtime_observation_v1',
            'active_cors_validation_v1'
          )
          and active_task.state = 'leased'
     )
   order by t.priority desc, t.available_at asc, t.created_at asc, t.id asc
   for update of t skip locked
   limit 1;

  if task_record.id is null then
    return null;
  end if;

  select * into runtime_task
    from private.runtime_worker_tasks
   where task_id = task_record.id
     and scan_job_id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;

  if runtime_task.task_id is null
     or job_record.id is null
     or job_record.status <> 'queued'::public.scan_job_status
     or job_record.cancel_requested_at is not null
     or job_record.requested_by <> runtime_task.requested_by then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  if not (
    (task_record.execution_class = 'passive_runtime_observation_v1'
      and runtime_task.domain_job_kind = 'passive_runtime'::public.scan_job_kind
      and job_record.job_kind = 'passive_runtime'::public.scan_job_kind)
    or
    (task_record.execution_class = 'active_cors_validation_v1'
      and runtime_task.domain_job_kind = 'active_validation'::public.scan_job_kind
      and job_record.job_kind = 'active_validation'::public.scan_job_kind)
  ) then
    raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
  end if;

  lease_token := extensions.gen_random_bytes(32);
  lease_token_text := encode(lease_token, 'hex');
  lease_expiry := task_record.absolute_deadline_at;

  update private.worker_tasks
     set state = 'leased',
         attempt_count = task_record.attempt_count + 1,
         updated_at = claim_now
   where id = task_record.id
     and state = 'queued'
     and attempt_count = 0
     and max_attempts = 1
  returning * into task_record;

  if task_record.id is null then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  insert into private.worker_attempts (
    task_id,
    attempt_number,
    worker_id,
    lease_token_hash,
    leased_at,
    lease_expires_at,
    last_heartbeat_at
  ) values (
    task_record.id,
    task_record.attempt_count,
    worker_record.id,
    encode(extensions.digest(lease_token, 'sha256'), 'hex'),
    claim_now,
    lease_expiry,
    claim_now
  )
  returning * into attempt_record;

  if task_record.execution_class = 'passive_runtime_observation_v1' then
    execution_budget := '{"maxWallTimeMs":30000,"maxCpuTimeMs":15000,"maxMemoryBytes":268435456,"maxProcesses":1,"maxInputFiles":0,"maxInputBytes":65536,"maxScratchBytes":16777216,"maxOutputBytes":131072}'::jsonb;
    input_kind := 'passive_runtime_observation';
  else
    execution_budget := '{"maxWallTimeMs":20000,"maxCpuTimeMs":10000,"maxMemoryBytes":268435456,"maxProcesses":1,"maxInputFiles":0,"maxInputBytes":32768,"maxScratchBytes":8388608,"maxOutputBytes":65536}'::jsonb;
    input_kind := 'active_cors_validation';
  end if;

  update private.worker_nodes
     set last_seen_at = claim_now
   where id = worker_record.id;

  perform private.record_worker_event(
    'worker.task_claimed',
    task_record.workspace_id,
    worker_record.id,
    task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'attemptNumber', attempt_record.attempt_number,
      'leaseExpiresAt', attempt_record.lease_expires_at,
      'executionClass', task_record.execution_class
    )
  );

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'executionClass', task_record.execution_class,
    'leaseToken', lease_token_text,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'absoluteDeadlineAt', task_record.absolute_deadline_at,
    'budget', execution_budget,
    'input', jsonb_build_object(
      'kind', input_kind,
      'domainJobId', task_record.scan_job_id
    )
  );
end;
$$;

create or replace function private.recover_cancelled_runtime_worker_tasks(
  target_now timestamptz
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  job_record public.scan_jobs%rowtype;
  recovered integer := 0;
begin
  for task_record in
    select t.*
      from private.worker_tasks t
      join public.scan_jobs j
        on j.id = t.scan_job_id
       and j.workspace_id = t.workspace_id
       and j.asset_id = t.asset_id
     where t.execution_class in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     )
       and t.state in ('queued', 'retry_wait')
       and (
         j.cancel_requested_at is not null
         or j.status = 'cancelled'::public.scan_job_status
       )
     order by t.updated_at asc, t.id asc
     for update of t skip locked
  loop
    select * into job_record
      from public.scan_jobs
     where id = task_record.scan_job_id
       and workspace_id = task_record.workspace_id
       and asset_id = task_record.asset_id
     for update;

    if job_record.id is not null
       and (
         job_record.cancel_requested_at is not null
         or job_record.status = 'cancelled'::public.scan_job_status
       ) then
      update private.worker_tasks
         set state = 'cancelled',
             updated_at = target_now
       where id = task_record.id
         and state in ('queued', 'retry_wait');

      if found then
        recovered := recovered + 1;
      end if;
    end if;
  end loop;

  return recovered;
end;
$$;

create or replace function public.recover_worker_state(
  target_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  runtime_cancelled_count integer;
  leased_count integer;
  unleased_count integer;
  runtime_unleased_count integer;
  runtime_reconciled_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  runtime_cancelled_count := private.recover_cancelled_runtime_worker_tasks(target_now);
  leased_count := public.recover_expired_worker_attempts_leased_only(target_now);
  unleased_count := private.recover_expired_unleased_worker_tasks(target_now);
  runtime_unleased_count := private.recover_expired_runtime_worker_tasks(target_now);
  runtime_reconciled_count := private.reconcile_dead_letter_runtime_worker_jobs(target_now);

  return runtime_cancelled_count
    + leased_count
    + unleased_count
    + runtime_unleased_count
    + runtime_reconciled_count;
end;
$$;

create or replace function public.get_worker_fleet_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  node_rows jsonb;
  state_counts jsonb;
  active_leases integer;
  passive_nodes integer;
  passive_leases integer;
  active_cors_nodes integer;
  active_cors_leases integer;
  runtime_classes jsonb;
begin
  -- Preserve detailed node visibility for non-network worker classes only.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'workerId', nodes.id,
        'executionClass', nodes.execution_class,
        'softwareVersion', nodes.software_version,
        'registeredAt', nodes.registered_at,
        'lastSeenAt', nodes.last_seen_at,
        'disabledAt', nodes.disabled_at
      )
      order by nodes.registered_at desc, nodes.id asc
    ),
    '[]'::jsonb
  )
  into node_rows
  from (
    select
      id,
      execution_class,
      software_version,
      registered_at,
      last_seen_at,
      disabled_at
    from private.worker_nodes
    where execution_class not in (
      'passive_runtime_observation_v1',
      'active_cors_validation_v1'
    )
    order by registered_at desc, id asc
    limit 100
  ) as nodes;

  select jsonb_build_object(
    'queued', count(*) filter (where state = 'queued'),
    'leased', count(*) filter (where state = 'leased'),
    'retryWait', count(*) filter (where state = 'retry_wait'),
    'completed', count(*) filter (where state = 'completed'),
    'deadLetter', count(*) filter (where state = 'dead_letter'),
    'cancelled', count(*) filter (where state = 'cancelled')
  )
  into state_counts
  from private.worker_tasks;

  select count(*)::integer
    into active_leases
    from private.worker_attempts
   where finished_at is null
     and lease_expires_at > now();

  select count(*)::integer
    into passive_nodes
    from private.worker_nodes
   where execution_class = 'passive_runtime_observation_v1'
     and disabled_at is null;

  select count(*)::integer
    into passive_leases
    from private.worker_tasks
   where execution_class = 'passive_runtime_observation_v1'
     and state = 'leased';

  select count(*)::integer
    into active_cors_nodes
    from private.worker_nodes
   where execution_class = 'active_cors_validation_v1'
     and disabled_at is null;

  select count(*)::integer
    into active_cors_leases
    from private.worker_tasks
   where execution_class = 'active_cors_validation_v1'
     and state = 'leased';

  runtime_classes := jsonb_build_object(
    'passiveRuntime', jsonb_build_object(
      'executionClass', 'passive_runtime_observation_v1',
      'enabledNodeCount', passive_nodes,
      'leasedCount', passive_leases,
      'capacity', 2,
      'available', passive_nodes > 0 and passive_leases < 2 and active_leases < 4,
      'saturated', passive_leases >= 2 or active_leases >= 4
    ),
    'activeCors', jsonb_build_object(
      'executionClass', 'active_cors_validation_v1',
      'enabledNodeCount', active_cors_nodes,
      'leasedCount', active_cors_leases,
      'capacity', 1,
      'available', active_cors_nodes > 0 and active_cors_leases < 1 and active_leases < 4,
      'saturated', active_cors_leases >= 1 or active_leases >= 4
    )
  );

  return jsonb_build_object(
    'generatedAt', now(),
    'nodes', node_rows,
    'taskCounts', state_counts,
    'activeLeaseCount', active_leases,
    'runtimeClasses', runtime_classes
  );
end;
$$;

revoke all on function public.claim_runtime_worker_task(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_runtime_worker_task(uuid)
  to service_role;

revoke all on function private.recover_cancelled_runtime_worker_tasks(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.recover_worker_state(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.recover_worker_state(timestamptz)
  to service_role;

revoke all on function public.get_worker_fleet_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.get_worker_fleet_snapshot()
  to service_role;

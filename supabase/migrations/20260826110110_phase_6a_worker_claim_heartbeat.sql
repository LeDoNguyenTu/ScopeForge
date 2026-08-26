create or replace function public.claim_worker_task(
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
  job_record public.scan_jobs%rowtype;
  attempt_record private.worker_attempts%rowtype;
  claim_now timestamptz := now();
  lease_token bytea;
  lease_token_text text;
  lease_expiry timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-claim-v1', 0));

  select * into worker_record
  from private.worker_nodes
  where id = target_worker_id
  for update;

  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  if (
    select count(*)
    from private.worker_tasks
    where state = 'leased'
  ) >= 4 then
    return null;
  end if;

  select t.* into task_record
  from private.worker_tasks t
  join public.scan_jobs j
    on j.id = t.scan_job_id
   and j.workspace_id = t.workspace_id
   and j.asset_id = t.asset_id
  where t.execution_class = worker_record.execution_class
    and t.state in ('queued', 'retry_wait')
    and t.available_at <= claim_now
    and t.absolute_deadline_at > claim_now
    and j.job_kind = 'worker_foundation_probe'::public.scan_job_kind
    and j.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
    and j.cancel_requested_at is null
    and not exists (
      select 1
      from private.worker_tasks active_task
      where active_task.workspace_id = t.workspace_id
        and active_task.state = 'leased'
    )
  order by priority desc, available_at asc, created_at asc, id asc
  for update of t skip locked
  limit 1;

  if task_record.id is null then
    return null;
  end if;

  select * into job_record
  from public.scan_jobs
  where id = task_record.scan_job_id
    and workspace_id = task_record.workspace_id
    and asset_id = task_record.asset_id
  for update;

  if job_record.cancel_requested_at is not null
     or job_record.status in (
       'succeeded'::public.scan_job_status,
       'failed'::public.scan_job_status,
       'blocked'::public.scan_job_status,
       'cancelled'::public.scan_job_status
     ) then
    return null;
  end if;

  lease_token := extensions.gen_random_bytes(32);
  lease_token_text := encode(lease_token, 'hex');
  lease_expiry := least(claim_now + interval '90 seconds', task_record.absolute_deadline_at);

  update private.worker_tasks
  set state = 'leased',
      attempt_count = task_record.attempt_count + 1,
      updated_at = claim_now
  where id = task_record.id
  returning * into task_record;

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

  if job_record.status = 'queued'::public.scan_job_status then
    update public.scan_jobs
    set status = 'running'::public.scan_job_status,
        started_at = coalesce(started_at, claim_now)
    where id = job_record.id
      and status = 'queued'::public.scan_job_status
    returning * into job_record;
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
      'leaseExpiresAt', attempt_record.lease_expires_at
    )
  );

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'executionClass', task_record.execution_class,
    'leaseToken', lease_token_text,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'absoluteDeadlineAt', task_record.absolute_deadline_at,
    'budget', job_record.budget,
    'input', jsonb_build_object(
      'kind', 'foundation_probe',
      'nonce', task_record.id::text
    )
  );
end;
$$;

create or replace function public.heartbeat_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  heartbeat_now timestamptz := now();
  calculated_hash text;
  next_expiry timestamptz;
  cancellation_requested boolean;
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into worker_record
  from private.worker_nodes
  where id = target_worker_id
  for update;
  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  select * into task_record
  from private.worker_tasks
  where id = target_task_id
  for update;

  select * into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id
  for update;

  if task_record.id is null
     or attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash
     or attempt_record.finished_at is not null
     or task_record.state <> 'leased'
     or attempt_record.lease_expires_at <= heartbeat_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into job_record
  from public.scan_jobs
  where id = task_record.scan_job_id
    and workspace_id = task_record.workspace_id
    and asset_id = task_record.asset_id
  for update;

  if job_record.id is null then
    raise exception 'WORKER_JOB_NOT_AVAILABLE';
  end if;

  cancellation_requested := job_record.cancel_requested_at is not null
    or job_record.status = 'cancelled'::public.scan_job_status;

  if cancellation_requested then
    next_expiry := attempt_record.lease_expires_at;
  else
    next_expiry := least(
      heartbeat_now + interval '90 seconds',
      task_record.absolute_deadline_at
    );
  end if;

  update private.worker_attempts
  set last_heartbeat_at = heartbeat_now,
      lease_expires_at = next_expiry
  where id = attempt_record.id
  returning * into attempt_record;

  update private.worker_nodes
  set last_seen_at = heartbeat_now
  where id = worker_record.id;

  return jsonb_build_object(
    'cancelRequested', cancellation_requested,
    'leaseExpiresAt', attempt_record.lease_expires_at
  );
end;
$$;

revoke all on function public.claim_worker_task(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_worker_task(uuid) to service_role;

revoke all on function public.heartbeat_worker_attempt(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.heartbeat_worker_attempt(uuid, uuid, uuid, text)
  to service_role;

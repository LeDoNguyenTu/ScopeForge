create table private.worker_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  worker_id uuid references private.worker_nodes(id),
  task_id uuid references private.worker_tasks(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 100),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  ),
  created_at timestamptz not null default now()
);

create index worker_events_created_idx
  on private.worker_events(created_at desc);
create index worker_events_workspace_created_idx
  on private.worker_events(workspace_id, created_at desc)
  where workspace_id is not null;
create index worker_events_worker_created_idx
  on private.worker_events(worker_id, created_at desc)
  where worker_id is not null;
create index worker_events_task_created_idx
  on private.worker_events(task_id, created_at desc)
  where task_id is not null;

revoke all on table private.worker_events from public, anon, authenticated;

create or replace function private.record_worker_event(
  target_event_type text,
  target_workspace_id uuid default null,
  target_worker_id uuid default null,
  target_task_id uuid default null,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if target_event_type is null or char_length(target_event_type) < 1 or char_length(target_event_type) > 100 then
    raise exception 'WORKER_EVENT_INVALID';
  end if;
  if target_metadata is null or jsonb_typeof(target_metadata) <> 'object' or pg_column_size(target_metadata) > 2048 then
    raise exception 'WORKER_EVENT_INVALID';
  end if;

  insert into private.worker_events (
    workspace_id,
    worker_id,
    task_id,
    event_type,
    metadata
  ) values (
    target_workspace_id,
    target_worker_id,
    target_task_id,
    target_event_type,
    target_metadata
  );
end;
$$;

revoke all on function private.record_worker_event(text, uuid, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.register_worker_node(
  target_credential_hash text,
  target_software_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
begin
  if target_credential_hash is null or target_credential_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_CREDENTIAL_INVALID';
  end if;
  if target_software_version is null or char_length(target_software_version) < 1 or char_length(target_software_version) > 64 then
    raise exception 'WORKER_VERSION_INVALID';
  end if;

  insert into private.worker_nodes (
    credential_hash,
    execution_class,
    software_version
  ) values (
    target_credential_hash,
    'foundation_no_egress_v1',
    target_software_version
  )
  returning * into worker_record;

  perform private.record_worker_event(
    'worker.node_registered',
    null,
    worker_record.id,
    null,
    jsonb_build_object(
      'executionClass', worker_record.execution_class,
      'softwareVersion', worker_record.software_version
    )
  );

  return jsonb_build_object(
    'workerId', worker_record.id,
    'executionClass', worker_record.execution_class,
    'softwareVersion', worker_record.software_version,
    'registeredAt', worker_record.registered_at
  );
exception
  when unique_violation then
    raise exception 'WORKER_CREDENTIAL_CONFLICT';
end;
$$;

create or replace function public.disable_worker_node(
  target_worker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
begin
  update private.worker_nodes
  set disabled_at = coalesce(disabled_at, now())
  where id = target_worker_id
  returning * into worker_record;

  if worker_record.id is null then
    raise exception 'WORKER_NOT_AVAILABLE';
  end if;

  perform private.record_worker_event(
    'worker.node_disabled',
    null,
    worker_record.id,
    null,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'workerId', worker_record.id,
    'disabledAt', worker_record.disabled_at
  );
end;
$$;

create or replace function public.enqueue_foundation_worker_task(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.scan_jobs%rowtype;
  task_record private.worker_tasks%rowtype;
begin
  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = target_actor_id
      and role::text in ('owner', 'admin', 'member')
  ) then
    raise exception 'WORKER_PROBE_ACCESS_DENIED';
  end if;

  if not exists (
    select 1
    from public.assets
    where id = target_asset_id
      and workspace_id = target_workspace_id
  ) then
    raise exception 'WORKER_PROBE_ASSET_MISMATCH';
  end if;

  insert into public.scan_jobs (
    workspace_id,
    asset_id,
    job_kind,
    status,
    requested_by,
    blocked_reason,
    authorization_canonical_target,
    authorization_asset_kind,
    authorization_verified_at,
    validation_profile_id,
    validation_profile_version,
    authorization_granted_at,
    budget,
    request_count,
    redirect_count,
    finding_count
  ) values (
    target_workspace_id,
    target_asset_id,
    'worker_foundation_probe'::public.scan_job_kind,
    'queued'::public.scan_job_status,
    target_actor_id,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'maxWallTimeMs', 30000,
      'maxCpuTimeMs', 20000,
      'maxMemoryBytes', 268435456,
      'maxProcesses', 4,
      'maxInputFiles', 100,
      'maxInputBytes', 10485760,
      'maxScratchBytes', 33554432,
      'maxOutputBytes', 1048576
    ),
    0,
    0,
    0
  )
  returning * into job_record;

  insert into private.worker_tasks (
    scan_job_id,
    workspace_id,
    asset_id,
    execution_class,
    state,
    priority,
    available_at,
    attempt_count,
    max_attempts,
    absolute_deadline_at
  ) values (
    job_record.id,
    job_record.workspace_id,
    job_record.asset_id,
    'foundation_no_egress_v1',
    'queued',
    0,
    now(),
    0,
    3,
    now() + interval '5 minutes'
  )
  returning * into task_record;

  perform private.record_worker_event(
    'worker.task_queued',
    task_record.workspace_id,
    null,
    task_record.id,
    jsonb_build_object('scanJobId', task_record.scan_job_id)
  );

  return jsonb_build_object(
    'scanJobId', job_record.id,
    'taskId', task_record.id,
    'executionClass', task_record.execution_class,
    'absoluteDeadlineAt', task_record.absolute_deadline_at
  );
end;
$$;

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
     or attempt_record.lease_expires_at <= now() then
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

create or replace function public.finalize_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_outcome text,
  target_failure_code text,
  target_terminal_payload_digest text,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint
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
  finalize_now timestamptz := now();
  calculated_hash text;
  effective_outcome text;
  effective_failure_code text;
  retry_delay interval;
  replayed boolean := false;
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;
  if target_terminal_payload_digest is null or target_terminal_payload_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_terminal_outcome not in ('succeeded', 'failed', 'cancelled') then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_wall_time_ms is null or target_wall_time_ms < 0 or target_wall_time_ms > 30000
     or target_cpu_time_ms is null or target_cpu_time_ms < 0 or target_cpu_time_ms > 20000
     or target_peak_memory_bytes is null or target_peak_memory_bytes < 0 or target_peak_memory_bytes > 268435456
     or target_input_bytes is null or target_input_bytes < 0 or target_input_bytes > 10485760
     or target_output_bytes is null or target_output_bytes < 0 or target_output_bytes > 1048576 then
    raise exception 'WORKER_BUDGET_EXCEEDED';
  end if;

  if target_terminal_outcome = 'failed' then
    if target_failure_code not in (
      'WORKER_LEASE_EXPIRED',
      'WORKER_LOST',
      'WORKER_BUDGET_EXCEEDED',
      'WORKER_OUTPUT_INVALID',
      'WORKER_EXECUTION_FAILED',
      'WORKER_CLASS_UNAVAILABLE'
    ) then
      raise exception 'WORKER_TERMINAL_INVALID';
    end if;
  elsif target_failure_code is not null then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id
  for update;

  if attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is not null then
    if attempt_record.terminal_payload_digest = target_terminal_payload_digest
       and attempt_record.outcome in ('succeeded', 'failed', 'cancelled') then
      replayed := true;
      return jsonb_build_object(
        'taskId', target_task_id,
        'attemptId', target_attempt_id,
        'outcome', attempt_record.outcome,
        'replayed', replayed
      );
    end if;
    raise exception 'WORKER_TERMINAL_CONFLICT';
  end if;

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
  if task_record.id is null
     or task_record.state <> 'leased'
     or attempt_record.lease_expires_at <= now() then
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

  if job_record.cancel_requested_at is not null
     or job_record.status = 'cancelled'::public.scan_job_status
     or target_terminal_outcome = 'cancelled' then
    effective_outcome := 'cancelled';
    effective_failure_code := 'WORKER_CANCELLED';
  else
    effective_outcome := target_terminal_outcome;
    effective_failure_code := target_failure_code;
  end if;

  update private.worker_attempts
  set finished_at = finalize_now,
      outcome = effective_outcome,
      failure_code = effective_failure_code,
      terminal_payload_digest = target_terminal_payload_digest,
      wall_time_ms = target_wall_time_ms,
      cpu_time_ms = target_cpu_time_ms,
      peak_memory_bytes = target_peak_memory_bytes,
      input_bytes = target_input_bytes,
      output_bytes = target_output_bytes
  where id = attempt_record.id
  returning * into attempt_record;

  if effective_outcome = 'cancelled' then
    update private.worker_tasks
    set state = 'cancelled', updated_at = finalize_now
    where id = task_record.id;

    if job_record.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
      update public.scan_jobs
      set status = 'cancelled'::public.scan_job_status,
          finished_at = finalize_now,
          failure_code = null
      where id = job_record.id;
    end if;

    perform private.record_worker_event(
      'worker.cancelled',
      task_record.workspace_id,
      worker_record.id,
      task_record.id,
      jsonb_build_object('attemptId', attempt_record.id)
    );
  elsif effective_outcome = 'succeeded' then
    update private.worker_tasks
    set state = 'completed', updated_at = finalize_now
    where id = task_record.id;

    update public.scan_jobs
    set status = 'succeeded'::public.scan_job_status,
        finished_at = finalize_now,
        failure_code = null,
        request_count = 0,
        redirect_count = 0,
        finding_count = 0
    where id = job_record.id
      and status = 'running'::public.scan_job_status;

    if not found then
      raise exception 'WORKER_JOB_STATE_CONFLICT';
    end if;

    perform private.record_worker_event(
      'worker.succeeded',
      task_record.workspace_id,
      worker_record.id,
      task_record.id,
      jsonb_build_object('attemptId', attempt_record.id)
    );
  else
    if task_record.attempt_count < task_record.max_attempts
       and task_record.absolute_deadline_at > finalize_now then
      retry_delay := case task_record.attempt_count
        when 1 then interval '15 seconds'
        when 2 then interval '60 seconds'
        else null
      end;

      if retry_delay is null or finalize_now + retry_delay >= task_record.absolute_deadline_at then
        update private.worker_tasks
        set state = 'dead_letter', updated_at = finalize_now
        where id = task_record.id;

        update public.scan_jobs
        set status = 'failed'::public.scan_job_status,
            finished_at = finalize_now,
            failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
        where id = job_record.id
          and status = 'running'::public.scan_job_status;

        perform private.record_worker_event(
          'worker.dead_lettered',
          task_record.workspace_id,
          worker_record.id,
          task_record.id,
          jsonb_build_object('attemptId', attempt_record.id, 'reason', 'deadline')
        );
      else
        update private.worker_tasks
        set state = 'retry_wait',
            available_at = finalize_now + retry_delay,
            updated_at = finalize_now
        where id = task_record.id;

        perform private.record_worker_event(
          'worker.retry_scheduled',
          task_record.workspace_id,
          worker_record.id,
          task_record.id,
          jsonb_build_object(
            'attemptId', attempt_record.id,
            'availableAt', finalize_now + retry_delay
          )
        );
      end if;
    else
      update private.worker_tasks
      set state = 'dead_letter', updated_at = finalize_now
      where id = task_record.id;

      update public.scan_jobs
      set status = 'failed'::public.scan_job_status,
          finished_at = finalize_now,
          failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
      where id = job_record.id
        and status = 'running'::public.scan_job_status;

      perform private.record_worker_event(
        'worker.dead_lettered',
        task_record.workspace_id,
        worker_record.id,
        task_record.id,
        jsonb_build_object('attemptId', attempt_record.id, 'reason', 'attempts')
      );
    end if;
  end if;

  update private.worker_nodes
  set last_seen_at = greatest(coalesce(last_seen_at, finalize_now), finalize_now)
  where id = worker_record.id;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'outcome', effective_outcome,
    'replayed', replayed
  );
end;
$$;

create or replace function public.recover_expired_worker_attempts(
  target_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  retry_delay interval;
  recovered integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  for task_record in
    select t.*
    from private.worker_tasks t
    join public.scan_jobs j
      on j.id = t.scan_job_id
     and j.workspace_id = t.workspace_id
     and j.asset_id = t.asset_id
    where t.state in ('queued', 'retry_wait')
      and j.cancel_requested_at is not null
    for update of t skip locked
  loop
    select * into job_record
    from public.scan_jobs
    where id = task_record.scan_job_id
    for update;

    update private.worker_tasks
    set state = 'cancelled', updated_at = target_now
    where id = task_record.id;

    if job_record.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
      update public.scan_jobs
      set status = 'cancelled'::public.scan_job_status,
          finished_at = target_now,
          failure_code = null
      where id = job_record.id;
    end if;

    perform private.record_worker_event(
      'worker.cancelled',
      task_record.workspace_id,
      null,
      task_record.id,
      jsonb_build_object('reason', 'cancel_before_claim')
    );
    recovered := recovered + 1;
  end loop;

  for attempt_record in
    select a.*
    from private.worker_attempts a
    join private.worker_tasks t on t.id = a.task_id
    where a.finished_at is null
      and a.lease_expires_at <= target_now
      and t.state = 'leased'
    order by a.lease_expires_at asc, a.id asc
    for update of a skip locked
  loop
    select * into task_record
    from private.worker_tasks
    where id = attempt_record.task_id
    for update;

    select * into job_record
    from public.scan_jobs
    where id = task_record.scan_job_id
      and workspace_id = task_record.workspace_id
      and asset_id = task_record.asset_id
    for update;

    if job_record.cancel_requested_at is not null
       or job_record.status = 'cancelled'::public.scan_job_status then
      update private.worker_attempts
      set finished_at = target_now,
          outcome = 'cancelled',
          failure_code = 'WORKER_CANCELLED'
      where id = attempt_record.id;

      update private.worker_tasks
      set state = 'cancelled', updated_at = target_now
      where id = task_record.id;

      if job_record.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
        update public.scan_jobs
        set status = 'cancelled'::public.scan_job_status,
            finished_at = target_now,
            failure_code = null
        where id = job_record.id;
      end if;

      perform private.record_worker_event(
        'worker.cancelled',
        task_record.workspace_id,
        attempt_record.worker_id,
        task_record.id,
        jsonb_build_object('attemptId', attempt_record.id, 'reason', 'lease_expired_after_cancel')
      );
    else
      update private.worker_attempts
      set finished_at = target_now,
          outcome = 'lease_expired',
          failure_code = 'WORKER_LEASE_EXPIRED'
      where id = attempt_record.id;

      if task_record.absolute_deadline_at <= target_now then
        update private.worker_tasks
        set state = 'dead_letter', updated_at = target_now
        where id = task_record.id;

        update public.scan_jobs
        set status = 'failed'::public.scan_job_status,
            finished_at = target_now,
            failure_code = 'WORKER_BUDGET_EXCEEDED'
        where id = job_record.id
          and status = 'running'::public.scan_job_status;

        perform private.record_worker_event(
          'worker.dead_lettered',
          task_record.workspace_id,
          attempt_record.worker_id,
          task_record.id,
          jsonb_build_object('attemptId', attempt_record.id, 'reason', 'deadline')
        );
      elsif task_record.attempt_count < task_record.max_attempts then
        retry_delay := case task_record.attempt_count
          when 1 then interval '15 seconds'
          when 2 then interval '60 seconds'
          else null
        end;

        if retry_delay is not null and target_now + retry_delay < task_record.absolute_deadline_at then
          update private.worker_tasks
          set state = 'retry_wait',
              available_at = target_now + retry_delay,
              updated_at = target_now
          where id = task_record.id;

          perform private.record_worker_event(
            'worker.lease_expired',
            task_record.workspace_id,
            attempt_record.worker_id,
            task_record.id,
            jsonb_build_object('attemptId', attempt_record.id)
          );
          perform private.record_worker_event(
            'worker.retry_scheduled',
            task_record.workspace_id,
            attempt_record.worker_id,
            task_record.id,
            jsonb_build_object('availableAt', target_now + retry_delay)
          );
        else
          update private.worker_tasks
          set state = 'dead_letter', updated_at = target_now
          where id = task_record.id;

          update public.scan_jobs
          set status = 'failed'::public.scan_job_status,
              finished_at = target_now,
              failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
          where id = job_record.id
            and status = 'running'::public.scan_job_status;

          perform private.record_worker_event(
            'worker.dead_lettered',
            task_record.workspace_id,
            attempt_record.worker_id,
            task_record.id,
            jsonb_build_object('attemptId', attempt_record.id, 'reason', 'retry_window')
          );
        end if;
      else
        update private.worker_tasks
        set state = 'dead_letter', updated_at = target_now
        where id = task_record.id;

        update public.scan_jobs
        set status = 'failed'::public.scan_job_status,
            finished_at = target_now,
            failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
        where id = job_record.id
          and status = 'running'::public.scan_job_status;

        perform private.record_worker_event(
          'worker.dead_lettered',
          task_record.workspace_id,
          attempt_record.worker_id,
          task_record.id,
          jsonb_build_object('attemptId', attempt_record.id, 'reason', 'attempts')
        );
      end if;
    end if;

    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;

revoke all on function public.register_worker_node(text, text) from public, anon, authenticated;
grant execute on function public.register_worker_node(text, text) to service_role;

revoke all on function public.disable_worker_node(uuid) from public, anon, authenticated;
grant execute on function public.disable_worker_node(uuid) to service_role;

revoke all on function public.enqueue_foundation_worker_task(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_foundation_worker_task(uuid, uuid, uuid) to service_role;

revoke all on function public.claim_worker_task(uuid) from public, anon, authenticated;
grant execute on function public.claim_worker_task(uuid) to service_role;

revoke all on function public.heartbeat_worker_attempt(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.heartbeat_worker_attempt(uuid, uuid, uuid, text) to service_role;

revoke all on function public.finalize_worker_attempt(uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.finalize_worker_attempt(uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint) to service_role;

revoke all on function public.recover_expired_worker_attempts(timestamptz) from public, anon, authenticated;
grant execute on function public.recover_expired_worker_attempts(timestamptz) to service_role;

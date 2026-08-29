create or replace function public.claim_repository_scan_worker_task(
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
  attempt_record private.worker_attempts%rowtype;
  scan_task private.repository_scan_tasks%rowtype;
  job_record public.scan_jobs%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  artifact_record private.repository_source_artifacts%rowtype;
  claim_now timestamptz := now();
  lease_token bytea;
  lease_token_text text;
  lease_expiry timestamptz;
begin
  if target_worker_id is null then
    raise exception 'WORKER_NOT_AVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-claim-v1', 0));

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id
   for update;

  if worker_record.id is null
     or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;
  if worker_record.execution_class <> 'phase3_repository_scan_no_egress_v1' then
    raise exception 'WORKER_CLASS_UNAVAILABLE';
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
    join private.repository_scan_tasks rst
      on rst.task_id = t.id
     and rst.scan_job_id = t.scan_job_id
     and rst.workspace_id = t.workspace_id
     and rst.asset_id = t.asset_id
   where t.execution_class = 'phase3_repository_scan_no_egress_v1'
     and t.state in ('queued', 'retry_wait')
     and t.available_at <= claim_now
     and t.absolute_deadline_at > claim_now
     and j.job_kind = 'repository_scan'::public.scan_job_kind
     and j.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
     and j.cancel_requested_at is null
     and not exists (
       select 1
         from private.worker_tasks active_task
        where active_task.workspace_id = t.workspace_id
          and active_task.state = 'leased'
     )
   order by t.priority desc, t.available_at asc, t.created_at asc, t.id asc
   for update of t skip locked
   limit 1;

  if task_record.id is null then
    return null;
  end if;

  select * into scan_task
    from private.repository_scan_tasks
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

  if scan_task.task_id is null
     or job_record.id is null
     or job_record.job_kind <> 'repository_scan'::public.scan_job_kind
     or job_record.cancel_requested_at is not null
     or job_record.status not in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  select * into snapshot_record
    from public.repository_source_snapshots
   where id = scan_task.snapshot_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  select * into artifact_record
    from private.repository_source_artifacts
   where snapshot_id = scan_task.snapshot_id;

  if snapshot_record.id is null
     or artifact_record.snapshot_id is null
     or snapshot_record.expires_at < task_record.absolute_deadline_at
     or artifact_record.expires_at < task_record.absolute_deadline_at
     or artifact_record.deletion_status <> 'active'
     or artifact_record.deleted_at is not null
     or artifact_record.stored_byte_count <> snapshot_record.stored_artifact_bytes
     or artifact_record.artifact_digest <> snapshot_record.artifact_digest then
    raise exception 'REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE';
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
      'leaseExpiresAt', attempt_record.lease_expires_at,
      'snapshotId', scan_task.snapshot_id
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
      'kind', 'phase3_repository_scan',
      'snapshotId', snapshot_record.id,
      'canonicalRepositoryUrl', snapshot_record.canonical_repository_url,
      'resolvedCommitSha', snapshot_record.resolved_commit_sha,
      'contentDigest', snapshot_record.content_digest,
      'artifactDigest', snapshot_record.artifact_digest,
      'storedArtifactBytes', snapshot_record.stored_artifact_bytes,
      'retainedFileCount', snapshot_record.retained_file_count,
      'retainedBytes', snapshot_record.retained_bytes,
      'scannerProfileId', scan_task.scanner_profile_id,
      'scannerProfileVersion', scan_task.scanner_profile_version
    )
  );
end;
$$;

create or replace function public.finalize_repository_scan_worker_failure(
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
begin
  if target_terminal_outcome = 'succeeded' then
    raise exception 'REPOSITORY_SCAN_PUBLICATION_REQUIRED';
  end if;
  if target_terminal_outcome not in ('failed', 'cancelled') then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$'
     or target_terminal_payload_digest is null
     or target_terminal_payload_digest !~ '^[a-f0-9]{64}$' then
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
       and attempt_record.outcome in ('failed', 'cancelled') then
      return jsonb_build_object(
        'taskId', target_task_id,
        'attemptId', target_attempt_id,
        'outcome', attempt_record.outcome,
        'replayed', true
      );
    end if;
    raise exception 'WORKER_TERMINAL_CONFLICT';
  end if;

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id
   for update;
  select * into task_record
    from private.worker_tasks
   where id = target_task_id
   for update;

  if worker_record.id is null
     or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;
  if worker_record.execution_class <> 'phase3_repository_scan_no_egress_v1'
     or task_record.id is null
     or task_record.execution_class <> 'phase3_repository_scan_no_egress_v1'
     or task_record.state <> 'leased'
     or attempt_record.lease_expires_at <= finalize_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;

  if job_record.id is null
     or job_record.job_kind <> 'repository_scan'::public.scan_job_kind then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  if target_wall_time_ms is null or target_wall_time_ms < 0 or target_wall_time_ms > 300000
     or target_cpu_time_ms is null or target_cpu_time_ms < 0 or target_cpu_time_ms > 300000
     or target_peak_memory_bytes is null or target_peak_memory_bytes < 0 or target_peak_memory_bytes > 1073741824
     or target_input_bytes is null or target_input_bytes < 0 or target_input_bytes > 268435456
     or target_output_bytes is null or target_output_bytes < 0 or target_output_bytes > 3670016 then
    raise exception 'WORKER_BUDGET_EXCEEDED';
  end if;

  if target_terminal_outcome = 'failed' and target_failure_code not in (
    'WORKER_LOST',
    'WORKER_BUDGET_EXCEEDED',
    'WORKER_OUTPUT_INVALID',
    'WORKER_EXECUTION_FAILED',
    'WORKER_CLASS_UNAVAILABLE',
    'REPOSITORY_SCAN_ARTIFACT_UNAVAILABLE',
    'REPOSITORY_SCAN_ARTIFACT_INTEGRITY_FAILED',
    'REPOSITORY_SCAN_SNAPSHOT_INVALID',
    'REPOSITORY_SCAN_SANDBOX_FAILED',
    'REPOSITORY_SCAN_SCANNER_FAILED',
    'REPOSITORY_SCAN_OUTPUT_INVALID'
  ) then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_terminal_outcome = 'cancelled' and target_failure_code is not null then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;

  if job_record.cancel_requested_at is not null
     or job_record.status = 'cancelled'::public.scan_job_status
     or target_terminal_outcome = 'cancelled' then
    effective_outcome := 'cancelled';
    effective_failure_code := 'WORKER_CANCELLED';
  else
    effective_outcome := 'failed';
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
      'worker.cancelled', task_record.workspace_id, worker_record.id, task_record.id,
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
    else
      retry_delay := null;
    end if;

    if retry_delay is not null
       and finalize_now + retry_delay < task_record.absolute_deadline_at then
      update private.worker_tasks
         set state = 'retry_wait',
             available_at = finalize_now + retry_delay,
             updated_at = finalize_now
       where id = task_record.id;

      perform private.record_worker_event(
        'worker.retry_scheduled', task_record.workspace_id, worker_record.id, task_record.id,
        jsonb_build_object(
          'attemptId', attempt_record.id,
          'availableAt', finalize_now + retry_delay
        )
      );
    else
      update private.worker_tasks
         set state = 'dead_letter', updated_at = finalize_now
       where id = task_record.id;

      if job_record.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
        update public.scan_jobs
           set status = 'failed'::public.scan_job_status,
               finished_at = finalize_now,
               failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
         where id = job_record.id;
      end if;

      perform private.record_worker_event(
        'worker.dead_lettered', task_record.workspace_id, worker_record.id, task_record.id,
        jsonb_build_object('attemptId', attempt_record.id, 'reason', effective_failure_code)
      );
    end if;
  end if;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'outcome', effective_outcome,
    'replayed', false
  );
end;
$$;

revoke all on function public.claim_repository_scan_worker_task(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_repository_scan_worker_task(uuid)
  to service_role;

revoke all on function public.finalize_repository_scan_worker_failure(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_repository_scan_worker_failure(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) to service_role;
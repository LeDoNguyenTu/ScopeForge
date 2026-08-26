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
  if target_terminal_payload_digest is null
     or target_terminal_payload_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_terminal_outcome not in ('succeeded', 'failed', 'cancelled') then
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
     or attempt_record.lease_expires_at <= finalize_now then
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

  if task_record.execution_class = 'foundation_no_egress_v1' then
    if job_record.job_kind <> 'worker_foundation_probe'::public.scan_job_kind then
      raise exception 'WORKER_JOB_STATE_CONFLICT';
    end if;
    if target_wall_time_ms is null or target_wall_time_ms < 0 or target_wall_time_ms > 30000
       or target_cpu_time_ms is null or target_cpu_time_ms < 0 or target_cpu_time_ms > 20000
       or target_peak_memory_bytes is null or target_peak_memory_bytes < 0 or target_peak_memory_bytes > 268435456
       or target_input_bytes is null or target_input_bytes < 0 or target_input_bytes > 10485760
       or target_output_bytes is null or target_output_bytes < 0 or target_output_bytes > 1048576 then
      raise exception 'WORKER_BUDGET_EXCEEDED';
    end if;
    if target_terminal_outcome = 'failed' and target_failure_code not in (
      'WORKER_LOST',
      'WORKER_BUDGET_EXCEEDED',
      'WORKER_OUTPUT_INVALID',
      'WORKER_EXECUTION_FAILED',
      'WORKER_CLASS_UNAVAILABLE'
    ) then
      raise exception 'WORKER_TERMINAL_INVALID';
    end if;
  elsif task_record.execution_class = 'repository_snapshot_github_public_v1' then
    if job_record.job_kind <> 'repository_snapshot'::public.scan_job_kind then
      raise exception 'WORKER_JOB_STATE_CONFLICT';
    end if;
    if target_terminal_outcome = 'succeeded' then
      raise exception 'REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED';
    end if;
    if target_wall_time_ms is null or target_wall_time_ms < 0 or target_wall_time_ms > 300000
       or target_cpu_time_ms is null or target_cpu_time_ms < 0 or target_cpu_time_ms > 120000
       or target_peak_memory_bytes is null or target_peak_memory_bytes < 0 or target_peak_memory_bytes > 536870912
       or target_input_bytes is null or target_input_bytes < 0 or target_input_bytes > 268435456
       or target_output_bytes is null or target_output_bytes < 0 or target_output_bytes > 65536 then
      raise exception 'WORKER_BUDGET_EXCEEDED';
    end if;
    if target_terminal_outcome = 'failed' and target_failure_code not in (
      'WORKER_LOST',
      'WORKER_BUDGET_EXCEEDED',
      'WORKER_OUTPUT_INVALID',
      'WORKER_EXECUTION_FAILED',
      'WORKER_CLASS_UNAVAILABLE',
      'REPOSITORY_UNAVAILABLE',
      'REPOSITORY_IDENTITY_CHANGED',
      'REPOSITORY_NETWORK_POLICY_FAILED',
      'REPOSITORY_ARCHIVE_UNSAFE',
      'REPOSITORY_ARCHIVE_BUDGET_EXCEEDED',
      'REPOSITORY_ARTIFACT_UPLOAD_FAILED'
    ) then
      raise exception 'WORKER_TERMINAL_INVALID';
    end if;
  else
    raise exception 'WORKER_CLASS_UNAVAILABLE';
  end if;

  if target_terminal_outcome <> 'failed' and target_failure_code is not null then
    raise exception 'WORKER_TERMINAL_INVALID';
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
      'worker.cancelled', task_record.workspace_id, worker_record.id, task_record.id,
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
      'worker.succeeded', task_record.workspace_id, worker_record.id, task_record.id,
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

        update public.scan_jobs
           set status = 'failed'::public.scan_job_status,
               finished_at = finalize_now,
               failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
         where id = job_record.id
           and status = 'running'::public.scan_job_status;

        perform private.record_worker_event(
          'worker.dead_lettered', task_record.workspace_id, worker_record.id, task_record.id,
          jsonb_build_object('attemptId', attempt_record.id, 'reason', 'deadline')
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
        'worker.dead_lettered', task_record.workspace_id, worker_record.id, task_record.id,
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

create or replace function public.finalize_repository_snapshot_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_payload_digest text,
  target_canonical_repository_url text,
  target_default_branch text,
  target_resolved_commit_sha text,
  target_content_digest text,
  target_artifact_digest text,
  target_compressed_bytes bigint,
  target_expanded_bytes bigint,
  target_retained_file_count integer,
  target_retained_bytes bigint,
  target_stored_artifact_bytes bigint,
  target_skip_counts jsonb,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint,
  target_server_observed_object_bytes bigint
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
  repository_task private.repository_snapshot_tasks%rowtype;
  upload_record private.repository_snapshot_attempt_uploads%rowtype;
  existing_snapshot public.repository_source_snapshots%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  publish_now timestamptz := now();
  calculated_hash text;
  replayed boolean := false;
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$'
     or target_terminal_payload_digest is null or target_terminal_payload_digest !~ '^[a-f0-9]{64}$'
     or target_canonical_repository_url is null
     or char_length(target_canonical_repository_url) not between 1 and 512
     or target_canonical_repository_url !~ '^https://github[.]com/[^/?#]+/[^/?#]+$'
     or target_default_branch is null or octet_length(target_default_branch) not between 1 and 255
     or target_resolved_commit_sha is null or target_resolved_commit_sha !~ '^[a-f0-9]{40}$'
     or target_content_digest is null or target_content_digest !~ '^[a-f0-9]{64}$'
     or target_artifact_digest is null or target_artifact_digest !~ '^[a-f0-9]{64}$'
     or target_compressed_bytes is null or target_compressed_bytes not between 0 and 134217728
     or target_expanded_bytes is null or target_expanded_bytes not between 0 and 536870912
     or target_retained_file_count is null or target_retained_file_count not between 0 and 20000
     or target_retained_bytes is null or target_retained_bytes not between 0 and 268435456
     or target_stored_artifact_bytes is null or target_stored_artifact_bytes not between 1 and 335544320
     or target_server_observed_object_bytes is null or target_server_observed_object_bytes not between 1 and 335544320
     or target_server_observed_object_bytes <> target_stored_artifact_bytes
     or target_expanded_bytes < target_retained_bytes
     or target_wall_time_ms is null or target_wall_time_ms not between 0 and 300000
     or target_cpu_time_ms is null or target_cpu_time_ms not between 0 and 120000
     or target_peak_memory_bytes is null or target_peak_memory_bytes not between 0 and 536870912
     or target_input_bytes is null or target_input_bytes not between 0 and 268435456
     or target_output_bytes is null or target_output_bytes not between 0 and 65536 then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_INVALID';
  end if;

  if jsonb_typeof(target_skip_counts) is distinct from 'object'
     or not (target_skip_counts ?& array[
       'symlink', 'hardlink', 'fileTooLarge', 'retainedFileLimit', 'retainedBytesLimit'
     ])
     or (target_skip_counts - array[
       'symlink', 'hardlink', 'fileTooLarge', 'retainedFileLimit', 'retainedBytesLimit'
     ]) <> '{}'::jsonb
     or pg_column_size(target_skip_counts) > 1024
     or (target_skip_counts->>'symlink') !~ '^[0-9]+$'
     or (target_skip_counts->>'hardlink') !~ '^[0-9]+$'
     or (target_skip_counts->>'fileTooLarge') !~ '^[0-9]+$'
     or (target_skip_counts->>'retainedFileLimit') !~ '^[0-9]+$'
     or (target_skip_counts->>'retainedBytesLimit') !~ '^[0-9]+$'
     or (target_skip_counts->>'symlink')::bigint not between 0 and 50000
     or (target_skip_counts->>'hardlink')::bigint not between 0 and 50000
     or (target_skip_counts->>'fileTooLarge')::bigint not between 0 and 50000
     or (target_skip_counts->>'retainedFileLimit')::bigint not between 0 and 50000
     or (target_skip_counts->>'retainedBytesLimit')::bigint not between 0 and 50000 then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_INVALID';
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
       and attempt_record.outcome = 'succeeded' then
      select * into existing_snapshot
        from public.repository_source_snapshots
       where scan_job_id = (
         select scan_job_id from private.worker_tasks where id = target_task_id
       );
      if existing_snapshot.id is null
         or existing_snapshot.canonical_repository_url <> target_canonical_repository_url
         or existing_snapshot.default_branch <> target_default_branch
         or existing_snapshot.resolved_commit_sha <> target_resolved_commit_sha
         or existing_snapshot.content_digest <> target_content_digest
         or existing_snapshot.artifact_digest <> target_artifact_digest
         or existing_snapshot.compressed_bytes <> target_compressed_bytes
         or existing_snapshot.expanded_bytes <> target_expanded_bytes
         or existing_snapshot.retained_file_count <> target_retained_file_count
         or existing_snapshot.retained_bytes <> target_retained_bytes
         or existing_snapshot.stored_artifact_bytes <> target_stored_artifact_bytes
         or existing_snapshot.skip_counts <> target_skip_counts then
        raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT';
      end if;
      replayed := true;
      return jsonb_build_object(
        'taskId', target_task_id,
        'attemptId', target_attempt_id,
        'snapshotId', existing_snapshot.id,
        'outcome', 'succeeded',
        'replayed', replayed
      );
    end if;
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT';
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
     or worker_record.disabled_at is not null
     or worker_record.execution_class <> 'repository_snapshot_github_public_v1'
     or task_record.id is null
     or task_record.execution_class <> 'repository_snapshot_github_public_v1'
     or task_record.state <> 'leased'
     or attempt_record.lease_expires_at <= publish_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;
  select * into repository_task
    from private.repository_snapshot_tasks
   where task_id = task_record.id
     and scan_job_id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;
  select * into upload_record
    from private.repository_snapshot_attempt_uploads
   where attempt_id = attempt_record.id
     and task_id = task_record.id;

  if job_record.id is null
     or job_record.job_kind <> 'repository_snapshot'::public.scan_job_kind
     or job_record.status <> 'running'::public.scan_job_status
     or repository_task.task_id is null
     or upload_record.attempt_id is null then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_INVALID';
  end if;

  if job_record.cancel_requested_at is not null
     or job_record.status = 'cancelled'::public.scan_job_status then
    update private.worker_attempts
       set finished_at = publish_now,
           outcome = 'cancelled',
           failure_code = 'WORKER_CANCELLED',
           terminal_payload_digest = target_terminal_payload_digest,
           wall_time_ms = target_wall_time_ms,
           cpu_time_ms = target_cpu_time_ms,
           peak_memory_bytes = target_peak_memory_bytes,
           input_bytes = target_input_bytes,
           output_bytes = target_output_bytes
     where id = attempt_record.id;

    update private.worker_tasks
       set state = 'cancelled', updated_at = publish_now
     where id = task_record.id;

    update public.scan_jobs
       set status = 'cancelled'::public.scan_job_status,
           finished_at = publish_now,
           failure_code = null
     where id = job_record.id
       and status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status);

    perform private.record_worker_event(
      'worker.cancelled', task_record.workspace_id, worker_record.id, task_record.id,
      jsonb_build_object('attemptId', attempt_record.id)
    );

    return jsonb_build_object(
      'taskId', task_record.id,
      'attemptId', attempt_record.id,
      'outcome', 'cancelled',
      'replayed', false
    );
  end if;

  if repository_task.canonical_repository_url <> target_canonical_repository_url then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_INVALID';
  end if;

  if exists (
    select 1 from public.repository_source_snapshots
     where scan_job_id = job_record.id
  ) then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT';
  end if;

  insert into public.repository_source_snapshots (
    workspace_id,
    asset_id,
    scan_job_id,
    requested_by,
    source_kind,
    schema_version,
    canonical_repository_url,
    default_branch,
    resolved_commit_sha,
    content_digest,
    artifact_digest,
    compressed_bytes,
    expanded_bytes,
    retained_file_count,
    retained_bytes,
    stored_artifact_bytes,
    skip_counts,
    created_at,
    expires_at
  ) values (
    task_record.workspace_id,
    task_record.asset_id,
    task_record.scan_job_id,
    repository_task.requested_by,
    'github_public_archive',
    1,
    target_canonical_repository_url,
    target_default_branch,
    target_resolved_commit_sha,
    target_content_digest,
    target_artifact_digest,
    target_compressed_bytes,
    target_expanded_bytes,
    target_retained_file_count,
    target_retained_bytes,
    target_stored_artifact_bytes,
    target_skip_counts,
    publish_now,
    publish_now + interval '7 days'
  )
  returning * into snapshot_record;

  insert into private.repository_source_artifacts (
    snapshot_id,
    provider,
    object_key,
    stored_byte_count,
    artifact_digest,
    expires_at,
    deletion_status,
    deleted_at,
    created_at
  ) values (
    snapshot_record.id,
    'r2',
    upload_record.object_key,
    target_server_observed_object_bytes,
    target_artifact_digest,
    snapshot_record.expires_at,
    'active',
    null,
    publish_now
  );

  update private.worker_attempts
     set finished_at = publish_now,
         outcome = 'succeeded',
         failure_code = null,
         terminal_payload_digest = target_terminal_payload_digest,
         wall_time_ms = target_wall_time_ms,
         cpu_time_ms = target_cpu_time_ms,
         peak_memory_bytes = target_peak_memory_bytes,
         input_bytes = target_input_bytes,
         output_bytes = target_output_bytes
   where id = attempt_record.id;

  update private.worker_tasks
     set state = 'completed', updated_at = publish_now
   where id = task_record.id;

  update public.scan_jobs
     set status = 'succeeded'::public.scan_job_status,
         finished_at = publish_now,
         failure_code = null,
         request_count = 0,
         redirect_count = 0,
         finding_count = 0
   where id = job_record.id
     and status = 'running'::public.scan_job_status;

  if not found then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT';
  end if;

  update private.worker_nodes
     set last_seen_at = greatest(coalesce(last_seen_at, publish_now), publish_now)
   where id = worker_record.id;

  perform private.record_worker_event(
    'worker.succeeded', task_record.workspace_id, worker_record.id, task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'snapshotId', snapshot_record.id,
      'resolvedCommitSha', snapshot_record.resolved_commit_sha
    )
  );

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'snapshotId', snapshot_record.id,
    'outcome', 'succeeded',
    'replayed', replayed
  );
end;
$$;

revoke all on function public.finalize_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.finalize_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) to service_role;

revoke all on function public.finalize_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.finalize_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) to service_role;

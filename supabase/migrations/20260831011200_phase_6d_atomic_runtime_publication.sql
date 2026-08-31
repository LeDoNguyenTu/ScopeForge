create or replace function public.publish_passive_runtime_worker_success(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_digest text,
  target_request_count integer,
  target_redirect_count integer,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint,
  observation_rows jsonb,
  finding_rows jsonb,
  evidence_rows jsonb,
  observed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_record jsonb;
  result_record jsonb;
begin
  if observation_rows is null
     or jsonb_typeof(observation_rows) <> 'array'
     or finding_rows is null
     or jsonb_typeof(finding_rows) <> 'array'
     or evidence_rows is null
     or jsonb_typeof(evidence_rows) <> 'array'
     or observed_at is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  context_record := public.get_runtime_worker_finalization_context(
    target_worker_id,
    target_task_id,
    target_attempt_id,
    target_lease_token
  );

  if context_record->>'executionClass' <> 'passive_runtime_observation_v1' then
    raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
  end if;

  if context_record->>'finishedAt' is not null then
    return public.finalize_runtime_worker_attempt(
      target_worker_id,
      target_task_id,
      target_attempt_id,
      target_lease_token,
      'passive_runtime_observation_v1',
      target_terminal_digest,
      'succeeded',
      null,
      target_request_count,
      target_redirect_count,
      0,
      target_wall_time_ms,
      target_cpu_time_ms,
      target_peak_memory_bytes,
      target_input_bytes,
      target_output_bytes
    );
  end if;

  if (context_record->>'cancelRequested')::boolean then
    return public.finalize_runtime_worker_attempt(
      target_worker_id,
      target_task_id,
      target_attempt_id,
      target_lease_token,
      'passive_runtime_observation_v1',
      target_terminal_digest,
      'succeeded',
      null,
      0,
      0,
      0,
      target_wall_time_ms,
      target_cpu_time_ms,
      target_peak_memory_bytes,
      target_input_bytes,
      target_output_bytes
    );
  end if;

  perform public.persist_passive_runtime_result(
    (context_record->>'workspaceId')::uuid,
    (context_record->>'assetId')::uuid,
    (context_record->>'domainJobId')::uuid,
    observation_rows,
    finding_rows,
    evidence_rows,
    observed_at
  );

  result_record := public.finalize_runtime_worker_attempt(
    target_worker_id,
    target_task_id,
    target_attempt_id,
    target_lease_token,
    'passive_runtime_observation_v1',
    target_terminal_digest,
    'succeeded',
    null,
    target_request_count,
    target_redirect_count,
    jsonb_array_length(finding_rows),
    target_wall_time_ms,
    target_cpu_time_ms,
    target_peak_memory_bytes,
    target_input_bytes,
    target_output_bytes
  );

  return result_record;
end;
$$;

create or replace function public.publish_active_cors_worker_success(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_digest text,
  target_request_count integer,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint,
  observation_row jsonb,
  finding_rows jsonb,
  evidence_rows jsonb,
  observed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_record jsonb;
  result_record jsonb;
begin
  if observation_row is null
     or jsonb_typeof(observation_row) <> 'object'
     or finding_rows is null
     or jsonb_typeof(finding_rows) <> 'array'
     or evidence_rows is null
     or jsonb_typeof(evidence_rows) <> 'array'
     or observed_at is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  context_record := public.get_runtime_worker_finalization_context(
    target_worker_id,
    target_task_id,
    target_attempt_id,
    target_lease_token
  );

  if context_record->>'executionClass' <> 'active_cors_validation_v1' then
    raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
  end if;

  if context_record->>'finishedAt' is not null then
    return public.finalize_runtime_worker_attempt(
      target_worker_id,
      target_task_id,
      target_attempt_id,
      target_lease_token,
      'active_cors_validation_v1',
      target_terminal_digest,
      'succeeded',
      null,
      target_request_count,
      0,
      0,
      target_wall_time_ms,
      target_cpu_time_ms,
      target_peak_memory_bytes,
      target_input_bytes,
      target_output_bytes
    );
  end if;

  if (context_record->>'cancelRequested')::boolean then
    return public.finalize_runtime_worker_attempt(
      target_worker_id,
      target_task_id,
      target_attempt_id,
      target_lease_token,
      'active_cors_validation_v1',
      target_terminal_digest,
      'succeeded',
      null,
      0,
      0,
      0,
      target_wall_time_ms,
      target_cpu_time_ms,
      target_peak_memory_bytes,
      target_input_bytes,
      target_output_bytes
    );
  end if;

  perform public.persist_active_validation_result(
    (context_record->>'workspaceId')::uuid,
    (context_record->>'assetId')::uuid,
    (context_record->>'domainJobId')::uuid,
    observation_row,
    finding_rows,
    evidence_rows,
    observed_at
  );

  result_record := public.finalize_runtime_worker_attempt(
    target_worker_id,
    target_task_id,
    target_attempt_id,
    target_lease_token,
    'active_cors_validation_v1',
    target_terminal_digest,
    'succeeded',
    null,
    target_request_count,
    0,
    jsonb_array_length(finding_rows),
    target_wall_time_ms,
    target_cpu_time_ms,
    target_peak_memory_bytes,
    target_input_bytes,
    target_output_bytes
  );

  return result_record;
end;
$$;

revoke all on function public.publish_passive_runtime_worker_success(
  uuid, uuid, uuid, text, text, integer, integer,
  integer, integer, bigint, bigint, bigint,
  jsonb, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.publish_passive_runtime_worker_success(
  uuid, uuid, uuid, text, text, integer, integer,
  integer, integer, bigint, bigint, bigint,
  jsonb, jsonb, jsonb, timestamptz
) to service_role;

revoke all on function public.publish_active_cors_worker_success(
  uuid, uuid, uuid, text, text, integer,
  integer, integer, bigint, bigint, bigint,
  jsonb, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.publish_active_cors_worker_success(
  uuid, uuid, uuid, text, text, integer,
  integer, integer, bigint, bigint, bigint,
  jsonb, jsonb, jsonb, timestamptz
) to service_role;

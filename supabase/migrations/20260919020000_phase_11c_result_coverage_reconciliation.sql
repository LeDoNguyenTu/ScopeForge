-- Phase 11C terminal-result coverage reconciliation.
-- Forward-only. This migration remains source-only until the separate Phase 11
-- production migration gate is approved.

alter table private.pentest_action_attempts
  add column request_count integer not null default 0;

alter table private.pentest_action_attempts
  add constraint pentest_action_attempts_request_count_check
    check (request_count >= 0);

create or replace function private.apply_phase11_attempt_coverage(
  target_workspace_id uuid,
  target_run_id uuid,
  target_action_id text,
  target_status text,
  target_request_count integer,
  target_now timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  action_record private.pentest_actions%rowtype;
  coverage_record private.pentest_coverage%rowtype;
  next_attempted_capability_ids text[];
  next_covered_node_ids text[];
  next_untested_node_ids text[];
  next_request_count bigint;
  next_provider_failure_count bigint;
  counts_as_attempt boolean;
begin
  if target_workspace_id is null
    or target_run_id is null
    or target_action_id is null
    or target_action_id !~ '^phase11-action:[0-9a-f]{64}$'
    or target_status not in (
      'succeeded', 'no_signal', 'blocked', 'cancelled',
      'timed_out', 'provider_failed', 'policy_rejected'
    )
    or target_request_count is null
    or target_request_count < 0
    or target_now is null
  then
    raise exception 'PHASE11_COVERAGE_RECONCILIATION_INVALID';
  end if;

  select *
  into action_record
  from private.pentest_actions
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
  for update;

  if action_record.action_id is null
    or action_record.decision_status not in ('approved', 'narrowed')
    or action_record.max_requests is null
    or target_request_count > action_record.max_requests
  then
    raise exception 'PHASE11_COVERAGE_ACTION_INVALID';
  end if;

  select *
  into coverage_record
  from private.pentest_coverage
  where workspace_id = target_workspace_id
    and run_id = target_run_id
  for update;

  if coverage_record.run_id is null then
    raise exception 'PHASE11_COVERAGE_NOT_FOUND';
  end if;

  counts_as_attempt := target_status in (
    'succeeded', 'no_signal', 'timed_out', 'provider_failed'
  );

  if counts_as_attempt then
    select array(
      select distinct capability_id
      from unnest(
        coverage_record.attempted_capability_ids || array[action_record.capability_id]
      ) as capability_id
      order by capability_id
    )
    into next_attempted_capability_ids;

    select array(
      select distinct node_id
      from unnest(
        coverage_record.covered_node_ids || action_record.target_node_ids
      ) as node_id
      order by node_id
    )
    into next_covered_node_ids;

    select array(
      select node_id
      from unnest(coverage_record.untested_node_ids) as node_id
      where not (node_id = any(action_record.target_node_ids))
      order by node_id
    )
    into next_untested_node_ids;
  else
    next_attempted_capability_ids := coverage_record.attempted_capability_ids;
    next_covered_node_ids := coverage_record.covered_node_ids;
    next_untested_node_ids := coverage_record.untested_node_ids;
  end if;

  if cardinality(next_attempted_capability_ids) > 512
    or cardinality(next_covered_node_ids) > 4096
    or cardinality(next_untested_node_ids) > 4096
  then
    raise exception 'PHASE11_COVERAGE_LIMIT_EXCEEDED';
  end if;

  next_request_count :=
    coverage_record.request_count::bigint + target_request_count::bigint;
  next_provider_failure_count :=
    coverage_record.provider_failure_count::bigint
    + case when target_status = 'provider_failed' then 1 else 0 end;

  if next_request_count > 2147483647
    or next_provider_failure_count > 2147483647
  then
    raise exception 'PHASE11_COVERAGE_COUNTER_OVERFLOW';
  end if;

  update private.pentest_coverage
  set attempted_capability_ids = next_attempted_capability_ids,
      covered_node_ids = next_covered_node_ids,
      untested_node_ids = next_untested_node_ids,
      request_count = next_request_count::integer,
      provider_failure_count = next_provider_failure_count::integer,
      updated_at = target_now
  where workspace_id = target_workspace_id
    and run_id = target_run_id;

  update public.pentest_coverage_summaries
  set attempted_capability_count = cardinality(next_attempted_capability_ids),
      covered_node_count = cardinality(next_covered_node_ids),
      untested_node_count = cardinality(next_untested_node_ids),
      request_count = next_request_count::integer,
      provider_failure_count = next_provider_failure_count::integer,
      updated_at = target_now
  where workspace_id = target_workspace_id
    and run_id = target_run_id;

  if not found then
    raise exception 'PHASE11_COVERAGE_SUMMARY_NOT_FOUND';
  end if;
end;
$$;

revoke all on function private.apply_phase11_attempt_coverage(
  uuid, uuid, text, text, integer, timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.get_phase11_http_worker_finalization_context(
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
  lookup_now timestamptz := clock_timestamp();
  calculated_hash text;
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  cancel_requested boolean;
begin
  if target_worker_id is null
    or target_task_id is null
    or target_attempt_id is null
    or target_lease_token is null
    or target_lease_token !~ '^[a-f0-9]{64}$'
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into worker_record
  from private.worker_nodes
  where id = target_worker_id;

  select * into task_record
  from private.worker_tasks
  where id = target_task_id;

  select * into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id;

  select * into binding_record
  from private.phase11_http_worker_tasks
  where task_id = target_task_id;

  if worker_record.id is null
    or worker_record.disabled_at is not null
    or worker_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.id is null
    or task_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.workspace_id is distinct from binding_record.workspace_id
    or task_record.scan_job_id is not null
    or task_record.asset_id is not null
    or binding_record.task_id is null
    or attempt_record.id is null
    or attempt_record.worker_id is distinct from target_worker_id
    or attempt_record.lease_token_hash is distinct from calculated_hash
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is null
    and (task_record.state <> 'leased' or attempt_record.lease_expires_at <= lookup_now)
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into run_record
  from private.pentest_runs
  where id = binding_record.run_id
    and workspace_id = binding_record.workspace_id;

  select * into action_record
  from private.pentest_actions
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  if run_record.id is null
    or action_record.action_id is null
    or action_record.authorization_id is distinct from binding_record.authorization_id
    or run_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.capability_id is distinct from binding_record.capability_id
    or action_record.capability_version is distinct from binding_record.capability_version
    or cardinality(action_record.target_node_ids) <> 1
    or action_record.target_node_ids[1] is distinct from binding_record.target_node_id
    or action_record.requested_mode <> 'safe_active'
    or action_record.closed_parameters->>'discoveryProfile' not in ('root-only', 'well-known-safe')
  then
    raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
  end if;

  cancel_requested := run_record.status = 'cancelled' or action_record.state = 'cancelled';

  if attempt_record.finished_at is null and not cancel_requested then
    select * into snapshot_record
    from private.pentest_run_authorization_snapshots
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and snapshot_ref = binding_record.authorization_snapshot_ref;

    if run_record.status <> 'running'
      or action_record.state <> 'running'
      or action_record.decision_status not in ('approved', 'narrowed')
      or snapshot_record.snapshot_ref is null
      or snapshot_record.expires_at <= lookup_now
      or action_record.authorization_expires_at is null
      or action_record.authorization_expires_at <= lookup_now
      or action_record.authorization_expires_at > snapshot_record.expires_at
      or not (binding_record.target_node_id = any(snapshot_record.authorized_node_ids))
    then
      raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
    end if;
  end if;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'workspaceId', binding_record.workspace_id,
    'runId', binding_record.run_id,
    'actionId', binding_record.action_id,
    'authorizationId', binding_record.authorization_id,
    'authorizationSnapshotRef', binding_record.authorization_snapshot_ref,
    'targetNodeId', binding_record.target_node_id,
    'capabilityId', binding_record.capability_id,
    'providerId', binding_record.provider_id,
    'providerVersion', binding_record.provider_version,
    'discoveryProfile', action_record.closed_parameters->>'discoveryProfile',
    'maxRequests', least(action_record.max_requests, 12),
    'leasedAt', attempt_record.leased_at,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'cancelRequested', cancel_requested,
    'finishedAt', attempt_record.finished_at,
    'priorOutcome', attempt_record.outcome,
    'priorTerminalDigest', attempt_record.terminal_payload_digest
  );
end;
$$;

revoke all on function public.get_phase11_http_worker_finalization_context(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_phase11_http_worker_finalization_context(uuid, uuid, uuid, text)
  to service_role;

create or replace function public.finalize_phase11_http_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_digest text,
  target_outcome text,
  target_failure_code text,
  target_request_count integer,
  target_metrics jsonb,
  observation_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  finalize_now timestamptz := clock_timestamp();
  calculated_hash text;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  observation_row jsonb;
  effective_outcome text;
  attempt_status text;
  observation_ids text[] := '{}';
  evidence_refs text[] := '{}';
begin
  if target_worker_id is null
    or target_task_id is null
    or target_attempt_id is null
    or target_lease_token is null
    or target_lease_token !~ '^[a-f0-9]{64}$'
    or target_terminal_digest is null
    or target_terminal_digest !~ '^[a-f0-9]{64}$'
    or target_outcome not in ('succeeded', 'failed', 'cancelled')
    or target_request_count is null
    or target_request_count < 0
    or target_request_count > 12
    or target_metrics is null
    or jsonb_typeof(target_metrics) <> 'object'
    or (select count(*) from jsonb_object_keys(target_metrics)) <> 5
    or not (target_metrics ?& array[
      'wallTimeMs', 'cpuTimeMs', 'peakMemoryBytes', 'inputBytes', 'outputBytes'
    ])
    or jsonb_typeof(target_metrics->'wallTimeMs') <> 'number'
    or (target_metrics->>'wallTimeMs')::numeric not between 0 and 30000
    or jsonb_typeof(target_metrics->'cpuTimeMs') <> 'number'
    or (target_metrics->>'cpuTimeMs')::numeric not between 0 and 15000
    or jsonb_typeof(target_metrics->'peakMemoryBytes') <> 'number'
    or (target_metrics->>'peakMemoryBytes')::numeric not between 0 and 268435456
    or jsonb_typeof(target_metrics->'inputBytes') <> 'number'
    or (target_metrics->>'inputBytes')::numeric not between 0 and 4096
    or jsonb_typeof(target_metrics->'outputBytes') <> 'number'
    or (target_metrics->>'outputBytes')::numeric not between 0 and 32768
    or observation_rows is null
    or jsonb_typeof(observation_rows) <> 'array'
    or jsonb_array_length(observation_rows) > 4
  then
    raise exception 'PHASE11_HTTP_TERMINAL_INVALID';
  end if;
  if target_outcome = 'failed' and target_failure_code not in (
    'WORKER_LOST', 'WORKER_BUDGET_EXCEEDED', 'WORKER_OUTPUT_INVALID',
    'WORKER_EXECUTION_FAILED', 'WORKER_CLASS_UNAVAILABLE',
    'RUNTIME_WORKER_AUTHORIZATION_FAILED', 'RUNTIME_WORKER_CANCELLED',
    'RUNTIME_WORKER_NETWORK_POLICY_FAILED', 'RUNTIME_WORKER_BUDGET_EXCEEDED',
    'RUNTIME_WORKER_OUTPUT_INVALID', 'RUNTIME_WORKER_EXECUTION_FAILED',
    'HTTP_DISCOVERY_REQUEST_BUDGET', 'HTTP_DISCOVERY_REQUEST_TIMEOUT',
    'HTTP_DISCOVERY_TOTAL_TIMEOUT', 'HTTP_DISCOVERY_NETWORK_ERROR',
    'HTTP_DISCOVERY_PROFILE_INVALID'
  ) then
    raise exception 'PHASE11_HTTP_FAILURE_CODE_INVALID';
  end if;
  if target_outcome <> 'failed' and target_failure_code is not null then
    raise exception 'PHASE11_HTTP_FAILURE_CODE_INVALID';
  end if;
  if target_outcome <> 'succeeded' and jsonb_array_length(observation_rows) <> 0 then
    raise exception 'PHASE11_HTTP_OBSERVATION_OUTCOME_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into task_record
  from private.worker_tasks
  where id = target_task_id
  for update;

  select * into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id
  for update;

  select * into binding_record
  from private.phase11_http_worker_tasks
  where task_id = target_task_id;

  if task_record.id is null
    or task_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.workspace_id is distinct from binding_record.workspace_id
    or binding_record.task_id is null
    or attempt_record.id is null
    or attempt_record.worker_id is distinct from target_worker_id
    or attempt_record.lease_token_hash is distinct from calculated_hash
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is not null then
    if attempt_record.terminal_payload_digest is distinct from target_terminal_digest
    then
      raise exception 'WORKER_TERMINAL_CONFLICT';
    end if;
    return jsonb_build_object('outcome', attempt_record.outcome, 'replayed', true);
  end if;

  if task_record.state <> 'leased'
    or task_record.absolute_deadline_at <= finalize_now
    or attempt_record.lease_expires_at <= finalize_now
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into run_record
  from private.pentest_runs
  where id = binding_record.run_id
    and workspace_id = binding_record.workspace_id
  for update;

  select * into action_record
  from private.pentest_actions
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id
  for update;

  if run_record.id is null
    or action_record.action_id is null
    or action_record.authorization_id is distinct from binding_record.authorization_id
    or run_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.capability_id is distinct from binding_record.capability_id
    or action_record.capability_version is distinct from binding_record.capability_version
    or cardinality(action_record.target_node_ids) <> 1
    or action_record.target_node_ids[1] is distinct from binding_record.target_node_id
    or action_record.requested_mode <> 'safe_active'
    or action_record.max_requests is null
    or target_request_count > action_record.max_requests
  then
    raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
  end if;

  if run_record.status = 'cancelled' or action_record.state = 'cancelled' then
    effective_outcome := 'cancelled';
  else
    effective_outcome := target_outcome;
    select * into snapshot_record
    from private.pentest_run_authorization_snapshots
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and snapshot_ref = binding_record.authorization_snapshot_ref;
    if run_record.status <> 'running'
      or action_record.state <> 'running'
      or action_record.decision_status not in ('approved', 'narrowed')
      or snapshot_record.snapshot_ref is null
      or snapshot_record.expires_at <= finalize_now
      or action_record.authorization_expires_at is null
      or action_record.authorization_expires_at <= finalize_now
      or action_record.authorization_expires_at > snapshot_record.expires_at
      or not (binding_record.target_node_id = any(snapshot_record.authorized_node_ids))
    then
      raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
    end if;
  end if;

  if effective_outcome <> 'succeeded' then
    -- Failed/cancelled execution must not erase already-consumed network
    -- budget. The trusted finalization layer sends either the observed count
    -- from a completed mediator result or the authorized max_requests as a
    -- conservative upper bound when the executor terminated before it could
    -- report an exact count.
    observation_rows := '[]'::jsonb;
  else
    for observation_row in select value from jsonb_array_elements(observation_rows)
    loop
      if observation_row->>'observation_id' !~ '^phase11-obs-http:[0-9a-f]{64}$'
        or observation_row->>'provider_id' <> binding_record.provider_id
        or observation_row->>'provider_version' <> binding_record.provider_version
        or observation_row->>'capability_id' <> binding_record.capability_id
        or observation_row->>'authorization_snapshot_ref' <> binding_record.authorization_snapshot_ref
        or observation_row->>'execution_mode' <> 'safe_active'
        or observation_row->'asset_node_ids' <> jsonb_build_array(binding_record.target_node_id)
        or jsonb_array_length(observation_row->'evidence_refs') <> 1
        or observation_row->'evidence_refs'->>0 !~
          ('^phase11-http-attempt:' || target_attempt_id::text || ':(root|security-txt|robots|sitemap)$')
      then
        raise exception 'PHASE11_HTTP_OBSERVATION_INVALID';
      end if;
      observation_ids := array_append(observation_ids, observation_row->>'observation_id');
      evidence_refs := array_append(evidence_refs, observation_row->'evidence_refs'->>0);
    end loop;

    perform public.persist_phase11_observations(
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.authorization_snapshot_ref,
      observation_rows
    );
  end if;

  attempt_status := case effective_outcome
    when 'succeeded' then case when cardinality(observation_ids) = 0 then 'no_signal' else 'succeeded' end
    when 'cancelled' then 'cancelled'
    else 'provider_failed'
  end;

  insert into private.pentest_action_attempts (
    id, workspace_id, run_id, action_id, authorization_id,
    provider_id, provider_version, status, request_count, observation_ids, evidence_refs,
    started_at, completed_at, error_code
  ) values (
    attempt_record.id, binding_record.workspace_id, binding_record.run_id,
    binding_record.action_id, binding_record.authorization_id,
    binding_record.provider_id, binding_record.provider_version, attempt_status,
    target_request_count, observation_ids, evidence_refs, attempt_record.leased_at, finalize_now,
    case when effective_outcome = 'failed' then target_failure_code else null end
  );

  perform private.apply_phase11_attempt_coverage(
    binding_record.workspace_id,
    binding_record.run_id,
    binding_record.action_id,
    attempt_status,
    target_request_count,
    finalize_now
  );

  update private.worker_attempts
  set finished_at = finalize_now,
      outcome = effective_outcome,
      failure_code = case when effective_outcome = 'failed' then target_failure_code else null end,
      terminal_payload_digest = target_terminal_digest,
      wall_time_ms = (target_metrics->>'wallTimeMs')::integer,
      cpu_time_ms = (target_metrics->>'cpuTimeMs')::integer,
      peak_memory_bytes = (target_metrics->>'peakMemoryBytes')::bigint,
      input_bytes = (target_metrics->>'inputBytes')::bigint,
      output_bytes = (target_metrics->>'outputBytes')::bigint
  where id = attempt_record.id;

  update private.worker_tasks
  set state = case effective_outcome when 'succeeded' then 'completed' when 'cancelled' then 'cancelled' else 'dead_letter' end,
      updated_at = finalize_now
  where id = task_record.id;

  update private.pentest_actions
  set state = case when effective_outcome = 'cancelled' then 'cancelled' else 'terminal' end,
      updated_at = finalize_now
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  update public.pentest_action_summaries
  set state = case when effective_outcome = 'cancelled' then 'cancelled' else 'terminal' end,
      updated_at = finalize_now
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  perform private.record_worker_event(
    'worker.task_terminal',
    binding_record.workspace_id,
    target_worker_id,
    task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'outcome', effective_outcome,
      'executionClass', task_record.execution_class,
      'requestCount', target_request_count,
      'observationCount', cardinality(observation_ids)
    )
  );

  return jsonb_build_object('outcome', effective_outcome, 'replayed', false);
end;
$$;

revoke all on function public.finalize_phase11_http_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_phase11_http_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, jsonb, jsonb
) to service_role;


-- Phase 11 HTTP tasks intentionally have no scan_job row. Replace the shared
-- heartbeat with a class-aware implementation so legacy workers preserve their
-- existing scan-job cancellation semantics while Phase 11 cancellation and
-- authorization expiry are derived only from trusted Phase 11 state.

create or replace function private.recover_phase11_http_unleased_worker_tasks(
  target_now timestamptz
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  effective_cancelled boolean;
  recovered integer := 0;
begin
  for task_record in
    select t.*
    from private.worker_tasks t
    join private.phase11_http_worker_tasks binding
      on binding.task_id = t.id
     and binding.workspace_id = t.workspace_id
    join private.pentest_actions action
      on action.workspace_id = binding.workspace_id
     and action.run_id = binding.run_id
     and action.action_id = binding.action_id
    join private.pentest_runs run
      on run.id = binding.run_id
     and run.workspace_id = binding.workspace_id
    left join private.pentest_run_authorization_snapshots snapshot
      on snapshot.workspace_id = binding.workspace_id
     and snapshot.run_id = binding.run_id
     and snapshot.snapshot_ref = binding.authorization_snapshot_ref
    where t.execution_class = 'phase11_http_discovery_v1'
      and t.state in ('queued', 'retry_wait')
      and (
        run.status <> 'running'
        or action.state <> 'queued'
        or t.absolute_deadline_at <= target_now
        or snapshot.snapshot_ref is null
        or snapshot.expires_at <= target_now
        or action.authorization_expires_at is null
        or action.authorization_expires_at <= target_now
      )
    order by t.absolute_deadline_at asc, t.id asc
    for update of t skip locked
  loop
    select *
    into binding_record
    from private.phase11_http_worker_tasks
    where task_id = task_record.id;

    select *
    into run_record
    from private.pentest_runs
    where id = binding_record.run_id
      and workspace_id = binding_record.workspace_id
    for update;

    select *
    into action_record
    from private.pentest_actions
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id
    for update;

    select *
    into snapshot_record
    from private.pentest_run_authorization_snapshots
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and snapshot_ref = binding_record.authorization_snapshot_ref;

    effective_cancelled :=
      run_record.status = 'cancelled'
      or action_record.state = 'cancelled';

    update private.worker_tasks
    set state = case when effective_cancelled then 'cancelled' else 'dead_letter' end,
        updated_at = target_now
    where id = task_record.id
      and state in ('queued', 'retry_wait');

    if not found then
      continue;
    end if;

    insert into private.pentest_action_attempts (
      workspace_id,
      run_id,
      action_id,
      authorization_id,
      provider_id,
      provider_version,
      status,
      request_count,
      observation_ids,
      evidence_refs,
      started_at,
      completed_at,
      error_code
    ) values (
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.action_id,
      binding_record.authorization_id,
      binding_record.provider_id,
      binding_record.provider_version,
      case when effective_cancelled then 'cancelled' else 'blocked' end,
      0,
      '{}',
      '{}',
      binding_record.created_at,
      target_now,
      case when effective_cancelled then null else 'WORKER_CLASS_UNAVAILABLE' end
    );

    update private.pentest_actions
    set state = case when effective_cancelled then 'cancelled' else 'terminal' end,
        updated_at = target_now
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id
      and state in ('queued', 'cancelled');

    update public.pentest_action_summaries
    set state = case when effective_cancelled then 'cancelled' else 'terminal' end,
        updated_at = target_now
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id;

    perform private.record_worker_event(
      case when effective_cancelled then 'worker.cancelled' else 'worker.dead_lettered' end,
      binding_record.workspace_id,
      null,
      task_record.id,
      jsonb_build_object(
        'runId', binding_record.run_id,
        'actionId', binding_record.action_id,
        'executionClass', 'phase11_http_discovery_v1',
        'reason', case
          when effective_cancelled then 'phase11_cancel_before_claim'
          else 'phase11_deadline_or_authorization_before_claim'
        end
      )
    );

    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;

create or replace function private.recover_phase11_http_expired_worker_attempts(
  target_now timestamptz
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  attempt_record private.worker_attempts%rowtype;
  task_record private.worker_tasks%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  effective_cancelled boolean;
  recovered integer := 0;
begin
  for attempt_record in
    select attempt.*
    from private.worker_attempts attempt
    join private.worker_tasks task
      on task.id = attempt.task_id
    join private.phase11_http_worker_tasks binding
      on binding.task_id = task.id
    where task.execution_class = 'phase11_http_discovery_v1'
      and task.state = 'leased'
      and attempt.finished_at is null
      and attempt.lease_expires_at <= target_now
    order by attempt.lease_expires_at asc, attempt.id asc
    for update of attempt skip locked
  loop
    select *
    into task_record
    from private.worker_tasks
    where id = attempt_record.task_id
    for update;

    select *
    into binding_record
    from private.phase11_http_worker_tasks
    where task_id = task_record.id;

    select *
    into run_record
    from private.pentest_runs
    where id = binding_record.run_id
      and workspace_id = binding_record.workspace_id
    for update;

    select *
    into action_record
    from private.pentest_actions
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id
    for update;

    if task_record.state <> 'leased'
      or attempt_record.finished_at is not null
      or binding_record.task_id is null
      or run_record.id is null
      or action_record.action_id is null
    then
      continue;
    end if;

    effective_cancelled :=
      run_record.status = 'cancelled'
      or action_record.state = 'cancelled';

    update private.worker_attempts
    set finished_at = target_now,
        outcome = case when effective_cancelled then 'cancelled' else 'failed' end,
        failure_code = case
          when effective_cancelled then null
          else 'HTTP_DISCOVERY_TOTAL_TIMEOUT'
        end
    where id = attempt_record.id
      and finished_at is null;

    if not found then
      continue;
    end if;

    update private.worker_tasks
    set state = case when effective_cancelled then 'cancelled' else 'dead_letter' end,
        updated_at = target_now
    where id = task_record.id
      and state = 'leased';

    insert into private.pentest_action_attempts (
      id,
      workspace_id,
      run_id,
      action_id,
      authorization_id,
      provider_id,
      provider_version,
      status,
      request_count,
      observation_ids,
      evidence_refs,
      started_at,
      completed_at,
      error_code
    ) values (
      attempt_record.id,
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.action_id,
      binding_record.authorization_id,
      binding_record.provider_id,
      binding_record.provider_version,
      case when effective_cancelled then 'cancelled' else 'timed_out' end,
      least(action_record.max_requests, 12),
      '{}',
      '{}',
      attempt_record.leased_at,
      target_now,
      case when effective_cancelled then null else 'HTTP_DISCOVERY_TOTAL_TIMEOUT' end
    );

    perform private.apply_phase11_attempt_coverage(
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.action_id,
      case when effective_cancelled then 'cancelled' else 'timed_out' end,
      least(action_record.max_requests, 12),
      target_now
    );

    update private.pentest_actions
    set state = case when effective_cancelled then 'cancelled' else 'terminal' end,
        updated_at = target_now
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id
      and state in ('running', 'cancelled');

    update public.pentest_action_summaries
    set state = case when effective_cancelled then 'cancelled' else 'terminal' end,
        updated_at = target_now
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id;

    perform private.record_worker_event(
      case when effective_cancelled then 'worker.cancelled' else 'worker.dead_lettered' end,
      binding_record.workspace_id,
      attempt_record.worker_id,
      task_record.id,
      jsonb_build_object(
        'attemptId', attempt_record.id,
        'runId', binding_record.run_id,
        'actionId', binding_record.action_id,
        'executionClass', 'phase11_http_discovery_v1',
        'reason', case
          when effective_cancelled then 'phase11_lease_expired_after_cancel'
          else 'phase11_lease_expired'
        end
      )
    );

    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;


-- Reconcile graph writes with terminal-result counters so a stale graph snapshot
-- cannot roll back request/failure usage or previously covered nodes.
create or replace function public.persist_phase11_graph_state(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  node_rows jsonb,
  edge_rows jsonb,
  hypothesis_rows jsonb,
  coverage_row jsonb,
  event_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.pentest_runs%rowtype;
  node_row jsonb;
  edge_row jsonb;
  hypothesis_row jsonb;
  event_row jsonb;
  coverage_object jsonb;
  persisted_coverage private.pentest_coverage%rowtype;
  node_count integer;
  edge_count integer;
  hypothesis_count integer;
  event_count integer;
begin
  if node_rows is null
    or edge_rows is null
    or hypothesis_rows is null
    or coverage_row is null
    or event_rows is null
    or jsonb_typeof(node_rows) <> 'array'
    or jsonb_typeof(edge_rows) <> 'array'
    or jsonb_typeof(hypothesis_rows) <> 'array'
    or jsonb_typeof(coverage_row) <> 'object'
    or jsonb_typeof(event_rows) <> 'array'
  then
    raise exception 'PHASE11_GRAPH_PAYLOAD_INVALID';
  end if;

  node_count := jsonb_array_length(node_rows);
  edge_count := jsonb_array_length(edge_rows);
  hypothesis_count := jsonb_array_length(hypothesis_rows);
  event_count := jsonb_array_length(event_rows);

  if node_count > 1000 or edge_count > 2000 or hypothesis_count > 1000 or event_count > 500 then
    raise exception 'PHASE11_GRAPH_PAYLOAD_TOO_LARGE';
  end if;

  select *
  into run_record
  from private.pentest_runs
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'PHASE11_RUN_NOT_FOUND';
  end if;
  if run_record.authorization_snapshot_ref is distinct from target_authorization_snapshot_ref then
    raise exception 'PHASE11_AUTHORIZATION_SNAPSHOT_MISMATCH';
  end if;
  if run_record.status in ('completed', 'cancelled', 'failed') then
    raise exception 'PHASE11_RUN_TERMINAL';
  end if;

  for node_row in select value from jsonb_array_elements(node_rows)
  loop
    if coalesce(node_row->>'node_id', '') = ''
      or coalesce(node_row->>'asset_type', '') = ''
      or coalesce(node_row->>'canonical_locator', '') = ''
      or coalesce(node_row->>'authorization_ref', '') = ''
      or node_row->>'authorization_ref' <> target_authorization_snapshot_ref
      or jsonb_typeof(node_row->'parent_node_ids') <> 'array'
      or jsonb_typeof(node_row->'technology_tags') <> 'array'
      or jsonb_typeof(node_row->'provenance_refs') <> 'array'
      or jsonb_array_length(node_row->'provenance_refs') = 0
      or coalesce((node_row->>'confidence')::double precision, -1) < 0
      or coalesce((node_row->>'confidence')::double precision, 2) > 1
    then
      raise exception 'PHASE11_GRAPH_NODE_INVALID';
    end if;

    insert into private.pentest_graph_nodes (
      workspace_id, run_id, node_id, asset_type, canonical_locator,
      parent_node_ids, authorization_ref, technology_tags, confidence,
      provenance_refs, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      node_row->>'node_id',
      node_row->>'asset_type',
      node_row->>'canonical_locator',
      array(select jsonb_array_elements_text(node_row->'parent_node_ids')),
      node_row->>'authorization_ref',
      array(select jsonb_array_elements_text(node_row->'technology_tags')),
      (node_row->>'confidence')::double precision,
      array(select jsonb_array_elements_text(node_row->'provenance_refs')),
      now()
    )
    on conflict (workspace_id, run_id, node_id) do update
    set asset_type = excluded.asset_type,
        canonical_locator = excluded.canonical_locator,
        parent_node_ids = excluded.parent_node_ids,
        authorization_ref = excluded.authorization_ref,
        technology_tags = excluded.technology_tags,
        confidence = excluded.confidence,
        provenance_refs = excluded.provenance_refs,
        updated_at = excluded.updated_at;

    insert into public.pentest_graph_node_summaries (
      workspace_id, run_id, node_id, asset_type, parent_node_ids,
      technology_tags, confidence, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      node_row->>'node_id',
      node_row->>'asset_type',
      array(select jsonb_array_elements_text(node_row->'parent_node_ids')),
      array(select jsonb_array_elements_text(node_row->'technology_tags')),
      (node_row->>'confidence')::double precision,
      now()
    )
    on conflict (workspace_id, run_id, node_id) do update
    set asset_type = excluded.asset_type,
        parent_node_ids = excluded.parent_node_ids,
        technology_tags = excluded.technology_tags,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at;
  end loop;

  for edge_row in select value from jsonb_array_elements(edge_rows)
  loop
    if coalesce(edge_row->>'edge_id', '') = ''
      or coalesce(edge_row->>'from_node_id', '') = ''
      or coalesce(edge_row->>'to_node_id', '') = ''
      or coalesce(edge_row->>'relationship', '') = ''
      or coalesce(edge_row->>'provenance_kind', '') = ''
      or jsonb_typeof(edge_row->'provenance_refs') <> 'array'
      or jsonb_array_length(edge_row->'provenance_refs') = 0
      or coalesce(edge_row->>'authorization_ref', '') = ''
      or edge_row->>'authorization_ref' <> target_authorization_snapshot_ref
    then
      raise exception 'PHASE11_GRAPH_EDGE_INVALID';
    end if;

    insert into private.pentest_graph_edges (
      workspace_id, run_id, edge_id, from_node_id, to_node_id,
      relationship, provenance_kind, provenance_refs, confidence,
      observed_at, authorization_ref, stale, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      edge_row->>'edge_id',
      edge_row->>'from_node_id',
      edge_row->>'to_node_id',
      edge_row->>'relationship',
      edge_row->>'provenance_kind',
      array(select jsonb_array_elements_text(edge_row->'provenance_refs')),
      (edge_row->>'confidence')::double precision,
      (edge_row->>'observed_at')::timestamptz,
      edge_row->>'authorization_ref',
      (edge_row->>'stale')::boolean,
      now()
    )
    on conflict (workspace_id, run_id, edge_id) do update
    set from_node_id = excluded.from_node_id,
        to_node_id = excluded.to_node_id,
        relationship = excluded.relationship,
        provenance_kind = excluded.provenance_kind,
        provenance_refs = excluded.provenance_refs,
        confidence = excluded.confidence,
        observed_at = excluded.observed_at,
        authorization_ref = excluded.authorization_ref,
        stale = excluded.stale,
        updated_at = excluded.updated_at;

    insert into public.pentest_graph_edge_summaries (
      workspace_id, run_id, edge_id, from_node_id, to_node_id,
      relationship, confidence, stale, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      edge_row->>'edge_id',
      edge_row->>'from_node_id',
      edge_row->>'to_node_id',
      edge_row->>'relationship',
      (edge_row->>'confidence')::double precision,
      (edge_row->>'stale')::boolean,
      now()
    )
    on conflict (workspace_id, run_id, edge_id) do update
    set from_node_id = excluded.from_node_id,
        to_node_id = excluded.to_node_id,
        relationship = excluded.relationship,
        confidence = excluded.confidence,
        stale = excluded.stale,
        updated_at = excluded.updated_at;
  end loop;

  for hypothesis_row in select value from jsonb_array_elements(hypothesis_rows)
  loop
    if coalesce(hypothesis_row->>'hypothesis_id', '') = ''
      or coalesce(hypothesis_row->>'reasoning_source', '') = ''
      or coalesce(hypothesis_row->>'statement', '') = ''
      or jsonb_typeof(hypothesis_row->'target_node_ids') <> 'array'
      or jsonb_array_length(hypothesis_row->'target_node_ids') = 0
      or jsonb_typeof(hypothesis_row->'candidate_capability_ids') <> 'array'
      or jsonb_array_length(hypothesis_row->'candidate_capability_ids') = 0
      or jsonb_typeof(hypothesis_row->'expected_evidence_types') <> 'array'
      or jsonb_array_length(hypothesis_row->'expected_evidence_types') = 0
    then
      raise exception 'PHASE11_HYPOTHESIS_INVALID';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(hypothesis_row->'target_node_ids') target_node_id
      where not exists (
        select 1
        from private.pentest_graph_nodes graph_node
        where graph_node.workspace_id = target_workspace_id
          and graph_node.run_id = target_run_id
          and graph_node.node_id = target_node_id
      )
    ) then
      raise exception 'PHASE11_HYPOTHESIS_TARGET_UNKNOWN';
    end if;

    insert into private.pentest_hypotheses (
      workspace_id, run_id, hypothesis_id, reasoning_source,
      target_node_ids, statement, preconditions, candidate_capability_ids,
      expected_evidence_types, base_confidence, confidence, status,
      evidence_refs, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      hypothesis_row->>'hypothesis_id',
      hypothesis_row->>'reasoning_source',
      array(select jsonb_array_elements_text(hypothesis_row->'target_node_ids')),
      hypothesis_row->>'statement',
      array(select jsonb_array_elements_text(coalesce(hypothesis_row->'preconditions', '[]'::jsonb))),
      array(select jsonb_array_elements_text(hypothesis_row->'candidate_capability_ids')),
      array(select jsonb_array_elements_text(hypothesis_row->'expected_evidence_types')),
      (hypothesis_row->>'base_confidence')::double precision,
      (hypothesis_row->>'confidence')::double precision,
      hypothesis_row->>'status',
      array(select jsonb_array_elements_text(coalesce(hypothesis_row->'evidence_refs', '[]'::jsonb))),
      now()
    )
    on conflict (workspace_id, run_id, hypothesis_id) do update
    set reasoning_source = excluded.reasoning_source,
        target_node_ids = excluded.target_node_ids,
        statement = excluded.statement,
        preconditions = excluded.preconditions,
        candidate_capability_ids = excluded.candidate_capability_ids,
        expected_evidence_types = excluded.expected_evidence_types,
        base_confidence = excluded.base_confidence,
        confidence = excluded.confidence,
        status = excluded.status,
        evidence_refs = excluded.evidence_refs,
        updated_at = excluded.updated_at;

    insert into public.pentest_hypothesis_summaries (
      workspace_id, run_id, hypothesis_id, target_node_ids,
      candidate_capability_ids, confidence, status, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      hypothesis_row->>'hypothesis_id',
      array(select jsonb_array_elements_text(hypothesis_row->'target_node_ids')),
      array(select jsonb_array_elements_text(hypothesis_row->'candidate_capability_ids')),
      (hypothesis_row->>'confidence')::double precision,
      hypothesis_row->>'status',
      now()
    )
    on conflict (workspace_id, run_id, hypothesis_id) do update
    set target_node_ids = excluded.target_node_ids,
        candidate_capability_ids = excluded.candidate_capability_ids,
        confidence = excluded.confidence,
        status = excluded.status,
        updated_at = excluded.updated_at;
  end loop;

  coverage_object := coverage_row;
  insert into private.pentest_coverage as current (
    workspace_id, run_id, attempted_capability_ids, covered_node_ids,
    untested_node_ids, request_count, graph_expansion_count,
    provider_failure_count, started_at, deadline_at, updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    array(select jsonb_array_elements_text(coalesce(coverage_object->'attempted_capability_ids', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(coverage_object->'covered_node_ids', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(coverage_object->'untested_node_ids', '[]'::jsonb))),
    coalesce((coverage_object->>'request_count')::integer, 0),
    coalesce((coverage_object->>'graph_expansion_count')::integer, 0),
    coalesce((coverage_object->>'provider_failure_count')::integer, 0),
    (coverage_object->>'started_at')::timestamptz,
    (coverage_object->>'deadline_at')::timestamptz,
    now()
  )
  on conflict (workspace_id, run_id) do update
  set attempted_capability_ids = array(
        select distinct capability_id
        from unnest(
          current.attempted_capability_ids || excluded.attempted_capability_ids
        ) as capabilities(capability_id)
        order by capability_id
      ),
      covered_node_ids = array(
        select distinct node_id
        from unnest(
          current.covered_node_ids || excluded.covered_node_ids
        ) as covered(node_id)
        order by node_id
      ),
      untested_node_ids = array(
        select distinct node_id
        from unnest(
          current.untested_node_ids || excluded.untested_node_ids
        ) as untested(node_id)
        where not (
          node_id = any(
            array(
              select distinct covered_node_id
              from unnest(
                current.covered_node_ids || excluded.covered_node_ids
              ) as covered_nodes(covered_node_id)
            )
          )
        )
        order by node_id
      ),
      request_count = greatest(current.request_count, excluded.request_count),
      graph_expansion_count = greatest(
        current.graph_expansion_count,
        excluded.graph_expansion_count
      ),
      provider_failure_count = greatest(
        current.provider_failure_count,
        excluded.provider_failure_count
      ),
      started_at = current.started_at,
      deadline_at = current.deadline_at,
      updated_at = excluded.updated_at;

  select *
  into persisted_coverage
  from private.pentest_coverage
  where workspace_id = target_workspace_id
    and run_id = target_run_id;

  if persisted_coverage.run_id is null then
    raise exception 'PHASE11_COVERAGE_NOT_FOUND';
  end if;

  insert into public.pentest_coverage_summaries (
    workspace_id, run_id, attempted_capability_count, covered_node_count,
    untested_node_count, request_count, graph_expansion_count,
    provider_failure_count, started_at, deadline_at, updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    cardinality(persisted_coverage.attempted_capability_ids),
    cardinality(persisted_coverage.covered_node_ids),
    cardinality(persisted_coverage.untested_node_ids),
    persisted_coverage.request_count,
    persisted_coverage.graph_expansion_count,
    persisted_coverage.provider_failure_count,
    persisted_coverage.started_at,
    persisted_coverage.deadline_at,
    now()
  )
  on conflict (workspace_id, run_id) do update
  set attempted_capability_count = excluded.attempted_capability_count,
      covered_node_count = excluded.covered_node_count,
      untested_node_count = excluded.untested_node_count,
      request_count = excluded.request_count,
      graph_expansion_count = excluded.graph_expansion_count,
      provider_failure_count = excluded.provider_failure_count,
      started_at = excluded.started_at,
      deadline_at = excluded.deadline_at,
      updated_at = excluded.updated_at;

  for event_row in select value from jsonb_array_elements(event_rows)
  loop
    if coalesce(event_row->>'id', '') = ''
      or coalesce(event_row->>'event_type', '') = ''
      or jsonb_typeof(coalesce(event_row->'metadata', '{}'::jsonb)) <> 'object'
    then
      raise exception 'PHASE11_RUN_EVENT_INVALID';
    end if;

    insert into private.pentest_run_events (
      id, workspace_id, run_id, event_type, metadata, created_at
    )
    values (
      (event_row->>'id')::uuid,
      target_workspace_id,
      target_run_id,
      event_row->>'event_type',
      coalesce(event_row->'metadata', '{}'::jsonb),
      (event_row->>'created_at')::timestamptz
    )
    on conflict (id) do nothing;
  end loop;

  update private.pentest_runs
  set updated_at = now()
  where id = target_run_id and workspace_id = target_workspace_id;

  update public.pentest_run_summaries
  set updated_at = now()
  where run_id = target_run_id and workspace_id = target_workspace_id;

  return jsonb_build_object(
    'nodeCount', node_count,
    'edgeCount', edge_count,
    'hypothesisCount', hypothesis_count,
    'eventCount', event_count
  );
end;
$$;


  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into worker_record
  from private.worker_nodes
  where id = target_worker_id;

  select * into task_record
  from private.worker_tasks
  where id = target_task_id;

  select * into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id;

  select * into binding_record
  from private.phase11_http_worker_tasks
  where task_id = target_task_id;

  if worker_record.id is null
    or worker_record.disabled_at is not null
    or worker_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.id is null
    or task_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.workspace_id is distinct from binding_record.workspace_id
    or task_record.scan_job_id is not null
    or task_record.asset_id is not null
    or binding_record.task_id is null
    or attempt_record.id is null
    or attempt_record.worker_id is distinct from target_worker_id
    or attempt_record.lease_token_hash is distinct from calculated_hash
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is null
    and (task_record.state <> 'leased' or attempt_record.lease_expires_at <= lookup_now)
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into run_record
  from private.pentest_runs
  where id = binding_record.run_id
    and workspace_id = binding_record.workspace_id;

  select * into action_record
  from private.pentest_actions
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  if run_record.id is null
    or action_record.action_id is null
    or action_record.authorization_id is distinct from binding_record.authorization_id
    or run_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.capability_id is distinct from binding_record.capability_id
    or action_record.capability_version is distinct from binding_record.capability_version
    or cardinality(action_record.target_node_ids) <> 1
    or action_record.target_node_ids[1] is distinct from binding_record.target_node_id
    or action_record.requested_mode <> 'safe_active'
    or action_record.closed_parameters->>'discoveryProfile' not in ('root-only', 'well-known-safe')
  then
    raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
  end if;

  cancel_requested := run_record.status = 'cancelled' or action_record.state = 'cancelled';

  if attempt_record.finished_at is null and not cancel_requested then
    select * into snapshot_record
    from private.pentest_run_authorization_snapshots
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and snapshot_ref = binding_record.authorization_snapshot_ref;

    if run_record.status <> 'running'
      or action_record.state <> 'running'
      or action_record.decision_status not in ('approved', 'narrowed')
      or snapshot_record.snapshot_ref is null
      or snapshot_record.expires_at <= lookup_now
      or action_record.authorization_expires_at is null
      or action_record.authorization_expires_at <= lookup_now
      or action_record.authorization_expires_at > snapshot_record.expires_at
      or not (binding_record.target_node_id = any(snapshot_record.authorized_node_ids))
    then
      raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
    end if;
  end if;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'workspaceId', binding_record.workspace_id,
    'runId', binding_record.run_id,
    'actionId', binding_record.action_id,
    'authorizationId', binding_record.authorization_id,
    'authorizationSnapshotRef', binding_record.authorization_snapshot_ref,
    'targetNodeId', binding_record.target_node_id,
    'capabilityId', binding_record.capability_id,
    'providerId', binding_record.provider_id,
    'providerVersion', binding_record.provider_version,
    'discoveryProfile', action_record.closed_parameters->>'discoveryProfile',
    'maxRequests', least(action_record.max_requests, 12),
    'leasedAt', attempt_record.leased_at,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'cancelRequested', cancel_requested,
    'finishedAt', attempt_record.finished_at,
    'priorOutcome', attempt_record.outcome,
    'priorTerminalDigest', attempt_record.terminal_payload_digest
  );
end;
$;

revoke all on function public.get_phase11_http_worker_finalization_context(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_phase11_http_worker_finalization_context(uuid, uuid, uuid, text)
  to service_role;

create or replace function public.finalize_phase11_http_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_digest text,
  target_outcome text,
  target_failure_code text,
  target_request_count integer,
  target_metrics jsonb,
  observation_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  finalize_now timestamptz := clock_timestamp();
  calculated_hash text;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  observation_row jsonb;
  effective_outcome text;
  attempt_status text;
  observation_ids text[] := '{}';
  evidence_refs text[] := '{}';
begin
  if target_worker_id is null
    or target_task_id is null
    or target_attempt_id is null
    or target_lease_token is null
    or target_lease_token !~ '^[a-f0-9]{64}$'
    or target_terminal_digest is null
    or target_terminal_digest !~ '^[a-f0-9]{64}$'
    or target_outcome not in ('succeeded', 'failed', 'cancelled')
    or target_request_count is null
    or target_request_count < 0
    or target_request_count > 12
    or target_metrics is null
    or jsonb_typeof(target_metrics) <> 'object'
    or (select count(*) from jsonb_object_keys(target_metrics)) <> 5
    or not (target_metrics ?& array[
      'wallTimeMs', 'cpuTimeMs', 'peakMemoryBytes', 'inputBytes', 'outputBytes'
    ])
    or jsonb_typeof(target_metrics->'wallTimeMs') <> 'number'
    or (target_metrics->>'wallTimeMs')::numeric not between 0 and 30000
    or jsonb_typeof(target_metrics->'cpuTimeMs') <> 'number'
    or (target_metrics->>'cpuTimeMs')::numeric not between 0 and 15000
    or jsonb_typeof(target_metrics->'peakMemoryBytes') <> 'number'
    or (target_metrics->>'peakMemoryBytes')::numeric not between 0 and 268435456
    or jsonb_typeof(target_metrics->'inputBytes') <> 'number'
    or (target_metrics->>'inputBytes')::numeric not between 0 and 4096
    or jsonb_typeof(target_metrics->'outputBytes') <> 'number'
    or (target_metrics->>'outputBytes')::numeric not between 0 and 32768
    or observation_rows is null
    or jsonb_typeof(observation_rows) <> 'array'
    or jsonb_array_length(observation_rows) > 4
  then
    raise exception 'PHASE11_HTTP_TERMINAL_INVALID';
  end if;
  if target_outcome = 'failed' and target_failure_code not in (
    'WORKER_LOST', 'WORKER_BUDGET_EXCEEDED', 'WORKER_OUTPUT_INVALID',
    'WORKER_EXECUTION_FAILED', 'WORKER_CLASS_UNAVAILABLE',
    'RUNTIME_WORKER_AUTHORIZATION_FAILED', 'RUNTIME_WORKER_CANCELLED',
    'RUNTIME_WORKER_NETWORK_POLICY_FAILED', 'RUNTIME_WORKER_BUDGET_EXCEEDED',
    'RUNTIME_WORKER_OUTPUT_INVALID', 'RUNTIME_WORKER_EXECUTION_FAILED',
    'HTTP_DISCOVERY_REQUEST_BUDGET', 'HTTP_DISCOVERY_REQUEST_TIMEOUT',
    'HTTP_DISCOVERY_TOTAL_TIMEOUT', 'HTTP_DISCOVERY_NETWORK_ERROR',
    'HTTP_DISCOVERY_PROFILE_INVALID'
  ) then
    raise exception 'PHASE11_HTTP_FAILURE_CODE_INVALID';
  end if;
  if target_outcome <> 'failed' and target_failure_code is not null then
    raise exception 'PHASE11_HTTP_FAILURE_CODE_INVALID';
  end if;
  if target_outcome <> 'succeeded' and jsonb_array_length(observation_rows) <> 0 then
    raise exception 'PHASE11_HTTP_OBSERVATION_OUTCOME_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into task_record
  from private.worker_tasks
  where id = target_task_id
  for update;

  select * into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id
  for update;

  select * into binding_record
  from private.phase11_http_worker_tasks
  where task_id = target_task_id;

  if task_record.id is null
    or task_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.workspace_id is distinct from binding_record.workspace_id
    or binding_record.task_id is null
    or attempt_record.id is null
    or attempt_record.worker_id is distinct from target_worker_id
    or attempt_record.lease_token_hash is distinct from calculated_hash
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is not null then
    if attempt_record.terminal_payload_digest is distinct from target_terminal_digest
    then
      raise exception 'WORKER_TERMINAL_CONFLICT';
    end if;
    return jsonb_build_object('outcome', attempt_record.outcome, 'replayed', true);
  end if;

  if task_record.state <> 'leased'
    or task_record.absolute_deadline_at <= finalize_now
    or attempt_record.lease_expires_at <= finalize_now
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into run_record
  from private.pentest_runs
  where id = binding_record.run_id
    and workspace_id = binding_record.workspace_id
  for update;

  select * into action_record
  from private.pentest_actions
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id
  for update;

  if run_record.id is null
    or action_record.action_id is null
    or action_record.authorization_id is distinct from binding_record.authorization_id
    or run_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.capability_id is distinct from binding_record.capability_id
    or action_record.capability_version is distinct from binding_record.capability_version
    or cardinality(action_record.target_node_ids) <> 1
    or action_record.target_node_ids[1] is distinct from binding_record.target_node_id
    or action_record.requested_mode <> 'safe_active'
    or action_record.max_requests is null
    or target_request_count > action_record.max_requests
  then
    raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
  end if;

  if run_record.status = 'cancelled' or action_record.state = 'cancelled' then
    effective_outcome := 'cancelled';
  else
    effective_outcome := target_outcome;
    select * into snapshot_record
    from private.pentest_run_authorization_snapshots
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and snapshot_ref = binding_record.authorization_snapshot_ref;
    if run_record.status <> 'running'
      or action_record.state <> 'running'
      or action_record.decision_status not in ('approved', 'narrowed')
      or snapshot_record.snapshot_ref is null
      or snapshot_record.expires_at <= finalize_now
      or action_record.authorization_expires_at is null
      or action_record.authorization_expires_at <= finalize_now
      or action_record.authorization_expires_at > snapshot_record.expires_at
      or not (binding_record.target_node_id = any(snapshot_record.authorized_node_ids))
    then
      raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
    end if;
  end if;

  if effective_outcome <> 'succeeded' then
    -- Failed/cancelled execution must not erase already-consumed network
    -- budget. The trusted finalization layer sends either the observed count
    -- from a completed mediator result or the authorized max_requests as a
    -- conservative upper bound when the executor terminated before it could
    -- report an exact count.
    observation_rows := '[]'::jsonb;
  else
    for observation_row in select value from jsonb_array_elements(observation_rows)
    loop
      if observation_row->>'observation_id' !~ '^phase11-obs-http:[0-9a-f]{64}$'
        or observation_row->>'provider_id' <> binding_record.provider_id
        or observation_row->>'provider_version' <> binding_record.provider_version
        or observation_row->>'capability_id' <> binding_record.capability_id
        or observation_row->>'authorization_snapshot_ref' <> binding_record.authorization_snapshot_ref
        or observation_row->>'execution_mode' <> 'safe_active'
        or observation_row->'asset_node_ids' <> jsonb_build_array(binding_record.target_node_id)
        or jsonb_array_length(observation_row->'evidence_refs') <> 1
        or observation_row->'evidence_refs'->>0 !~
          ('^phase11-http-attempt:' || target_attempt_id::text || ':(root|security-txt|robots|sitemap)$')
      then
        raise exception 'PHASE11_HTTP_OBSERVATION_INVALID';
      end if;
      observation_ids := array_append(observation_ids, observation_row->>'observation_id');
      evidence_refs := array_append(evidence_refs, observation_row->'evidence_refs'->>0);
    end loop;

    perform public.persist_phase11_observations(
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.authorization_snapshot_ref,
      observation_rows
    );
  end if;

  attempt_status := case effective_outcome
    when 'succeeded' then case when cardinality(observation_ids) = 0 then 'no_signal' else 'succeeded' end
    when 'cancelled' then 'cancelled'
    else 'provider_failed'
  end;

  insert into private.pentest_action_attempts (
    id, workspace_id, run_id, action_id, authorization_id,
    provider_id, provider_version, status, request_count, observation_ids, evidence_refs,
    started_at, completed_at, error_code
  ) values (
    attempt_record.id, binding_record.workspace_id, binding_record.run_id,
    binding_record.action_id, binding_record.authorization_id,
    binding_record.provider_id, binding_record.provider_version, attempt_status,
    target_request_count, observation_ids, evidence_refs, attempt_record.leased_at, finalize_now,
    case when effective_outcome = 'failed' then target_failure_code else null end
  );

  perform private.apply_phase11_attempt_coverage(
    binding_record.workspace_id,
    binding_record.run_id,
    binding_record.action_id,
    attempt_status,
    target_request_count,
    finalize_now
  );

  update private.worker_attempts
  set finished_at = finalize_now,
      outcome = effective_outcome,
      failure_code = case when effective_outcome = 'failed' then target_failure_code else null end,
      terminal_payload_digest = target_terminal_digest,
      wall_time_ms = (target_metrics->>'wallTimeMs')::integer,
      cpu_time_ms = (target_metrics->>'cpuTimeMs')::integer,
      peak_memory_bytes = (target_metrics->>'peakMemoryBytes')::bigint,
      input_bytes = (target_metrics->>'inputBytes')::bigint,
      output_bytes = (target_metrics->>'outputBytes')::bigint
  where id = attempt_record.id;

  update private.worker_tasks
  set state = case effective_outcome when 'succeeded' then 'completed' when 'cancelled' then 'cancelled' else 'dead_letter' end,
      updated_at = finalize_now
  where id = task_record.id;

  update private.pentest_actions
  set state = case when effective_outcome = 'cancelled' then 'cancelled' else 'terminal' end,
      updated_at = finalize_now
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  update public.pentest_action_summaries
  set state = case when effective_outcome = 'cancelled' then 'cancelled' else 'terminal' end,
      updated_at = finalize_now
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  perform private.record_worker_event(
    'worker.task_terminal',
    binding_record.workspace_id,
    target_worker_id,
    task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'outcome', effective_outcome,
      'executionClass', task_record.execution_class,
      'requestCount', target_request_count,
      'observationCount', cardinality(observation_ids)
    )
  );

  return jsonb_build_object('outcome', effective_outcome, 'replayed', false);
end;
$$;

revoke all on function public.finalize_phase11_http_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_phase11_http_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, jsonb, jsonb
) to service_role;


-- Phase 11 HTTP tasks intentionally have no scan_job row. Replace the shared
-- heartbeat with a class-aware implementation so legacy workers preserve their
-- existing scan-job cancellation semantics while Phase 11 cancellation and
-- authorization expiry are derived only from trusted Phase 11 state.

create or replace function private.recover_phase11_http_unleased_worker_tasks(
  target_now timestamptz
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  effective_cancelled boolean;
  recovered integer := 0;
begin
  for task_record in
    select t.*
    from private.worker_tasks t
    join private.phase11_http_worker_tasks binding
      on binding.task_id = t.id
     and binding.workspace_id = t.workspace_id
    join private.pentest_actions action
      on action.workspace_id = binding.workspace_id
     and action.run_id = binding.run_id
     and action.action_id = binding.action_id
    join private.pentest_runs run
      on run.id = binding.run_id
     and run.workspace_id = binding.workspace_id
    left join private.pentest_run_authorization_snapshots snapshot
      on snapshot.workspace_id = binding.workspace_id
     and snapshot.run_id = binding.run_id
     and snapshot.snapshot_ref = binding.authorization_snapshot_ref
    where t.execution_class = 'phase11_http_discovery_v1'
      and t.state in ('queued', 'retry_wait')
      and (
        run.status <> 'running'
        or action.state <> 'queued'
        or t.absolute_deadline_at <= target_now
        or snapshot.snapshot_ref is null
        or snapshot.expires_at <= target_now
        or action.authorization_expires_at is null
        or action.authorization_expires_at <= target_now
      )
    order by t.absolute_deadline_at asc, t.id asc
    for update of t skip locked
  loop
    select *
    into binding_record
    from private.phase11_http_worker_tasks
    where task_id = task_record.id;

    select *
    into run_record
    from private.pentest_runs
    where id = binding_record.run_id
      and workspace_id = binding_record.workspace_id
    for update;

    select *
    into action_record
    from private.pentest_actions
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id
    for update;

    select *
    into snapshot_record
    from private.pentest_run_authorization_snapshots
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and snapshot_ref = binding_record.authorization_snapshot_ref;

    effective_cancelled :=
      run_record.status = 'cancelled'
      or action_record.state = 'cancelled';

    update private.worker_tasks
    set state = case when effective_cancelled then 'cancelled' else 'dead_letter' end,
        updated_at = target_now
    where id = task_record.id
      and state in ('queued', 'retry_wait');

    if not found then
      continue;
    end if;

    insert into private.pentest_action_attempts (
      workspace_id,
      run_id,
      action_id,
      authorization_id,
      provider_id,
      provider_version,
      status,
      request_count,
      observation_ids,
      evidence_refs,
      started_at,
      completed_at,
      error_code
    ) values (
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.action_id,
      binding_record.authorization_id,
      binding_record.provider_id,
      binding_record.provider_version,
      case when effective_cancelled then 'cancelled' else 'blocked' end,
      0,
      '{}',
      '{}',
      binding_record.created_at,
      target_now,
      case when effective_cancelled then null else 'WORKER_CLASS_UNAVAILABLE' end
    );

    update private.pentest_actions
    set state = case when effective_cancelled then 'cancelled' else 'terminal' end,
        updated_at = target_now
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id
      and state in ('queued', 'cancelled');

    update public.pentest_action_summaries
    set state = case when effective_cancelled then 'cancelled' else 'terminal' end,
        updated_at = target_now
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id;

    perform private.record_worker_event(
      case when effective_cancelled then 'worker.cancelled' else 'worker.dead_lettered' end,
      binding_record.workspace_id,
      null,
      task_record.id,
      jsonb_build_object(
        'runId', binding_record.run_id,
        'actionId', binding_record.action_id,
        'executionClass', 'phase11_http_discovery_v1',
        'reason', case
          when effective_cancelled then 'phase11_cancel_before_claim'
          else 'phase11_deadline_or_authorization_before_claim'
        end
      )
    );

    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;

create or replace function private.recover_phase11_http_expired_worker_attempts(
  target_now timestamptz
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  attempt_record private.worker_attempts%rowtype;
  task_record private.worker_tasks%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  effective_cancelled boolean;
  recovered integer := 0;
begin
  for attempt_record in
    select attempt.*
    from private.worker_attempts attempt
    join private.worker_tasks task
      on task.id = attempt.task_id
    join private.phase11_http_worker_tasks binding
      on binding.task_id = task.id
    where task.execution_class = 'phase11_http_discovery_v1'
      and task.state = 'leased'
      and attempt.finished_at is null
      and attempt.lease_expires_at <= target_now
    order by attempt.lease_expires_at asc, attempt.id asc
    for update of attempt skip locked
  loop
    select *
    into task_record
    from private.worker_tasks
    where id = attempt_record.task_id
    for update;

    select *
    into binding_record
    from private.phase11_http_worker_tasks
    where task_id = task_record.id;

    select *
    into run_record
    from private.pentest_runs
    where id = binding_record.run_id
      and workspace_id = binding_record.workspace_id
    for update;

    select *
    into action_record
    from private.pentest_actions
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id
    for update;

    if task_record.state <> 'leased'
      or attempt_record.finished_at is not null
      or binding_record.task_id is null
      or run_record.id is null
      or action_record.action_id is null
    then
      continue;
    end if;

    effective_cancelled :=
      run_record.status = 'cancelled'
      or action_record.state = 'cancelled';

    update private.worker_attempts
    set finished_at = target_now,
        outcome = case when effective_cancelled then 'cancelled' else 'failed' end,
        failure_code = case
          when effective_cancelled then null
          else 'HTTP_DISCOVERY_TOTAL_TIMEOUT'
        end
    where id = attempt_record.id
      and finished_at is null;

    if not found then
      continue;
    end if;

    update private.worker_tasks
    set state = case when effective_cancelled then 'cancelled' else 'dead_letter' end,
        updated_at = target_now
    where id = task_record.id
      and state = 'leased';

    insert into private.pentest_action_attempts (
      id,
      workspace_id,
      run_id,
      action_id,
      authorization_id,
      provider_id,
      provider_version,
      status,
      request_count,
      observation_ids,
      evidence_refs,
      started_at,
      completed_at,
      error_code
    ) values (
      attempt_record.id,
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.action_id,
      binding_record.authorization_id,
      binding_record.provider_id,
      binding_record.provider_version,
      case when effective_cancelled then 'cancelled' else 'timed_out' end,
      least(action_record.max_requests, 12),
      '{}',
      '{}',
      attempt_record.leased_at,
      target_now,
      case when effective_cancelled then null else 'HTTP_DISCOVERY_TOTAL_TIMEOUT' end
    );

    perform private.apply_phase11_attempt_coverage(
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.action_id,
      case when effective_cancelled then 'cancelled' else 'timed_out' end,
      least(action_record.max_requests, 12),
      target_now
    );

    update private.pentest_actions
    set state = case when effective_cancelled then 'cancelled' else 'terminal' end,
        updated_at = target_now
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id
      and state in ('running', 'cancelled');

    update public.pentest_action_summaries
    set state = case when effective_cancelled then 'cancelled' else 'terminal' end,
        updated_at = target_now
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and action_id = binding_record.action_id;

    perform private.record_worker_event(
      case when effective_cancelled then 'worker.cancelled' else 'worker.dead_lettered' end,
      binding_record.workspace_id,
      attempt_record.worker_id,
      task_record.id,
      jsonb_build_object(
        'attemptId', attempt_record.id,
        'runId', binding_record.run_id,
        'actionId', binding_record.action_id,
        'executionClass', 'phase11_http_discovery_v1',
        'reason', case
          when effective_cancelled then 'phase11_lease_expired_after_cancel'
          else 'phase11_lease_expired'
        end
      )
    );

    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;


-- Reconcile graph writes with terminal-result counters so a stale graph snapshot
-- cannot roll back request/failure usage or previously covered nodes.
create or replace function public.persist_phase11_graph_state(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  node_rows jsonb,
  edge_rows jsonb,
  hypothesis_rows jsonb,
  coverage_row jsonb,
  event_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.pentest_runs%rowtype;
  node_row jsonb;
  edge_row jsonb;
  hypothesis_row jsonb;
  event_row jsonb;
  coverage_object jsonb;
  persisted_coverage private.pentest_coverage%rowtype;
  node_count integer;
  edge_count integer;
  hypothesis_count integer;
  event_count integer;
begin
  if node_rows is null
    or edge_rows is null
    or hypothesis_rows is null
    or coverage_row is null
    or event_rows is null
    or jsonb_typeof(node_rows) <> 'array'
    or jsonb_typeof(edge_rows) <> 'array'
    or jsonb_typeof(hypothesis_rows) <> 'array'
    or jsonb_typeof(coverage_row) <> 'object'
    or jsonb_typeof(event_rows) <> 'array'
  then
    raise exception 'PHASE11_GRAPH_PAYLOAD_INVALID';
  end if;

  node_count := jsonb_array_length(node_rows);
  edge_count := jsonb_array_length(edge_rows);
  hypothesis_count := jsonb_array_length(hypothesis_rows);
  event_count := jsonb_array_length(event_rows);

  if node_count > 1000 or edge_count > 2000 or hypothesis_count > 1000 or event_count > 500 then
    raise exception 'PHASE11_GRAPH_PAYLOAD_TOO_LARGE';
  end if;

  select *
  into run_record
  from private.pentest_runs
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'PHASE11_RUN_NOT_FOUND';
  end if;
  if run_record.authorization_snapshot_ref is distinct from target_authorization_snapshot_ref then
    raise exception 'PHASE11_AUTHORIZATION_SNAPSHOT_MISMATCH';
  end if;
  if run_record.status in ('completed', 'cancelled', 'failed') then
    raise exception 'PHASE11_RUN_TERMINAL';
  end if;

  for node_row in select value from jsonb_array_elements(node_rows)
  loop
    if coalesce(node_row->>'node_id', '') = ''
      or coalesce(node_row->>'asset_type', '') = ''
      or coalesce(node_row->>'canonical_locator', '') = ''
      or coalesce(node_row->>'authorization_ref', '') = ''
      or node_row->>'authorization_ref' <> target_authorization_snapshot_ref
      or jsonb_typeof(node_row->'parent_node_ids') <> 'array'
      or jsonb_typeof(node_row->'technology_tags') <> 'array'
      or jsonb_typeof(node_row->'provenance_refs') <> 'array'
      or jsonb_array_length(node_row->'provenance_refs') = 0
      or coalesce((node_row->>'confidence')::double precision, -1) < 0
      or coalesce((node_row->>'confidence')::double precision, 2) > 1
    then
      raise exception 'PHASE11_GRAPH_NODE_INVALID';
    end if;

    insert into private.pentest_graph_nodes (
      workspace_id, run_id, node_id, asset_type, canonical_locator,
      parent_node_ids, authorization_ref, technology_tags, confidence,
      provenance_refs, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      node_row->>'node_id',
      node_row->>'asset_type',
      node_row->>'canonical_locator',
      array(select jsonb_array_elements_text(node_row->'parent_node_ids')),
      node_row->>'authorization_ref',
      array(select jsonb_array_elements_text(node_row->'technology_tags')),
      (node_row->>'confidence')::double precision,
      array(select jsonb_array_elements_text(node_row->'provenance_refs')),
      now()
    )
    on conflict (workspace_id, run_id, node_id) do update
    set asset_type = excluded.asset_type,
        canonical_locator = excluded.canonical_locator,
        parent_node_ids = excluded.parent_node_ids,
        authorization_ref = excluded.authorization_ref,
        technology_tags = excluded.technology_tags,
        confidence = excluded.confidence,
        provenance_refs = excluded.provenance_refs,
        updated_at = excluded.updated_at;

    insert into public.pentest_graph_node_summaries (
      workspace_id, run_id, node_id, asset_type, parent_node_ids,
      technology_tags, confidence, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      node_row->>'node_id',
      node_row->>'asset_type',
      array(select jsonb_array_elements_text(node_row->'parent_node_ids')),
      array(select jsonb_array_elements_text(node_row->'technology_tags')),
      (node_row->>'confidence')::double precision,
      now()
    )
    on conflict (workspace_id, run_id, node_id) do update
    set asset_type = excluded.asset_type,
        parent_node_ids = excluded.parent_node_ids,
        technology_tags = excluded.technology_tags,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at;
  end loop;

  for edge_row in select value from jsonb_array_elements(edge_rows)
  loop
    if coalesce(edge_row->>'edge_id', '') = ''
      or coalesce(edge_row->>'from_node_id', '') = ''
      or coalesce(edge_row->>'to_node_id', '') = ''
      or coalesce(edge_row->>'relationship', '') = ''
      or coalesce(edge_row->>'provenance_kind', '') = ''
      or jsonb_typeof(edge_row->'provenance_refs') <> 'array'
      or jsonb_array_length(edge_row->'provenance_refs') = 0
      or coalesce(edge_row->>'authorization_ref', '') = ''
      or edge_row->>'authorization_ref' <> target_authorization_snapshot_ref
    then
      raise exception 'PHASE11_GRAPH_EDGE_INVALID';
    end if;

    insert into private.pentest_graph_edges (
      workspace_id, run_id, edge_id, from_node_id, to_node_id,
      relationship, provenance_kind, provenance_refs, confidence,
      observed_at, authorization_ref, stale, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      edge_row->>'edge_id',
      edge_row->>'from_node_id',
      edge_row->>'to_node_id',
      edge_row->>'relationship',
      edge_row->>'provenance_kind',
      array(select jsonb_array_elements_text(edge_row->'provenance_refs')),
      (edge_row->>'confidence')::double precision,
      (edge_row->>'observed_at')::timestamptz,
      edge_row->>'authorization_ref',
      (edge_row->>'stale')::boolean,
      now()
    )
    on conflict (workspace_id, run_id, edge_id) do update
    set from_node_id = excluded.from_node_id,
        to_node_id = excluded.to_node_id,
        relationship = excluded.relationship,
        provenance_kind = excluded.provenance_kind,
        provenance_refs = excluded.provenance_refs,
        confidence = excluded.confidence,
        observed_at = excluded.observed_at,
        authorization_ref = excluded.authorization_ref,
        stale = excluded.stale,
        updated_at = excluded.updated_at;

    insert into public.pentest_graph_edge_summaries (
      workspace_id, run_id, edge_id, from_node_id, to_node_id,
      relationship, confidence, stale, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      edge_row->>'edge_id',
      edge_row->>'from_node_id',
      edge_row->>'to_node_id',
      edge_row->>'relationship',
      (edge_row->>'confidence')::double precision,
      (edge_row->>'stale')::boolean,
      now()
    )
    on conflict (workspace_id, run_id, edge_id) do update
    set from_node_id = excluded.from_node_id,
        to_node_id = excluded.to_node_id,
        relationship = excluded.relationship,
        confidence = excluded.confidence,
        stale = excluded.stale,
        updated_at = excluded.updated_at;
  end loop;

  for hypothesis_row in select value from jsonb_array_elements(hypothesis_rows)
  loop
    if coalesce(hypothesis_row->>'hypothesis_id', '') = ''
      or coalesce(hypothesis_row->>'reasoning_source', '') = ''
      or coalesce(hypothesis_row->>'statement', '') = ''
      or jsonb_typeof(hypothesis_row->'target_node_ids') <> 'array'
      or jsonb_array_length(hypothesis_row->'target_node_ids') = 0
      or jsonb_typeof(hypothesis_row->'candidate_capability_ids') <> 'array'
      or jsonb_array_length(hypothesis_row->'candidate_capability_ids') = 0
      or jsonb_typeof(hypothesis_row->'expected_evidence_types') <> 'array'
      or jsonb_array_length(hypothesis_row->'expected_evidence_types') = 0
    then
      raise exception 'PHASE11_HYPOTHESIS_INVALID';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(hypothesis_row->'target_node_ids') target_node_id
      where not exists (
        select 1
        from private.pentest_graph_nodes graph_node
        where graph_node.workspace_id = target_workspace_id
          and graph_node.run_id = target_run_id
          and graph_node.node_id = target_node_id
      )
    ) then
      raise exception 'PHASE11_HYPOTHESIS_TARGET_UNKNOWN';
    end if;

    insert into private.pentest_hypotheses (
      workspace_id, run_id, hypothesis_id, reasoning_source,
      target_node_ids, statement, preconditions, candidate_capability_ids,
      expected_evidence_types, base_confidence, confidence, status,
      evidence_refs, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      hypothesis_row->>'hypothesis_id',
      hypothesis_row->>'reasoning_source',
      array(select jsonb_array_elements_text(hypothesis_row->'target_node_ids')),
      hypothesis_row->>'statement',
      array(select jsonb_array_elements_text(coalesce(hypothesis_row->'preconditions', '[]'::jsonb))),
      array(select jsonb_array_elements_text(hypothesis_row->'candidate_capability_ids')),
      array(select jsonb_array_elements_text(hypothesis_row->'expected_evidence_types')),
      (hypothesis_row->>'base_confidence')::double precision,
      (hypothesis_row->>'confidence')::double precision,
      hypothesis_row->>'status',
      array(select jsonb_array_elements_text(coalesce(hypothesis_row->'evidence_refs', '[]'::jsonb))),
      now()
    )
    on conflict (workspace_id, run_id, hypothesis_id) do update
    set reasoning_source = excluded.reasoning_source,
        target_node_ids = excluded.target_node_ids,
        statement = excluded.statement,
        preconditions = excluded.preconditions,
        candidate_capability_ids = excluded.candidate_capability_ids,
        expected_evidence_types = excluded.expected_evidence_types,
        base_confidence = excluded.base_confidence,
        confidence = excluded.confidence,
        status = excluded.status,
        evidence_refs = excluded.evidence_refs,
        updated_at = excluded.updated_at;

    insert into public.pentest_hypothesis_summaries (
      workspace_id, run_id, hypothesis_id, target_node_ids,
      candidate_capability_ids, confidence, status, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      hypothesis_row->>'hypothesis_id',
      array(select jsonb_array_elements_text(hypothesis_row->'target_node_ids')),
      array(select jsonb_array_elements_text(hypothesis_row->'candidate_capability_ids')),
      (hypothesis_row->>'confidence')::double precision,
      hypothesis_row->>'status',
      now()
    )
    on conflict (workspace_id, run_id, hypothesis_id) do update
    set target_node_ids = excluded.target_node_ids,
        candidate_capability_ids = excluded.candidate_capability_ids,
        confidence = excluded.confidence,
        status = excluded.status,
        updated_at = excluded.updated_at;
  end loop;

  coverage_object := coverage_row;
  insert into private.pentest_coverage as current (
    workspace_id, run_id, attempted_capability_ids, covered_node_ids,
    untested_node_ids, request_count, graph_expansion_count,
    provider_failure_count, started_at, deadline_at, updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    array(select jsonb_array_elements_text(coalesce(coverage_object->'attempted_capability_ids', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(coverage_object->'covered_node_ids', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(coverage_object->'untested_node_ids', '[]'::jsonb))),
    coalesce((coverage_object->>'request_count')::integer, 0),
    coalesce((coverage_object->>'graph_expansion_count')::integer, 0),
    coalesce((coverage_object->>'provider_failure_count')::integer, 0),
    (coverage_object->>'started_at')::timestamptz,
    (coverage_object->>'deadline_at')::timestamptz,
    now()
  )
  on conflict (workspace_id, run_id) do update
  set attempted_capability_ids = array(
        select distinct capability_id
        from unnest(
          current.attempted_capability_ids || excluded.attempted_capability_ids
        ) as capabilities(capability_id)
        order by capability_id
      ),
      covered_node_ids = array(
        select distinct node_id
        from unnest(
          current.covered_node_ids || excluded.covered_node_ids
        ) as covered(node_id)
        order by node_id
      ),
      untested_node_ids = array(
        select distinct node_id
        from unnest(
          current.untested_node_ids || excluded.untested_node_ids
        ) as untested(node_id)
        where not (
          node_id = any(
            array(
              select distinct covered_node_id
              from unnest(
                current.covered_node_ids || excluded.covered_node_ids
              ) as covered_nodes(covered_node_id)
            )
          )
        )
        order by node_id
      ),
      request_count = greatest(current.request_count, excluded.request_count),
      graph_expansion_count = greatest(
        current.graph_expansion_count,
        excluded.graph_expansion_count
      ),
      provider_failure_count = greatest(
        current.provider_failure_count,
        excluded.provider_failure_count
      ),
      started_at = current.started_at,
      deadline_at = current.deadline_at,
      updated_at = excluded.updated_at;

  select *
  into persisted_coverage
  from private.pentest_coverage
  where workspace_id = target_workspace_id
    and run_id = target_run_id;

  if persisted_coverage.run_id is null then
    raise exception 'PHASE11_COVERAGE_NOT_FOUND';
  end if;

  insert into public.pentest_coverage_summaries (
    workspace_id, run_id, attempted_capability_count, covered_node_count,
    untested_node_count, request_count, graph_expansion_count,
    provider_failure_count, started_at, deadline_at, updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    cardinality(persisted_coverage.attempted_capability_ids),
    cardinality(persisted_coverage.covered_node_ids),
    cardinality(persisted_coverage.untested_node_ids),
    persisted_coverage.request_count,
    persisted_coverage.graph_expansion_count,
    persisted_coverage.provider_failure_count,
    persisted_coverage.started_at,
    persisted_coverage.deadline_at,
    now()
  )
  on conflict (workspace_id, run_id) do update
  set attempted_capability_count = excluded.attempted_capability_count,
      covered_node_count = excluded.covered_node_count,
      untested_node_count = excluded.untested_node_count,
      request_count = excluded.request_count,
      graph_expansion_count = excluded.graph_expansion_count,
      provider_failure_count = excluded.provider_failure_count,
      started_at = excluded.started_at,
      deadline_at = excluded.deadline_at,
      updated_at = excluded.updated_at;

  for event_row in select value from jsonb_array_elements(event_rows)
  loop
    if coalesce(event_row->>'id', '') = ''
      or coalesce(event_row->>'event_type', '') = ''
      or jsonb_typeof(coalesce(event_row->'metadata', '{}'::jsonb)) <> 'object'
    then
      raise exception 'PHASE11_RUN_EVENT_INVALID';
    end if;

    insert into private.pentest_run_events (
      id, workspace_id, run_id, event_type, metadata, created_at
    )
    values (
      (event_row->>'id')::uuid,
      target_workspace_id,
      target_run_id,
      event_row->>'event_type',
      coalesce(event_row->'metadata', '{}'::jsonb),
      (event_row->>'created_at')::timestamptz
    )
    on conflict (id) do nothing;
  end loop;

  update private.pentest_runs
  set updated_at = now()
  where id = target_run_id and workspace_id = target_workspace_id;

  update public.pentest_run_summaries
  set updated_at = now()
  where run_id = target_run_id and workspace_id = target_workspace_id;

  return jsonb_build_object(
    'nodeCount', node_count,
    'edgeCount', edge_count,
    'hypothesisCount', hypothesis_count,
    'eventCount', event_count
  );
end;
$$;


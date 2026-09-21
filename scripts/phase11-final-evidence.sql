-- Phase 11 final production canary evidence and acceptance query.
-- Read-only. Do not modify or delete any canary rows.
-- Run only after the single authenticated final canary has been queued.
--
-- The three known failed canaries are excluded explicitly. If new_canary_count
-- is not exactly 1, do not queue another canary.

with new_canaries as (
  select
    p11.task_id,
    p11.workspace_id,
    p11.run_id,
    p11.action_id,
    p11.authorization_id,
    p11.authorization_snapshot_ref,
    p11.target_node_id,
    p11.capability_id,
    p11.capability_version,
    p11.provider_id,
    p11.provider_version,
    p11.created_at as phase11_task_created_at,
    wt.state as worker_task_state,
    wt.attempt_count,
    wt.max_attempts,
    wt.available_at,
    wt.absolute_deadline_at,
    wt.updated_at as worker_task_updated_at
  from private.phase11_http_worker_tasks p11
  join private.worker_tasks wt on wt.id = p11.task_id
  where p11.run_id not in (
    'bbd5c0cd-717c-4ee3-a5a6-c1028331f5b4'::uuid,
    'dd90af93-9f9e-4168-8a2a-067302210f85'::uuid,
    '3a96f604-857c-4a36-8d23-3c2127ab08de'::uuid
  )
),
final_canary as (
  select *
  from new_canaries
  order by phase11_task_created_at desc
  limit 1
),
run_row as (
  select r.*
  from private.pentest_runs r
  join final_canary c on c.run_id = r.id
),
action_row as (
  select a.*
  from private.pentest_actions a
  join final_canary c on c.run_id = a.run_id and c.action_id = a.action_id
),
worker_attempt_rows as (
  select wa.*
  from private.worker_attempts wa
  join final_canary c on c.task_id = wa.task_id
),
action_attempt_rows as (
  select paa.*
  from private.pentest_action_attempts paa
  join final_canary c on c.run_id = paa.run_id and c.action_id = paa.action_id
),
coverage_row as (
  select pc.*
  from private.pentest_coverage pc
  join final_canary c on c.run_id = pc.run_id
),
observation_rows as (
  select po.*
  from private.pentest_observations po
  join final_canary c on c.run_id = po.run_id
),
active_count as (
  select count(*)::integer as value
  from private.worker_tasks wt
  join private.phase11_http_worker_tasks p11 on p11.task_id = wt.id
  where wt.state in ('queued', 'retry_wait', 'leased')
),
checks as (
  select
    (select count(*) = 1 from new_canaries) as exactly_one_new_canary,
    coalesce((select worker_task_state = 'completed' from final_canary), false) as task_completed,
    (
      select count(*) = 1
        and bool_and(outcome = 'succeeded')
        and bool_and(failure_code is null)
        and bool_and(finished_at is not null)
      from worker_attempt_rows
    ) as worker_attempt_succeeded,
    (
      select count(*) = 1
        and bool_and(status in ('succeeded', 'no_signal'))
        and bool_and(error_code is null)
        and bool_and(request_count = 1)
        and bool_and(completed_at is not null)
      from action_attempt_rows
    ) as action_attempt_accepted,
    coalesce((
      select state = 'terminal'
        and decision_status in ('approved', 'narrowed')
        and max_requests = 1
        and max_runtime_ms = 5000
      from action_row
    ), false) as action_terminal_and_bounded,
    coalesce((
      select status = 'completed'
      from run_row
    ), false) as run_completed,
    coalesce((
      select request_count = 1
        and provider_failure_count = 0
      from coverage_row
    ), false) as coverage_exact,
    (
      select case
        when aa.status = 'no_signal' then (select count(*) = 0 from observation_rows)
        when aa.status = 'succeeded' then (select count(*) between 1 and 4 from observation_rows)
        else false
      end
      from action_attempt_rows aa
      limit 1
    ) as observation_consistent,
    (select value = 0 from active_count) as no_active_phase11_tasks
),
verdict as (
  select
    *,
    (
      exactly_one_new_canary
      and task_completed
      and worker_attempt_succeeded
      and action_attempt_accepted
      and action_terminal_and_bounded
      and run_completed
      and coverage_exact
      and coalesce(observation_consistent, false)
      and no_active_phase11_tasks
    ) as acceptance_ready
  from checks
)
select jsonb_build_object(
  'acceptance_ready', (select acceptance_ready from verdict),
  'acceptance_checks', (select to_jsonb(v) - 'acceptance_ready' from verdict v),
  'new_canary_count', (select count(*) from new_canaries),
  'phase11_task', (select to_jsonb(c) from final_canary c),
  'run', (select to_jsonb(r) from run_row r),
  'action', (select to_jsonb(a) from action_row a),
  'worker_attempts', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
    from (
      select
        wa.id,
        wa.task_id,
        wa.attempt_number,
        wa.worker_id,
        wa.leased_at,
        wa.lease_expires_at,
        wa.last_heartbeat_at,
        wa.finished_at,
        wa.outcome,
        wa.failure_code,
        wa.terminal_payload_digest,
        wa.wall_time_ms,
        wa.cpu_time_ms,
        wa.peak_memory_bytes,
        wa.input_bytes,
        wa.output_bytes,
        wa.created_at
      from worker_attempt_rows wa
    ) x
  ),
  'action_attempts', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
    from (
      select
        paa.id,
        paa.run_id,
        paa.action_id,
        paa.authorization_id,
        paa.provider_id,
        paa.provider_version,
        paa.status,
        paa.observation_ids,
        paa.evidence_refs,
        paa.started_at,
        paa.completed_at,
        paa.error_code,
        paa.request_count,
        paa.created_at
      from action_attempt_rows paa
    ) x
  ),
  'coverage', (select to_jsonb(pc) from coverage_row pc),
  'observations', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
    from (
      select
        po.observation_id,
        po.run_id,
        po.provider_id,
        po.provider_version,
        po.capability_id,
        po.asset_node_ids,
        po.evidence_refs,
        po.observed_at,
        po.confidence,
        po.authorization_snapshot_ref,
        po.execution_mode,
        po.created_at
      from observation_rows po
    ) x
  ),
  'worker', (
    select jsonb_build_object(
      'id', wn.id,
      'execution_class', wn.execution_class,
      'software_version', wn.software_version,
      'last_seen_at', wn.last_seen_at,
      'disabled_at', wn.disabled_at
    )
    from private.worker_nodes wn
    where wn.id = 'cd9a7769-e21f-4f75-84c3-ffe2d1f4616e'::uuid
  ),
  'active_phase11_task_count', (select value from active_count)
) as final_phase11_canary_evidence;

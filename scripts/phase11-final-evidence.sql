-- Phase 11 final production canary evidence query.
-- Read-only. Do not modify or delete any canary rows.
-- Run only after the single authenticated final canary has been queued.
--
-- The three known failed canaries are excluded explicitly so this query selects
-- only the new closure canary. If it returns no row, do not queue a second canary.

with final_canary as (
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
  order by p11.created_at desc
  limit 1
)
select jsonb_build_object(
  'phase11_task', (select to_jsonb(c) from final_canary c),
  'run', (
    select to_jsonb(r)
    from private.pentest_runs r
    join final_canary c on c.run_id = r.id
  ),
  'action', (
    select to_jsonb(a)
    from private.pentest_actions a
    join final_canary c on c.run_id = a.run_id and c.action_id = a.action_id
  ),
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
      from private.worker_attempts wa
      join final_canary c on c.task_id = wa.task_id
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
      from private.pentest_action_attempts paa
      join final_canary c on c.run_id = paa.run_id and c.action_id = paa.action_id
    ) x
  ),
  'coverage', (
    select to_jsonb(pc)
    from private.pentest_coverage pc
    join final_canary c on c.run_id = pc.run_id
  ),
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
      from private.pentest_observations po
      join final_canary c on c.run_id = po.run_id
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
  'active_phase11_task_count', (
    select count(*)
    from private.worker_tasks wt
    join private.phase11_http_worker_tasks p11 on p11.task_id = wt.id
    where wt.state in ('queued', 'retry_wait', 'leased')
  )
) as final_phase11_canary_evidence;

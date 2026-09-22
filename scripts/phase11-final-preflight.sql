-- Phase 11 final production canary preflight.
-- Read-only. Run before the single authenticated canary click.
-- Expected closure-ready state:
--   worker.disabled_at IS NULL
--   phase11_task_count = 5
--   active_phase11_task_count = 0
--   historical_runs contains exactly the five preserved terminal canaries
--   eligible_target is ScopeForge Production at https://scopeforge.dev

select jsonb_build_object(
  'worker', (
    select jsonb_build_object(
      'id', id,
      'execution_class', execution_class,
      'software_version', software_version,
      'last_seen_at', last_seen_at,
      'disabled_at', disabled_at
    )
    from private.worker_nodes
    where id = 'cd9a7769-e21f-4f75-84c3-ffe2d1f4616e'::uuid
  ),
  'phase11_task_count', (
    select count(*)
    from private.phase11_http_worker_tasks
  ),
  'active_phase11_task_count', (
    select count(*)
    from private.worker_tasks wt
    join private.phase11_http_worker_tasks p11 on p11.task_id = wt.id
    where wt.state in ('queued', 'retry_wait', 'leased')
  ),
  'historical_runs', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'run_id', p11.run_id,
          'task_id', p11.task_id,
          'task_state', wt.state,
          'action_id', p11.action_id,
          'created_at', p11.created_at
        )
        order by p11.created_at
      ),
      '[]'::jsonb
    )
    from private.phase11_http_worker_tasks p11
    join private.worker_tasks wt on wt.id = p11.task_id
  ),
  'eligible_target', (
    select to_jsonb(x)
    from (
      select
        id,
        workspace_id,
        kind,
        name,
        canonical_target,
        verification_status,
        verified_at
      from public.assets
      where kind::text in ('web_application', 'api')
        and verification_status::text = 'verified'
        and canonical_target = 'https://scopeforge.dev'
      order by updated_at desc
      limit 1
    ) x
  )
) as phase11_final_preflight;

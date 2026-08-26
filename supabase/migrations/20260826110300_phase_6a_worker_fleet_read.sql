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
begin
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

  return jsonb_build_object(
    'generatedAt', now(),
    'nodes', node_rows,
    'taskCounts', state_counts,
    'activeLeaseCount', active_leases
  );
end;
$$;

revoke all on function public.get_worker_fleet_snapshot() from public, anon, authenticated;
grant execute on function public.get_worker_fleet_snapshot() to service_role;

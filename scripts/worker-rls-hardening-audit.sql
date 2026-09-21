-- ScopeForge private worker-table RLS hardening audit.
-- Read-only. This file intentionally does not enable RLS or create policies.
-- Use it before designing any defense-in-depth migration for the nine private
-- worker/runtime tables currently flagged by the Supabase security advisor.

with target_tables(table_name) as (
  values
    ('worker_nodes'),
    ('worker_tasks'),
    ('worker_attempts'),
    ('worker_events'),
    ('repository_snapshot_tasks'),
    ('repository_snapshot_attempt_uploads'),
    ('repository_source_artifacts'),
    ('repository_scan_tasks'),
    ('runtime_worker_tasks')
)
select
  c.relname as table_name,
  pg_get_userbyid(c.relowner) as owner,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('grantee', g.grantee, 'privilege', g.privilege_type)
      order by g.grantee, g.privilege_type
    )
    from information_schema.role_table_grants g
    where g.table_schema = 'private'
      and g.table_name = c.relname
  ), '[]'::jsonb) as grants,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('name', p.policyname, 'cmd', p.cmd, 'roles', p.roles)
      order by p.policyname
    )
    from pg_policies p
    where p.schemaname = 'private'
      and p.tablename = c.relname
  ), '[]'::jsonb) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join target_tables t on t.table_name = c.relname
where n.nspname = 'private'
  and c.relkind = 'r'
order by c.relname;

select
  routine_schema,
  routine_name,
  security_type
from information_schema.routines
where routine_schema in ('public', 'private')
  and security_type = 'DEFINER'
  and (
    routine_definition ilike '%private.worker_nodes%'
    or routine_definition ilike '%private.worker_tasks%'
    or routine_definition ilike '%private.worker_attempts%'
    or routine_definition ilike '%private.worker_events%'
    or routine_definition ilike '%private.repository_snapshot_tasks%'
    or routine_definition ilike '%private.repository_snapshot_attempt_uploads%'
    or routine_definition ilike '%private.repository_source_artifacts%'
    or routine_definition ilike '%private.repository_scan_tasks%'
    or routine_definition ilike '%private.runtime_worker_tasks%'
  )
order by routine_schema, routine_name;

create or replace function public.mark_connected_project_scan_waiting(
  target_snapshot_task_id uuid,
  target_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  continuation jsonb;
  target_link_id uuid;
begin
  continuation := public.get_connected_project_snapshot_continuation(
    target_snapshot_task_id,
    target_snapshot_id
  );
  if continuation is null then
    return null;
  end if;
  target_link_id := (continuation->>'linkId')::uuid;

  update private.github_project_scan_intents
     set snapshot_id = target_snapshot_id,
         state = 'waiting_scan_runtime',
         last_error_code = null
   where link_id = target_link_id
     and snapshot_task_id = target_snapshot_task_id
     and state <> 'scan_queued'
     and scan_task_id is null;

  if not found then
    return jsonb_build_object('state', 'scan_queued');
  end if;

  update public.github_repository_links
     set project_scan_state = 'waiting_scan_runtime'
   where id = target_link_id
     and workspace_id = (continuation->>'workspaceId')::uuid
     and project_scan_state <> 'scan_queued';

  return jsonb_build_object('state', 'waiting_scan_runtime');
end;
$$;

revoke all on function public.mark_connected_project_scan_waiting(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mark_connected_project_scan_waiting(uuid, uuid)
  to service_role;

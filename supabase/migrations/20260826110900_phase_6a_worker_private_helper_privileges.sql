revoke all on function private.record_worker_event(text, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.recover_expired_unleased_worker_tasks(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.guard_worker_node_update()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_worker_task_update()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_worker_attempt_update()
  from public, anon, authenticated, service_role;

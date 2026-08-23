revoke all on function public.record_audit_event(uuid, text, text, uuid, jsonb) from public;
revoke all on function public.record_audit_event(uuid, text, text, uuid, jsonb) from anon;
revoke all on function public.record_audit_event(uuid, text, text, uuid, jsonb) from authenticated;
drop function public.record_audit_event(uuid, text, text, uuid, jsonb);

create policy audit_events_insert_actor_bound on public.audit_events
for insert to authenticated
with check (
  actor_type = 'user'::public.audit_actor_type
  and actor_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

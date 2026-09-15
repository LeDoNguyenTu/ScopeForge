-- Phase 10A3 release hardening: bound webhook replay metadata growth.
-- GitHub exposes manual redelivery for the past three days. Retain seven days
-- so ordinary and delayed redeliveries remain idempotent with a safety margin.

create or replace function public.admit_github_webhook_delivery(
  target_delivery_id uuid,
  target_event_name text,
  target_action text,
  target_installation_id bigint,
  target_repository_id bigint,
  target_push_after_sha text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admitted_id uuid;
begin
  if target_delivery_id is null
     or target_event_name is null
     or char_length(target_event_name) not between 1 and 64
     or target_event_name !~ '^[a-z][a-z0-9_]*$'
     or (target_action is not null and (
       char_length(target_action) not between 1 and 64
       or target_action !~ '^[A-Za-z0-9_.-]+$'
     ))
     or (target_installation_id is not null and target_installation_id <= 0)
     or (target_repository_id is not null and target_repository_id <= 0)
     or (target_push_after_sha is not null and target_push_after_sha !~ '^[a-f0-9]{40}$') then
    raise exception 'GITHUB_WEBHOOK_DELIVERY_INVALID';
  end if;

  -- The received_at index makes this rolling cleanup proportional to expired
  -- replay rows. With cleanup on every accepted request, storage cannot grow
  -- indefinitely after the retention window passes.
  delete from private.github_webhook_deliveries
   where received_at < now() - interval '7 days';

  insert into private.github_webhook_deliveries (
    delivery_id, event_name, action, installation_id, repository_id,
    push_after_sha, processing_state, received_at
  ) values (
    target_delivery_id, target_event_name, target_action, target_installation_id,
    target_repository_id, target_push_after_sha, 'received', now()
  )
  on conflict (delivery_id) do nothing
  returning delivery_id into admitted_id;

  if admitted_id is null then
    return jsonb_build_object(
      'admitted', false,
      'replayed', true,
      'deliveryId', target_delivery_id
    );
  end if;

  return jsonb_build_object(
    'admitted', true,
    'replayed', false,
    'deliveryId', admitted_id
  );
end;
$$;

revoke all on function public.admit_github_webhook_delivery(uuid, text, text, bigint, bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admit_github_webhook_delivery(uuid, text, text, bigint, bigint, text)
  to service_role;

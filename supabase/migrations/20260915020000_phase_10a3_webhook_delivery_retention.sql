-- Phase 10A3 release hardening: retain the minimum delivery identity forever
-- while pruning detailed webhook metadata after seven days. GitHub does not
-- authenticate X-GitHub-Delivery, so this ledger is defense in depth only;
-- destructive lifecycle events are independently revalidated with GitHub.

create table private.github_webhook_delivery_receipts (
  delivery_id uuid primary key
);

alter table private.github_webhook_delivery_receipts enable row level security;
revoke all on table private.github_webhook_delivery_receipts
  from public, anon, authenticated, service_role;

insert into private.github_webhook_delivery_receipts (delivery_id)
select delivery_id from private.github_webhook_deliveries
on conflict (delivery_id) do nothing;

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

  insert into private.github_webhook_delivery_receipts (delivery_id)
  values (target_delivery_id)
  on conflict (delivery_id) do nothing
  returning delivery_id into admitted_id;

  if admitted_id is null then
    return jsonb_build_object(
      'admitted', false,
      'replayed', true,
      'deliveryId', target_delivery_id
    );
  end if;

  -- Keep richer operational metadata bounded. The receipt above is not
  -- deleted, so an exact delivery UUID can never become admissible again.
  delete from private.github_webhook_deliveries
   where received_at < now() - interval '7 days';

  insert into private.github_webhook_deliveries (
    delivery_id, event_name, action, installation_id, repository_id,
    push_after_sha, processing_state, received_at
  ) values (
    target_delivery_id, target_event_name, target_action, target_installation_id,
    target_repository_id, target_push_after_sha, 'received', now()
  )
  returning delivery_id into admitted_id;

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

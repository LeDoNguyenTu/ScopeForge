-- Phase 11A run-orchestration hardening.
-- Forward-only. Depends on 20260918070000_phase_11a_run_orchestration.sql.
-- This migration remains source-only until the separate Phase 11 production rollout gate.

alter table private.pentest_actions
  add constraint pentest_actions_stable_action_id_check
    check (action_id ~ '^phase11-action:[0-9a-f]{64}$'),
  add constraint pentest_actions_stable_authorization_id_check
    check (authorization_id is null or authorization_id ~ '^phase11-authz:[0-9a-f]{64}$'),
  add constraint pentest_actions_stable_cancellation_key_check
    check (cancellation_key is null or cancellation_key ~ '^phase11-cancel:[0-9a-f]{64}$');

alter table private.pentest_action_attempts
  add constraint pentest_action_attempts_stable_authorization_id_check
    check (authorization_id ~ '^phase11-authz:[0-9a-f]{64}$');

alter table public.pentest_action_summaries
  add constraint pentest_action_summaries_stable_action_id_check
    check (action_id ~ '^phase11-action:[0-9a-f]{64}$');

create or replace function public.mark_phase11_action_queued(
  target_workspace_id uuid,
  target_run_id uuid,
  target_action_id text,
  target_enqueue_token uuid,
  target_queue_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_record private.pentest_actions%rowtype;
begin
  if target_queue_reference is null or char_length(target_queue_reference) not between 1 and 1024 then
    raise exception 'PHASE11_ACTION_QUEUE_REFERENCE_INVALID';
  end if;

  select *
  into action_record
  from private.pentest_actions
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
  for update;

  if not found then
    raise exception 'PHASE11_ACTION_NOT_FOUND';
  end if;

  if action_record.state = 'queued' and action_record.queue_reference = target_queue_reference then
    return jsonb_build_object(
      'actionId', target_action_id,
      'replayed', true,
      'cancelled', false
    );
  end if;

  if action_record.state = 'cancelled' then
    if action_record.queue_reference = target_queue_reference then
      return jsonb_build_object(
        'actionId', target_action_id,
        'replayed', true,
        'cancelled', true
      );
    end if;

    if action_record.queue_reference is not null
      or action_record.enqueue_token is distinct from target_enqueue_token
    then
      raise exception 'PHASE11_ACTION_ENQUEUE_RESERVATION_INVALID';
    end if;

    update private.pentest_actions
    set queue_reference = target_queue_reference,
        enqueue_token = null,
        updated_at = now()
    where workspace_id = target_workspace_id
      and run_id = target_run_id
      and action_id = target_action_id;

    return jsonb_build_object(
      'actionId', target_action_id,
      'replayed', false,
      'cancelled', true
    );
  end if;

  if action_record.state <> 'enqueueing'
    or action_record.enqueue_token is distinct from target_enqueue_token
  then
    raise exception 'PHASE11_ACTION_ENQUEUE_RESERVATION_INVALID';
  end if;

  update private.pentest_actions
  set state = 'queued',
      queue_reference = target_queue_reference,
      enqueue_token = null,
      updated_at = now()
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;

  update public.pentest_action_summaries
  set state = 'queued',
      updated_at = now()
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;

  return jsonb_build_object(
    'actionId', target_action_id,
    'replayed', false,
    'cancelled', false
  );
end;
$$;

create or replace function public.release_phase11_action_enqueue(
  target_workspace_id uuid,
  target_run_id uuid,
  target_action_id text,
  target_enqueue_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_record private.pentest_actions%rowtype;
begin
  select *
  into action_record
  from private.pentest_actions
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
  for update;

  if not found then
    raise exception 'PHASE11_ACTION_NOT_FOUND';
  end if;

  if action_record.state = 'cancelled' then
    if action_record.enqueue_token is null then
      return;
    end if;
    if action_record.enqueue_token is distinct from target_enqueue_token then
      raise exception 'PHASE11_ACTION_ENQUEUE_RESERVATION_INVALID';
    end if;
    update private.pentest_actions
    set enqueue_token = null,
        updated_at = now()
    where workspace_id = target_workspace_id
      and run_id = target_run_id
      and action_id = target_action_id;
    return;
  end if;

  if action_record.state <> 'enqueueing'
    or action_record.enqueue_token is distinct from target_enqueue_token
  then
    raise exception 'PHASE11_ACTION_ENQUEUE_RESERVATION_INVALID';
  end if;

  update private.pentest_actions
  set state = 'authorized',
      enqueue_token = null,
      updated_at = now()
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;

  update public.pentest_action_summaries
  set state = 'authorized',
      updated_at = now()
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;
end;
$$;

create or replace function public.cancel_phase11_pentest_run(
  target_workspace_id uuid,
  target_run_id uuid,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.workspace_role;
  run_record private.pentest_runs%rowtype;
  was_cancelled boolean := false;
  queue_rows jsonb;
begin
  select role
  into actor_role
  from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = target_actor_id;

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'PHASE11_RUN_CANCEL_FORBIDDEN';
  end if;

  select *
  into run_record
  from private.pentest_runs
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'PHASE11_RUN_NOT_FOUND';
  end if;

  if run_record.status in ('completed', 'failed') then
    raise exception 'PHASE11_RUN_TERMINAL';
  end if;

  if run_record.status <> 'cancelled' then
    update private.pentest_runs
    set status = 'cancelled',
        stop_reason = 'cancelled',
        updated_at = now()
    where id = target_run_id and workspace_id = target_workspace_id;

    update public.pentest_run_summaries
    set status = 'cancelled',
        stop_reason = 'cancelled',
        updated_at = now()
    where run_id = target_run_id and workspace_id = target_workspace_id;

    update private.pentest_actions
    set state = 'cancelled',
        enqueue_token = case when state = 'enqueueing' then enqueue_token else null end,
        updated_at = now()
    where workspace_id = target_workspace_id
      and run_id = target_run_id
      and state not in ('terminal', 'rejected', 'cancelled');

    update public.pentest_action_summaries
    set state = 'cancelled',
        updated_at = now()
    where workspace_id = target_workspace_id
      and run_id = target_run_id
      and state not in ('terminal', 'rejected', 'cancelled');

    was_cancelled := true;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'actionId', action.action_id,
    'queueReference', action.queue_reference
  ) order by action.action_id), '[]'::jsonb)
  into queue_rows
  from private.pentest_actions action
  where action.workspace_id = target_workspace_id
    and action.run_id = target_run_id
    and action.state = 'cancelled'
    and action.queue_reference is not null;

  return jsonb_build_object(
    'runId', target_run_id,
    'cancelled', true,
    'replayed', not was_cancelled,
    'activeQueues', queue_rows
  );
end;
$$;

create or replace function public.stop_phase11_pentest_run(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_stop_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
  run_record private.pentest_runs%rowtype;
begin
  perform private.assert_phase11_run_scope(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_stop_reason not in (
    'cancelled', 'deadline_reached', 'request_budget_exhausted',
    'graph_expansion_limit', 'provider_failure_limit', 'no_eligible_hypotheses',
    'approval_required', 'authorization_expired', 'coverage_complete'
  ) then
    raise exception 'PHASE11_STOP_REASON_INVALID';
  end if;

  select *
  into run_record
  from private.pentest_runs
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;

  if run_record.status in ('completed', 'cancelled', 'failed') then
    return;
  end if;

  next_status := case
    when target_stop_reason = 'cancelled' then 'cancelled'
    when target_stop_reason = 'approval_required' then 'waiting_approval'
    when target_stop_reason in ('coverage_complete', 'no_eligible_hypotheses') then 'completed'
    else 'failed'
  end;

  update private.pentest_runs
  set status = next_status,
      stop_reason = target_stop_reason,
      updated_at = now()
  where id = target_run_id
    and workspace_id = target_workspace_id;

  update public.pentest_run_summaries
  set status = next_status,
      stop_reason = target_stop_reason,
      updated_at = now()
  where run_id = target_run_id
    and workspace_id = target_workspace_id;
end;
$$;

revoke all on function public.mark_phase11_action_queued(uuid, uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_phase11_action_queued(uuid, uuid, text, uuid, text)
  to service_role;

revoke all on function public.release_phase11_action_enqueue(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.release_phase11_action_enqueue(uuid, uuid, text, uuid)
  to service_role;

revoke all on function public.cancel_phase11_pentest_run(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_phase11_pentest_run(uuid, uuid, uuid)
  to service_role;

revoke all on function public.stop_phase11_pentest_run(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.stop_phase11_pentest_run(uuid, uuid, text, text)
  to service_role;

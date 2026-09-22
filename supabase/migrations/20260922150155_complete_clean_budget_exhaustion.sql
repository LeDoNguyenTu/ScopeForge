-- A clean request-budget exhaustion is the expected terminal state for a
-- bounded run that consumed its authorized requests successfully. Provider
-- failures are prioritized by evaluateStopConditions before this RPC is
-- called, so the failure stop reason remains fail-closed.
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
    when target_stop_reason in (
      'coverage_complete',
      'no_eligible_hypotheses',
      'request_budget_exhausted'
    ) then 'completed'
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

revoke all on function public.stop_phase11_pentest_run(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.stop_phase11_pentest_run(uuid, uuid, text, text)
  to service_role;

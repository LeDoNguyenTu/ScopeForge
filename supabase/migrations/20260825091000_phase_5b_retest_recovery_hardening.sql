alter table public.security_finding_retests
  add constraint security_finding_retests_source_snapshot_check
  check (
    (
      execution_kind = 'passive_runtime'
      and source_id = 'scopeforge:runtime-observer'
      and source_version is not distinct from '0.1'
    )
    or (
      execution_kind = 'active_validation'
      and source_id = 'scopeforge:runtime-validator'
      and source_version is not distinct from 'cors-origin-policy@1'
    )
  );

create or replace function private.recover_security_finding_after_unverified_retest()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recovered_finding_id text;
begin
  if old.status in ('requested', 'running')
     and new.status in ('still_present', 'inconclusive', 'failed', 'cancelled')
     and new.status is distinct from old.status then
    update public.security_findings
       set lifecycle_state = 'in_progress',
           updated_at = now()
     where workspace_id = new.workspace_id
       and finding_id = new.finding_id
       and lifecycle_state = 'retest_pending'
    returning finding_id into recovered_finding_id;

    if recovered_finding_id is not null then
      insert into public.security_finding_events (
        workspace_id,
        finding_id,
        scan_job_id,
        actor_type,
        actor_id,
        event_type,
        from_lifecycle,
        to_lifecycle,
        reason,
        metadata
      ) values (
        new.workspace_id,
        new.finding_id,
        new.scan_job_id,
        'system',
        null,
        'finding.lifecycle_changed',
        'retest_pending',
        'in_progress',
        'Deterministic retest completed without a verified fix',
        jsonb_build_object(
          'retest_id', new.id,
          'retest_status', new.status,
          'result_code', new.result_code
        )
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger security_finding_retests_recover_unverified_finding
after update of status on public.security_finding_retests
for each row execute function private.recover_security_finding_after_unverified_retest();

create or replace function public.abort_security_finding_retest_before_start(
  target_workspace_id uuid,
  target_retest_id uuid,
  target_actor_id uuid
)
returns public.security_finding_retests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  current_retest public.security_finding_retests%rowtype;
  current_finding public.security_findings%rowtype;
  aborted_retest public.security_finding_retests%rowtype;
begin
  select role::text
    into actor_role
    from public.workspace_members
   where workspace_id = target_workspace_id
     and user_id = target_actor_id
     and role::text in ('owner', 'admin', 'member', 'viewer');

  if actor_role is null or actor_role = 'viewer' then
    raise exception 'SECURITY_RETEST_FORBIDDEN';
  end if;

  select *
    into current_retest
    from public.security_finding_retests
   where id = target_retest_id
     and workspace_id = target_workspace_id
   for update;

  if current_retest.id is null then
    raise exception 'SECURITY_RETEST_NOT_AVAILABLE';
  end if;

  if current_retest.requested_by is distinct from target_actor_id then
    raise exception 'SECURITY_RETEST_FORBIDDEN';
  end if;

  if current_retest.execution_kind = 'active_validation'
     and actor_role not in ('owner', 'admin') then
    raise exception 'SECURITY_RETEST_FORBIDDEN';
  end if;

  if current_retest.status <> 'requested'
     or current_retest.scan_job_id is not null
     or current_retest.started_at is not null
     or current_retest.completed_at is not null then
    raise exception 'SECURITY_RETEST_FINALIZATION_INVALID';
  end if;

  select *
    into current_finding
    from public.security_findings
   where workspace_id = target_workspace_id
     and finding_id = current_retest.finding_id
   for update;

  if current_finding.finding_id is null
     or current_finding.asset_id is distinct from current_retest.asset_id
     or current_finding.lifecycle_state <> 'retest_pending' then
    raise exception 'SECURITY_RETEST_FINALIZATION_INVALID';
  end if;

  update public.security_finding_retests
     set status = 'failed',
         result_code = 'enqueue_failed',
         completed_at = now()
   where id = current_retest.id
     and workspace_id = target_workspace_id
  returning * into aborted_retest;

  insert into public.security_finding_events (
    workspace_id,
    finding_id,
    scan_job_id,
    actor_type,
    actor_id,
    event_type,
    from_lifecycle,
    to_lifecycle,
    reason,
    metadata
  ) values (
    target_workspace_id,
    current_retest.finding_id,
    null,
    'system',
    null,
    'finding.retest_completed',
    null,
    null,
    null,
    jsonb_build_object(
      'retest_id', current_retest.id,
      'status', 'failed',
      'result_code', 'enqueue_failed'
    )
  );

  return aborted_retest;
end;
$$;

revoke all on function public.abort_security_finding_retest_before_start(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.abort_security_finding_retest_before_start(uuid, uuid, uuid)
  to service_role;

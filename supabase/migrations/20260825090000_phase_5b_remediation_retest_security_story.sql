create table public.security_finding_work (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null,
  assignee_user_id uuid references auth.users(id) on delete set null,
  remediation_note text check (
    remediation_note is null or char_length(remediation_note) <= 2000
  ),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, finding_id),
  constraint security_finding_work_finding_fkey
    foreign key (workspace_id, finding_id)
    references public.security_findings(workspace_id, finding_id)
    on delete cascade
);

create table public.security_finding_retests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null,
  asset_id uuid not null,
  requested_by uuid not null references auth.users(id),
  execution_kind text not null check (
    execution_kind in ('passive_runtime', 'active_validation')
  ),
  source_id text not null check (char_length(source_id) between 1 and 256),
  source_version text check (source_version is null or char_length(source_version) <= 128),
  rule_ref text not null check (char_length(rule_ref) between 1 and 512),
  validation_profile_id text check (
    validation_profile_id is null or char_length(validation_profile_id) <= 128
  ),
  validation_profile_version integer,
  active_consent_granted_at timestamptz,
  status text not null default 'requested' check (
    status in ('requested', 'running', 'still_present', 'verified_fixed', 'inconclusive', 'failed', 'cancelled')
  ),
  scan_job_id uuid,
  result_code text check (result_code is null or char_length(result_code) <= 100),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint security_finding_retests_finding_fkey
    foreign key (workspace_id, finding_id)
    references public.security_findings(workspace_id, finding_id)
    on delete cascade,
  constraint security_finding_retests_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  constraint security_finding_retests_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id),
  constraint security_finding_retests_execution_snapshot_check check (
    (
      execution_kind = 'passive_runtime'
      and validation_profile_id is null
      and validation_profile_version is null
      and active_consent_granted_at is null
    )
    or (
      execution_kind = 'active_validation'
      and validation_profile_id = 'cors-origin-policy'
      and validation_profile_version = 1
      and active_consent_granted_at is not null
    )
  ),
  constraint security_finding_retests_timestamps_check check (
    (
      status = 'requested'
      and scan_job_id is null
      and started_at is null
      and completed_at is null
    )
    or (
      status = 'running'
      and scan_job_id is not null
      and started_at is not null
      and completed_at is null
    )
    or (
      status in ('still_present', 'verified_fixed', 'inconclusive', 'failed', 'cancelled')
      and completed_at is not null
    )
  ),
  constraint security_finding_retests_time_order_check check (
    (started_at is null or started_at >= requested_at)
    and (completed_at is null or completed_at >= requested_at)
    and (completed_at is null or started_at is null or completed_at >= started_at)
  )
);

create unique index security_finding_retests_one_active_per_finding
  on public.security_finding_retests(workspace_id, finding_id)
  where status in ('requested', 'running');

create index security_finding_retests_workspace_finding_requested_idx
  on public.security_finding_retests(workspace_id, finding_id, requested_at desc);
create index security_finding_retests_asset_workspace_idx
  on public.security_finding_retests(asset_id, workspace_id);
create index security_finding_retests_job_workspace_asset_idx
  on public.security_finding_retests(scan_job_id, workspace_id, asset_id)
  where scan_job_id is not null;
create index security_finding_retests_requested_by_idx
  on public.security_finding_retests(requested_by);
create index security_finding_work_assignee_user_idx
  on public.security_finding_work(assignee_user_id)
  where assignee_user_id is not null;
create index security_finding_work_updated_by_idx
  on public.security_finding_work(updated_by);

-- Cover Phase 5A foreign keys reported by the production Supabase advisor.
create index security_findings_asset_workspace_fk_idx
  on public.security_findings(asset_id, workspace_id);
create index security_evidence_asset_workspace_fk_idx
  on public.security_evidence(asset_id, workspace_id);
create index security_finding_occurrences_asset_workspace_fk_idx
  on public.security_finding_occurrences(asset_id, workspace_id);
create index security_finding_events_actor_id_fk_idx
  on public.security_finding_events(actor_id)
  where actor_id is not null;

create or replace function private.guard_security_finding_retest_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.finding_id is distinct from old.finding_id
     or new.asset_id is distinct from old.asset_id
     or new.requested_by is distinct from old.requested_by
     or new.execution_kind is distinct from old.execution_kind
     or new.source_id is distinct from old.source_id
     or new.source_version is distinct from old.source_version
     or new.rule_ref is distinct from old.rule_ref
     or new.validation_profile_id is distinct from old.validation_profile_id
     or new.validation_profile_version is distinct from old.validation_profile_version
     or new.active_consent_granted_at is distinct from old.active_consent_granted_at
     or new.requested_at is distinct from old.requested_at then
    raise exception 'Retest execution snapshot fields are immutable';
  end if;

  return new;
end;
$$;

create trigger security_finding_retests_guard_update
before update on public.security_finding_retests
for each row execute function private.guard_security_finding_retest_update();

alter table public.security_finding_events
  drop constraint if exists security_finding_events_event_type_check;

alter table public.security_finding_events
  add constraint security_finding_events_event_type_check check (
    char_length(event_type) between 1 and 100
    and event_type in (
      'finding.created',
      'finding.reobserved',
      'finding.lifecycle_changed',
      'finding.reopened',
      'finding.assignment_changed',
      'finding.remediation_note_updated',
      'finding.retest_requested',
      'finding.retest_started',
      'finding.retest_completed'
    )
  );

alter table public.security_finding_work enable row level security;
alter table public.security_finding_retests enable row level security;

create policy security_finding_work_select_member on public.security_finding_work
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_finding_retests_select_member on public.security_finding_retests
for select to authenticated using (private.is_workspace_member(workspace_id));

revoke all on table public.security_finding_work from anon, authenticated;
revoke all on table public.security_finding_retests from anon, authenticated;

grant select on table public.security_finding_work to authenticated;
grant select on table public.security_finding_retests to authenticated;

create or replace function public.change_security_finding_work(
  target_workspace_id uuid,
  target_finding_id text,
  target_actor_id uuid,
  target_assignee_user_id uuid,
  target_remediation_note text
)
returns public.security_finding_work
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  current_finding public.security_findings%rowtype;
  current_work public.security_finding_work%rowtype;
  updated_work public.security_finding_work%rowtype;
  normalized_note text;
begin
  select role::text
    into actor_role
    from public.workspace_members
   where workspace_id = target_workspace_id
     and user_id = target_actor_id
     and role::text in ('owner', 'admin', 'member', 'viewer');

  if actor_role is null or actor_role = 'viewer' then
    raise exception 'SECURITY_REMEDIATION_FORBIDDEN';
  end if;

  normalized_note := nullif(btrim(target_remediation_note), '');
  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'SECURITY_REMEDIATION_NOTE_INVALID';
  end if;

  select *
    into current_finding
    from public.security_findings
   where workspace_id = target_workspace_id
     and finding_id = target_finding_id
   for update;

  if current_finding.finding_id is null then
    raise exception 'SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE';
  end if;

  select *
    into current_work
    from public.security_finding_work
   where workspace_id = target_workspace_id
     and finding_id = target_finding_id
   for update;

  if actor_role in ('owner', 'admin') then
    if target_assignee_user_id is not null
       and not exists (
         select 1
           from public.workspace_members
          where workspace_id = target_workspace_id
            and user_id = target_assignee_user_id
       ) then
      raise exception 'SECURITY_REMEDIATION_ASSIGNEE_INVALID';
    end if;
  elsif actor_role = 'member' then
    if target_assignee_user_id is not null
       and target_assignee_user_id is distinct from target_actor_id then
      raise exception 'SECURITY_REMEDIATION_FORBIDDEN';
    end if;

    if target_assignee_user_id is null
       and current_work.assignee_user_id is not null
       and current_work.assignee_user_id is distinct from target_actor_id then
      raise exception 'SECURITY_REMEDIATION_FORBIDDEN';
    end if;
  else
    raise exception 'SECURITY_REMEDIATION_FORBIDDEN';
  end if;

  insert into public.security_finding_work (
    workspace_id,
    finding_id,
    assignee_user_id,
    remediation_note,
    updated_by
  ) values (
    target_workspace_id,
    target_finding_id,
    target_assignee_user_id,
    normalized_note,
    target_actor_id
  )
  on conflict (workspace_id, finding_id) do update
    set assignee_user_id = excluded.assignee_user_id,
        remediation_note = excluded.remediation_note,
        updated_by = excluded.updated_by,
        updated_at = now()
  returning * into updated_work;

  if current_work.assignee_user_id is distinct from target_assignee_user_id then
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
      target_finding_id,
      null,
      'user',
      target_actor_id,
      'finding.assignment_changed',
      null,
      null,
      null,
      jsonb_build_object('assignee_user_id', target_assignee_user_id)
    );
  end if;

  if current_work.remediation_note is distinct from normalized_note then
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
      target_finding_id,
      null,
      'user',
      target_actor_id,
      'finding.remediation_note_updated',
      null,
      null,
      null,
      jsonb_build_object('has_note', normalized_note is not null)
    );
  end if;

  return updated_work;
end;
$$;

revoke all on function public.change_security_finding_work(uuid, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.change_security_finding_work(uuid, text, uuid, uuid, text)
  to service_role;

create or replace function public.request_security_finding_retest(
  target_workspace_id uuid,
  target_finding_id text,
  target_actor_id uuid,
  target_execution_kind text,
  target_source_id text,
  target_source_version text,
  target_rule_ref text,
  target_validation_profile_id text,
  target_validation_profile_version integer,
  target_explicit_consent boolean
)
returns public.security_finding_retests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  current_finding public.security_findings%rowtype;
  existing_retest_id uuid;
  requested_retest public.security_finding_retests%rowtype;
  trusted_execution_kind text;
  trusted_validation_profile_id text;
  trusted_validation_profile_version integer;
  trusted_consent_granted_at timestamptz;
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
    into current_finding
    from public.security_findings
   where workspace_id = target_workspace_id
     and finding_id = target_finding_id
   for update;

  if current_finding.finding_id is null then
    raise exception 'SECURITY_RETEST_NOT_AVAILABLE';
  end if;

  select id
    into existing_retest_id
    from public.security_finding_retests
   where workspace_id = target_workspace_id
     and finding_id = target_finding_id
     and status in ('requested', 'running')
   order by requested_at desc
   limit 1
   for update;

  if existing_retest_id is not null then
    raise exception 'SECURITY_RETEST_ACTIVE_CONFLICT';
  end if;

  if current_finding.lifecycle_state::text <> 'resolved' then
    raise exception 'SECURITY_RETEST_STATE_INVALID';
  end if;

  if current_finding.source_kind::text <> 'deterministic-runtime-scanner' then
    raise exception 'SECURITY_RETEST_UNSUPPORTED_SOURCE';
  end if;

  if current_finding.source_id = 'scopeforge:runtime-observer' then
    trusted_execution_kind := 'passive_runtime';
    trusted_validation_profile_id := null;
    trusted_validation_profile_version := null;
    trusted_consent_granted_at := null;

    if target_execution_kind <> trusted_execution_kind
       or target_source_id <> current_finding.source_id
       or target_source_version is distinct from current_finding.source_version
       or target_rule_ref <> current_finding.rule_ref
       or target_validation_profile_id is not null
       or target_validation_profile_version is not null then
      raise exception 'SECURITY_RETEST_UNSUPPORTED_SOURCE';
    end if;
  elsif current_finding.source_id = 'scopeforge:runtime-validator'
        and current_finding.source_version = 'cors-origin-policy@1' then
    trusted_execution_kind := 'active_validation';
    trusted_validation_profile_id := 'cors-origin-policy';
    trusted_validation_profile_version := 1;

    if actor_role not in ('owner', 'admin') then
      raise exception 'SECURITY_RETEST_FORBIDDEN';
    end if;

    if not coalesce(target_explicit_consent, false) then
      raise exception 'SECURITY_RETEST_CONSENT_REQUIRED';
    end if;

    if target_execution_kind <> trusted_execution_kind
       or target_source_id <> current_finding.source_id
       or target_source_version is distinct from current_finding.source_version
       or target_rule_ref <> current_finding.rule_ref
       or target_validation_profile_id is distinct from trusted_validation_profile_id
       or target_validation_profile_version is distinct from trusted_validation_profile_version then
      raise exception 'SECURITY_RETEST_UNSUPPORTED_SOURCE';
    end if;

    trusted_consent_granted_at := now();
  else
    raise exception 'SECURITY_RETEST_UNSUPPORTED_SOURCE';
  end if;

  insert into public.security_finding_retests (
    workspace_id,
    finding_id,
    asset_id,
    requested_by,
    execution_kind,
    source_id,
    source_version,
    rule_ref,
    validation_profile_id,
    validation_profile_version,
    active_consent_granted_at,
    status
  ) values (
    target_workspace_id,
    target_finding_id,
    current_finding.asset_id,
    target_actor_id,
    trusted_execution_kind,
    current_finding.source_id,
    current_finding.source_version,
    current_finding.rule_ref,
    trusted_validation_profile_id,
    trusted_validation_profile_version,
    trusted_consent_granted_at,
    'requested'
  )
  returning * into requested_retest;

  update public.security_findings
     set lifecycle_state = 'retest_pending',
         updated_at = now()
   where workspace_id = target_workspace_id
     and finding_id = target_finding_id;

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
    target_finding_id,
    null,
    'user',
    target_actor_id,
    'finding.retest_requested',
    'resolved',
    'retest_pending',
    null,
    jsonb_build_object(
      'retest_id', requested_retest.id,
      'execution_kind', trusted_execution_kind
    )
  );

  return requested_retest;
end;
$$;

revoke all on function public.request_security_finding_retest(uuid, text, uuid, text, text, text, text, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.request_security_finding_retest(uuid, text, uuid, text, text, text, text, text, integer, boolean)
  to service_role;

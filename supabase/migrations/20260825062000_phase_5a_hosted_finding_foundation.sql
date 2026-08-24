create table public.security_findings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null check (char_length(finding_id) between 1 and 256),
  asset_id uuid not null,
  source_kind text not null check (
    source_kind in (
      'deterministic-passive-scanner',
      'deterministic-runtime-scanner',
      'external-scanner',
      'user-confirmed',
      'advisory-inference'
    )
  ),
  source_id text not null check (char_length(source_id) between 1 and 256),
  source_version text check (source_version is null or char_length(source_version) <= 128),
  rule_ref text not null check (char_length(rule_ref) between 1 and 512),
  title text not null check (char_length(title) between 1 and 240),
  description text not null check (char_length(description) between 1 and 8192),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  validation_state text not null check (
    validation_state in ('unvalidated', 'static_confirmed', 'runtime_observed', 'runtime_validated', 'user_confirmed')
  ),
  provenance_kind text not null check (
    provenance_kind in ('observed', 'scanner-derived', 'user-confirmed', 'inferred')
  ),
  location jsonb check (
    location is null
    or (jsonb_typeof(location) = 'object' and pg_column_size(location) <= 8192)
  ),
  taxonomy jsonb not null check (
    jsonb_typeof(taxonomy) = 'object'
    and pg_column_size(taxonomy) <= 16384
  ),
  remediation jsonb check (
    remediation is null
    or (jsonb_typeof(remediation) = 'object' and pg_column_size(remediation) <= 16384)
  ),
  lifecycle_state text not null check (
    lifecycle_state in (
      'open',
      'acknowledged',
      'in_progress',
      'resolved',
      'retest_pending',
      'verified_fixed',
      'accepted_risk',
      'false_positive'
    )
  ),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_seen_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, finding_id),
  check (first_seen_at <= last_seen_at),
  constraint security_findings_asset_workspace_fkey
    foreign key (asset_id, workspace_id) references public.assets(id, workspace_id) on delete cascade,
  constraint security_findings_last_seen_job_fkey
    foreign key (last_seen_job_id, workspace_id, asset_id) references public.scan_jobs(id, workspace_id, asset_id)
);

create table public.security_evidence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  evidence_id text not null check (char_length(evidence_id) between 1 and 256),
  asset_id uuid not null,
  kind text not null check (
    kind in (
      'repository-location',
      'static-analysis',
      'dependency',
      'http-observation',
      'tls-observation',
      'user-confirmed',
      'artifact-reference'
    )
  ),
  provenance_kind text not null check (
    provenance_kind in ('observed', 'scanner-derived', 'user-confirmed', 'inferred')
  ),
  summary text not null check (char_length(summary) between 1 and 4096),
  classification text not null check (classification in ('public', 'internal', 'sensitive', 'secret')),
  artifact_ref text check (artifact_ref is null or char_length(artifact_ref) <= 1024),
  created_at timestamptz not null default now(),
  primary key (workspace_id, evidence_id),
  constraint security_evidence_asset_workspace_fkey
    foreign key (asset_id, workspace_id) references public.assets(id, workspace_id) on delete cascade
);

create table public.security_finding_evidence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null,
  evidence_id text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, finding_id, evidence_id),
  constraint security_finding_evidence_finding_fkey
    foreign key (workspace_id, finding_id)
    references public.security_findings(workspace_id, finding_id)
    on delete cascade,
  constraint security_finding_evidence_evidence_fkey
    foreign key (workspace_id, evidence_id)
    references public.security_evidence(workspace_id, evidence_id)
    on delete cascade
);

create table public.security_finding_occurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null,
  asset_id uuid not null,
  scan_job_id uuid not null,
  scan_run_ref text check (scan_run_ref is null or char_length(scan_run_ref) <= 256),
  observed_at timestamptz not null,
  source_kind text not null check (
    source_kind in (
      'deterministic-passive-scanner',
      'deterministic-runtime-scanner',
      'external-scanner',
      'user-confirmed',
      'advisory-inference'
    )
  ),
  source_id text not null check (char_length(source_id) between 1 and 256),
  source_version text check (source_version is null or char_length(source_version) <= 128),
  validation_state text not null check (
    validation_state in ('unvalidated', 'static_confirmed', 'runtime_observed', 'runtime_validated', 'user_confirmed')
  ),
  created_at timestamptz not null default now(),
  unique (workspace_id, finding_id, scan_job_id),
  constraint security_finding_occurrences_finding_fkey
    foreign key (workspace_id, finding_id)
    references public.security_findings(workspace_id, finding_id)
    on delete cascade,
  constraint security_finding_occurrences_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  constraint security_finding_occurrences_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id) references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade
);

create table public.security_finding_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null,
  scan_job_id uuid references public.scan_jobs(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'system')),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    char_length(event_type) between 1 and 100
    and event_type in ('finding.created', 'finding.reobserved', 'finding.lifecycle_changed', 'finding.reopened')
  ),
  from_lifecycle text check (
    from_lifecycle is null
    or from_lifecycle in (
      'open', 'acknowledged', 'in_progress', 'resolved', 'retest_pending', 'verified_fixed', 'accepted_risk', 'false_positive'
    )
  ),
  to_lifecycle text check (
    to_lifecycle is null
    or to_lifecycle in (
      'open', 'acknowledged', 'in_progress', 'resolved', 'retest_pending', 'verified_fixed', 'accepted_risk', 'false_positive'
    )
  ),
  reason text check (reason is null or char_length(reason) <= 1000),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 8192
  ),
  created_at timestamptz not null default now(),
  constraint security_finding_events_finding_fkey
    foreign key (workspace_id, finding_id)
    references public.security_findings(workspace_id, finding_id)
    on delete cascade
);

create unique index security_finding_events_scan_event_unique
  on public.security_finding_events(workspace_id, finding_id, scan_job_id, event_type)
  where scan_job_id is not null and actor_type = 'system';

create index security_findings_workspace_lifecycle_seen_idx
  on public.security_findings(workspace_id, lifecycle_state, last_seen_at desc);
create index security_findings_workspace_asset_seen_idx
  on public.security_findings(workspace_id, asset_id, last_seen_at desc);
create index security_findings_last_seen_job_idx
  on public.security_findings(last_seen_job_id, workspace_id, asset_id)
  where last_seen_job_id is not null;
create index security_evidence_workspace_asset_idx
  on public.security_evidence(workspace_id, asset_id, created_at desc);
create index security_finding_evidence_evidence_idx
  on public.security_finding_evidence(workspace_id, evidence_id, finding_id);
create index security_finding_occurrences_workspace_finding_seen_idx
  on public.security_finding_occurrences(workspace_id, finding_id, observed_at desc);
create index security_finding_occurrences_job_idx
  on public.security_finding_occurrences(scan_job_id, workspace_id, asset_id);
create index security_finding_events_workspace_finding_created_idx
  on public.security_finding_events(workspace_id, finding_id, created_at desc);
create index security_finding_events_scan_job_idx
  on public.security_finding_events(scan_job_id)
  where scan_job_id is not null;

create or replace function private.guard_security_finding_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.finding_id is distinct from old.finding_id
     or new.asset_id is distinct from old.asset_id
     or new.source_kind is distinct from old.source_kind
     or new.source_id is distinct from old.source_id
     or new.source_version is distinct from old.source_version
     or new.rule_ref is distinct from old.rule_ref
     or new.created_at is distinct from old.created_at then
    raise exception 'Security finding identity fields are immutable';
  end if;

  if new.first_seen_at > new.last_seen_at then
    raise exception 'Finding first-seen time cannot be after last-seen time';
  end if;

  return new;
end;
$$;

create trigger security_findings_guard_update
before update on public.security_findings
for each row execute function private.guard_security_finding_update();

create or replace function private.reject_security_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Evidence rows are immutable';
end;
$$;

create trigger security_evidence_reject_update
before update on public.security_evidence
for each row execute function private.reject_security_evidence_mutation();
create trigger security_evidence_reject_delete
before delete on public.security_evidence
for each row execute function private.reject_security_evidence_mutation();

create or replace function private.reject_security_finding_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Finding history rows are append-only';
end;
$$;

create trigger security_finding_evidence_reject_update
before update on public.security_finding_evidence
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_evidence_reject_delete
before delete on public.security_finding_evidence
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_occurrences_reject_update
before update on public.security_finding_occurrences
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_occurrences_reject_delete
before delete on public.security_finding_occurrences
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_events_reject_update
before update on public.security_finding_events
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_events_reject_delete
before delete on public.security_finding_events
for each row execute function private.reject_security_finding_history_mutation();

alter table public.security_findings enable row level security;
alter table public.security_evidence enable row level security;
alter table public.security_finding_evidence enable row level security;
alter table public.security_finding_occurrences enable row level security;
alter table public.security_finding_events enable row level security;

create policy security_findings_select_member on public.security_findings
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_evidence_select_member on public.security_evidence
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_finding_evidence_select_member on public.security_finding_evidence
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_finding_occurrences_select_member on public.security_finding_occurrences
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_finding_events_select_member on public.security_finding_events
for select to authenticated using (private.is_workspace_member(workspace_id));

revoke all on table public.security_findings from anon, authenticated;
revoke all on table public.security_evidence from anon, authenticated;
revoke all on table public.security_finding_evidence from anon, authenticated;
revoke all on table public.security_finding_occurrences from anon, authenticated;
revoke all on table public.security_finding_events from anon, authenticated;

grant select on table public.security_findings to authenticated;
grant select on table public.security_evidence to authenticated;
grant select on table public.security_finding_evidence to authenticated;
grant select on table public.security_finding_occurrences to authenticated;
grant select on table public.security_finding_events to authenticated;

create or replace function private.guard_runtime_scan_job_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.asset_id is distinct from old.asset_id
     or new.job_kind is distinct from old.job_kind
     or new.requested_by is distinct from old.requested_by
     or new.authorization_canonical_target is distinct from old.authorization_canonical_target
     or new.authorization_asset_kind is distinct from old.authorization_asset_kind
     or new.authorization_verified_at is distinct from old.authorization_verified_at
     or new.validation_profile_id is distinct from old.validation_profile_id
     or new.validation_profile_version is distinct from old.validation_profile_version
     or new.authorization_granted_at is distinct from old.authorization_granted_at
     or new.budget is distinct from old.budget
     or new.created_at is distinct from old.created_at then
    raise exception 'Runtime job authorization snapshot fields are immutable';
  end if;

  if new.cancel_requested_at is distinct from old.cancel_requested_at then
    if old.cancel_requested_at is not null
       or new.cancel_requested_at is null
       or old.status not in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
      raise exception 'Invalid runtime cancellation request transition';
    end if;

    if exists (
      select 1
        from public.runtime_observations
       where job_id = old.id
         and workspace_id = old.workspace_id
         and asset_id = old.asset_id
    ) then
      raise exception 'Runtime result persistence has already committed';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'queued'::public.scan_job_status
       and new.status not in ('running'::public.scan_job_status, 'blocked'::public.scan_job_status, 'cancelled'::public.scan_job_status) then
      raise exception 'Invalid runtime job transition';
    elsif old.status = 'running'::public.scan_job_status
       and new.status not in ('succeeded'::public.scan_job_status, 'failed'::public.scan_job_status, 'blocked'::public.scan_job_status, 'cancelled'::public.scan_job_status) then
      raise exception 'Invalid runtime job transition';
    elsif old.status in ('succeeded'::public.scan_job_status, 'failed'::public.scan_job_status, 'blocked'::public.scan_job_status, 'cancelled'::public.scan_job_status) then
      raise exception 'Runtime job terminal states are immutable';
    end if;

    if new.status = 'succeeded'::public.scan_job_status
       and (old.cancel_requested_at is not null or new.cancel_requested_at is not null) then
      raise exception 'A cancelled runtime job cannot succeed';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.ingest_security_finding_batch(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_job_id uuid,
  finding_rows jsonb,
  evidence_rows jsonb,
  observed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence_row jsonb;
  finding_row jsonb;
  evidence_ref jsonb;
  existing_evidence public.security_evidence%rowtype;
  existing_finding public.security_findings%rowtype;
  occurrence_id uuid;
  finding_inserted boolean;
  next_lifecycle text;
  event_type text;
begin
  if jsonb_typeof(finding_rows) <> 'array' or jsonb_typeof(evidence_rows) <> 'array' then
    raise exception 'Runtime finding persistence requires array payloads';
  end if;

  for evidence_row in select value from jsonb_array_elements(evidence_rows)
  loop
    if jsonb_typeof(evidence_row) <> 'object'
       or evidence_row->>'kind' not in ('http-observation', 'tls-observation')
       or evidence_row->>'provenance_kind' <> 'observed'
       or evidence_row->>'classification' <> 'public'
       or nullif(evidence_row->>'artifact_ref', '') is not null then
      raise exception 'Runtime evidence payload is not authorized';
    end if;

    insert into public.security_evidence (
      workspace_id,
      evidence_id,
      asset_id,
      kind,
      provenance_kind,
      summary,
      classification,
      artifact_ref
    ) values (
      target_workspace_id,
      evidence_row->>'evidence_id',
      target_asset_id,
      evidence_row->>'kind',
      evidence_row->>'provenance_kind',
      evidence_row->>'summary',
      evidence_row->>'classification',
      null
    )
    on conflict (workspace_id, evidence_id) do nothing;

    select *
      into existing_evidence
      from public.security_evidence
     where workspace_id = target_workspace_id
       and evidence_id = evidence_row->>'evidence_id';

    if existing_evidence.evidence_id is null
       or existing_evidence.asset_id is distinct from target_asset_id
       or existing_evidence.kind is distinct from evidence_row->>'kind'
       or existing_evidence.provenance_kind is distinct from evidence_row->>'provenance_kind'
       or existing_evidence.summary is distinct from evidence_row->>'summary'
       or existing_evidence.classification is distinct from evidence_row->>'classification'
       or existing_evidence.artifact_ref is not null then
      raise exception 'EVIDENCE_ID_CONFLICT';
    end if;
  end loop;

  for finding_row in select value from jsonb_array_elements(finding_rows)
  loop
    if jsonb_typeof(finding_row) <> 'object'
       or finding_row->>'source_kind' <> 'deterministic-runtime-scanner'
       or finding_row->>'provenance_kind' <> 'scanner-derived'
       or finding_row->>'validation_state' not in ('runtime_observed', 'runtime_validated')
       or jsonb_typeof(finding_row->'evidence_refs') <> 'array' then
      raise exception 'Runtime finding payload is not authorized';
    end if;

    for evidence_ref in select value from jsonb_array_elements(finding_row->'evidence_refs')
    loop
      if jsonb_typeof(evidence_ref) <> 'string'
         or not exists (
           select 1
             from public.security_evidence
            where workspace_id = target_workspace_id
              and asset_id = target_asset_id
              and evidence_id = evidence_ref #>> '{}'
         ) then
        raise exception 'Runtime finding references unavailable evidence';
      end if;
    end loop;

    finding_inserted := false;
    insert into public.security_findings (
      workspace_id,
      finding_id,
      asset_id,
      source_kind,
      source_id,
      source_version,
      rule_ref,
      title,
      description,
      severity,
      confidence,
      validation_state,
      provenance_kind,
      location,
      taxonomy,
      remediation,
      lifecycle_state,
      first_seen_at,
      last_seen_at,
      last_seen_job_id
    ) values (
      target_workspace_id,
      finding_row->>'finding_id',
      target_asset_id,
      finding_row->>'source_kind',
      finding_row->>'source_id',
      nullif(finding_row->>'source_version', ''),
      finding_row->>'rule_ref',
      finding_row->>'title',
      finding_row->>'description',
      finding_row->>'severity',
      finding_row->>'confidence',
      finding_row->>'validation_state',
      finding_row->>'provenance_kind',
      finding_row->'location',
      finding_row->'taxonomy',
      finding_row->'remediation',
      'open',
      observed_at,
      observed_at,
      target_job_id
    )
    on conflict (workspace_id, finding_id) do nothing
    returning true into finding_inserted;

    select *
      into existing_finding
      from public.security_findings
     where workspace_id = target_workspace_id
       and finding_id = finding_row->>'finding_id'
     for update;

    if existing_finding.finding_id is null
       or existing_finding.asset_id is distinct from target_asset_id
       or existing_finding.source_kind is distinct from finding_row->>'source_kind'
       or existing_finding.source_id is distinct from finding_row->>'source_id'
       or existing_finding.source_version is distinct from nullif(finding_row->>'source_version', '')
       or existing_finding.rule_ref is distinct from finding_row->>'rule_ref' then
      raise exception 'FINDING_ID_CONFLICT';
    end if;

    occurrence_id := null;
    insert into public.security_finding_occurrences (
      workspace_id,
      finding_id,
      asset_id,
      scan_job_id,
      scan_run_ref,
      observed_at,
      source_kind,
      source_id,
      source_version,
      validation_state
    ) values (
      target_workspace_id,
      finding_row->>'finding_id',
      target_asset_id,
      target_job_id,
      nullif(finding_row->>'scan_run_ref', ''),
      observed_at,
      finding_row->>'source_kind',
      finding_row->>'source_id',
      nullif(finding_row->>'source_version', ''),
      finding_row->>'validation_state'
    )
    on conflict (workspace_id, finding_id, scan_job_id) do nothing
    returning id into occurrence_id;

    if occurrence_id is null then
      continue;
    end if;

    for evidence_ref in select value from jsonb_array_elements(finding_row->'evidence_refs')
    loop
      insert into public.security_finding_evidence (workspace_id, finding_id, evidence_id)
      values (target_workspace_id, finding_row->>'finding_id', evidence_ref #>> '{}')
      on conflict (workspace_id, finding_id, evidence_id) do nothing;
    end loop;

    if finding_inserted is true then
      next_lifecycle := 'open';
      event_type := 'finding.created';
    elsif observed_at >= existing_finding.last_seen_at then
      next_lifecycle := case existing_finding.lifecycle_state
        when 'resolved' then 'in_progress'
        when 'retest_pending' then 'in_progress'
        when 'verified_fixed' then 'open'
        when 'accepted_risk' then existing_finding.lifecycle_state
        when 'false_positive' then existing_finding.lifecycle_state
        else existing_finding.lifecycle_state
      end;
      event_type := case
        when next_lifecycle is distinct from existing_finding.lifecycle_state then 'finding.reopened'
        else 'finding.reobserved'
      end;
    else
      next_lifecycle := existing_finding.lifecycle_state;
      event_type := 'finding.reobserved';
    end if;

    if finding_inserted is not true and observed_at >= existing_finding.last_seen_at then
      update public.security_findings
         set title = finding_row->>'title',
             description = finding_row->>'description',
             severity = finding_row->>'severity',
             confidence = finding_row->>'confidence',
             validation_state = finding_row->>'validation_state',
             provenance_kind = finding_row->>'provenance_kind',
             location = finding_row->'location',
             taxonomy = finding_row->'taxonomy',
             remediation = finding_row->'remediation',
             lifecycle_state = next_lifecycle,
             last_seen_at = observed_at,
             last_seen_job_id = target_job_id,
             updated_at = now()
       where workspace_id = target_workspace_id
         and finding_id = finding_row->>'finding_id';
    end if;

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
      finding_row->>'finding_id',
      target_job_id,
      'system',
      null,
      event_type,
      case when finding_inserted is true then null else existing_finding.lifecycle_state end,
      next_lifecycle,
      null,
      '{}'::jsonb
    )
    on conflict (workspace_id, finding_id, scan_job_id, event_type)
      where scan_job_id is not null and actor_type = 'system'
    do nothing;
  end loop;
end;
$$;

revoke all on function private.ingest_security_finding_batch(uuid, uuid, uuid, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;

create or replace function public.persist_passive_runtime_result(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_job_id uuid,
  observation_rows jsonb,
  finding_rows jsonb,
  evidence_rows jsonb,
  observed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_kind_text text;
  job_status text;
  job_cancel_requested_at timestamptz;
  observation_row jsonb;
  existing_observation public.runtime_observations%rowtype;
begin
  select job_kind::text, status::text, cancel_requested_at
    into job_kind_text, job_status, job_cancel_requested_at
    from public.scan_jobs
   where id = target_job_id
     and workspace_id = target_workspace_id
     and asset_id = target_asset_id
   for update;

  if job_kind_text is null
     or job_status <> 'running'
     or job_cancel_requested_at is not null then
    raise exception 'Runtime result persistence requires a running uncancelled job';
  end if;

  if job_kind_text <> 'passive_runtime' then
    raise exception 'Passive runtime result persistence requires a passive runtime job';
  end if;

  if jsonb_typeof(observation_rows) <> 'array' then
    raise exception 'Passive runtime observations must be an array';
  end if;

  for observation_row in select value from jsonb_array_elements(observation_rows)
  loop
    if jsonb_typeof(observation_row) <> 'object'
       or (observation_row->>'sequence') is null
       or (observation_row->>'sequence')::integer < 0
       or observation_row->>'kind' not in ('http-status', 'redirect', 'header', 'cookie', 'tls')
       or jsonb_typeof(observation_row->'payload') <> 'object' then
      raise exception 'Passive runtime observation payload is invalid';
    end if;

    insert into public.runtime_observations (
      workspace_id,
      job_id,
      asset_id,
      sequence,
      kind,
      payload
    ) values (
      target_workspace_id,
      target_job_id,
      target_asset_id,
      (observation_row->>'sequence')::integer,
      observation_row->>'kind',
      observation_row->'payload'
    )
    on conflict (job_id, sequence) do nothing;

    select *
      into existing_observation
      from public.runtime_observations
     where job_id = target_job_id
       and sequence = (observation_row->>'sequence')::integer;

    if existing_observation.id is null
       or existing_observation.workspace_id is distinct from target_workspace_id
       or existing_observation.asset_id is distinct from target_asset_id
       or existing_observation.kind is distinct from observation_row->>'kind'
       or existing_observation.payload is distinct from observation_row->'payload' then
      raise exception 'RUNTIME_OBSERVATION_ID_CONFLICT';
    end if;
  end loop;

  perform private.ingest_security_finding_batch(
    target_workspace_id,
    target_asset_id,
    target_job_id,
    finding_rows,
    evidence_rows,
    observed_at
  );
end;
$$;

revoke all on function public.persist_passive_runtime_result(uuid, uuid, uuid, jsonb, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.persist_passive_runtime_result(uuid, uuid, uuid, jsonb, jsonb, jsonb, timestamptz)
  to service_role;

create or replace function public.persist_active_validation_result(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_job_id uuid,
  observation_row jsonb,
  finding_rows jsonb,
  evidence_rows jsonb,
  observed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_kind_text text;
  job_status text;
  job_cancel_requested_at timestamptz;
  existing_observation public.runtime_observations%rowtype;
begin
  select job_kind::text, status::text, cancel_requested_at
    into job_kind_text, job_status, job_cancel_requested_at
    from public.scan_jobs
   where id = target_job_id
     and workspace_id = target_workspace_id
     and asset_id = target_asset_id
   for update;

  if job_kind_text is null
     or job_status <> 'running'
     or job_cancel_requested_at is not null then
    raise exception 'Runtime result persistence requires a running uncancelled job';
  end if;

  if job_kind_text <> 'active_validation' then
    raise exception 'Active validation result persistence requires an active validation job';
  end if;

  if jsonb_typeof(observation_row) <> 'object'
     or (observation_row->>'sequence') is null
     or (observation_row->>'sequence')::integer < 0
     or observation_row->>'kind' <> 'cors-policy'
     or jsonb_typeof(observation_row->'payload') <> 'object' then
    raise exception 'Active validation observation payload is invalid';
  end if;

  insert into public.runtime_observations (
    workspace_id,
    job_id,
    asset_id,
    sequence,
    kind,
    payload
  ) values (
    target_workspace_id,
    target_job_id,
    target_asset_id,
    (observation_row->>'sequence')::integer,
    'cors-policy',
    observation_row->'payload'
  )
  on conflict (job_id, sequence) do nothing;

  select *
    into existing_observation
    from public.runtime_observations
   where job_id = target_job_id
     and sequence = (observation_row->>'sequence')::integer;

  if existing_observation.id is null
     or existing_observation.workspace_id is distinct from target_workspace_id
     or existing_observation.asset_id is distinct from target_asset_id
     or existing_observation.kind is distinct from 'cors-policy'
     or existing_observation.payload is distinct from observation_row->'payload' then
    raise exception 'RUNTIME_OBSERVATION_ID_CONFLICT';
  end if;

  perform private.ingest_security_finding_batch(
    target_workspace_id,
    target_asset_id,
    target_job_id,
    finding_rows,
    evidence_rows,
    observed_at
  );
end;
$$;

revoke all on function public.persist_active_validation_result(uuid, uuid, uuid, jsonb, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.persist_active_validation_result(uuid, uuid, uuid, jsonb, jsonb, jsonb, timestamptz)
  to service_role;

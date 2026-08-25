alter table public.scan_jobs
  add constraint scan_jobs_phase3_import_snapshot_check check (
    job_kind <> 'phase3_import'::public.scan_job_kind
    or (
      status = 'succeeded'::public.scan_job_status
      and blocked_reason is null
      and authorization_canonical_target is not null
      and char_length(authorization_canonical_target) between 1 and 2048
      and authorization_asset_kind = 'repository'::public.asset_kind
      and authorization_verified_at is null
      and validation_profile_id is null
      and validation_profile_version is null
      and authorization_granted_at is null
      and budget = '{}'::jsonb
      and cancel_requested_at is null
      and started_at is not null
      and finished_at is not null
      and started_at <= finished_at
      and failure_code is null
      and request_count = 0
      and redirect_count = 0
      and finding_count between 0 and 500
    )
  );

create table public.security_phase3_import_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null,
  scan_job_id uuid not null,
  run_ref text not null check (
    char_length(run_ref) = 69
    and run_ref ~ '^sfh1:[0-9a-f]{64}$'
  ),
  repository_canonical_url text not null check (
    char_length(repository_canonical_url) between 1 and 2048
  ),
  schema_version smallint not null default 1 check (schema_version = 1),
  tool_version text not null check (char_length(tool_version) between 1 and 64),
  scan_started_at timestamptz not null,
  scan_duration_ms integer not null check (scan_duration_ms between 0 and 86400000),
  scanner_descriptors jsonb not null check (
    jsonb_typeof(scanner_descriptors) = 'array'
    and jsonb_array_length(scanner_descriptors) between 1 and 32
    and pg_column_size(scanner_descriptors) <= 8192
  ),
  scanner_error_count integer not null check (scanner_error_count between 0 and 100000),
  files_analyzed integer not null check (files_analyzed between 0 and 1000000),
  files_skipped integer not null check (files_skipped between 0 and 1000000),
  total_bytes bigint not null check (total_bytes between 0 and 10737418240),
  finding_count integer not null check (finding_count between 0 and 500),
  evidence_count integer not null check (evidence_count between 0 and 500),
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{32}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, asset_id, run_ref),
  unique (scan_job_id),
  constraint security_phase3_import_runs_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  constraint security_phase3_import_runs_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade
);

create index security_phase3_import_runs_workspace_asset_created_idx
  on public.security_phase3_import_runs(workspace_id, asset_id, created_at desc);
create index security_phase3_import_runs_workspace_created_idx
  on public.security_phase3_import_runs(workspace_id, created_at desc);

create or replace function private.reject_security_phase3_import_run_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Phase 3 import run rows are immutable';
end;
$$;

create trigger security_phase3_import_runs_reject_update
before update on public.security_phase3_import_runs
for each row execute function private.reject_security_phase3_import_run_mutation();

create trigger security_phase3_import_runs_reject_delete
before delete on public.security_phase3_import_runs
for each row execute function private.reject_security_phase3_import_run_mutation();

alter table public.security_phase3_import_runs enable row level security;

create policy security_phase3_import_runs_select_member
on public.security_phase3_import_runs
for select to authenticated
using (private.is_workspace_member(workspace_id));

revoke all on table public.security_phase3_import_runs from public, anon, authenticated;
grant select on table public.security_phase3_import_runs to authenticated;

create or replace function public.persist_phase3_import_result(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid,
  target_repository_canonical_url text,
  target_run_ref text,
  target_tool_version text,
  target_scan_started_at timestamptz,
  target_scan_duration_ms integer,
  target_scanner_descriptors jsonb,
  target_scanner_error_count integer,
  target_files_analyzed integer,
  target_files_skipped integer,
  target_total_bytes bigint,
  finding_rows jsonb,
  evidence_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role_text text;
  asset_kind_text text;
  asset_canonical_target text;
  scanner_descriptor text;
  scanner_descriptor_count integer;
  scanner_descriptor_unique_count integer;
  payload_digest_value text;
  import_observed_at timestamptz;
  import_job_id uuid;
  import_run_id uuid;
  existing_run public.security_phase3_import_runs%rowtype;
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
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null
     or target_repository_canonical_url is null
     or char_length(target_repository_canonical_url) not between 1 and 2048
     or target_run_ref is null
     or target_run_ref !~ '^sfh1:[0-9a-f]{64}$'
     or target_tool_version is null
     or char_length(target_tool_version) not between 1 and 64
     or target_scan_started_at is null
     or target_scan_duration_ms is null
     or target_scan_duration_ms not between 0 and 86400000
     or target_scanner_error_count is null
     or target_scanner_error_count not between 0 and 100000
     or target_files_analyzed is null
     or target_files_analyzed not between 0 and 1000000
     or target_files_skipped is null
     or target_files_skipped not between 0 and 1000000
     or target_total_bytes is null
     or target_total_bytes not between 0 and 10737418240 then
    raise exception 'PHASE3_IMPORT_PAYLOAD_INVALID';
  end if;

  if jsonb_typeof(target_scanner_descriptors) is distinct from 'array'
     or jsonb_array_length(target_scanner_descriptors) not between 1 and 32
     or pg_column_size(target_scanner_descriptors) > 8192 then
    raise exception 'PHASE3_IMPORT_PAYLOAD_INVALID';
  end if;

  select count(*), count(distinct descriptor.value #>> '{}')
    into scanner_descriptor_count, scanner_descriptor_unique_count
    from jsonb_array_elements(target_scanner_descriptors) as descriptor(value);

  if scanner_descriptor_count is distinct from scanner_descriptor_unique_count then
    raise exception 'PHASE3_IMPORT_PAYLOAD_INVALID';
  end if;

  for scanner_descriptor in
    select descriptor.value #>> '{}'
      from jsonb_array_elements(target_scanner_descriptors) as descriptor(value)
  loop
    if scanner_descriptor not in (
      'iac@1.0.0',
      'jsts@1.0.0',
      'sca@1.0.0',
      'secrets@1.0.0'
    ) then
      raise exception 'PHASE3_IMPORT_PAYLOAD_INVALID';
    end if;
  end loop;

  if jsonb_typeof(finding_rows) is distinct from 'array'
     or jsonb_typeof(evidence_rows) is distinct from 'array'
     or jsonb_array_length(finding_rows) > 500
     or jsonb_array_length(evidence_rows) > 500
     or pg_column_size(finding_rows) + pg_column_size(evidence_rows) > 3670016 then
    raise exception 'PHASE3_IMPORT_PAYLOAD_INVALID';
  end if;

  select role::text
    into actor_role_text
    from public.workspace_members
   where workspace_id = target_workspace_id
     and user_id = target_actor_id
     and role::text in ('owner', 'admin', 'member');

  if actor_role_text is null then
    raise exception 'PHASE3_IMPORT_ACCESS_DENIED';
  end if;

  select kind::text, canonical_target
    into asset_kind_text, asset_canonical_target
    from public.assets
   where id = target_asset_id
     and workspace_id = target_workspace_id
   for update;

  if asset_kind_text is null
     or asset_kind_text <> 'repository'
     or asset_canonical_target is distinct from target_repository_canonical_url then
    raise exception 'PHASE3_IMPORT_ASSET_MISMATCH';
  end if;

  for evidence_row in select value from jsonb_array_elements(evidence_rows)
  loop
    if jsonb_typeof(evidence_row) is distinct from 'object'
       or jsonb_object_length(evidence_row) <> 6
       or not (evidence_row ? 'evidence_id')
       or not (evidence_row ? 'kind')
       or not (evidence_row ? 'provenance_kind')
       or not (evidence_row ? 'summary')
       or not (evidence_row ? 'classification')
       or not (evidence_row ? 'artifact_ref')
       or jsonb_typeof(evidence_row->'evidence_id') is distinct from 'string'
       or char_length(evidence_row->>'evidence_id') not between 1 and 256
       or jsonb_typeof(evidence_row->'kind') is distinct from 'string'
       or evidence_row->>'kind' not in ('static-analysis', 'dependency')
       or evidence_row->>'provenance_kind' <> 'scanner-derived'
       or jsonb_typeof(evidence_row->'summary') is distinct from 'string'
       or char_length(evidence_row->>'summary') not between 1 and 4096
       or evidence_row->>'classification' <> 'internal'
       or evidence_row->'artifact_ref' is distinct from 'null'::jsonb then
      raise exception 'PHASE3_IMPORT_PAYLOAD_INVALID';
    end if;
  end loop;

  for finding_row in select value from jsonb_array_elements(finding_rows)
  loop
    if jsonb_typeof(finding_row) is distinct from 'object'
       or jsonb_object_length(finding_row) <> 16
       or not (finding_row ? 'finding_id')
       or not (finding_row ? 'source_kind')
       or not (finding_row ? 'source_id')
       or not (finding_row ? 'source_version')
       or not (finding_row ? 'scan_run_ref')
       or not (finding_row ? 'rule_ref')
       or not (finding_row ? 'title')
       or not (finding_row ? 'description')
       or not (finding_row ? 'severity')
       or not (finding_row ? 'confidence')
       or not (finding_row ? 'validation_state')
       or not (finding_row ? 'provenance_kind')
       or not (finding_row ? 'location')
       or not (finding_row ? 'taxonomy')
       or not (finding_row ? 'remediation')
       or not (finding_row ? 'evidence_refs')
       or jsonb_typeof(finding_row->'finding_id') is distinct from 'string'
       or char_length(finding_row->>'finding_id') not between 1 and 256
       or finding_row->>'source_kind' <> 'deterministic-passive-scanner'
       or jsonb_typeof(finding_row->'source_id') is distinct from 'string'
       or char_length(finding_row->>'source_id') not between 1 and 256
       or jsonb_typeof(finding_row->'source_version') is distinct from 'string'
       or char_length(finding_row->>'source_version') not between 1 and 128
       or finding_row->>'scan_run_ref' is distinct from target_run_ref
       or jsonb_typeof(finding_row->'rule_ref') is distinct from 'string'
       or char_length(finding_row->>'rule_ref') not between 1 and 512
       or jsonb_typeof(finding_row->'title') is distinct from 'string'
       or char_length(finding_row->>'title') not between 1 and 240
       or jsonb_typeof(finding_row->'description') is distinct from 'string'
       or char_length(finding_row->>'description') not between 1 and 8192
       or finding_row->>'severity' not in ('critical', 'high', 'medium', 'low', 'info')
       or finding_row->>'confidence' not in ('high', 'medium', 'low')
       or finding_row->>'validation_state' not in ('static_confirmed', 'unvalidated')
       or finding_row->>'provenance_kind' <> 'scanner-derived'
       or (jsonb_typeof(finding_row->'location') not in ('object', 'null'))
       or jsonb_typeof(finding_row->'taxonomy') is distinct from 'object'
       or (jsonb_typeof(finding_row->'remediation') not in ('object', 'null'))
       or jsonb_typeof(finding_row->'evidence_refs') is distinct from 'array'
       or jsonb_array_length(finding_row->'evidence_refs') not between 1 and 8 then
      raise exception 'PHASE3_IMPORT_PAYLOAD_INVALID';
    end if;

    for evidence_ref in select value from jsonb_array_elements(finding_row->'evidence_refs')
    loop
      if jsonb_typeof(evidence_ref) is distinct from 'string'
         or not exists (
           select 1
             from jsonb_array_elements(evidence_rows) as candidate(value)
            where candidate.value->>'evidence_id' = evidence_ref #>> '{}'
         ) then
        raise exception 'PHASE3_IMPORT_PAYLOAD_INVALID';
      end if;
    end loop;
  end loop;

  payload_digest_value := md5(finding_rows::text || E'\n' || evidence_rows::text);
  import_observed_at := target_scan_started_at + (target_scan_duration_ms * interval '1 millisecond');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_workspace_id::text || ':' || target_asset_id::text || ':' || target_run_ref,
      0
    )
  );

  select *
    into existing_run
    from public.security_phase3_import_runs
   where workspace_id = target_workspace_id
     and asset_id = target_asset_id
     and run_ref = target_run_ref
   for update;

  if found then
    if existing_run.repository_canonical_url is distinct from target_repository_canonical_url
       or existing_run.schema_version is distinct from 1
       or existing_run.tool_version is distinct from target_tool_version
       or existing_run.scan_started_at is distinct from target_scan_started_at
       or existing_run.scan_duration_ms is distinct from target_scan_duration_ms
       or existing_run.scanner_descriptors is distinct from target_scanner_descriptors
       or existing_run.scanner_error_count is distinct from target_scanner_error_count
       or existing_run.files_analyzed is distinct from target_files_analyzed
       or existing_run.files_skipped is distinct from target_files_skipped
       or existing_run.total_bytes is distinct from target_total_bytes
       or existing_run.finding_count is distinct from jsonb_array_length(finding_rows)
       or existing_run.evidence_count is distinct from jsonb_array_length(evidence_rows)
       or existing_run.payload_digest is distinct from payload_digest_value
       or existing_run.created_by is distinct from target_actor_id then
      raise exception 'PHASE3_IMPORT_RUN_REF_CONFLICT';
    end if;

    return jsonb_build_object(
      'importRunId', existing_run.id,
      'scanJobId', existing_run.scan_job_id,
      'replayed', true
    );
  end if;

  insert into public.scan_jobs (
    workspace_id,
    asset_id,
    status,
    requested_by,
    blocked_reason,
    job_kind,
    authorization_canonical_target,
    authorization_asset_kind,
    authorization_verified_at,
    validation_profile_id,
    validation_profile_version,
    authorization_granted_at,
    budget,
    cancel_requested_at,
    started_at,
    finished_at,
    failure_code,
    request_count,
    redirect_count,
    finding_count
  ) values (
    target_workspace_id,
    target_asset_id,
    'succeeded'::public.scan_job_status,
    target_actor_id,
    null,
    'phase3_import'::public.scan_job_kind,
    target_repository_canonical_url,
    'repository'::public.asset_kind,
    null,
    null,
    null,
    null,
    '{}'::jsonb,
    null,
    target_scan_started_at,
    import_observed_at,
    null,
    0,
    0,
    jsonb_array_length(finding_rows)
  )
  returning id into import_job_id;

  if not exists (
    select 1
      from public.scan_jobs
     where id = import_job_id
       and workspace_id = target_workspace_id
       and asset_id = target_asset_id
       and job_kind = 'phase3_import'::public.scan_job_kind
       and status = 'succeeded'::public.scan_job_status
       and authorization_asset_kind = 'repository'::public.asset_kind
       and budget = '{}'::jsonb
       and request_count = 0
       and redirect_count = 0
  ) then
    raise exception 'PHASE3_IMPORT_JOB_INVALID';
  end if;

  for evidence_row in select value from jsonb_array_elements(evidence_rows)
  loop
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
       or existing_evidence.provenance_kind is distinct from 'scanner-derived'
       or existing_evidence.summary is distinct from evidence_row->>'summary'
       or existing_evidence.classification is distinct from 'internal'
       or existing_evidence.artifact_ref is not null then
      raise exception 'PHASE3_IMPORT_EVIDENCE_ID_CONFLICT';
    end if;
  end loop;

  for finding_row in select value from jsonb_array_elements(finding_rows)
  loop
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
      finding_row->>'source_version',
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
      import_observed_at,
      import_observed_at,
      import_job_id
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
       or existing_finding.source_kind is distinct from 'deterministic-passive-scanner'
       or existing_finding.source_id is distinct from finding_row->>'source_id'
       or existing_finding.source_version is distinct from finding_row->>'source_version'
       or existing_finding.rule_ref is distinct from finding_row->>'rule_ref' then
      raise exception 'PHASE3_IMPORT_FINDING_ID_CONFLICT';
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
      import_job_id,
      target_run_ref,
      import_observed_at,
      'deterministic-passive-scanner',
      finding_row->>'source_id',
      finding_row->>'source_version',
      finding_row->>'validation_state'
    )
    on conflict (workspace_id, finding_id, scan_job_id) do nothing
    returning id into occurrence_id;

    if occurrence_id is null then
      continue;
    end if;

    for evidence_ref in select value from jsonb_array_elements(finding_row->'evidence_refs')
    loop
      insert into public.security_finding_evidence (
        workspace_id,
        finding_id,
        evidence_id
      ) values (
        target_workspace_id,
        finding_row->>'finding_id',
        evidence_ref #>> '{}'
      )
      on conflict (workspace_id, finding_id, evidence_id) do nothing;
    end loop;

    if coalesce(finding_inserted, false) then
      next_lifecycle := 'open';
      event_type := 'finding.created';
    elsif import_observed_at >= existing_finding.last_seen_at then
      next_lifecycle := case existing_finding.lifecycle_state
        when 'verified_fixed' then 'open'
        when 'resolved' then 'in_progress'
        when 'retest_pending' then 'in_progress'
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

    if not coalesce(finding_inserted, false)
       and import_observed_at >= existing_finding.last_seen_at then
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
             last_seen_at = import_observed_at,
             last_seen_job_id = import_job_id,
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
      import_job_id,
      'system',
      null,
      event_type,
      case when coalesce(finding_inserted, false) then null else existing_finding.lifecycle_state end,
      next_lifecycle,
      null,
      jsonb_build_object('phase3RunRef', target_run_ref)
    )
    on conflict (workspace_id, finding_id, scan_job_id, event_type)
      where scan_job_id is not null and actor_type = 'system'
    do nothing;
  end loop;

  insert into public.security_phase3_import_runs (
    workspace_id,
    asset_id,
    scan_job_id,
    run_ref,
    repository_canonical_url,
    schema_version,
    tool_version,
    scan_started_at,
    scan_duration_ms,
    scanner_descriptors,
    scanner_error_count,
    files_analyzed,
    files_skipped,
    total_bytes,
    finding_count,
    evidence_count,
    payload_digest,
    created_by
  ) values (
    target_workspace_id,
    target_asset_id,
    import_job_id,
    target_run_ref,
    target_repository_canonical_url,
    1,
    target_tool_version,
    target_scan_started_at,
    target_scan_duration_ms,
    target_scanner_descriptors,
    target_scanner_error_count,
    target_files_analyzed,
    target_files_skipped,
    target_total_bytes,
    jsonb_array_length(finding_rows),
    jsonb_array_length(evidence_rows),
    payload_digest_value,
    target_actor_id
  )
  returning id into import_run_id;

  return jsonb_build_object(
    'importRunId', import_run_id,
    'scanJobId', import_job_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.persist_phase3_import_result(
  uuid, uuid, uuid, text, text, text, timestamptz, integer, jsonb,
  integer, integer, integer, bigint, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.persist_phase3_import_result(
  uuid, uuid, uuid, text, text, text, timestamptz, integer, jsonb,
  integer, integer, integer, bigint, jsonb, jsonb
) to service_role;

create or replace function private.ingest_repository_scan_finding_batch(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_job_id uuid,
  target_run_ref text,
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
  next_event_type text;
begin
  if jsonb_typeof(finding_rows) is distinct from 'array'
     or jsonb_typeof(evidence_rows) is distinct from 'array'
     or jsonb_array_length(finding_rows) > 500
     or jsonb_array_length(evidence_rows) > 500
     or pg_column_size(finding_rows) + pg_column_size(evidence_rows) > 3670016 then
    raise exception 'REPOSITORY_SCAN_OUTPUT_INVALID';
  end if;

  for evidence_row in select value from jsonb_array_elements(evidence_rows)
  loop
    if jsonb_typeof(evidence_row) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(evidence_row)) <> 6
       or evidence_row->>'kind' not in ('static-analysis', 'dependency')
       or evidence_row->>'provenance_kind' <> 'scanner-derived'
       or evidence_row->>'classification' <> 'internal'
       or jsonb_typeof(evidence_row->'artifact_ref') is distinct from 'null'
       or char_length(coalesce(evidence_row->>'evidence_id', '')) not between 1 and 256
       or char_length(coalesce(evidence_row->>'summary', '')) not between 1 and 4096 then
      raise exception 'REPOSITORY_SCAN_OUTPUT_INVALID';
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
      'scanner-derived',
      evidence_row->>'summary',
      'internal',
      null
    )
    on conflict (workspace_id, evidence_id) do nothing;

    select * into existing_evidence
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
      raise exception 'REPOSITORY_SCAN_EVIDENCE_ID_CONFLICT';
    end if;
  end loop;

  for finding_row in select value from jsonb_array_elements(finding_rows)
  loop
    if jsonb_typeof(finding_row) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(finding_row)) <> 16
       or finding_row->>'source_kind' <> 'deterministic-passive-scanner'
       or finding_row->>'provenance_kind' <> 'scanner-derived'
       or finding_row->>'validation_state' not in ('static_confirmed', 'unvalidated')
       or finding_row->>'scan_run_ref' is distinct from target_run_ref
       or finding_row->>'severity' not in ('critical', 'high', 'medium', 'low', 'info')
       or finding_row->>'confidence' not in ('high', 'medium', 'low')
       or jsonb_typeof(finding_row->'location') not in ('object', 'null')
       or jsonb_typeof(finding_row->'taxonomy') is distinct from 'object'
       or jsonb_typeof(finding_row->'remediation') not in ('object', 'null')
       or jsonb_typeof(finding_row->'evidence_refs') is distinct from 'array'
       or jsonb_array_length(finding_row->'evidence_refs') not between 1 and 8
       or char_length(coalesce(finding_row->>'finding_id', '')) not between 1 and 256
       or char_length(coalesce(finding_row->>'source_id', '')) not between 1 and 256
       or char_length(coalesce(finding_row->>'source_version', '')) not between 1 and 128
       or char_length(coalesce(finding_row->>'rule_ref', '')) not between 1 and 512
       or char_length(coalesce(finding_row->>'title', '')) not between 1 and 240
       or char_length(coalesce(finding_row->>'description', '')) not between 1 and 8192 then
      raise exception 'REPOSITORY_SCAN_OUTPUT_INVALID';
    end if;

    for evidence_ref in select value from jsonb_array_elements(finding_row->'evidence_refs')
    loop
      if jsonb_typeof(evidence_ref) is distinct from 'string'
         or not exists (
           select 1
             from public.security_evidence
            where workspace_id = target_workspace_id
              and asset_id = target_asset_id
              and evidence_id = evidence_ref #>> '{}'
         ) then
        raise exception 'REPOSITORY_SCAN_OUTPUT_INVALID';
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
      'deterministic-passive-scanner',
      finding_row->>'source_id',
      finding_row->>'source_version',
      finding_row->>'rule_ref',
      finding_row->>'title',
      finding_row->>'description',
      finding_row->>'severity',
      finding_row->>'confidence',
      finding_row->>'validation_state',
      'scanner-derived',
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

    select * into existing_finding
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
      raise exception 'REPOSITORY_SCAN_FINDING_ID_CONFLICT';
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
      target_run_ref,
      observed_at,
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
      insert into public.security_finding_evidence (workspace_id, finding_id, evidence_id)
      values (target_workspace_id, finding_row->>'finding_id', evidence_ref #>> '{}')
      on conflict (workspace_id, finding_id, evidence_id) do nothing;
    end loop;

    if coalesce(finding_inserted, false) then
      next_lifecycle := 'open';
      next_event_type := 'finding.created';
    elsif observed_at >= existing_finding.last_seen_at then
      next_lifecycle := case existing_finding.lifecycle_state
        when 'verified_fixed' then 'open'
        when 'resolved' then 'in_progress'
        when 'retest_pending' then 'in_progress'
        when 'accepted_risk' then existing_finding.lifecycle_state
        when 'false_positive' then existing_finding.lifecycle_state
        else existing_finding.lifecycle_state
      end;
      next_event_type := case
        when next_lifecycle is distinct from existing_finding.lifecycle_state then 'finding.reopened'
        else 'finding.reobserved'
      end;
    else
      next_lifecycle := existing_finding.lifecycle_state;
      next_event_type := 'finding.reobserved';
    end if;

    if not coalesce(finding_inserted, false)
       and observed_at >= existing_finding.last_seen_at then
      update public.security_findings
         set title = finding_row->>'title',
             description = finding_row->>'description',
             severity = finding_row->>'severity',
             confidence = finding_row->>'confidence',
             validation_state = finding_row->>'validation_state',
             provenance_kind = 'scanner-derived',
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
      next_event_type,
      case when coalesce(finding_inserted, false) then null else existing_finding.lifecycle_state end,
      next_lifecycle,
      null,
      jsonb_build_object('repositoryScanRunRef', target_run_ref)
    )
    on conflict (workspace_id, finding_id, scan_job_id, event_type)
      where scan_job_id is not null and actor_type = 'system'
    do nothing;
  end loop;
end;
$$;

revoke all on function private.ingest_repository_scan_finding_batch(
  uuid, uuid, uuid, text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
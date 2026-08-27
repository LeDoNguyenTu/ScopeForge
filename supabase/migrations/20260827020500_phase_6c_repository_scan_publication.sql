create or replace function public.get_repository_scan_publication_context(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  scan_task private.repository_scan_tasks%rowtype;
  job_record public.scan_jobs%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  calculated_hash text;
  access_now timestamptz := now();
begin
  if target_worker_id is null
     or target_task_id is null
     or target_attempt_id is null
     or target_lease_token is null
     or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id;

  select * into task_record
    from private.worker_tasks
   where id = target_task_id;

  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id;

  if worker_record.id is null
     or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  if worker_record.execution_class <> 'phase3_repository_scan_no_egress_v1'
     or task_record.id is null
     or task_record.execution_class <> 'phase3_repository_scan_no_egress_v1'
     or task_record.state <> 'leased'
     or attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash
     or attempt_record.finished_at is not null
     or attempt_record.lease_expires_at <= access_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into scan_task
    from private.repository_scan_tasks
   where task_id = task_record.id
     and scan_job_id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  if scan_task.task_id is null
     or job_record.id is null
     or job_record.job_kind <> 'repository_scan'::public.scan_job_kind
     or job_record.status not in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  select * into snapshot_record
    from public.repository_source_snapshots
   where id = scan_task.snapshot_id
     and workspace_id = scan_task.workspace_id
     and asset_id = scan_task.asset_id;

  if snapshot_record.id is null then
    raise exception 'REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE';
  end if;

  return jsonb_build_object(
    'snapshotId', snapshot_record.id,
    'canonicalRepositoryUrl', snapshot_record.canonical_repository_url,
    'resolvedCommitSha', snapshot_record.resolved_commit_sha,
    'contentDigest', snapshot_record.content_digest,
    'artifactDigest', snapshot_record.artifact_digest,
    'retainedFileCount', snapshot_record.retained_file_count,
    'retainedBytes', snapshot_record.retained_bytes,
    'scannerProfileId', scan_task.scanner_profile_id,
    'scannerProfileVersion', scan_task.scanner_profile_version
  );
end;
$$;

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
  event_type text;
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
      event_type := 'finding.created';
    elsif observed_at >= existing_finding.last_seen_at then
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
      event_type,
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

create or replace function public.finalize_repository_scan_success(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_snapshot_id uuid,
  target_repository_canonical_url text,
  target_resolved_commit_sha text,
  target_snapshot_content_digest text,
  target_snapshot_artifact_digest text,
  target_scanner_profile_id text,
  target_scanner_profile_version integer,
  target_terminal_payload_digest text,
  target_result_digest text,
  target_run_ref text,
  target_tool_version text,
  target_scan_started_at timestamptz,
  target_scan_duration_ms integer,
  target_scanner_descriptors jsonb,
  target_scanner_error_count integer,
  target_files_analyzed integer,
  target_files_skipped integer,
  target_total_bytes bigint,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint,
  finding_rows jsonb,
  evidence_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  scan_task private.repository_scan_tasks%rowtype;
  job_record public.scan_jobs%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  existing_run public.repository_scan_runs%rowtype;
  publication_now timestamptz := now();
  observed_at timestamptz;
  calculated_hash text;
  run_id uuid;
begin
  if target_worker_id is null
     or target_task_id is null
     or target_attempt_id is null
     or target_snapshot_id is null
     or target_lease_token is null
     or target_lease_token !~ '^[a-f0-9]{64}$'
     or target_terminal_payload_digest is null
     or target_terminal_payload_digest !~ '^[a-f0-9]{64}$'
     or target_result_digest is null
     or target_result_digest !~ '^[a-f0-9]{64}$'
     or target_run_ref is null
     or target_run_ref !~ '^sfh1:[a-f0-9]{64}$'
     or target_resolved_commit_sha is null
     or target_resolved_commit_sha !~ '^[a-f0-9]{40}$'
     or target_snapshot_content_digest is null
     or target_snapshot_content_digest !~ '^[a-f0-9]{64}$'
     or target_snapshot_artifact_digest is null
     or target_snapshot_artifact_digest !~ '^[a-f0-9]{64}$'
     or target_repository_canonical_url is null
     or char_length(target_repository_canonical_url) not between 1 and 512
     or target_tool_version is null
     or char_length(target_tool_version) not between 1 and 64
     or target_scanner_profile_id <> 'phase3-hosted-static-v1'
     or target_scanner_profile_version <> 1
     or target_scanner_error_count <> 0
     or target_scan_started_at is null
     or target_scan_duration_ms is null
     or target_scan_duration_ms not between 0 and 300000
     or target_files_analyzed is null
     or target_files_analyzed not between 0 and 20000
     or target_files_skipped is null
     or target_files_skipped not between 0 and 20000
     or target_total_bytes is null
     or target_total_bytes not between 0 and 268435456
     or target_wall_time_ms is null
     or target_wall_time_ms not between 0 and 300000
     or target_cpu_time_ms is null
     or target_cpu_time_ms not between 0 and 300000
     or target_peak_memory_bytes is null
     or target_peak_memory_bytes not between 0 and 1073741824
     or target_input_bytes is null
     or target_input_bytes not between 0 and 268435456
     or target_output_bytes is null
     or target_output_bytes not between 0 and 3670016
     or target_scanner_descriptors is distinct from '["iac@1.0.0","jsts@1.0.0","sca@1.0.0","secrets@1.0.0"]'::jsonb
     or jsonb_typeof(finding_rows) is distinct from 'array'
     or jsonb_typeof(evidence_rows) is distinct from 'array'
     or jsonb_array_length(finding_rows) > 500
     or jsonb_array_length(evidence_rows) > 500
     or pg_column_size(finding_rows) + pg_column_size(evidence_rows) > 3670016 then
    raise exception 'REPOSITORY_SCAN_OUTPUT_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into task_record
    from private.worker_tasks
   where id = target_task_id
   for update;

  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id
   for update;

  if task_record.id is null
     or attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into scan_task
    from private.repository_scan_tasks
   where task_id = task_record.id
     and scan_job_id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;

  if scan_task.task_id is null
     or job_record.id is null
     or job_record.job_kind <> 'repository_scan'::public.scan_job_kind then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  select * into snapshot_record
    from public.repository_source_snapshots
   where id = scan_task.snapshot_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  if snapshot_record.id is null
     or scan_task.snapshot_id <> target_snapshot_id
     or scan_task.scanner_profile_id <> target_scanner_profile_id
     or scan_task.scanner_profile_version <> target_scanner_profile_version
     or snapshot_record.canonical_repository_url <> target_repository_canonical_url
     or snapshot_record.resolved_commit_sha <> target_resolved_commit_sha
     or snapshot_record.content_digest <> target_snapshot_content_digest
     or snapshot_record.artifact_digest <> target_snapshot_artifact_digest
     or target_files_analyzed + target_files_skipped > snapshot_record.retained_file_count
     or target_total_bytes > snapshot_record.retained_bytes then
    raise exception 'REPOSITORY_SCAN_OUTPUT_INVALID';
  end if;

  if attempt_record.finished_at is not null then
    select * into existing_run
      from public.repository_scan_runs
     where scan_job_id = job_record.id;

    if attempt_record.terminal_payload_digest = target_terminal_payload_digest
       and attempt_record.outcome = 'cancelled'
       and existing_run.id is null then
      return jsonb_build_object(
        'taskId', target_task_id,
        'attemptId', target_attempt_id,
        'outcome', 'cancelled',
        'replayed', true
      );
    end if;

    if attempt_record.terminal_payload_digest = target_terminal_payload_digest
       and attempt_record.outcome = 'succeeded'
       and existing_run.id is not null
       and existing_run.snapshot_id = target_snapshot_id
       and existing_run.run_ref = target_run_ref
       and existing_run.result_digest = target_result_digest
       and existing_run.resolved_commit_sha = target_resolved_commit_sha
       and existing_run.snapshot_content_digest = target_snapshot_content_digest
       and existing_run.snapshot_artifact_digest = target_snapshot_artifact_digest then
      return jsonb_build_object(
        'taskId', target_task_id,
        'attemptId', target_attempt_id,
        'runId', existing_run.id,
        'outcome', 'succeeded',
        'replayed', true
      );
    end if;

    raise exception 'REPOSITORY_SCAN_TERMINAL_CONFLICT';
  end if;

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id
   for update;

  if worker_record.id is null
     or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  if worker_record.execution_class <> 'phase3_repository_scan_no_egress_v1'
     or task_record.execution_class <> 'phase3_repository_scan_no_egress_v1'
     or task_record.state <> 'leased'
     or attempt_record.lease_expires_at <= publication_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if job_record.cancel_requested_at is not null
     or job_record.status = 'cancelled'::public.scan_job_status then
    update private.worker_attempts
       set finished_at = publication_now,
           outcome = 'cancelled',
           failure_code = 'WORKER_CANCELLED',
           terminal_payload_digest = target_terminal_payload_digest,
           wall_time_ms = target_wall_time_ms,
           cpu_time_ms = target_cpu_time_ms,
           peak_memory_bytes = target_peak_memory_bytes,
           input_bytes = target_input_bytes,
           output_bytes = target_output_bytes
     where id = attempt_record.id;

    update private.worker_tasks
       set state = 'cancelled', updated_at = publication_now
     where id = task_record.id;

    if job_record.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
      update public.scan_jobs
         set status = 'cancelled'::public.scan_job_status,
             finished_at = publication_now,
             failure_code = null
       where id = job_record.id;
    end if;

    perform private.record_worker_event(
      'worker.cancelled', task_record.workspace_id, worker_record.id, task_record.id,
      jsonb_build_object('attemptId', attempt_record.id, 'publicationRace', true)
    );

    return jsonb_build_object(
      'taskId', task_record.id,
      'attemptId', attempt_record.id,
      'outcome', 'cancelled',
      'replayed', false
    );
  end if;

  if job_record.status <> 'running'::public.scan_job_status then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  observed_at := target_scan_started_at
    + (target_scan_duration_ms::double precision * interval '1 millisecond');
  if target_scan_started_at < attempt_record.leased_at - interval '5 seconds'
     or target_scan_started_at > publication_now + interval '5 seconds'
     or observed_at > publication_now + interval '5 seconds' then
    raise exception 'REPOSITORY_SCAN_OUTPUT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      task_record.workspace_id::text || ':' || task_record.asset_id::text || ':' || target_run_ref,
      0
    )
  );

  select * into existing_run
    from public.repository_scan_runs
   where workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
     and run_ref = target_run_ref
   for update;

  if existing_run.id is not null then
    raise exception 'REPOSITORY_SCAN_TERMINAL_CONFLICT';
  end if;

  perform private.ingest_repository_scan_finding_batch(
    task_record.workspace_id,
    task_record.asset_id,
    job_record.id,
    target_run_ref,
    finding_rows,
    evidence_rows,
    observed_at
  );

  insert into public.repository_scan_runs (
    workspace_id,
    asset_id,
    snapshot_id,
    scan_job_id,
    requested_by,
    schema_version,
    scanner_profile_id,
    scanner_profile_version,
    tool_version,
    resolved_commit_sha,
    snapshot_content_digest,
    snapshot_artifact_digest,
    run_ref,
    scan_started_at,
    scan_duration_ms,
    scanner_descriptors,
    files_analyzed,
    files_skipped,
    total_bytes,
    finding_count,
    result_digest
  ) values (
    task_record.workspace_id,
    task_record.asset_id,
    snapshot_record.id,
    job_record.id,
    scan_task.requested_by,
    1,
    target_scanner_profile_id,
    target_scanner_profile_version,
    target_tool_version,
    target_resolved_commit_sha,
    target_snapshot_content_digest,
    target_snapshot_artifact_digest,
    target_run_ref,
    target_scan_started_at,
    target_scan_duration_ms,
    target_scanner_descriptors,
    target_files_analyzed,
    target_files_skipped,
    target_total_bytes,
    jsonb_array_length(finding_rows),
    target_result_digest
  ) returning id into run_id;

  update private.worker_attempts
     set finished_at = publication_now,
         outcome = 'succeeded',
         failure_code = null,
         terminal_payload_digest = target_terminal_payload_digest,
         wall_time_ms = target_wall_time_ms,
         cpu_time_ms = target_cpu_time_ms,
         peak_memory_bytes = target_peak_memory_bytes,
         input_bytes = target_input_bytes,
         output_bytes = target_output_bytes
   where id = attempt_record.id;

  update private.worker_tasks
     set state = 'completed', updated_at = publication_now
   where id = task_record.id;

  update public.scan_jobs
     set status = 'succeeded'::public.scan_job_status,
         finished_at = publication_now,
         failure_code = null,
         finding_count = jsonb_array_length(finding_rows)
   where id = job_record.id;

  perform private.record_worker_event(
    'worker.succeeded', task_record.workspace_id, worker_record.id, task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'repositoryScanRunId', run_id,
      'snapshotId', snapshot_record.id,
      'findingCount', jsonb_array_length(finding_rows)
    )
  );

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'runId', run_id,
    'outcome', 'succeeded',
    'replayed', false
  );
end;
$$;

revoke all on function public.get_repository_scan_publication_context(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_repository_scan_publication_context(uuid, uuid, uuid, text)
  to service_role;

revoke all on function private.ingest_repository_scan_finding_batch(uuid, uuid, uuid, text, jsonb, jsonb, timestamptz)
  from public, anon, authenticated, service_role;

revoke all on function public.finalize_repository_scan_success(
  uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer,
  text, text, text, text, timestamptz, integer, jsonb, integer, integer,
  integer, bigint, integer, integer, bigint, bigint, bigint, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_repository_scan_success(
  uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer,
  text, text, text, text, timestamptz, integer, jsonb, integer, integer,
  integer, bigint, integer, integer, bigint, bigint, bigint, jsonb, jsonb
) to service_role;

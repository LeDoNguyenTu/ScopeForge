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
    'assetId', scan_task.asset_id,
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

revoke all on function public.get_repository_scan_publication_context(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_repository_scan_publication_context(uuid, uuid, uuid, text)
  to service_role;

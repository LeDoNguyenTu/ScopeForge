create or replace function public.get_repository_scan_snapshot_artifact(
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
  artifact_record private.repository_source_artifacts%rowtype;
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

  if worker_record.id is null
     or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  if worker_record.execution_class <> 'phase3_repository_scan_no_egress_v1' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into task_record
    from private.worker_tasks
   where id = target_task_id;

  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id;

  if task_record.id is null
     or task_record.execution_class <> 'phase3_repository_scan_no_egress_v1'
     or task_record.state <> 'leased'
     or task_record.absolute_deadline_at <= access_now
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

  if scan_task.task_id is null
     or scan_task.snapshot_id is null then
    raise exception 'REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  if job_record.id is null
     or job_record.job_kind <> 'repository_scan'::public.scan_job_kind
     or job_record.status <> 'running'::public.scan_job_status
     or job_record.cancel_requested_at is not null then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  select * into snapshot_record
    from public.repository_source_snapshots
   where id = scan_task.snapshot_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  if snapshot_record.id is null
     or snapshot_record.expires_at <= access_now then
    raise exception 'REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE';
  end if;

  select * into artifact_record
    from private.repository_source_artifacts
   where snapshot_id = scan_task.snapshot_id;

  if artifact_record.snapshot_id is null
     or artifact_record.deletion_status <> 'active'
     or artifact_record.deleted_at is not null
     or artifact_record.expires_at <= access_now
     or artifact_record.stored_byte_count <> snapshot_record.stored_artifact_bytes
     or artifact_record.artifact_digest <> snapshot_record.artifact_digest then
    raise exception 'REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE';
  end if;

  return jsonb_build_object(
    'snapshotId', snapshot_record.id,
    'objectKey', artifact_record.object_key,
    'storedArtifactBytes', artifact_record.stored_byte_count,
    'artifactDigest', artifact_record.artifact_digest,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'artifactExpiresAt', least(snapshot_record.expires_at, artifact_record.expires_at)
  );
end;
$$;

revoke all on function public.get_repository_scan_snapshot_artifact(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_repository_scan_snapshot_artifact(uuid, uuid, uuid, text)
  to service_role;
create or replace function public.heartbeat_worker_attempt(
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
  job_record public.scan_jobs%rowtype;
  heartbeat_now timestamptz;
  calculated_hash text;
  next_expiry timestamptz;
  cancellation_requested boolean;
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id
   for update;

  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  select * into task_record
    from private.worker_tasks
   where id = target_task_id
   for update;

  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id
   for update;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;

  heartbeat_now := clock_timestamp();

  if task_record.id is null
     or attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash
     or attempt_record.finished_at is not null
     or task_record.state <> 'leased'
     or attempt_record.lease_expires_at <= heartbeat_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if job_record.id is null then
    raise exception 'WORKER_JOB_NOT_AVAILABLE';
  end if;

  cancellation_requested := job_record.cancel_requested_at is not null
    or job_record.status = 'cancelled'::public.scan_job_status;

  if cancellation_requested then
    next_expiry := attempt_record.lease_expires_at;
  else
    next_expiry := least(
      heartbeat_now + interval '90 seconds',
      task_record.absolute_deadline_at
    );
  end if;

  update private.worker_attempts
     set last_heartbeat_at = heartbeat_now,
         lease_expires_at = next_expiry
   where id = attempt_record.id
  returning * into attempt_record;

  update private.worker_nodes
     set last_seen_at = heartbeat_now
   where id = worker_record.id;

  return jsonb_build_object(
    'cancelRequested', cancellation_requested,
    'leaseExpiresAt', attempt_record.lease_expires_at
  );
end;
$$;

revoke all on function public.heartbeat_worker_attempt(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.heartbeat_worker_attempt(uuid, uuid, uuid, text)
  to service_role;

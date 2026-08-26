create index if not exists repository_snapshot_attempt_uploads_created_idx
  on private.repository_snapshot_attempt_uploads(created_at);

create or replace function public.list_repository_snapshot_cleanup_candidates(
  target_now timestamptz default now(),
  target_limit integer default 100
)
returns table (
  snapshot_id uuid,
  object_key text,
  expires_at timestamptz,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_now is null or target_limit is null or not (target_limit between 1 and 100) then
    raise exception 'REPOSITORY_SNAPSHOT_CLEANUP_INVALID';
  end if;

  return query
  with candidates as (
    select
      artifact.snapshot_id,
      artifact.object_key,
      artifact.expires_at,
      'expired'::text as reason
    from private.repository_source_artifacts artifact
    where artifact.deletion_status = 'active'
      and artifact.expires_at <= target_now

    union all

    select
      null::uuid as snapshot_id,
      upload.object_key,
      upload.created_at + interval '24 hours' as expires_at,
      'orphan'::text as reason
    from private.repository_snapshot_attempt_uploads upload
    join private.worker_attempts attempt
      on attempt.id = upload.attempt_id
     and attempt.task_id = upload.task_id
    join private.worker_tasks task
      on task.id = upload.task_id
    where upload.created_at <= target_now - interval '24 hours'
      and not exists (
        select 1
        from private.repository_source_artifacts published
        where published.object_key = upload.object_key
      )
      and (
        attempt.finished_at is not null
        or attempt.lease_expires_at <= target_now
        or task.state <> 'leased'
      )
  )
  select
    candidates.snapshot_id,
    candidates.object_key,
    candidates.expires_at,
    candidates.reason
  from candidates
  order by candidates.expires_at asc, candidates.object_key asc
  limit target_limit;
end;
$$;

create or replace function public.mark_repository_snapshot_artifact_deleted(
  target_snapshot_id uuid,
  target_object_key text,
  target_reason text,
  target_now timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  upload_record private.repository_snapshot_attempt_uploads%rowtype;
  attempt_record private.worker_attempts%rowtype;
  task_record private.worker_tasks%rowtype;
begin
  if target_now is null
     or target_object_key is null
     or target_object_key !~ '^repository-source/[a-f0-9]{64}[.]tar[.]gz$'
     or target_reason not in ('expired', 'orphan') then
    raise exception 'REPOSITORY_SNAPSHOT_CLEANUP_INVALID';
  end if;

  if target_reason = 'expired' then
    if target_snapshot_id is null then
      raise exception 'REPOSITORY_SNAPSHOT_CLEANUP_INVALID';
    end if;

    update private.repository_source_artifacts
       set deletion_status = 'deleted',
           deleted_at = coalesce(deleted_at, target_now)
     where snapshot_id = target_snapshot_id
       and object_key = target_object_key
       and deletion_status = 'active'
       and expires_at <= target_now;

    if found then
      return;
    end if;

    if exists (
      select 1
      from private.repository_source_artifacts
      where snapshot_id = target_snapshot_id
        and object_key = target_object_key
        and deletion_status = 'deleted'
    ) then
      return;
    end if;

    raise exception 'REPOSITORY_SNAPSHOT_CLEANUP_CONFLICT';
  end if;

  if target_snapshot_id is not null then
    raise exception 'REPOSITORY_SNAPSHOT_CLEANUP_INVALID';
  end if;

  select * into upload_record
  from private.repository_snapshot_attempt_uploads
  where object_key = target_object_key
  for update;

  if upload_record.attempt_id is null then
    return;
  end if;

  select * into attempt_record
  from private.worker_attempts
  where id = upload_record.attempt_id
    and task_id = upload_record.task_id
  for update;

  select * into task_record
  from private.worker_tasks
  where id = upload_record.task_id
  for update;

  if upload_record.created_at > target_now - interval '24 hours'
     or attempt_record.id is null
     or task_record.id is null
     or (
       attempt_record.finished_at is null
       and attempt_record.lease_expires_at > target_now
       and task_record.state = 'leased'
     )
     or exists (
       select 1
       from private.repository_source_artifacts published
       where published.object_key = target_object_key
     ) then
    raise exception 'REPOSITORY_SNAPSHOT_CLEANUP_CONFLICT';
  end if;

  delete from private.repository_snapshot_attempt_uploads
  where attempt_id = upload_record.attempt_id
    and task_id = upload_record.task_id
    and object_key = target_object_key;
end;
$$;

revoke all on function public.list_repository_snapshot_cleanup_candidates(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.list_repository_snapshot_cleanup_candidates(timestamptz, integer)
  to service_role;

revoke all on function public.mark_repository_snapshot_artifact_deleted(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mark_repository_snapshot_artifact_deleted(uuid, text, text, timestamptz)
  to service_role;

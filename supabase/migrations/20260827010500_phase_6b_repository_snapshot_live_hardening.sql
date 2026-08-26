revoke all on table public.repository_source_snapshots from service_role;

create index if not exists repository_source_snapshots_requested_by_idx
  on public.repository_source_snapshots(requested_by);

create index if not exists repository_snapshot_tasks_requested_by_idx
  on private.repository_snapshot_tasks(requested_by);

alter function public.finalize_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) rename to finalize_repository_snapshot_worker_attempt_v1;

alter function public.finalize_repository_snapshot_worker_attempt_v1(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) set schema private;

revoke all on function private.finalize_repository_snapshot_worker_attempt_v1(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) from public, anon, authenticated, service_role;

create or replace function public.finalize_repository_snapshot_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_payload_digest text,
  target_canonical_repository_url text,
  target_default_branch text,
  target_resolved_commit_sha text,
  target_content_digest text,
  target_artifact_digest text,
  target_compressed_bytes bigint,
  target_expanded_bytes bigint,
  target_retained_file_count integer,
  target_retained_bytes bigint,
  target_stored_artifact_bytes bigint,
  target_skip_counts jsonb,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint,
  target_server_observed_object_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from private.worker_tasks t
    join public.scan_jobs j
      on j.id = t.scan_job_id
     and j.workspace_id = t.workspace_id
     and j.asset_id = t.asset_id
    where t.id = target_task_id
      and t.execution_class = 'repository_snapshot_github_public_v1'
      and j.job_kind = 'repository_snapshot'::public.scan_job_kind
      and (
        j.cancel_requested_at is not null
        or j.status = 'cancelled'::public.scan_job_status
      )
  ) then
    return public.finalize_worker_attempt(
      target_worker_id,
      target_task_id,
      target_attempt_id,
      target_lease_token,
      'cancelled',
      null,
      target_terminal_payload_digest,
      target_wall_time_ms,
      target_cpu_time_ms,
      target_peak_memory_bytes,
      target_input_bytes,
      target_output_bytes
    );
  end if;

  return private.finalize_repository_snapshot_worker_attempt_v1(
    target_worker_id,
    target_task_id,
    target_attempt_id,
    target_lease_token,
    target_terminal_payload_digest,
    target_canonical_repository_url,
    target_default_branch,
    target_resolved_commit_sha,
    target_content_digest,
    target_artifact_digest,
    target_compressed_bytes,
    target_expanded_bytes,
    target_retained_file_count,
    target_retained_bytes,
    target_stored_artifact_bytes,
    target_skip_counts,
    target_wall_time_ms,
    target_cpu_time_ms,
    target_peak_memory_bytes,
    target_input_bytes,
    target_output_bytes,
    target_server_observed_object_bytes
  );
end;
$$;

revoke all on function public.finalize_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.finalize_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) to service_role;

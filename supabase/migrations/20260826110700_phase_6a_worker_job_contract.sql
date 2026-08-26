alter table public.scan_jobs
  add constraint scan_jobs_worker_foundation_probe_snapshot_check check (
    job_kind <> 'worker_foundation_probe'::public.scan_job_kind
    or (
      status <> 'blocked'::public.scan_job_status
      and blocked_reason is null
      and authorization_canonical_target is null
      and authorization_asset_kind is null
      and authorization_verified_at is null
      and validation_profile_id is null
      and validation_profile_version is null
      and authorization_granted_at is null
      and budget = '{"maxWallTimeMs":30000,"maxCpuTimeMs":20000,"maxMemoryBytes":268435456,"maxProcesses":4,"maxInputFiles":100,"maxInputBytes":10485760,"maxScratchBytes":33554432,"maxOutputBytes":1048576}'::jsonb
      and request_count = 0
      and redirect_count = 0
      and finding_count = 0
      and case status
        when 'queued'::public.scan_job_status then
          started_at is null and finished_at is null and failure_code is null
        when 'running'::public.scan_job_status then
          started_at is not null and finished_at is null and failure_code is null
        when 'succeeded'::public.scan_job_status then
          started_at is not null and finished_at is not null and failure_code is null and cancel_requested_at is null
        when 'failed'::public.scan_job_status then
          started_at is not null
          and finished_at is not null
          and cancel_requested_at is null
          and failure_code in ('WORKER_ATTEMPTS_EXHAUSTED', 'WORKER_BUDGET_EXCEEDED')
        when 'cancelled'::public.scan_job_status then
          finished_at is not null and failure_code is null
        else false
      end
    )
  );

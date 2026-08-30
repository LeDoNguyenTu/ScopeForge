alter table private.worker_nodes
  drop constraint if exists worker_nodes_execution_class_check;

alter table private.worker_nodes
  add constraint worker_nodes_execution_class_check check (
    execution_class in (
      'foundation_no_egress_v1',
      'repository_snapshot_github_public_v1',
      'phase3_repository_scan_no_egress_v1',
      'passive_runtime_observation_v1',
      'active_cors_validation_v1'
    )
  );

alter table private.worker_tasks
  drop constraint if exists worker_tasks_execution_class_check;

alter table private.worker_tasks
  add constraint worker_tasks_execution_class_check check (
    execution_class in (
      'foundation_no_egress_v1',
      'repository_snapshot_github_public_v1',
      'phase3_repository_scan_no_egress_v1',
      'passive_runtime_observation_v1',
      'active_cors_validation_v1'
    )
  );

alter table private.worker_tasks
  add constraint worker_tasks_phase6d_single_attempt_check check (
    execution_class not in (
      'passive_runtime_observation_v1',
      'active_cors_validation_v1'
    )
    or max_attempts = 1
  ),
  add constraint worker_tasks_phase6d_deadline_check check (
    case execution_class
      when 'passive_runtime_observation_v1' then
        absolute_deadline_at = created_at + interval '30 seconds'
      when 'active_cors_validation_v1' then
        absolute_deadline_at = created_at + interval '20 seconds'
      else true
    end
  );

create table private.runtime_worker_tasks (
  task_id uuid primary key references private.worker_tasks(id) on delete cascade,
  scan_job_id uuid not null unique,
  workspace_id uuid not null,
  asset_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  domain_job_kind public.scan_job_kind not null check (
    domain_job_kind in (
      'passive_runtime'::public.scan_job_kind,
      'active_validation'::public.scan_job_kind
    )
  ),
  schema_version smallint not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  constraint runtime_worker_tasks_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade,
  constraint runtime_worker_tasks_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade
);

create index runtime_worker_tasks_job_workspace_asset_idx
  on private.runtime_worker_tasks(scan_job_id, workspace_id, asset_id);

create index runtime_worker_tasks_asset_workspace_idx
  on private.runtime_worker_tasks(asset_id, workspace_id);

create index runtime_worker_tasks_workspace_created_idx
  on private.runtime_worker_tasks(workspace_id, created_at desc);

create or replace function private.guard_runtime_worker_task_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  worker_task_record private.worker_tasks%rowtype;
  job_record public.scan_jobs%rowtype;
begin
  select * into worker_task_record
    from private.worker_tasks
   where id = new.task_id
     and scan_job_id = new.scan_job_id
     and workspace_id = new.workspace_id
     and asset_id = new.asset_id;

  select * into job_record
    from public.scan_jobs
   where id = new.scan_job_id
     and workspace_id = new.workspace_id
     and asset_id = new.asset_id;

  if worker_task_record.id is null or job_record.id is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if job_record.requested_by <> new.requested_by
     or job_record.job_kind <> new.domain_job_kind
     or job_record.status <> 'queued'::public.scan_job_status
     or job_record.cancel_requested_at is not null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if not (
    (worker_task_record.execution_class = 'passive_runtime_observation_v1'
      and new.domain_job_kind = 'passive_runtime'::public.scan_job_kind)
    or
    (worker_task_record.execution_class = 'active_cors_validation_v1'
      and new.domain_job_kind = 'active_validation'::public.scan_job_kind)
  ) then
    raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger runtime_worker_tasks_guard_insert
before insert on private.runtime_worker_tasks
for each row execute function private.guard_runtime_worker_task_insert();

create or replace function private.guard_runtime_worker_task_update()
returns trigger
language plpgsql
set search_path = ''
as $$;
begin
  raise exception 'Runtime worker task bindings are immutable';
end;
$$;

create trigger runtime_worker_tasks_guard_update
before update on private.runtime_worker_tasks
for each row execute function private.guard_runtime_worker_task_update();

revoke all on table private.runtime_worker_tasks from public, anon, authenticated, service_role;
revoke all on function private.guard_runtime_worker_task_insert() from public, anon, authenticated, service_role;
revoke all on function private.guard_runtime_worker_task_update() from public, anon, authenticated, service_role;

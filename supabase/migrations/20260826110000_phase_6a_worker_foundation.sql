create table private.worker_nodes (
  id uuid primary key default gen_random_uuid(),
  credential_hash text not null unique check (credential_hash ~ '^[a-f0-9]{64}$'),
  execution_class text not null check (execution_class = 'foundation_no_egress_v1'),
  software_version text not null check (char_length(software_version) between 1 and 64),
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  disabled_at timestamptz,
  constraint worker_nodes_timestamp_check check (
    (last_seen_at is null or last_seen_at >= registered_at)
    and (disabled_at is null or disabled_at >= registered_at)
  )
);

create table private.worker_tasks (
  id uuid primary key default gen_random_uuid(),
  scan_job_id uuid not null unique,
  workspace_id uuid not null,
  asset_id uuid not null,
  execution_class text not null check (execution_class = 'foundation_no_egress_v1'),
  state text not null default 'queued' check (
    state in ('queued', 'leased', 'retry_wait', 'completed', 'dead_letter', 'cancelled')
  ),
  priority smallint not null default 0 check (priority between -100 and 100),
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  max_attempts integer not null default 3 check (max_attempts between 1 and 3),
  absolute_deadline_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_tasks_attempt_bound_check check (attempt_count <= max_attempts),
  constraint worker_tasks_deadline_check check (absolute_deadline_at > created_at),
  constraint worker_tasks_available_check check (available_at <= absolute_deadline_at),
  constraint worker_tasks_scan_job_fkey
    foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade,
  constraint worker_tasks_workspace_fkey
    foreign key (workspace_id)
    references public.workspaces(id)
    on delete cascade,
  constraint worker_tasks_asset_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade
);

create table private.worker_attempts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references private.worker_tasks(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 3),
  worker_id uuid not null references private.worker_nodes(id),
  lease_token_hash text not null check (lease_token_hash ~ '^[a-f0-9]{64}$'),
  leased_at timestamptz not null,
  lease_expires_at timestamptz not null,
  last_heartbeat_at timestamptz,
  finished_at timestamptz,
  outcome text check (
    outcome is null
    or outcome in ('succeeded', 'failed', 'cancelled', 'lease_expired', 'worker_lost')
  ),
  failure_code text check (
    failure_code is null or char_length(failure_code) between 1 and 64
  ),
  terminal_payload_digest text check (
    terminal_payload_digest is null or terminal_payload_digest ~ '^[a-f0-9]{64}$'
  ),
  wall_time_ms integer check (wall_time_ms is null or wall_time_ms >= 0),
  cpu_time_ms integer check (cpu_time_ms is null or cpu_time_ms >= 0),
  peak_memory_bytes bigint check (peak_memory_bytes is null or peak_memory_bytes >= 0),
  input_bytes bigint check (input_bytes is null or input_bytes >= 0),
  output_bytes bigint check (output_bytes is null or output_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (task_id, attempt_number),
  constraint worker_attempts_lease_check check (
    lease_expires_at > leased_at
    and (last_heartbeat_at is null or last_heartbeat_at >= leased_at)
    and (last_heartbeat_at is null or last_heartbeat_at <= lease_expires_at)
  ),
  constraint worker_attempts_terminal_check check (
    (finished_at is null and outcome is null and failure_code is null and terminal_payload_digest is null)
    or (finished_at is not null and outcome is not null)
  )
);

create unique index worker_attempts_one_active_per_task_idx
  on private.worker_attempts(task_id)
  where finished_at is null;

create index worker_tasks_claim_idx
  on private.worker_tasks(
    execution_class,
    state,
    priority desc,
    available_at,
    created_at,
    id
  );

create index worker_tasks_scan_job_workspace_asset_idx
  on private.worker_tasks(scan_job_id, workspace_id, asset_id);

create index worker_tasks_asset_workspace_idx
  on private.worker_tasks(asset_id, workspace_id);

create index worker_attempts_worker_id_idx
  on private.worker_attempts(worker_id);

create index worker_attempts_active_lease_idx
  on private.worker_attempts(lease_expires_at)
  where finished_at is null;

create or replace function private.guard_worker_node_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.credential_hash is distinct from old.credential_hash
     or new.execution_class is distinct from old.execution_class
     or new.software_version is distinct from old.software_version
     or new.registered_at is distinct from old.registered_at then
    raise exception 'Worker node identity fields are immutable';
  end if;

  if old.disabled_at is not null and new.disabled_at is distinct from old.disabled_at then
    raise exception 'Disabled worker nodes cannot be re-enabled';
  end if;

  if new.last_seen_at is distinct from old.last_seen_at
     and new.last_seen_at is not null
     and old.last_seen_at is not null
     and new.last_seen_at < old.last_seen_at then
    raise exception 'Worker node heartbeat cannot move backwards';
  end if;

  return new;
end;
$$;

create trigger worker_nodes_guard_update
before update on private.worker_nodes
for each row execute function private.guard_worker_node_update();

create or replace function private.guard_worker_task_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.scan_job_id is distinct from old.scan_job_id
     or new.workspace_id is distinct from old.workspace_id
     or new.asset_id is distinct from old.asset_id
     or new.execution_class is distinct from old.execution_class
     or new.priority is distinct from old.priority
     or new.max_attempts is distinct from old.max_attempts
     or new.absolute_deadline_at is distinct from old.absolute_deadline_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Worker task identity fields are immutable';
  end if;

  if new.attempt_count < old.attempt_count or new.attempt_count > old.attempt_count + 1 then
    raise exception 'Worker task attempt count transition is invalid';
  end if;

  if new.state is distinct from old.state then
    if old.state = 'queued' and new.state not in ('leased', 'cancelled') then
      raise exception 'Invalid worker task state transition';
    elsif old.state = 'leased' and new.state not in ('retry_wait', 'completed', 'dead_letter', 'cancelled') then
      raise exception 'Invalid worker task state transition';
    elsif old.state = 'retry_wait' and new.state not in ('leased', 'cancelled') then
      raise exception 'Invalid worker task state transition';
    elsif old.state in ('completed', 'dead_letter', 'cancelled') then
      raise exception 'Worker task terminal states are immutable';
    end if;
  elsif old.state in ('completed', 'dead_letter', 'cancelled')
        and row(new.*) is distinct from row(old.*) then
    raise exception 'Worker task terminal states are immutable';
  end if;

  if new.updated_at < old.updated_at then
    raise exception 'Worker task update timestamp cannot move backwards';
  end if;

  return new;
end;
$$;

create trigger worker_tasks_guard_update
before update on private.worker_tasks
for each row execute function private.guard_worker_task_update();

create or replace function private.guard_worker_attempt_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.task_id is distinct from old.task_id
     or new.attempt_number is distinct from old.attempt_number
     or new.worker_id is distinct from old.worker_id
     or new.lease_token_hash is distinct from old.lease_token_hash
     or new.leased_at is distinct from old.leased_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Worker attempt identity fields are immutable';
  end if;

  if old.finished_at is not null and row(new.*) is distinct from row(old.*) then
    raise exception 'Worker attempt terminal state is immutable';
  end if;

  if new.lease_expires_at < old.lease_expires_at then
    raise exception 'Worker attempt lease cannot shrink';
  end if;

  if new.last_heartbeat_at is distinct from old.last_heartbeat_at
     and new.last_heartbeat_at is not null
     and old.last_heartbeat_at is not null
     and new.last_heartbeat_at < old.last_heartbeat_at then
    raise exception 'Worker attempt heartbeat cannot move backwards';
  end if;

  return new;
end;
$$;

create trigger worker_attempts_guard_update
before update on private.worker_attempts
for each row execute function private.guard_worker_attempt_update();

revoke all on table private.worker_nodes from public, anon, authenticated;
revoke all on table private.worker_tasks from public, anon, authenticated;
revoke all on table private.worker_attempts from public, anon, authenticated;

create type public.asset_kind as enum ('web_application', 'api', 'repository');
create type public.asset_verification_status as enum ('unverified', 'pending', 'verified', 'failed');
create type public.scan_job_status as enum ('queued', 'blocked', 'cancelled');
create type public.audit_actor_type as enum ('user', 'system');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind public.asset_kind not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  canonical_target text not null check (char_length(canonical_target) between 1 and 2048),
  hostname text check (hostname is null or char_length(hostname) <= 253),
  verification_status public.asset_verification_status not null default 'unverified',
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, canonical_target)
);

create table public.asset_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  method text not null check (method in ('http_well_known')),
  token_hash text not null check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  status public.scan_job_status not null default 'blocked',
  requested_by uuid not null references auth.users(id) on delete restrict,
  blocked_reason text not null default 'Active scanning is not enabled in Phase 2',
  created_at timestamptz not null default now(),
  check (status <> 'queued')
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_type public.audit_actor_type not null default 'user',
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 100),
  target_type text check (target_type is null or char_length(target_type) <= 80),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 8192),
  created_at timestamptz not null default now()
);

create table public.workspace_usage (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  registered_assets integer not null default 0 check (registered_assets >= 0),
  verification_attempts_today integer not null default 0 check (verification_attempts_today >= 0),
  verification_attempt_date date not null default current_date,
  queued_jobs integer not null default 0 check (queued_jobs >= 0),
  updated_at timestamptz not null default now()
);

create index assets_workspace_status_idx on public.assets(workspace_id, verification_status, created_at desc);
create index asset_verification_asset_created_idx on public.asset_verification_challenges(asset_id, created_at desc);
create index asset_verification_workspace_attempt_idx on public.asset_verification_challenges(workspace_id, last_attempt_at desc);
create index scan_jobs_workspace_created_idx on public.scan_jobs(workspace_id, created_at desc);
create index audit_events_workspace_created_idx on public.audit_events(workspace_id, created_at desc);

create trigger assets_set_updated_at before update on public.assets for each row execute function private.set_updated_at();
create trigger workspace_usage_set_updated_at before update on public.workspace_usage for each row execute function private.set_updated_at();

insert into public.workspace_usage (workspace_id, registered_assets)
select w.id, count(a.id)::integer
from public.workspaces w
left join public.assets a on a.workspace_id = w.id
group by w.id
on conflict (workspace_id) do nothing;

create or replace function private.handle_workspace_usage_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_usage (workspace_id) values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

create trigger workspaces_create_usage_row
after insert on public.workspaces
for each row execute function private.handle_workspace_usage_row();

create or replace function private.sync_asset_usage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.workspace_usage (workspace_id, registered_assets)
    values (new.workspace_id, 1)
    on conflict (workspace_id) do update
      set registered_assets = public.workspace_usage.registered_assets + 1,
          updated_at = now();
    return new;
  elsif tg_op = 'DELETE' then
    update public.workspace_usage
      set registered_assets = greatest(registered_assets - 1, 0), updated_at = now()
      where workspace_id = old.workspace_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger assets_sync_usage_after_insert
after insert on public.assets
for each row execute function private.sync_asset_usage();
create trigger assets_sync_usage_after_delete
after delete on public.assets
for each row execute function private.sync_asset_usage();

alter table public.assets enable row level security;
alter table public.asset_verification_challenges enable row level security;
alter table public.scan_jobs enable row level security;
alter table public.audit_events enable row level security;
alter table public.workspace_usage enable row level security;

create policy assets_select_member on public.assets
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy assets_insert_contributor on public.assets
for insert to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role])
  and created_by = (select auth.uid())
);

create policy assets_update_contributor on public.assets
for update to authenticated
using (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role]))
with check (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role]));

create policy assets_delete_contributor on public.assets
for delete to authenticated
using (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role]));

create policy verification_select_member on public.asset_verification_challenges
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy verification_insert_contributor on public.asset_verification_challenges
for insert to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role])
  and created_by = (select auth.uid())
);

create policy verification_update_contributor on public.asset_verification_challenges
for update to authenticated
using (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role]))
with check (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role]));

create policy verification_delete_contributor on public.asset_verification_challenges
for delete to authenticated
using (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role]));

create policy scan_jobs_select_member on public.scan_jobs
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy audit_events_select_member on public.audit_events
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy workspace_usage_select_member on public.workspace_usage
for select to authenticated
using (private.is_workspace_member(workspace_id));

create or replace function public.record_audit_event(
  target_workspace_id uuid,
  event_name text,
  target_kind text default null,
  target_record_id uuid default null,
  details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  current_actor uuid;
begin
  current_actor := (select auth.uid());
  if current_actor is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_workspace_member(target_workspace_id) then
    raise exception 'Workspace access denied';
  end if;
  if event_name is null or char_length(event_name) < 1 or char_length(event_name) > 100 then
    raise exception 'Invalid event type';
  end if;
  if details is null or jsonb_typeof(details) <> 'object' or pg_column_size(details) > 8192 then
    raise exception 'Invalid audit metadata';
  end if;
  insert into public.audit_events (workspace_id, actor_type, actor_id, event_type, target_type, target_id, metadata)
  values (target_workspace_id, 'user', current_actor, event_name, target_kind, target_record_id, details)
  returning id into event_id;
  return event_id;
end;
$$;

revoke all on function public.record_audit_event(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.record_audit_event(uuid, text, text, uuid, jsonb) to authenticated;

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('owner', 'admin')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null check (char_length(action) between 1 and 100),
  target_user_id uuid,
  target_workspace_id uuid,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 8192),
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  id boolean primary key default true check (id = true),
  registration_enabled boolean not null default true,
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'ScopeForge is temporarily undergoing maintenance.'
    check (char_length(maintenance_message) between 1 and 280),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (true)
on conflict (id) do nothing;

create index platform_admins_role_idx on public.platform_admins(role, created_at);
create index platform_admin_audit_created_idx on public.platform_admin_audit_events(created_at desc);
create index platform_admin_audit_actor_idx on public.platform_admin_audit_events(actor_user_id, created_at desc);
create index platform_admin_audit_target_user_idx on public.platform_admin_audit_events(target_user_id, created_at desc)
where target_user_id is not null;

create trigger platform_admins_set_updated_at
before update on public.platform_admins
for each row execute function private.set_updated_at();

create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function private.set_updated_at();

create or replace function private.guard_last_platform_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and (
    tg_op = 'DELETE'
    or (tg_op = 'UPDATE' and new.role <> 'owner')
  ) then
    if not exists (
      select 1
      from public.platform_admins pa
      where pa.role = 'owner'
        and pa.user_id <> old.user_id
    ) then
      raise exception 'LAST_PLATFORM_OWNER';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_last_platform_owner() from public, anon, authenticated, service_role;

create trigger platform_admins_guard_last_owner
before update or delete on public.platform_admins
for each row execute function private.guard_last_platform_owner();

alter table public.platform_admins enable row level security;
alter table public.platform_admin_audit_events enable row level security;
alter table public.platform_settings enable row level security;

revoke all on table public.platform_admins from public, anon, authenticated;
revoke all on table public.platform_admin_audit_events from public, anon, authenticated;
revoke all on table public.platform_settings from public, anon, authenticated;

grant select, insert, update, delete on table public.platform_admins to service_role;
grant select, insert on table public.platform_admin_audit_events to service_role;
grant select, update on table public.platform_settings to service_role;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_workspace_id uuid;
  base_name text;
  workspace_slug text;
  registration_is_enabled boolean;
begin
  select ps.registration_enabled
    into registration_is_enabled
    from public.platform_settings ps
    where ps.id = true;

  if coalesce(registration_is_enabled, true) = false then
    raise exception 'REGISTRATION_DISABLED';
  end if;

  base_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'My'
  );
  workspace_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
  workspace_slug := trim(both '-' from workspace_slug);
  workspace_slug := left(coalesce(nullif(workspace_slug, ''), 'workspace'), 48)
    || '-'
    || left(replace(gen_random_uuid()::text, '-', ''), 8);

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  );

  insert into public.workspaces (name, slug, created_by)
  values (left(base_name || '''s workspace', 100), workspace_slug, new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;

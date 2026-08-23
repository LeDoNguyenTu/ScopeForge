create extension if not exists pgcrypto;
create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);
create index workspaces_created_by_idx on public.workspaces(created_by);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid()
  );
$$;

create or replace function private.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid() and wm.role = any(allowed_roles)
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, public.workspace_role[]) from public;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_workspace_id uuid;
  base_name text;
  workspace_slug text;
begin
  base_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'My');
  workspace_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
  workspace_slug := trim(both '-' from workspace_slug);
  workspace_slug := left(coalesce(nullif(workspace_slug, ''), 'workspace'), 48) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  insert into public.profiles (id, display_name, avatar_url) values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''));
  insert into public.workspaces (name, slug, created_by) values (left(base_name || '''s workspace', 100), workspace_slug, new.id) returning id into new_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "profiles_select_self" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "workspaces_select_member" on public.workspaces for select to authenticated using (private.is_workspace_member(id));
create policy "workspaces_insert_creator" on public.workspaces for insert to authenticated with check (created_by = auth.uid());
create policy "workspaces_update_admin" on public.workspaces for update to authenticated using (private.has_workspace_role(id, array['owner'::public.workspace_role, 'admin'::public.workspace_role])) with check (private.has_workspace_role(id, array['owner'::public.workspace_role, 'admin'::public.workspace_role]));
create policy "workspaces_delete_owner" on public.workspaces for delete to authenticated using (private.has_workspace_role(id, array['owner'::public.workspace_role]));
create policy "workspace_members_select_member" on public.workspace_members for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "workspace_members_insert_admin" on public.workspace_members for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role]));
create policy "workspace_members_update_admin" on public.workspace_members for update to authenticated using (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role])) with check (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role]));
create policy "workspace_members_delete_admin" on public.workspace_members for delete to authenticated using (private.has_workspace_role(workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role]));

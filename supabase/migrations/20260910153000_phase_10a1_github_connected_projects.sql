create table public.github_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  installation_id bigint not null unique check (installation_id > 0),
  account_id bigint not null check (account_id > 0),
  account_login text not null check (char_length(trim(account_login)) between 1 and 100),
  account_type text not null check (account_type in ('User', 'Organization')),
  repository_selection text not null check (repository_selection in ('all', 'selected')),
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  installed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.github_repository_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  github_connection_id uuid not null,
  asset_id uuid not null unique,
  repository_id bigint not null check (repository_id > 0),
  owner_login text not null check (char_length(trim(owner_login)) between 1 and 100),
  repository_name text not null check (char_length(trim(repository_name)) between 1 and 100),
  full_name text not null check (char_length(full_name) between 3 and 220),
  default_branch text not null check (char_length(default_branch) between 1 and 255),
  is_private boolean not null,
  html_url text not null check (
    char_length(html_url) between 19 and 2048
    and html_url like 'https://github.com/%'
  ),
  auto_scan_enabled boolean not null default true,
  access_status text not null default 'active' check (access_status in ('active', 'inaccessible', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, repository_id),
  constraint github_repository_links_connection_workspace_fkey
    foreign key (github_connection_id, workspace_id)
    references public.github_connections(id, workspace_id)
    on delete cascade,
  constraint github_repository_links_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade
);

create index github_connections_workspace_status_idx
  on public.github_connections(workspace_id, status, updated_at desc);
create index github_repository_links_connection_idx
  on public.github_repository_links(github_connection_id, created_at desc);
create index github_repository_links_workspace_access_idx
  on public.github_repository_links(workspace_id, access_status, updated_at desc);

create trigger github_connections_set_updated_at
before update on public.github_connections
for each row execute function private.set_updated_at();

create trigger github_repository_links_set_updated_at
before update on public.github_repository_links
for each row execute function private.set_updated_at();

alter table public.github_connections enable row level security;
alter table public.github_repository_links enable row level security;

revoke all on table public.github_connections from public, anon, authenticated;
revoke all on table public.github_repository_links from public, anon, authenticated;

grant select on table public.github_connections to authenticated;
grant select on table public.github_repository_links to authenticated;

grant select, insert, update, delete on table public.github_connections to service_role;
grant select, insert, update, delete on table public.github_repository_links to service_role;

create policy github_connections_select_member
  on public.github_connections
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy github_repository_links_select_member
  on public.github_repository_links
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

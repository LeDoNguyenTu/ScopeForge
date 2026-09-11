revoke all on table public.github_connections from service_role;
grant select, insert, update, delete on table public.github_connections to service_role;

revoke all on table public.github_repository_links from service_role;
grant select, insert, update, delete on table public.github_repository_links to service_role;

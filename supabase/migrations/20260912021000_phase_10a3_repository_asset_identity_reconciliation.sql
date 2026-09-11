-- Phase 10A3 corrective overlay: keep repository link and repository asset identity atomic.
-- This migration replaces only the service-role repository reconciliation function.

create or replace function public.reconcile_github_webhook_repository_state(
  target_installation_id bigint,
  target_repository_id bigint,
  target_owner_login text,
  target_repository_name text,
  target_full_name text,
  target_default_branch text,
  target_is_private boolean,
  target_html_url text,
  target_provider_archived boolean,
  target_access_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.github_connections%rowtype;
  link_record public.github_repository_links%rowtype;
  asset_record public.assets%rowtype;
  effective_access_status text;
begin
  if target_installation_id is null
     or target_installation_id <= 0
     or target_repository_id is null
     or target_repository_id <= 0
     or target_owner_login is null
     or char_length(target_owner_login) not between 1 and 100
     or target_repository_name is null
     or char_length(target_repository_name) not between 1 and 100
     or target_full_name <> target_owner_login || '/' || target_repository_name
     or target_default_branch is null
     or char_length(target_default_branch) not between 1 and 255
     or target_html_url <> 'https://github.com/' || target_full_name
     or target_is_private is null
     or target_provider_archived is null
     or target_access_status not in ('active', 'inaccessible', 'removed') then
    raise exception 'GITHUB_WEBHOOK_REPOSITORY_STATE_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-installation:' || target_installation_id::text, 0)
  );

  select *
  into connection_record
  from public.github_connections
  where installation_id = target_installation_id
  for update;

  if connection_record.id is null then
    return jsonb_build_object('matched', false, 'installationId', target_installation_id);
  end if;

  select *
  into link_record
  from public.github_repository_links
  where workspace_id = connection_record.workspace_id
    and github_connection_id = connection_record.id
    and repository_id = target_repository_id
  for update;

  if link_record.id is null then
    return jsonb_build_object(
      'matched', false,
      'workspaceId', connection_record.workspace_id,
      'repositoryId', target_repository_id
    );
  end if;

  select *
  into asset_record
  from public.assets
  where id = link_record.asset_id
    and workspace_id = connection_record.workspace_id
  for update;

  if asset_record.id is null
     or asset_record.kind <> 'repository'::public.asset_kind
     or asset_record.canonical_target <> link_record.html_url then
    raise exception 'GITHUB_WEBHOOK_REPOSITORY_ASSET_MISMATCH';
  end if;

  effective_access_status := case
    when connection_record.status <> 'active' then 'inaccessible'
    else target_access_status
  end;

  update public.github_repository_links
  set owner_login = target_owner_login,
      repository_name = target_repository_name,
      full_name = target_full_name,
      default_branch = target_default_branch,
      is_private = target_is_private,
      html_url = target_html_url,
      access_status = effective_access_status,
      project_scan_state = case
        when effective_access_status <> 'active' or target_provider_archived then 'idle'
        else project_scan_state
      end,
      updated_at = now()
  where id = link_record.id
    and workspace_id = connection_record.workspace_id;

  update public.assets
  set canonical_target = target_html_url,
      updated_at = now()
  where id = asset_record.id
    and workspace_id = connection_record.workspace_id;

  insert into private.github_repository_auto_scan_state (
    link_id,
    workspace_id,
    repository_id,
    pending,
    provider_archived,
    last_outcome_code,
    created_at,
    updated_at
  )
  values (
    link_record.id,
    connection_record.workspace_id,
    target_repository_id,
    false,
    target_provider_archived,
    case
      when target_provider_archived then 'IGNORED_ARCHIVED'
      when effective_access_status <> 'active' then 'IGNORED_INACCESSIBLE'
      else null
    end,
    now(),
    now()
  )
  on conflict (link_id) do update
  set repository_id = excluded.repository_id,
      provider_archived = excluded.provider_archived,
      pending = case
        when excluded.provider_archived or effective_access_status <> 'active' then false
        else private.github_repository_auto_scan_state.pending
      end,
      last_outcome_code = case
        when excluded.provider_archived then 'IGNORED_ARCHIVED'
        when effective_access_status <> 'active' then 'IGNORED_INACCESSIBLE'
        else private.github_repository_auto_scan_state.last_outcome_code
      end,
      updated_at = now();

  return jsonb_build_object(
    'matched', true,
    'workspaceId', connection_record.workspace_id,
    'connectionId', connection_record.id,
    'linkId', link_record.id,
    'assetId', link_record.asset_id,
    'repositoryId', target_repository_id,
    'installedBy', connection_record.installed_by,
    'autoScanEnabled', link_record.auto_scan_enabled,
    'accessStatus', effective_access_status,
    'providerArchived', target_provider_archived,
    'defaultBranch', target_default_branch,
    'isPrivate', target_is_private,
    'htmlUrl', target_html_url
  );
end;
$$;

revoke all on function public.reconcile_github_webhook_repository_state(
  bigint, bigint, text, text, text, text, boolean, text, boolean, text
) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_github_webhook_repository_state(
  bigint, bigint, text, text, text, text, boolean, text, boolean, text
) to service_role;

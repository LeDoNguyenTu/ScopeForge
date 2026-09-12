-- Phase 10A3 release hardening: recover same-head pending webhook state when no active
-- project-scan intent owns the queue chain.
--
-- record_github_webhook_push_head and enqueue_github_webhook_project_snapshot execute in
-- separate transactions. A newer delivery for the same authoritative head can therefore
-- advance latest_delivery_id before the earlier caller enqueues. The older enqueue must
-- remain stale and fail closed, but the newest same-head delivery must be allowed to own
-- enqueue when pending=true does not correspond to an active intent.

create or replace function public.record_github_webhook_push_head(
  target_workspace_id uuid,
  target_link_id uuid,
  target_repository_id bigint,
  target_delivery_id uuid,
  target_commit_sha text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_record public.github_repository_links%rowtype;
  connection_record public.github_connections%rowtype;
  auto_record private.github_repository_auto_scan_state%rowtype;
  intent_record private.github_project_scan_intents%rowtype;
  already_active boolean := false;
begin
  if target_workspace_id is null or target_link_id is null or target_delivery_id is null
     or target_repository_id is null or target_repository_id <= 0
     or target_commit_sha is null or target_commit_sha !~ '^[a-f0-9]{40}$' then
    raise exception 'GITHUB_WEBHOOK_PUSH_HEAD_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-github-auto-scan-link:' || target_link_id::text, 0)
  );

  select * into link_record
    from public.github_repository_links
   where id = target_link_id
     and workspace_id = target_workspace_id
     and repository_id = target_repository_id
   for update;
  if link_record.id is null then
    raise exception 'GITHUB_WEBHOOK_REPOSITORY_UNAVAILABLE';
  end if;

  select * into connection_record
    from public.github_connections
   where id = link_record.github_connection_id
     and workspace_id = target_workspace_id
   for update;
  if connection_record.id is null
     or connection_record.status <> 'active'
     or link_record.access_status <> 'active'
     or not link_record.auto_scan_enabled then
    return jsonb_build_object(
      'replayed', false,
      'shouldEnqueue', false,
      'ignored', true,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  if not exists (
    select 1 from private.github_webhook_deliveries
     where delivery_id = target_delivery_id
  ) then
    raise exception 'GITHUB_WEBHOOK_DELIVERY_UNKNOWN';
  end if;

  insert into private.github_repository_auto_scan_state (
    link_id, workspace_id, repository_id, latest_delivery_id, pending,
    provider_archived, created_at, updated_at
  ) values (
    link_record.id, link_record.workspace_id, link_record.repository_id,
    target_delivery_id, false, false, now(), now()
  )
  on conflict (link_id) do nothing;

  select * into auto_record
    from private.github_repository_auto_scan_state
   where link_id = link_record.id
     and workspace_id = link_record.workspace_id
   for update;

  if auto_record.provider_archived then
    update private.github_repository_auto_scan_state
       set latest_delivery_id = target_delivery_id,
           pending = false,
           last_outcome_code = 'IGNORED_ARCHIVED',
           updated_at = now()
     where link_id = link_record.id;
    return jsonb_build_object(
      'replayed', false,
      'shouldEnqueue', false,
      'ignored', true,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  if auto_record.successful_commit_sha = target_commit_sha
     and not auto_record.pending then
    update private.github_repository_auto_scan_state
       set desired_commit_sha = target_commit_sha,
           latest_delivery_id = target_delivery_id,
           last_outcome_code = 'SEMANTIC_REPLAY',
           updated_at = now()
     where link_id = link_record.id;
    return jsonb_build_object(
      'replayed', true,
      'shouldEnqueue', false,
      'ignored', false,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  select * into intent_record
    from private.github_project_scan_intents
   where link_id = link_record.id
   for update;
  already_active := intent_record.id is not null and intent_record.state <> 'idle';

  if auto_record.desired_commit_sha = target_commit_sha and auto_record.pending and already_active then
    update private.github_repository_auto_scan_state
       set latest_delivery_id = target_delivery_id,
           last_outcome_code = 'SEMANTIC_REPLAY',
           updated_at = now()
     where link_id = link_record.id;
    return jsonb_build_object(
      'replayed', true,
      'shouldEnqueue', false,
      'ignored', false,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  if auto_record.desired_commit_sha = target_commit_sha and auto_record.pending then
    update private.github_repository_auto_scan_state
       set latest_delivery_id = target_delivery_id,
           last_outcome_code = 'READY',
           updated_at = now()
     where link_id = link_record.id;
    return jsonb_build_object(
      'replayed', false,
      'shouldEnqueue', true,
      'coalesced', false,
      'ignored', false,
      'desiredCommitSha', target_commit_sha
    );
  end if;

  update private.github_repository_auto_scan_state
     set desired_commit_sha = target_commit_sha,
         latest_delivery_id = target_delivery_id,
         pending = true,
         last_outcome_code = case when already_active then 'COALESCED' else 'READY' end,
         updated_at = now()
   where link_id = link_record.id;

  return jsonb_build_object(
    'replayed', false,
    'shouldEnqueue', not already_active,
    'coalesced', already_active,
    'ignored', false,
    'desiredCommitSha', target_commit_sha
  );
end;
$$;

revoke all on function public.record_github_webhook_push_head(uuid, uuid, bigint, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.record_github_webhook_push_head(uuid, uuid, bigint, uuid, text) to service_role;

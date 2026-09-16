-- Workspace membership management uses the caller's session, never a supplied actor.
create or replace function public.list_workspace_collaborators(target_workspace_id uuid)
returns table(user_id uuid, display_name text, email text, role public.workspace_role)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_workspace_role(target_workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role]) then
    raise exception 'WORKSPACE_FORBIDDEN' using errcode = '42501';
  end if;
  perform 1 from auth.users where id=auth.uid() and deleted_at is null and (banned_until is null or banned_until < now()) for share;
  if not found then raise exception 'WORKSPACE_FORBIDDEN' using errcode = '42501'; end if;
  return query select m.user_id, p.display_name, u.email::text, m.role
    from public.workspace_members m join auth.users u on u.id=m.user_id
    left join public.profiles p on p.id=m.user_id
    where m.workspace_id=target_workspace_id order by m.joined_at, m.user_id;
end;
$$;

create or replace function public.manage_workspace_collaborator(
  target_workspace_id uuid, operation text, collaborator_email text default null,
  collaborator_id uuid default null, collaborator_role public.workspace_role default 'member'
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target_user uuid;
  existing_role public.workspace_role;
begin
  if actor is null or not private.has_workspace_role(target_workspace_id, array['owner'::public.workspace_role, 'admin'::public.workspace_role]) then
    raise exception 'WORKSPACE_FORBIDDEN' using errcode = '42501';
  end if;
  perform 1 from auth.users where id=actor and deleted_at is null and (banned_until is null or banned_until < now()) for share;
  if not found then raise exception 'WORKSPACE_FORBIDDEN' using errcode = '42501'; end if;
  -- Serialize membership edits and lock the actor's authorization through commit.
  perform 1 from public.workspaces where id=target_workspace_id for update;
  perform 1 from public.workspace_members where workspace_id=target_workspace_id and user_id=actor and role in ('owner','admin') for update;
  if not found then raise exception 'WORKSPACE_FORBIDDEN' using errcode = '42501'; end if;
  if operation not in ('add','role','remove') or operation is null then raise exception 'WORKSPACE_INVALID_INPUT'; end if;
  if collaborator_role is null or collaborator_role not in ('member','viewer') then raise exception 'WORKSPACE_INVALID_INPUT'; end if;
  if operation='add' then
    if collaborator_email is null or char_length(trim(collaborator_email)) > 254 then raise exception 'WORKSPACE_INVALID_INPUT'; end if;
    select id into target_user from auth.users where lower(email)=lower(trim(collaborator_email)) and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until < now()) for share;
    if target_user is null then raise exception 'WORKSPACE_ACCOUNT_UNAVAILABLE'; end if;
  else
    target_user := collaborator_id;
  end if;
  if target_user is null or target_user=actor then raise exception 'WORKSPACE_PROTECTED_MEMBER'; end if;
  select role into existing_role from public.workspace_members where workspace_id=target_workspace_id and user_id=target_user for update;
  if existing_role in ('owner','admin') then raise exception 'WORKSPACE_PROTECTED_MEMBER'; end if;
  if operation='add' then
    if existing_role is not null then raise exception 'WORKSPACE_ALREADY_MEMBER'; end if;
    insert into public.workspace_members(workspace_id,user_id,role) values(target_workspace_id,target_user,collaborator_role);
  elsif existing_role is null then
    raise exception 'WORKSPACE_MEMBER_MISSING';
  elsif operation='role' then
    update public.workspace_members set role=collaborator_role where workspace_id=target_workspace_id and user_id=target_user;
  else
    delete from public.workspace_members where workspace_id=target_workspace_id and user_id=target_user;
  end if;
  insert into public.audit_events(workspace_id,actor_type,actor_id,event_type,target_type,target_id,metadata)
    values(target_workspace_id,'user',actor,'workspace.collaborator.' || operation,'user',target_user,
      jsonb_build_object('previous_role',existing_role,'new_role',case when operation='remove' then null else collaborator_role end));
end;
$$;

revoke all on function public.list_workspace_collaborators(uuid) from public, anon;
revoke all on function public.manage_workspace_collaborator(uuid,text,text,uuid,public.workspace_role) from public, anon;
grant execute on function public.list_workspace_collaborators(uuid) to authenticated;
grant execute on function public.manage_workspace_collaborator(uuid,text,text,uuid,public.workspace_role) to authenticated;

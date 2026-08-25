create or replace function public.authenticate_worker_node(
  target_worker_id uuid,
  target_credential_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
begin
  if target_credential_hash is null or target_credential_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_AUTHENTICATION_FAILED';
  end if;

  select * into worker_record
  from private.worker_nodes
  where id = target_worker_id
    and credential_hash = target_credential_hash;

  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_AUTHENTICATION_FAILED';
  end if;

  return jsonb_build_object(
    'workerId', worker_record.id,
    'executionClass', worker_record.execution_class,
    'softwareVersion', worker_record.software_version
  );
end;
$$;

revoke all on function public.authenticate_worker_node(uuid, text) from public, anon, authenticated;
grant execute on function public.authenticate_worker_node(uuid, text) to service_role;

revoke all on schema private from public, anon, service_role;
grant usage on schema private to authenticated;

revoke all on function private.is_workspace_member(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.is_workspace_member(uuid)
  to authenticated;

revoke all on function private.has_workspace_role(uuid, public.workspace_role[])
  from public, anon, authenticated, service_role;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[])
  to authenticated;

revoke execute on function private.enforce_trial_asset_limit() from public, anon, authenticated, service_role;
revoke execute on function private.enforce_verification_quota() from public, anon, authenticated, service_role;
revoke execute on function private.guard_asset_verification_fields() from public, anon, authenticated, service_role;
revoke execute on function private.guard_runtime_observation_insert() from public, anon, authenticated, service_role;
revoke execute on function private.guard_runtime_scan_job_update() from public, anon, authenticated, service_role;
revoke execute on function private.guard_security_finding_retest_update() from public, anon, authenticated, service_role;
revoke execute on function private.guard_security_finding_update() from public, anon, authenticated, service_role;
revoke execute on function private.guard_verification_challenge_update() from public, anon, authenticated, service_role;
revoke execute on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function private.handle_workspace_usage_row() from public, anon, authenticated, service_role;
revoke execute on function private.recover_security_finding_after_unverified_retest() from public, anon, authenticated, service_role;
revoke execute on function private.reject_security_evidence_mutation() from public, anon, authenticated, service_role;
revoke execute on function private.reject_security_finding_history_mutation() from public, anon, authenticated, service_role;
revoke execute on function private.reject_security_phase3_import_run_mutation() from public, anon, authenticated, service_role;
revoke execute on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke execute on function private.sync_asset_usage() from public, anon, authenticated, service_role;
revoke execute on function private.sync_verification_usage() from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

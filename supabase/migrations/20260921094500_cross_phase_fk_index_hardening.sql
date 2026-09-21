-- Cross-phase foreign-key index hardening.
-- Source: Supabase performance advisor reconciliation on 2026-09-21.
-- Additive only: no RLS, grants, functions, constraints, or authority changes.

create index if not exists github_project_scan_intents_asset_workspace_idx
  on private.github_project_scan_intents (asset_id, workspace_id);

create index if not exists github_project_scan_intents_link_workspace_idx
  on private.github_project_scan_intents (link_id, workspace_id);

create index if not exists github_project_scan_intents_requested_by_idx
  on private.github_project_scan_intents (requested_by);

create index if not exists github_repository_auto_scan_state_link_workspace_idx
  on private.github_repository_auto_scan_state (link_id, workspace_id);

create index if not exists pentest_approval_events_approved_by_idx
  on private.pentest_approval_events (approved_by);

create index if not exists pentest_run_authorization_snapshots_created_by_idx
  on private.pentest_run_authorization_snapshots (created_by);

create index if not exists pentest_session_leases_created_by_idx
  on private.pentest_session_leases (created_by);

create index if not exists pentest_session_leases_run_workspace_idx
  on private.pentest_session_leases (run_id, workspace_id);

create index if not exists phase11_http_worker_tasks_target_idx
  on private.phase11_http_worker_tasks (workspace_id, run_id, target_node_id);

create index if not exists repository_snapshot_tasks_link_workspace_idx
  on private.repository_snapshot_tasks (github_repository_link_id, workspace_id);

create index if not exists github_connections_installed_by_idx
  on public.github_connections (installed_by);

create index if not exists github_repository_links_asset_workspace_idx
  on public.github_repository_links (asset_id, workspace_id);

create index if not exists github_repository_links_connection_workspace_idx
  on public.github_repository_links (github_connection_id, workspace_id);

create index if not exists pentest_coverage_summaries_run_workspace_idx
  on public.pentest_coverage_summaries (run_id, workspace_id);

create index if not exists platform_admins_created_by_idx
  on public.platform_admins (created_by);

create index if not exists platform_settings_updated_by_idx
  on public.platform_settings (updated_by);

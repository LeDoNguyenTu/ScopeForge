create index security_phase3_import_runs_asset_workspace_fk_idx
  on public.security_phase3_import_runs(asset_id, workspace_id);

create index security_phase3_import_runs_created_by_fk_idx
  on public.security_phase3_import_runs(created_by);

create index security_phase3_import_runs_job_workspace_asset_fk_idx
  on public.security_phase3_import_runs(scan_job_id, workspace_id, asset_id);
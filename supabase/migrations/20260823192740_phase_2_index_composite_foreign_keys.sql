create index asset_verification_asset_workspace_idx
  on public.asset_verification_challenges(asset_id, workspace_id);

create index scan_jobs_asset_workspace_idx
  on public.scan_jobs(asset_id, workspace_id);

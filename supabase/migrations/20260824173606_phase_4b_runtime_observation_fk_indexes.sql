create index runtime_observations_asset_workspace_idx
  on public.runtime_observations(asset_id, workspace_id);

create index runtime_observations_job_workspace_asset_idx
  on public.runtime_observations(job_id, workspace_id, asset_id);

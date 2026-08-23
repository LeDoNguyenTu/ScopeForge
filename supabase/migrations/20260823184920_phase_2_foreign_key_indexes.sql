create index assets_created_by_idx on public.assets(created_by);
create index assets_verified_by_idx on public.assets(verified_by) where verified_by is not null;
create index verification_created_by_idx on public.asset_verification_challenges(created_by);
create index audit_events_actor_id_idx on public.audit_events(actor_id) where actor_id is not null;
create index scan_jobs_asset_id_idx on public.scan_jobs(asset_id);
create index scan_jobs_requested_by_idx on public.scan_jobs(requested_by);

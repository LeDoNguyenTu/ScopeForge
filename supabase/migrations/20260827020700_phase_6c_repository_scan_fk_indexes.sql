create index if not exists repository_scan_tasks_requested_by_idx
  on private.repository_scan_tasks(requested_by);

create index if not exists repository_scan_runs_requested_by_idx
  on public.repository_scan_runs(requested_by);

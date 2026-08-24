create table public.security_findings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null check (char_length(finding_id) between 1 and 256),
  asset_id uuid not null,
  source_kind text not null check (
    source_kind in (
      'deterministic-passive-scanner',
      'deterministic-runtime-scanner',
      'external-scanner',
      'user-confirmed',
      'advisory-inference'
    )
  ),
  source_id text not null check (char_length(source_id) between 1 and 256),
  source_version text check (source_version is null or char_length(source_version) <= 128),
  rule_ref text not null check (char_length(rule_ref) between 1 and 512),
  title text not null check (char_length(title) between 1 and 240),
  description text not null check (char_length(description) between 1 and 8192),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  validation_state text not null check (
    validation_state in ('unvalidated', 'static_confirmed', 'runtime_observed', 'runtime_validated', 'user_confirmed')
  ),
  provenance_kind text not null check (
    provenance_kind in ('observed', 'scanner-derived', 'user-confirmed', 'inferred')
  ),
  location jsonb check (
    location is null
    or (jsonb_typeof(location) = 'object' and pg_column_size(location) <= 8192)
  ),
  taxonomy jsonb not null check (
    jsonb_typeof(taxonomy) = 'object'
    and pg_column_size(taxonomy) <= 16384
  ),
  remediation jsonb check (
    remediation is null
    or (jsonb_typeof(remediation) = 'object' and pg_column_size(remediation) <= 16384)
  ),
  lifecycle_state text not null check (
    lifecycle_state in (
      'open',
      'acknowledged',
      'in_progress',
      'resolved',
      'retest_pending',
      'verified_fixed',
      'accepted_risk',
      'false_positive'
    )
  ),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_seen_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, finding_id),
  check (first_seen_at <= last_seen_at),
  constraint security_findings_asset_workspace_fkey
    foreign key (asset_id, workspace_id) references public.assets(id, workspace_id) on delete cascade,
  constraint security_findings_last_seen_job_fkey
    foreign key (last_seen_job_id, workspace_id, asset_id) references public.scan_jobs(id, workspace_id, asset_id)
);

create table public.security_evidence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  evidence_id text not null check (char_length(evidence_id) between 1 and 256),
  asset_id uuid not null,
  kind text not null check (
    kind in (
      'repository-location',
      'static-analysis',
      'dependency',
      'http-observation',
      'tls-observation',
      'user-confirmed',
      'artifact-reference'
    )
  ),
  provenance_kind text not null check (
    provenance_kind in ('observed', 'scanner-derived', 'user-confirmed', 'inferred')
  ),
  summary text not null check (char_length(summary) between 1 and 4096),
  classification text not null check (classification in ('public', 'internal', 'sensitive', 'secret')),
  artifact_ref text check (artifact_ref is null or char_length(artifact_ref) <= 1024),
  created_at timestamptz not null default now(),
  primary key (workspace_id, evidence_id),
  constraint security_evidence_asset_workspace_fkey
    foreign key (asset_id, workspace_id) references public.assets(id, workspace_id) on delete cascade
);

create table public.security_finding_evidence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null,
  evidence_id text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, finding_id, evidence_id),
  constraint security_finding_evidence_finding_fkey
    foreign key (workspace_id, finding_id)
    references public.security_findings(workspace_id, finding_id)
    on delete cascade,
  constraint security_finding_evidence_evidence_fkey
    foreign key (workspace_id, evidence_id)
    references public.security_evidence(workspace_id, evidence_id)
    on delete cascade
);

create table public.security_finding_occurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null,
  asset_id uuid not null,
  scan_job_id uuid not null,
  scan_run_ref text check (scan_run_ref is null or char_length(scan_run_ref) <= 256),
  observed_at timestamptz not null,
  source_kind text not null check (
    source_kind in (
      'deterministic-passive-scanner',
      'deterministic-runtime-scanner',
      'external-scanner',
      'user-confirmed',
      'advisory-inference'
    )
  ),
  source_id text not null check (char_length(source_id) between 1 and 256),
  source_version text check (source_version is null or char_length(source_version) <= 128),
  validation_state text not null check (
    validation_state in ('unvalidated', 'static_confirmed', 'runtime_observed', 'runtime_validated', 'user_confirmed')
  ),
  created_at timestamptz not null default now(),
  unique (workspace_id, finding_id, scan_job_id),
  constraint security_finding_occurrences_finding_fkey
    foreign key (workspace_id, finding_id)
    references public.security_findings(workspace_id, finding_id)
    on delete cascade,
  constraint security_finding_occurrences_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  constraint security_finding_occurrences_job_workspace_asset_fkey
    foreign key (scan_job_id, workspace_id, asset_id) references public.scan_jobs(id, workspace_id, asset_id)
    on delete cascade
);

create table public.security_finding_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null,
  scan_job_id uuid references public.scan_jobs(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'system')),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    char_length(event_type) between 1 and 100
    and event_type in ('finding.created', 'finding.reobserved', 'finding.lifecycle_changed', 'finding.reopened')
  ),
  from_lifecycle text check (
    from_lifecycle is null
    or from_lifecycle in (
      'open', 'acknowledged', 'in_progress', 'resolved', 'retest_pending', 'verified_fixed', 'accepted_risk', 'false_positive'
    )
  ),
  to_lifecycle text check (
    to_lifecycle is null
    or to_lifecycle in (
      'open', 'acknowledged', 'in_progress', 'resolved', 'retest_pending', 'verified_fixed', 'accepted_risk', 'false_positive'
    )
  ),
  reason text check (reason is null or char_length(reason) <= 1000),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 8192
  ),
  created_at timestamptz not null default now(),
  constraint security_finding_events_finding_fkey
    foreign key (workspace_id, finding_id)
    references public.security_findings(workspace_id, finding_id)
    on delete cascade
);

create unique index security_finding_events_scan_event_unique
  on public.security_finding_events(workspace_id, finding_id, scan_job_id, event_type)
  where scan_job_id is not null and actor_type = 'system';

create index security_findings_workspace_lifecycle_seen_idx
  on public.security_findings(workspace_id, lifecycle_state, last_seen_at desc);
create index security_findings_workspace_asset_seen_idx
  on public.security_findings(workspace_id, asset_id, last_seen_at desc);
create index security_findings_last_seen_job_idx
  on public.security_findings(last_seen_job_id, workspace_id, asset_id)
  where last_seen_job_id is not null;
create index security_evidence_workspace_asset_idx
  on public.security_evidence(workspace_id, asset_id, created_at desc);
create index security_finding_evidence_evidence_idx
  on public.security_finding_evidence(workspace_id, evidence_id, finding_id);
create index security_finding_occurrences_workspace_finding_seen_idx
  on public.security_finding_occurrences(workspace_id, finding_id, observed_at desc);
create index security_finding_occurrences_job_idx
  on public.security_finding_occurrences(scan_job_id, workspace_id, asset_id);
create index security_finding_events_workspace_finding_created_idx
  on public.security_finding_events(workspace_id, finding_id, created_at desc);
create index security_finding_events_scan_job_idx
  on public.security_finding_events(scan_job_id)
  where scan_job_id is not null;

create or replace function private.guard_security_finding_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.finding_id is distinct from old.finding_id
     or new.asset_id is distinct from old.asset_id
     or new.source_kind is distinct from old.source_kind
     or new.source_id is distinct from old.source_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Security finding identity fields are immutable';
  end if;

  if new.first_seen_at > new.last_seen_at then
    raise exception 'Finding first-seen time cannot be after last-seen time';
  end if;

  return new;
end;
$$;

create trigger security_findings_guard_update
before update on public.security_findings
for each row execute function private.guard_security_finding_update();

create or replace function private.reject_security_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Evidence rows are immutable';
end;
$$;

create trigger security_evidence_reject_update
before update on public.security_evidence
for each row execute function private.reject_security_evidence_mutation();
create trigger security_evidence_reject_delete
before delete on public.security_evidence
for each row execute function private.reject_security_evidence_mutation();

create or replace function private.reject_security_finding_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Finding history rows are append-only';
end;
$$;

create trigger security_finding_evidence_reject_update
before update on public.security_finding_evidence
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_evidence_reject_delete
before delete on public.security_finding_evidence
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_occurrences_reject_update
before update on public.security_finding_occurrences
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_occurrences_reject_delete
before delete on public.security_finding_occurrences
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_events_reject_update
before update on public.security_finding_events
for each row execute function private.reject_security_finding_history_mutation();
create trigger security_finding_events_reject_delete
before delete on public.security_finding_events
for each row execute function private.reject_security_finding_history_mutation();

alter table public.security_findings enable row level security;
alter table public.security_evidence enable row level security;
alter table public.security_finding_evidence enable row level security;
alter table public.security_finding_occurrences enable row level security;
alter table public.security_finding_events enable row level security;

create policy security_findings_select_member on public.security_findings
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_evidence_select_member on public.security_evidence
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_finding_evidence_select_member on public.security_finding_evidence
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_finding_occurrences_select_member on public.security_finding_occurrences
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy security_finding_events_select_member on public.security_finding_events
for select to authenticated using (private.is_workspace_member(workspace_id));

revoke all on table public.security_findings from anon, authenticated;
revoke all on table public.security_evidence from anon, authenticated;
revoke all on table public.security_finding_evidence from anon, authenticated;
revoke all on table public.security_finding_occurrences from anon, authenticated;
revoke all on table public.security_finding_events from anon, authenticated;

grant select on table public.security_findings to authenticated;
grant select on table public.security_evidence to authenticated;
grant select on table public.security_finding_evidence to authenticated;
grant select on table public.security_finding_occurrences to authenticated;
grant select on table public.security_finding_events to authenticated;

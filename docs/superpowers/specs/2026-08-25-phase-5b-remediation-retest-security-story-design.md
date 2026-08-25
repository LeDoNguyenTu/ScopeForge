# Phase 5B Remediation, Retest, and Security Story Design

## Status

Approved direction: workflow-first Phase 5B built on the merged Phase 5A hosted finding ledger.

This design is intentionally narrower than the full Phase 5 roadmap. It adds remediation ownership, a deterministic retest workflow, and a read-only Security Story v1 without introducing new scanner/network authority, risk acceptance, false-positive decisions, hosted Phase 3 import, or model-provider execution.

## Goals

Phase 5B must let a workspace:

1. assign remediation work for a canonical finding;
2. record a bounded current remediation note/plan;
3. request a fresh retest after an operator resolves a finding;
4. reuse the already-authorized passive-runtime or active-CORS execution path rather than creating a new HTTP/scanner path;
5. mark a finding `verified_fixed` only after a fresh successful deterministic retest executes the same source/profile and the target finding does not recur;
6. mark a retest `still_present` when the same canonical finding recurs in that retest job;
7. preserve append-only remediation/retest history;
8. show a deterministic Security Story v1 derived from canonical finding, evidence, remediation state, and retest history;
9. keep browser clients read-only for the underlying security workflow tables and mutation RPCs.

## Non-goals

Phase 5B does not add:

- a generic network request API;
- new active validation profiles;
- crawling, fuzzing, exploit probes, credential replay, browser automation, or generalized DAST;
- hosted Phase 3 repository-scanner ingestion;
- risk acceptance or false-positive operator actions;
- automatic remediation;
- AI/model-generated state changes;
- background worker/fleet execution, queues, dedicated egress, or concurrency/backpressure infrastructure;
- arbitrary user-selected scanner/profile/method/header/body configuration;
- manual `verified_fixed` controls.

Phase 6 remains responsible for worker-scale execution and abuse controls.

## Architectural principles

### Canonical finding state remains singular

`public.security_findings` remains the only canonical finding row. Phase 5B does not create a second remediation finding model.

Remediation state and retest attempts attach to `(workspace_id, finding_id)` and preserve Phase 5A IDs, evidence, occurrences, and lifecycle history.

### Retest reuses existing execution authority

A retest is orchestration over an existing authorized execution path:

- passive-runtime finding -> existing `lib/runtime-observations` service;
- active CORS finding -> existing `lib/active-validation` service and `cors-origin-policy@1`.

The retest layer never imports `runtime-network`, never accepts a URL/method/header/body/profile from the browser, and never constructs HTTP requests itself.

### Absence is authoritative only when coverage is known

A target finding may become `verified_fixed` only when all of these are true:

- the finding is currently `retest_pending`;
- a fresh retest job succeeded;
- the retest executed the exact deterministic source/profile snapshot recorded at request time;
- the retest job belongs to the same workspace and asset;
- no occurrence for the canonical finding exists for that retest job;
- no competing reobservation has already moved the finding away from `retest_pending`.

A failed, blocked, cancelled, stale-version, or otherwise inconclusive job cannot verify a fix.

### Model output remains advisory

Security Story v1 is deterministic and local. No provider is required.

If model assistance is added later, it consumes the story/domain state as advisory context and cannot independently mutate validation, lifecycle, retest outcome, or verified-fix state.

## Data model

### `security_finding_work`

One current remediation-work row per canonical finding:

- `workspace_id uuid not null`
- `finding_id text not null`
- `assignee_user_id uuid null`
- `remediation_note text null`, maximum 2000 characters
- `updated_by uuid not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- primary key `(workspace_id, finding_id)`
- composite foreign key to `security_findings(workspace_id, finding_id)`
- assignee and updater reference `auth.users`

The row stores only the current assignment/note. Append-only history lives in `security_finding_events`.

### `security_finding_retests`

Each retest request is a durable immutable execution snapshot plus mutable outcome state:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null`
- `finding_id text not null`
- `asset_id uuid not null`
- `requested_by uuid not null`
- `execution_kind text not null check in ('passive_runtime','active_validation')`
- `source_id text not null`
- `source_version text null`
- `rule_ref text not null`
- `validation_profile_id text null`
- `validation_profile_version integer null`
- `active_consent_granted_at timestamptz null`
- `status text not null check in ('requested','running','still_present','verified_fixed','inconclusive','failed','cancelled')`
- `scan_job_id uuid null`
- `result_code text null`, maximum 100 characters
- `requested_at timestamptz not null default now()`
- `started_at timestamptz null`
- `completed_at timestamptz null`

Integrity rules:

- composite finding/workspace and asset/workspace foreign keys;
- `scan_job_id`, when set, must match workspace and asset;
- passive retests must have null validation-profile and consent fields;
- active retests must snapshot `cors-origin-policy`, version `1`, and a non-null consent timestamp;
- immutable snapshot fields cannot change after insert;
- terminal status requires `completed_at`;
- `running` requires `started_at` and `scan_job_id`;
- only one non-terminal retest per finding may exist at a time via a partial unique index.

### Finding events

Extend the Phase 5A event-type constraint with:

- `finding.assignment_changed`
- `finding.remediation_note_updated`
- `finding.retest_requested`
- `finding.retest_started`
- `finding.retest_completed`

Event metadata remains bounded to 8 KiB. Retest events store identifiers/status/result codes only, never raw network data.

## Authorization

### Reads

Authenticated workspace members may read:

- finding work state;
- retest attempts;
- existing finding/evidence/history data.

RLS must scope every row by workspace membership.

### Remediation writes

- `owner` and `admin` may assign any current workspace member or clear assignment.
- `member` may assign or clear only themselves.
- `owner`, `admin`, and `member` may update the bounded remediation note.
- `viewer` is read-only.

The trusted database mutation independently rechecks current workspace membership/role; browser-supplied role values are never authoritative.

### Retest authorization

Retest requests require the finding to be `resolved`.

- passive retest: owner/admin/member, subject to the existing passive-runtime authorization path;
- active CORS retest: owner/admin plus a new explicit consent checkbox for that retest request.

The browser supplies only finding ID plus explicit-consent boolean where required. Execution kind, asset, target, source/profile, and budget are derived server-side from the canonical finding and existing asset state.

## Retest source registry

A small trusted application registry maps canonical runtime provenance to the existing executor:

- `scopeforge:runtime-observer` -> passive runtime executor;
- `scopeforge:runtime-validator` with `cors-origin-policy@1` -> active validation executor.

The registry is closed in Phase 5B. Unknown sources are not executable and produce `RETEST_SOURCE_UNSUPPORTED`.

This registry contains no URLs, headers, methods, bodies, credentials, or network implementation.

## Retest state machine

### Request

1. Load canonical finding in workspace.
2. Require `lifecycle_state = 'resolved'`.
3. Resolve source registry entry from source ID/version/rule.
4. Recheck actor authorization.
5. For active CORS, require explicit consent.
6. In one service-role database transaction:
   - lock finding row;
   - recheck `resolved`;
   - insert immutable retest snapshot in `requested`;
   - transition finding `resolved -> retest_pending`;
   - append `finding.retest_requested` event.

### Start and execute

1. Reload retest and canonical finding.
2. Require retest `requested` and finding `retest_pending`.
3. Recheck source/profile snapshot and current asset authorization.
4. Enqueue/run the existing passive or active service.
5. Atomically attach the resulting `scan_job_id`, set `running`, and append `finding.retest_started` before or at execution handoff as appropriate to the synchronous Phase 5 control-plane model.

No new runtime request configuration is created.

### Finalize - still present

If the retest job succeeds and `security_finding_occurrences` contains `(workspace_id, finding_id, scan_job_id)`, the finding is still present.

Phase 5A ingestion already reopens `retest_pending -> in_progress` when the finding is observed. Finalization therefore:

- locks retest and finding rows;
- confirms the occurrence belongs to the retest job;
- sets retest status `still_present`;
- sets `completed_at`;
- appends `finding.retest_completed` with result `still_present`;
- does not overwrite the lifecycle chosen by canonical ingestion.

### Finalize - verified fixed

If the retest job succeeds and no occurrence exists for the target finding/job:

- lock retest row;
- lock finding row;
- lock/read the exact scan job;
- require retest status `running`;
- require finding lifecycle still `retest_pending`;
- require job `succeeded`, same workspace/asset, and expected execution kind;
- require source/profile version still matches the immutable retest snapshot;
- require no target occurrence for that job;
- transition `retest_pending -> verified_fixed`;
- set retest status `verified_fixed` and `completed_at`;
- append `finding.retest_completed` with result `verified_fixed`.

If a concurrent scan reobserves the finding first, canonical ingestion moves it away from `retest_pending`, so finalization cannot incorrectly mark it fixed.

If a later scan reobserves a `verified_fixed` finding, the existing recurrence rule reopens it, preserving the latest evidence rather than treating verified-fix state as permanent.

### Finalize - non-authoritative outcome

Blocked, failed, cancelled, source/profile drift, missing job, or unsupported coverage sets the retest to `failed`, `cancelled`, or `inconclusive` with a stable bounded result code.

The finding remains `retest_pending`; the operator can reopen it to `in_progress` through the existing lifecycle workflow or request a new retest after resolving again.

## Database write boundary

New browser-facing tables are SELECT-only for `authenticated`.

Mutation functions are `SECURITY DEFINER`, use `set search_path = ''`, schema-qualify referenced objects, revoke EXECUTE from `public`, `anon`, and `authenticated`, and grant EXECUTE only to `service_role`.

Required narrow functions:

- `change_security_finding_work(...)`
- `request_security_finding_retest(...)`
- `mark_security_finding_retest_running(...)`
- `finalize_security_finding_retest(...)`

Each function rechecks workspace identity and relevant state under row locks. No generic lifecycle or arbitrary retest-state setter is exposed.

## Application services

Create `lib/security-remediation/` with focused modules:

- `types.ts` - application input/result/error types;
- `source-registry.ts` - closed runtime-source-to-executor mapping;
- `repository.ts` - finding work/retest reads and narrow RPC calls;
- `service.ts` - authorization, request/start/finalize orchestration;
- `story.ts` - pure deterministic Security Story v1 builder.

The remediation service may depend on existing `lib/runtime-observations`, `lib/active-validation`, `lib/security-findings`, and `packages/security-domain` contracts.

It must not import `packages/runtime-network` or construct network requests.

Runtime packages must not depend back on `lib/security-remediation`.

## Security Story v1

Security Story v1 is not persisted. It is a deterministic read model assembled on the server from:

- canonical finding title/description/severity/confidence/validation;
- source/rule/version provenance;
- bounded linked evidence summaries/classifications;
- lifecycle and occurrence history;
- current remediation assignment/note;
- latest retest status/result.

The story exposes structured sections:

1. `summary` - what ScopeForge found and current lifecycle;
2. `evidence` - what was directly observed and validation confidence;
3. `impact` - bounded deterministic explanation from canonical description/taxonomy;
4. `remediation` - canonical remediation guidance plus current assignment/note;
5. `verification` - latest retest state and whether the fix is actually verified.

The story must explicitly distinguish observed/scanner-derived facts from operator workflow state. It must never claim a fix is verified unless lifecycle is `verified_fixed` and the latest authoritative retest is `verified_fixed`.

## UI

Extend `/dashboard/findings/[findingId]` with:

- Security Story v1 section;
- current assignee and bounded remediation note;
- assignment/note controls for authorized roles;
- retest history;
- `Request passive retest` for supported passive findings when resolved;
- `Request active CORS retest` plus explicit consent for supported active findings when resolved;
- status/result rendering for requested/running/still-present/verified-fixed/inconclusive/failed/cancelled attempts.

Do not expose source/profile selectors, target URLs, HTTP controls, arbitrary job IDs, or generic lifecycle targets.

## Read bounds

Preserve the Phase 5A bounded-read rule:

- finding list <= 100 rows;
- evidence links/evidence/occurrences/events <= 100 each;
- retest history <= 50 attempts per finding;
- story consumes only those bounded inputs;
- remediation note <= 2000 characters;
- event reason/metadata remain within existing Phase 5A bounds.

## Error handling

Application errors use stable codes and safe messages. Do not return raw PostgreSQL, network, or upstream exception text to the browser.

Required stable categories include:

- `REMEDIATION_FORBIDDEN`
- `REMEDIATION_ASSIGNEE_INVALID`
- `REMEDIATION_NOTE_INVALID`
- `RETEST_FINDING_NOT_RESOLVED`
- `RETEST_SOURCE_UNSUPPORTED`
- `RETEST_ACTIVE_CONSENT_REQUIRED`
- `RETEST_STATE_CONFLICT`
- `RETEST_EXECUTION_FAILED`
- `RETEST_INCONCLUSIVE`

## Testing strategy

Use TDD for every implementation slice.

Required coverage:

- migration/table/RLS/privilege contract;
- remediation role and assignee rules;
- note length and event history;
- source registry closed-world behavior;
- passive retest request without browser network parameters;
- active retest explicit owner/admin consent;
- immutable source/profile snapshots;
- request transaction performs `resolved -> retest_pending` atomically;
- target finding recurrence in retest job produces `still_present` and cannot verify fixed;
- absence on a successful exact-source/profile retest produces `verified_fixed`;
- failed/blocked/cancelled/drifted retests cannot verify fixed;
- concurrent recurrence prevents stale fixed finalization;
- Security Story provenance and verified-fix wording;
- browser action boundary contains no URL/method/header/body/profile/budget parameters;
- architecture guard prohibits remediation code from `runtime-network` and prohibits runtime packages from remediation dependencies;
- existing Phase 1-5A regression suite remains green.

## Operational prerequisite

The live Supabase project currently reports migrations only through Phase 4B, while `main` already contains merged Phase 4C and Phase 5A migrations.

Before relying on the hosted findings/retest UI in production, the merged Phase 4C migration and then the merged Phase 5A migration must be applied to the live ScopeForge project and Supabase security/performance advisors rechecked.

The Phase 5B migration itself must not be applied to production until its implementation PR is merged and the exact final head passes the complete repository gate.

## Delivery sequence

1. write/self-review this design and implementation plan;
2. merge the design/plan PR after a full documentation-only gate;
3. create an isolated Phase 5B implementation branch from that merge;
4. execute each task RED -> GREEN with CI checkpoints;
5. perform full changed-file security review;
6. update permanent architecture/state/test/handoff documentation;
7. run the exact final head through install, all tests, strict typecheck, CLI build/version, benchmark, and Next production build;
8. confirm mergeability/review state and squash-merge using expected-head protection;
9. apply the merged Phase 5B database migration only after repository merge and prerequisite live-schema reconciliation.
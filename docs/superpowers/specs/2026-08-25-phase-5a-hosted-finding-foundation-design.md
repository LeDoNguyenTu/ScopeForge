# Phase 5A Hosted Finding Foundation - Design

## Status

Approved architecture direction. This document is the written design for the first slice of Phase 5 and requires explicit user review before implementation planning begins.

## Context

Phase 4 established the canonical framework-independent security domain and deterministic runtime finding generation, but hosted persistence stops at scan jobs and runtime observations. Both the passive runtime observer and the bounded active validator already map deterministic rule matches into canonical `SecurityFinding` and `EvidenceRecord` objects. Those objects are currently returned in memory and are not stored as durable product records.

Phase 5 must not introduce a second finding model. The existing `packages/security-domain` contracts remain authoritative for finding identity, source, severity, confidence, validation, provenance, evidence, lifecycle, remediation, and relationships.

Phase 5 is split deliberately:

- **Phase 5A - Hosted Finding Foundation:** durable findings/evidence, trusted ingestion, lifecycle history, deduplication/recurrence, and basic findings views.
- **Phase 5B - Security Stories:** provenance-aware explanation and correlation over the durable ledger.
- **Phase 5C - Remediation and Retest:** ownership, richer remediation workflow, risk acceptance, expiry/review, retesting, and verified-fix workflow.

This document covers **Phase 5A only**.

## Decision summary

Phase 5A will add a canonical hosted finding ledger backed by workspace-scoped Supabase tables and a trusted application service. Runtime scanners will persist their existing canonical domain findings and evidence through that trusted boundary. Browser clients will receive workspace-scoped read access but no direct write authority to security-sensitive ledger tables.

The first hosted ingestion sources are the already-authorized Phase 4B passive runtime observer and Phase 4C-1 active CORS validator. The local Phase 3 scanner remains local in Phase 5A; its existing domain adapter stays compatible with the same canonical model for a later hosted import/worker boundary.

The durable identity is the existing domain `SecurityFindingId` / `EvidenceId` string, not a new database-generated public identity. Database tables use composite workspace-scoped keys around those IDs.

## Goals

Phase 5A must:

1. Persist canonical `SecurityFinding` and `EvidenceRecord` data without creating a parallel product schema.
2. Preserve deterministic finding identity across repeated observations.
3. Record first seen, last seen, and per-run occurrence history.
4. Preserve human workflow state when a deterministic finding is re-observed.
5. Keep lifecycle decisions auditable and workspace-scoped.
6. Make deterministic recurrence explicit rather than silently treating disappearance as remediation.
7. Keep scanner authority unchanged - Phase 5A adds persistence/workflow, not broader scanning.
8. Keep trusted writes out of the browser and preserve existing RLS/tenancy patterns.
9. Support a basic findings list/detail product surface without introducing Security Story AI or generalized remediation workflow yet.
10. Maintain idempotent ingestion so retries cannot duplicate findings or evidence.

## Non-goals

Phase 5A does **not** add:

- new active validators, crawling, fuzzing, exploit confirmation, browser automation, credentials, or generalized DAST
- queue-backed hosted repository scans or isolated workers
- arbitrary external finding import
- AI/model provider integration
- Security Story generation
- automated severity promotion from inferred/advisory content
- automatic remediation
- rich assignment/SLA workflows
- risk-acceptance expiry/review UI
- authenticated retest orchestration
- automatic closure because a finding did not appear in one later scan
- raw response bodies, secret values, cookies, authorization headers, or unbounded scanner output

Those remain later Phase 5 or Phase 6 concerns.

## Existing contracts remain authoritative

Phase 5A builds on the existing security-domain types:

- `SecurityFinding`
- `EvidenceRecord`
- `FindingLifecycleState`
- `ValidationState`
- `ValidationAuthority`
- `ProvenanceRecord`
- `FindingSourceRef`
- `RemediationSummary`
- `RiskRelationship`

The hosted layer may normalize those values into relational columns for indexing and constraints, but it must not redefine their semantics.

`packages/security-domain` remains framework-independent and must not import Supabase, Next.js, React, application services, database adapters, or provider SDKs.

## Architecture

```text
runtime-observer -----------+
                            |
runtime-validator ----------+--> canonical SecurityFinding/EvidenceRecord
                            |              |
                            |              v
                            |      lib/security-findings
                            |      trusted application service
                            |              |
                            |              v
                            |      trusted ledger repository
                            |              |
                            |              v
                            |      Supabase/PostgreSQL
                            |
Phase 3 domain adapter -----+  (compatible contract; hosted ingestion later)

Browser/UI -----------------------> workspace-scoped SELECT only
```

### Package/application boundaries

- `packages/security-domain` owns canonical contracts and lifecycle transition rules.
- Runtime packages continue to own deterministic mapping from scanner matches into canonical domain records.
- New `lib/security-findings` owns trusted hosted ingestion, lifecycle authorization, current-view assembly, event creation, and repository orchestration.
- Database adapters live below `lib/security-findings` and may use Supabase/service-role clients.
- UI routes/components consume read models or dedicated server actions; they never receive a generic ledger write API.
- Advisory/model systems remain downstream and cannot promote validation or lifecycle state by themselves.

## Durable identity

### Findings

The durable finding key is the canonical `SecurityFinding.id` string.

Examples already produced by the runtime mappers include namespaced SHA-256-backed values such as:

- `runtime:<digest>`
- `active-runtime:<digest>`

The ledger stores this value directly as `finding_id text` and scopes it with `workspace_id`.

### Evidence

The durable evidence key is the canonical `EvidenceRecord.id` string, also stored directly and workspace-scoped.

### Pre-persistence identity hardening

Before the ledger is activated, all deterministic hosted finding/evidence identities must include every semantic version component that can change the meaning of the rule result.

The active validator already includes its profile/version in the stable digest. The passive runtime mapper currently includes asset, rule ID, and observation key but omits `RUNTIME_SOURCE_VERSION` from the digest. Phase 5A will correct that before any hosted finding rows exist.

This is intentionally done before durable hosted finding data is created so no finding-ID migration is required.

Phase 3 fingerprint identity is not changed by Phase 5A. Hosted Phase 3 import remains out of scope and must be reviewed separately before activation.

## Database model

Phase 5A adds five workspace-scoped tables.

### `security_findings`

Current canonical state for each durable finding.

Required logical fields:

- `workspace_id uuid`
- `finding_id text`
- `asset_id uuid`
- `source_kind text`
- `source_id text`
- `source_version text null`
- `scan_run_ref text null`
- `rule_ref text`
- `title text`
- `description text`
- `severity text`
- `confidence text`
- `validation_state text`
- `provenance_kind text`
- `location jsonb null`
- `taxonomy jsonb`
- `remediation jsonb null`
- `lifecycle_state text`
- `first_seen_at timestamptz`
- `last_seen_at timestamptz`
- `last_seen_job_id uuid null`
- `created_at timestamptz`
- `updated_at timestamptz`

Key and integrity rules:

- primary/unique identity: `(workspace_id, finding_id)`
- `(asset_id, workspace_id)` must reference the workspace-scoped asset identity
- `last_seen_job_id`, when present, must reference a scan job from the same workspace and asset
- severity/confidence/validation/provenance/lifecycle values must be constrained to domain-supported values
- identity strings and text/JSON payloads must have explicit size bounds
- `first_seen_at <= last_seen_at`

### `security_evidence`

Immutable normalized evidence content.

Required logical fields:

- `workspace_id uuid`
- `evidence_id text`
- `asset_id uuid`
- `kind text`
- `provenance_kind text`
- `summary text`
- `classification text`
- `artifact_ref text null`
- `created_at timestamptz`

Key and integrity rules:

- primary/unique identity: `(workspace_id, evidence_id)`
- workspace/asset composite integrity
- evidence IDs are immutable
- content for an existing evidence ID must be byte-for-byte semantically compatible; conflicting reuse of the same ID is rejected rather than silently overwritten
- runtime ingestion in Phase 5A accepts only the classifications produced by the bounded runtime mappers; it must not become a generic secret-storage channel
- evidence summaries retain the existing 4 KiB runtime bound
- no raw headers, response bodies, cookies, credentials, query strings, fragments, or unbounded exception text may be introduced through this table

### `security_finding_evidence`

Many-to-many canonical association.

Required logical fields:

- `workspace_id uuid`
- `finding_id text`
- `evidence_id text`
- `created_at timestamptz`

Rules:

- composite foreign keys must remain inside one workspace
- duplicate links are idempotent
- a finding cannot link evidence from another workspace

### `security_finding_occurrences`

Append-only record that a deterministic source observed a finding in a concrete trusted execution.

Required logical fields:

- `id uuid`
- `workspace_id uuid`
- `finding_id text`
- `asset_id uuid`
- `scan_job_id uuid`
- `observed_at timestamptz`
- `source_kind text`
- `source_id text`
- `source_version text null`
- `validation_state text`
- `created_at timestamptz`

Rules:

- unique `(workspace_id, finding_id, scan_job_id)` for idempotent retry
- occurrence rows are append-only
- scan job must belong to the same workspace and asset
- an occurrence records observation, not lifecycle authority

### `security_finding_events`

Append-only product workflow history.

Required logical fields:

- `id uuid`
- `workspace_id uuid`
- `finding_id text`
- `actor_type text` (`user` or `system`)
- `actor_id uuid null`
- `event_type text`
- `from_lifecycle text null`
- `to_lifecycle text null`
- `reason text null`
- `metadata jsonb`
- `created_at timestamptz`

Initial event types:

- `finding.created`
- `finding.reobserved`
- `finding.lifecycle_changed`
- `finding.reopened`

The table is append-only. Current lifecycle remains materialized on `security_findings` for efficient reads.

## Trusted ingestion contract

`lib/security-findings` exposes a source-neutral trusted application contract conceptually equivalent to:

```ts
interface FindingIngestionBatch {
  workspaceId: string;
  assetId: string;
  scanJobId: string;
  observedAt: Date;
  findings: readonly SecurityFinding[];
  evidence: readonly EvidenceRecord[];
}
```

This is an **internal trusted contract**, not a public browser API.

### Validation before persistence

The service must reject the entire batch before mutation when any of these fail:

- caller is not the trusted server execution path
- job/workspace/asset do not match
- finding `assetRef` does not equal the authorized asset
- evidence reference is missing from the batch or already-durable compatible evidence
- duplicate IDs within a batch disagree on content
- finding/evidence IDs violate bounds
- source kind or validation state is unsupported
- provenance contradicts the source authority
- payload exceeds table/domain bounds
- runtime evidence attempts to persist forbidden raw content

No partial batch persistence is allowed.

## Runtime integration and transaction boundary

Phase 5A must not weaken the cancellation/evidence semantics already established in Phase 4.

For Phase 4B passive observations and Phase 4C active validation, canonical findings/evidence are derived immediately after deterministic rule evaluation. Their durable ledger writes must be integrated into the same trusted persistence boundary used to commit the corresponding runtime result.

### Active validation

The active-validation persistence critical section currently serializes observation persistence against cancellation. Phase 5A extends that database transaction so the following commit together under the same locked active job parent:

1. the bounded `cors-policy` observation
2. canonical evidence rows/links
3. canonical finding upserts
4. occurrence rows/events

If cancellation wins before this transaction, none of those records persist.

If the result transaction wins first, the durable active observation and its canonical findings/evidence commit together before any late cancellation can relabel the job as cancelled.

The later job-success transition remains a separate guarded state transition as today. A failure after result persistence but before success transition is recoverable through idempotent ledger/result persistence and must never duplicate evidence/findings/occurrences.

### Passive runtime observation

Passive result persistence is extended equivalently so normalized runtime observations and their canonical findings/evidence are committed through one trusted repository operation before job success.

### Failure semantics

- mapping/validation failure before persistence: job fails, no ledger mutation
- database result transaction failure: job fails, no partial result/ledger commit
- retry of an already-committed result transaction: idempotent
- job success failure after committed results: results remain durable and retryable; the job must not silently execute a second network scan merely to recreate ledger rows

Any retry/reconciliation mechanism beyond immediate idempotent server retry remains an implementation detail, but it cannot widen scanner/network authority.

## Upsert and deduplication semantics

### First observation

For a new finding ID:

- insert current canonical record with lifecycle `open`
- set `first_seen_at = last_seen_at = observedAt`
- persist compatible evidence and links
- add one occurrence
- add `finding.created` system event

### Re-observation

For an existing finding ID from the same canonical identity:

- update `last_seen_at` and `last_seen_job_id`
- add one idempotent occurrence for the new scan job
- add `finding.reobserved` event
- preserve human lifecycle state except for explicit deterministic recurrence rules below
- allow current scanner-derived descriptive fields to refresh only when identity/source compatibility rules permit it

Identity mismatch for the same durable finding ID is a hard ingestion conflict, not an overwrite.

### Disappearance is not remediation

If a later scan does not return a finding, Phase 5A does nothing automatically to its lifecycle.

Absence from one execution is not enough to prove a fix because target coverage, runtime state, configuration, scanner version, and authorization can differ.

## Lifecycle rules and authority

The existing domain lifecycle remains the basis:

- `open`
- `acknowledged`
- `in_progress`
- `resolved`
- `retest_pending`
- `verified_fixed`
- `accepted_risk`
- `false_positive`

### Phase 5A user actions

Initial UI/server actions expose only the workflow needed for the hosted finding foundation:

- `open -> acknowledged`
- `open/acknowledged -> in_progress`
- `in_progress -> resolved`
- `resolved -> retest_pending`
- supported return-to-work transitions already allowed by the domain

Workspace `member`, `admin`, and `owner` may perform ordinary triage/remediation-state transitions through trusted server actions.

`viewer` is read-only.

### Deferred high-impact decisions

Phase 5A does not expose production UI actions for:

- `accepted_risk`
- `false_positive`
- manual `verified_fixed`

Those require the richer authority/reason/expiry/review design in Phase 5C. The states remain part of the domain and may be displayed if encountered in tests/future imports.

### Deterministic recurrence

Re-observation of an existing deterministic finding usually preserves lifecycle. Exceptions:

- `resolved` + deterministic re-observation -> `in_progress`
- `retest_pending` + deterministic re-observation -> `in_progress`
- `verified_fixed` + deterministic re-observation -> `open`

Each automatic transition emits `finding.reopened` with system provenance and the scan job reference.

The existing domain transition table currently makes `verified_fixed` terminal. Phase 5A will make one narrow domain correction: allow `verified_fixed -> open`. Application-layer authority still ensures this transition is used only for trusted deterministic recurrence, not arbitrary browser mutation.

`accepted_risk` and `false_positive` are not automatically reopened in Phase 5A.

### Verified fixed

Phase 5A does not mark findings `verified_fixed` merely because they disappear from a scan. A positive qualifying retest/verification workflow is Phase 5C.

## Current finding fields versus immutable history

`security_findings` is the current materialized product view. `security_finding_occurrences` and `security_finding_events` retain observation/workflow history.

Scanner-derived descriptive fields may evolve across source versions, but identity fields may not drift underneath one durable ID.

Identity-compatible mutable fields include:

- title
- description
- severity
- confidence
- validation state when the new state is supported by deterministic authority
- taxonomy
- remediation guidance
- bounded location metadata

Identity-critical fields include:

- workspace
- asset
- finding ID
- source kind
- source ID
- rule identity family

A source version/profile version that materially changes identity must be reflected in the deterministic ID rule before ingestion.

Human lifecycle state is never reset merely because scanner text/severity changes.

## RLS and write authority

All new tables enable Row Level Security.

Authenticated browser/session roles receive only workspace-scoped `SELECT` grants/policies based on existing membership helpers.

Direct authenticated `INSERT`, `UPDATE`, and `DELETE` privileges are revoked from ledger tables.

Writes occur through trusted server/service-role repositories and narrowly scoped server actions that separately validate:

- authentication
- workspace membership
- workspace role
- finding ownership by workspace
- allowed lifecycle transition
- actor/reason requirements

No generic JSON patch/update endpoint is introduced.

## Auditing

Security-sensitive mutations are recorded in both the finding event history and existing workspace audit log where appropriate.

Required workspace audit events:

- `security_finding.batch_ingested` - bounded aggregate metadata only
- `security_finding.lifecycle_changed`
- `security_finding.reopened`

Allowed metadata includes bounded IDs, counts, source kind, old/new lifecycle, and reason code.

Forbidden audit content includes raw evidence bodies, secrets, cookies, authorization material, arbitrary scanner output, and unbounded exceptions.

Per-finding observation history belongs primarily in `security_finding_occurrences` / `security_finding_events` to avoid flooding the general workspace audit table.

## Evidence/privacy boundary

Phase 5A persists normalized domain evidence summaries only.

For Phase 4 runtime sources:

- summaries remain bounded to 4 KiB
- persisted runtime URLs remain redacted by the existing runtime boundary
- no raw response body is stored
- no cookie values are stored
- no Authorization values are stored
- no arbitrary response headers are stored
- no query strings/fragments/URL credentials are reintroduced
- no raw exception strings are stored

The ledger must reject an ingestion adapter that tries to bypass these source-specific privacy guarantees.

## Basic hosted findings UI

Phase 5A introduces a minimal product surface:

- `/dashboard/findings`
- `/dashboard/findings/[findingId]`

### Findings list

Initial filters:

- severity
- lifecycle
- validation state
- asset
- source kind

Default ordering:

1. active/non-terminal workflow state
2. severity descending
3. `last_seen_at` descending
4. stable finding ID tie-breaker

Pagination must be bounded and stable, preferably cursor-based on ordered fields rather than loading the full workspace finding set.

### Finding detail

Displays:

- title and description
- severity/confidence
- validation state
- source/rule identity
- asset
- lifecycle
- first/last seen
- normalized evidence summaries
- occurrence history
- lifecycle event history
- taxonomy/location when present
- remediation summary when present

It exposes only the Phase 5A lifecycle actions described above.

No Security Story generation control appears in Phase 5A.

## Read model

UI code should consume dedicated read models rather than raw database rows. A finding detail read model can assemble:

- current canonical finding
- evidence
- recent occurrences
- recent workflow events
- allowed transitions for the current actor role

This keeps database representation and domain/UI representation separable.

## Indexes and scale bounds

Required indexes include at minimum:

- findings by workspace + lifecycle + severity + last seen
- findings by workspace + asset + last seen
- findings by workspace + validation + last seen
- occurrences by workspace + finding + observed time
- events by workspace + finding + created time
- evidence links by workspace + finding

Queries must always be workspace-bounded.

Phase 5A does not introduce unbounded export or workspace-wide in-memory hydration.

## Architecture guards

Executable dependency tests should enforce:

- `packages/security-domain` imports no app/database/framework/provider layers
- runtime scanner packages do not import Supabase/Next.js/application finding services
- `lib/security-findings` may depend on `security-domain` and database adapters but must not depend on generic runtime-network authority
- UI/components cannot import service-role repositories
- advisory/model-provider code cannot write validation/lifecycle state directly

## Testing requirements

### Domain/lifecycle

- existing lifecycle transitions remain valid
- new `verified_fixed -> open` recurrence transition is covered
- no arbitrary browser action can invoke recurrence-only authority

### Identity

- passive runtime digest now includes source version
- active runtime identity remains profile-versioned
- repeated identical deterministic results produce the same finding/evidence IDs
- incompatible content under one durable ID is rejected

### Database/RLS

- cross-workspace finding/evidence links are impossible
- cross-workspace asset/job references are impossible
- browser/session roles are select-only
- service-role trusted writes succeed
- evidence/content bounds are enforced
- occurrence uniqueness makes retries idempotent
- event rows are append-only

### Ingestion

- entire batch rejects on one invalid record
- first observation inserts one finding/evidence/link/occurrence/event
- re-observation updates last seen and adds exactly one occurrence
- retry of the same job does not duplicate occurrence/event/link rows
- human lifecycle state survives ordinary re-observation
- resolved/retest-pending recurrence moves to in-progress
- verified-fixed recurrence reopens to open
- absence in a later execution does not resolve/verify a finding

### Runtime integration

- passive observations and canonical findings/evidence persist together
- active CORS observation and canonical findings/evidence persist in the same cancellation-serialized result transaction
- cancellation before result commit leaves no active observation/finding/evidence from that execution
- late cancellation cannot produce `cancelled` after committed active result evidence
- result transaction failure leaves no partial ledger state
- post-result job-success failure is idempotently recoverable without a second network request

### UI

- workspace isolation on list/detail routes
- viewers cannot mutate lifecycle
- members/admins/owners only receive allowed Phase 5A transitions
- accepted-risk/false-positive/manual-verified-fixed controls are absent
- list pagination/filtering is bounded
- evidence renders normalized summaries only

### Architecture

- dependency guards remain green
- runtime packages remain scanner/network-authority bounded
- no model/advisory layer can promote authoritative state

## Delivery slices

### 5A-0 - Domain/identity hardening

- add recurrence transition contract
- include passive runtime source version in deterministic digest
- add regression tests before persistence activation

### 5A-1 - Ledger schema and repository

- migrations/tables/indexes/RLS
- trusted repository/read models
- batch validation and idempotent upsert semantics

### 5A-2 - Runtime result integration

- extend passive result persistence transaction
- extend active cancellation-serialized result transaction
- wire canonical findings/evidence into the ledger
- preserve existing runtime tests and exact safety authority

### 5A-3 - Lifecycle service

- role-aware trusted lifecycle actions
- occurrence/event history
- recurrence transitions
- workspace audit integration

### 5A-4 - Minimal findings UI

- list/filter/pagination
- detail/evidence/history
- Phase 5A lifecycle controls
- no Security Story/AI controls yet

## Merge/security gate

Every implementation PR must preserve the repository's full verification gate on the exact final head:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Before merge, the exact final head also requires:

- no unresolved review/security blockers
- full changed-file security review
- no weakening of Phase 4 target/network/cancellation authority
- expected-head protected merge

## Completion criteria

Phase 5A is complete when:

1. canonical runtime findings/evidence survive beyond the request/job execution
2. deterministic re-observation is idempotent and auditable
3. current lifecycle state plus occurrence/event history are durable
4. lifecycle authority is role-scoped and browser writes remain blocked
5. deterministic recurrence has explicit reopen semantics
6. disappearance alone never claims remediation
7. findings can be browsed and inspected in a bounded hosted UI
8. Security Stories, rich remediation/risk acceptance, retesting, model providers, workers, and broader scanner authority remain outside this slice

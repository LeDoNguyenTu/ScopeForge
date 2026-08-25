# ScopeForge Architecture

ScopeForge separates control-plane authorization from scanner/runtime execution so the public application cannot become an unrestricted scanning proxy. Safety boundaries are expressed in package dependency direction, database authority, target policy, and executable regression tests.

## Control plane

```text
Browser
  |
  v
Vercel / Next.js control plane
  |
  +--> Supabase Auth
  +--> authenticated SELECTs protected by RLS
  +--> narrow trusted server actions
  |      |
  |      +--> service-role runtime/finding/workflow RPCs
  |
  +--> future scan queue
           |
           +--> isolated workers
           +--> private artifacts
           +--> dedicated egress controls
```

Every authenticated user belongs to one or more workspaces through `workspace_members`. Exposed hosted security tables are member-readable through RLS. Browser roles do not receive INSERT, UPDATE, DELETE, or direct mutation-RPC authority for the security ledger or remediation/retest workflow.

## Phase 3 local scanner

The Phase 3 scanner is a separate local execution path. Repository content is hostile data. Phase 3 performs bounded inventory and safe reads and does not execute target modules, package lifecycle scripts, Dockerfiles, Terraform, Kubernetes, GitHub Actions, package managers, or cloud tooling. Detector packages flow into normalized scanner results and JSON/SARIF output through the CLI composition root.

Hosted import of Phase 3 findings is not implemented yet. Any future import adapter must ingest normalized scanner data rather than moving arbitrary repository execution into the control plane.

## Product security domain

`packages/security-domain` is the framework-independent domain for findings, evidence, provenance, validation, lifecycle, remediation, relationships, and provider-neutral advisory contracts.

```text
scanner packages -> security-domain-adapters/phase3 -> security-domain
                                                    ^
                                                    |
                                             runtime mappings
```

The domain does not import Next.js, React, Supabase, database adapters, workers, scanners, CLI composition, or model-provider SDKs. Advisory/model output is downstream and cannot independently promote validation or lifecycle state.

## Runtime security architecture

```text
trusted application services
        |
        +----------------------+----------------------+
        |                                             |
        v                                             v
runtime-observer                               runtime-validator
(passive authority)                           (bounded active authority)
        |                                             |
        +----------------------+----------------------+
                               |
                               v
                         runtime-network
                    DNS + HTTPS + pinning + deadlines
                               |
                               v
                         network-safety
                       pure IP/DNS policy
```

`packages/network-safety` is pure policy with no DNS, HTTP/TLS, database, framework, or application I/O.

`packages/runtime-network` owns fresh DNS resolution, complete public-address-set validation, deterministic socket pinning, Host/SNI/certificate preservation, body destruction, and DNS-inclusive request deadlines. It does not own findings, UI, database state, passive redirect policy, or active profiles.

`packages/runtime-observer` remains passive-only. It owns verified web/API target policy, same-host redirect decisions, bounded/redacted status/header/cookie-attribute/TLS observations, passive budgets, and deterministic `runtime_observed` findings.

`packages/runtime-validator` contains only the approved `cors-origin-policy@1` active profile: verified web/API targets, separate owner/admin consent, exact verified HTTPS/443 target, exactly one unauthenticated GET, fixed `Origin: https://scopeforge.invalid`, zero redirect following/retries/request body/credentials/caller headers, bounded time/observation budgets, no response-body capture, and deterministic `runtime_validated` findings.

Runtime persistence and cancellation serialize through the matching `scan_jobs` row so active evidence cannot commit after cancellation wins, and a late cancellation cannot relabel a job after runtime result persistence has committed.

## Phase 5A hosted finding ledger

Phase 5A adds one canonical hosted persistence model. It does not create passive/active-specific finding tables.

```text
passive runtime result ----+
                           |
active validation result --+--> trusted atomic result RPC
                                  |
                                  +--> runtime_observations
                                  +--> security_evidence
                                  +--> security_findings
                                  +--> security_finding_evidence
                                  +--> security_finding_occurrences
                                  +--> security_finding_events
```

### Canonical state and immutable history

- `security_findings` stores current canonical state keyed by `(workspace_id, finding_id)`.
- `security_evidence` stores immutable normalized evidence keyed by `(workspace_id, evidence_id)`.
- `security_finding_evidence` links canonical findings to evidence and is append-only.
- `security_finding_occurrences` records trusted reobservation per scan job and is append-only.
- `security_finding_events` records creation, reobservation, reopening, operator lifecycle changes, remediation workflow, and retest events and is append-only.

Finding identity is semantic and stable across recurrence. Evidence identity additionally fingerprints bounded normalized evidence content so legitimate evidence changes create a new immutable evidence record instead of conflicting with an older one.

Only deterministic runtime sources are admitted by the current hosted ingestion boundary. Hosted ingestion requires scanner-derived findings, `runtime_observed` or `runtime_validated` validation, observed HTTP/TLS evidence, `public` classification, exact asset binding, bounded text/JSON, and evidence references that exist inside the trusted batch.

### Atomic result persistence

Passive and active runtime repositories do not directly insert ledger rows. They call separate service-role-only `SECURITY DEFINER` RPCs with pinned empty search paths:

- `persist_passive_runtime_result`
- `persist_active_validation_result`

Each RPC locks the exact `(job, workspace, asset)` parent, requires the correct running and uncancelled job kind, validates normalized observation shape, persists the observation idempotently, and invokes the private finding-ingestion transaction. Conflicting reuse of an observation, finding, or evidence identity is rejected rather than overwritten.

## Phase 5B remediation and deterministic retest

Phase 5B adds workflow state beside the canonical finding rather than creating another finding model.

```text
security_findings
      |
      +--> security_finding_work
      |
      +--> security_finding_retests
      |
      +--> security_finding_events
```

### Remediation work

`security_finding_work` stores the current assignee and bounded remediation note for a workspace finding. The trusted mutation path is `change_security_finding_work`.

The RPC:

- is `SECURITY DEFINER` with `search_path = ''`
- is executable only by `service_role`
- re-checks actor workspace membership and role
- locks the canonical finding/work row
- restricts member assignment to self
- validates owner/admin assignees are current workspace members
- bounds notes to 2000 characters
- updates workflow state and appends assignment/note events in one transaction

Authenticated browser roles receive RLS-protected SELECT only.

### Closed retest source registry

Retesting does not accept a caller-selected URL, method, headers, body, budget, source, profile, scan job, or desired result.

The application registry permits only:

```text
scopeforge:runtime-observer / 0.1
  -> passive_runtime
  -> existing runtime-observer service

scopeforge:runtime-validator / cors-origin-policy@1
  -> active_validation
  -> existing runtime-validator service
```

The database independently validates the same source/profile snapshot. Retest snapshot fields are immutable after request creation.

### Retest request and execution

`request_security_finding_retest` locks the canonical finding, requires `resolved`, verifies the supported deterministic source, prevents another active retest, records the immutable execution snapshot, transitions the finding to `retest_pending`, and appends `finding.retest_requested` in one transaction.

Active CORS retests still require owner/admin plus explicit consent. That consent is recorded in the immutable retest snapshot and the existing active-validation service performs its own authorization checks again before networking.

Application execution reuses the existing server dependency factories:

```text
requestFindingRetest
  -> enqueue existing passive or active runtime job
  -> mark_security_finding_retest_running
  -> execute existing runtime service
  -> finalize_security_finding_retest
```

`mark_security_finding_retest_running` validates the exact workspace, asset, requester, queued job kind, source/profile, and active authorization state before attaching a job to the retest.

If enqueue fails before a job is attached, `abort_security_finding_retest_before_start` can safely terminalize the still-requested retest. It cannot abort a running retest owned by the runtime path.

### Authoritative finalization and verified-fix semantics

`finalize_security_finding_retest` accepts only workspace and retest identity. It derives the terminal result from locked database state.

A successful job with a target finding occurrence for that exact scan job becomes `still_present`.

A successful job may become `verified_fixed` only when all of these remain true:

- job/workspace/asset binding matches the retest
- job kind and requester match the immutable snapshot
- source/version/profile snapshot matches the supported executor
- active authorization exists when required
- the exact target finding has no occurrence for that exact successful job
- canonical lifecycle is still `retest_pending`

Only then does the transaction update the canonical finding to `verified_fixed`.

Failed, blocked, cancelled, snapshot-mismatched, stale, or otherwise non-verifying retests cannot mark a finding fixed. A database trigger recovers a still-`retest_pending` finding to `in_progress` when a retest terminates as `still_present`, `inconclusive`, `failed`, or `cancelled`.

### Security Story v1

`lib/security-remediation/story.ts` is a pure bounded projection over canonical finding/evidence/history, remediation work, and retest state. It has no Supabase, Next.js, React, runtime execution, or provider dependency.

Security Story v1 can explain what is observed, what remediation work exists, and what verification state is authoritative. It cannot execute a model, run a scan, mutate a finding, or claim `verified_fixed` unless canonical lifecycle and latest authoritative retest state agree.

## Lifecycle authority

Human workflow remains intentionally narrow. Phase 5A exposes:

- open -> acknowledged
- open -> in progress
- acknowledged -> in progress
- in progress -> resolved
- resolved -> in progress

Phase 5B adds deterministic retest-driven transitions:

- resolved -> retest_pending through trusted retest request
- retest_pending -> verified_fixed only through authoritative fresh retest evidence
- retest_pending -> in_progress on non-verified terminal retest recovery

Risk acceptance and false-positive decisions are still not exposed as browser workflow actions.

Trusted recurrence can reopen canonical state according to domain policy: resolved/retest-pending return to in-progress and verified-fixed returns to open. Accepted-risk and false-positive remain unchanged by automated recurrence in the current slice.

## Read model and UI

Authenticated members use RLS-protected SELECT-only list/detail views. Finding/evidence/occurrence/event reads remain bounded, and Phase 5B retest history is limited to 50 rows newest-first.

The finding detail route adds remediation controls, deterministic retest controls/history, and Security Story v1. React renders normalized values as text. No raw runtime bodies, cookie values, arbitrary headers, credentials, caller request configuration, or unbounded exception text enter the hosted evidence/workflow UI.

## Evidence and secret boundary

Runtime persistence stores normalized observations rather than raw responses. Response bodies and cookie values are never persisted. Runtime URLs remove query strings, fragments, and credentials. Active CORS persistence keeps only bounded URL/status/origin/credential-allowance/Vary state. Hosted evidence accepts only already-bounded mapper output and currently stores no runtime artifact references.

A future Phase 5C Phase 3 import adapter must define its own evidence/privacy contract. In particular, secret values and unbounded source content must never be uploaded merely because the local scanner detected them.

## Executable dependency boundaries

CI guards these directions:

- `security-domain` remains framework/infrastructure/provider independent.
- `network-safety` remains pure and I/O-free.
- `runtime-network` remains below observer/validator/application/domain layers.
- application/component code cannot import generic `runtime-network` authority.
- `runtime-observer` cannot depend on active validation, hosted persistence/remediation, UI, database, or providers.
- `runtime-validator` cannot depend on passive observer, hosted persistence/remediation, UI, database, or providers and cannot re-export generic transport authority.
- hosted `lib/security-findings` cannot acquire runtime-network or scanner execution authority.
- `lib/security-remediation` cannot acquire generic runtime-network authority.
- Security Story construction remains infrastructure/provider independent.
- passive and active persistence remain on their dedicated atomic result RPCs rather than direct ledger writes.
- hosted workflow mutation RPCs remain service-role-only while browser roles stay SELECT-only.

These are security controls, not formatting rules.

## Future isolation and non-goals

Phase 5C should design a narrow trusted hosted adapter for existing Phase 3 normalized local/CI findings. This is a data-ingestion boundary, not authorization for arbitrary hosted repository execution.

Phase 6 remains responsible for queue-backed isolated workers, dedicated egress, concurrency/backpressure, private artifacts, fleet isolation, and abuse controls. Existing target, authorization, budget, cancellation, network, finding, evidence, retest, and audit contracts must move behind that boundary without being widened.

The current architecture does not authorize generalized crawling, endpoint discovery, user-supplied origins, arbitrary methods/headers/bodies, authenticated testing, credential/cookie replay, browser automation, exploit probes, fuzzing, credential attacks, denial-of-service behavior, generalized DAST, or automatic remediation.

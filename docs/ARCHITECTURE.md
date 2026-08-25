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
  |      +--> service-role runtime/finding RPCs
  |
  +--> future scan queue
           |
           +--> isolated workers
           +--> private artifacts
           +--> dedicated egress controls
```

Every authenticated user belongs to one or more workspaces through `workspace_members`. Exposed hosted security tables are member-readable through RLS. Browser roles do not receive INSERT, UPDATE, DELETE, or direct mutation-RPC authority for the security ledger.

## Phase 3 local scanner

The Phase 3 scanner is a separate local execution path. Repository content is hostile data. Phase 3 performs bounded inventory and safe reads and does not execute target modules, package lifecycle scripts, Dockerfiles, Terraform, Kubernetes, GitHub Actions, package managers, or cloud tooling. Detector packages flow into normalized scanner results and JSON/SARIF output through the CLI composition root.

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
- `security_finding_events` records creation, reobservation, reopening, and operator lifecycle changes and is append-only.

Finding identity is semantic and stable across recurrence. Evidence identity additionally fingerprints bounded normalized evidence content so legitimate evidence changes create a new immutable evidence record instead of conflicting with an older one.

Only deterministic runtime sources are admitted in Phase 5A. Hosted ingestion requires scanner-derived findings, `runtime_observed` or `runtime_validated` validation, observed HTTP/TLS evidence, `public` classification, exact asset binding, bounded text/JSON, and evidence references that exist inside the trusted batch.

### Atomic result persistence

Passive and active runtime repositories do not directly insert ledger rows. They call separate service-role-only `SECURITY DEFINER` RPCs with pinned empty search paths:

- `persist_passive_runtime_result`
- `persist_active_validation_result`

Each RPC locks the exact `(job, workspace, asset)` parent, requires the correct running and uncancelled job kind, validates normalized observation shape, persists the observation idempotently, and invokes the private finding-ingestion transaction. Conflicting reuse of an observation, finding, or evidence identity is rejected rather than overwritten.

### Lifecycle authority

Phase 5A exposes only these human workflow transitions:

- open -> acknowledged
- open -> in progress
- acknowledged -> in progress
- in progress -> resolved
- resolved -> in progress

Resolve and reopen require a bounded operator reason. Owner, admin, and member roles may use the workflow; viewer remains read-only. The server action passes only finding ID, action, and optional note. PostgreSQL independently checks actor workspace membership/role, locks the finding, checks the expected state, performs the current-state update, and appends the lifecycle event in the same transaction.

Risk acceptance, false-positive decisions, retest-pending, verified-fixed operator workflow, Security Stories, model execution, and hosted Phase 3 import are not authorized by 5A.

Trusted reobservation can reopen canonical state according to domain policy: resolved/retest-pending return to in-progress and verified-fixed returns to open. Accepted-risk and false-positive remain unchanged by automated recurrence in this slice.

### Read model and UI

Authenticated members use RLS-protected SELECT-only list/detail views. Phase 5A caps list, evidence, occurrence, and event reads at 100 rows per query. The dashboard uses a database count query for active findings instead of materializing the ledger. React renders normalized values as text; no raw runtime bodies, cookies, arbitrary headers, credentials, or unbounded exception text enter the hosted evidence UI.

## Evidence and secret boundary

Runtime persistence stores normalized observations rather than raw responses. Response bodies and cookie values are never persisted. Runtime URLs remove query strings, fragments, and credentials. Active CORS persistence keeps only bounded URL/status/origin/credential-allowance/Vary state. Phase 5A hosted evidence accepts only the already-bounded runtime mapper output and stores no runtime artifact references.

## Executable dependency boundaries

CI guards these directions:

- `security-domain` remains framework/infrastructure/provider independent.
- `network-safety` remains pure and I/O-free.
- `runtime-network` remains below observer/validator/application/domain layers.
- application/component code cannot import generic `runtime-network` authority.
- `runtime-observer` cannot depend on active validation, hosted persistence, UI, database, or providers.
- `runtime-validator` cannot depend on passive observer, hosted persistence, UI, database, or providers and cannot re-export generic transport authority.
- hosted `lib/security-findings` cannot acquire runtime-network or scanner execution authority.
- passive and active persistence remain on their dedicated atomic result RPCs rather than direct ledger writes.

These are security controls, not formatting rules.

## Future isolation and non-goals

Phase 6 remains responsible for queue-backed isolated workers, dedicated egress, concurrency/backpressure, private artifacts, fleet isolation, and abuse controls. Existing target, authorization, budget, cancellation, network, finding, evidence, and audit contracts must move behind that boundary without being widened.

The current architecture does not authorize generalized crawling, endpoint discovery, user-supplied origins, arbitrary methods/headers/bodies, authenticated testing, credential/cookie replay, browser automation, exploit probes, fuzzing, credential attacks, denial-of-service behavior, generalized DAST, or automatic remediation.

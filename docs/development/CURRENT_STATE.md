# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

The product keeps authorization, deterministic evidence, explanation, and remediation as separate concerns. Security state must remain attributable to deterministic/runtime evidence or explicit human workflow rather than model inference alone.

## Completed foundations

- **Phase 1 Foundation** - Next.js/React shell, Supabase auth/workspaces, RLS, security headers, CI.
- **Phase 2 Asset control and authorization** - workspace-scoped assets, canonical targets, proof of control, SSRF-safe verification, roles, quotas, audit events, and asset UX.
- **Phase 3 Code and supply-chain security** - local/passive scanner with hostile-repository safety, secrets, JavaScript/TypeScript SAST and bounded command taint, npm SCA/SBOM, IaC/configuration analysis, baselines, JSON/SARIF, golden outputs, and benchmarks. Merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- **Phase 4A Security domain contracts** - canonical framework-independent finding/evidence/provenance/validation/lifecycle/remediation/relationship contracts. Merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- **Phase 4B Verified passive runtime observations** - verified targets, reauthorization, DNS/IP safety, pinned HTTPS, bounded passive observations, cancellation, deterministic runtime findings, and trusted persistence. Merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- **Phase 4C-1 Bounded CORS origin-policy validation** - separate owner/admin-authorized active profile `cors-origin-policy@1`, one fixed synthetic-Origin unauthenticated GET to the exact verified HTTPS target, no redirect following/body/credentials/caller request configuration, bounded evidence and cancellation-safe persistence. Merged through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.

## Phase 5A - Hosted finding foundation

Phase 5A delivery is implemented in PR #30 and ships with this documentation.

### Canonical hosted ledger

One workspace-scoped hosted model is used for both passive and active runtime findings:

- `security_findings` - current canonical state
- `security_evidence` - immutable normalized evidence
- `security_finding_evidence` - append-only finding/evidence links
- `security_finding_occurrences` - append-only trusted recurrence per scan job
- `security_finding_events` - append-only system/operator history

Authenticated users receive RLS-protected SELECT only. Browser roles have no direct mutation authority over these tables or the trusted result/lifecycle RPCs.

### Atomic runtime ingestion

Passive and active runtime repositories now persist the runtime observation and hosted finding/evidence batch through separate service-role-only atomic PostgreSQL RPCs. The RPCs lock the exact job/workspace/asset parent and require a running, uncancelled job of the expected kind before any result is accepted.

Hosted ingestion accepts only deterministic runtime findings with scanner-derived provenance, `runtime_observed` or `runtime_validated` validation, observed public HTTP/TLS evidence, exact asset binding, bounded payloads, and internally available evidence references.

Retries are idempotent. Conflicting reuse of an observation, finding, or evidence ID is rejected.

### Durable identity and recurrence

Canonical finding identity stays stable across reobservation. Passive identity now includes source version before any hosted rows exist. Immutable evidence identity additionally fingerprints bounded evidence kind, classification, and summary content so changed evidence creates a new immutable record rather than conflicting with prior evidence.

Trusted reobservation appends a new occurrence and event. Current canonical state is refreshed only for observations at least as recent as `last_seen_at`.

Recurrence policy in this slice:

- `resolved` -> `in_progress`
- `retest_pending` -> `in_progress`
- `verified_fixed` -> `open`
- `accepted_risk` remains accepted
- `false_positive` remains false-positive

### Limited operator lifecycle

Phase 5A exposes only:

- open -> acknowledged
- open -> in progress
- acknowledged -> in progress
- in progress -> resolved
- resolved -> in progress

Owner/admin/member may perform these actions; viewer is read-only. Resolve and reopen require a note up to 1000 characters. PostgreSQL independently checks actor workspace membership/role, expected current state, allowed transition, and note requirements while locking the finding and appending the lifecycle event in the same transaction.

Risk acceptance, false-positive decisions, retest-pending/verified-fixed operator workflow, Security Stories, and model-driven lifecycle changes remain outside Phase 5A.

### Findings UI and read model

The dashboard now exposes hosted finding counts and a dedicated Findings route. Workspace members can review canonical identity, asset, severity, confidence, validation, taxonomy, remediation, immutable evidence, occurrence history, and lifecycle history from the same ledger.

Read paths are bounded:

- findings list: 100 rows
- evidence links/evidence: 100 rows
- occurrences: 100 rows
- events: 100 rows
- dashboard active-finding total: count-only query rather than full-ledger materialization

### Security boundaries preserved

Phase 5A introduces no new network/scanning authority. `lib/security-findings` cannot import runtime-network or scanner execution packages. Runtime packages cannot depend back on hosted finding persistence. Passive and active repositories remain on their dedicated atomic result RPCs.

No raw response body, cookie value, arbitrary response-header collection, credential, query/fragment secret, or unbounded exception text is added to hosted evidence.

## Verification baseline

The last implementation/security-guard checkpoint before the documentation tail, head `3d71ac3b408828608e9173d77db3c739a86f4710`, passed CI #618 with:

- reproducible dependency install
- 131 test files / 579 tests
- strict TypeScript typecheck
- CLI build and compiled version smoke
- scanner benchmark
- Next.js production build

The exact final PR head must pass the same complete gate before merge.

## Next boundary

The next Phase 5 design boundary is **5B Security Stories, remediation, and retest workflow**. It should add explanation and workflow on top of the canonical ledger without creating a second finding model or allowing inferred/model output to independently change validated security state.

Additional active validators remain separate design/security boundaries. Queue-backed isolated workers, dedicated egress, concurrency/backpressure, private artifacts, fleet operations, and abuse controls remain Phase 6.

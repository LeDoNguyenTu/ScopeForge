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
- **Phase 5A Hosted finding foundation** - one workspace-scoped canonical hosted finding ledger, immutable evidence, append-only recurrence/history, atomic runtime ingestion, bounded read models, and narrow audited lifecycle workflow. Delivered through PR #30.
- **Phase 5B Remediation, deterministic retest, and Security Story** - merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a`.

## Phase 5B delivered boundary

### Remediation workflow

Phase 5B adds `security_finding_work` as workflow state attached to, not replacing, the canonical `security_findings` record.

- owner/admin may assign remediation work to a current workspace member
- member may self-assign but cannot assign another user
- viewer remains read-only
- remediation notes are bounded to 2000 characters
- assignment and note changes append workflow events
- browser roles receive SELECT-only access through RLS
- all mutation RPCs are service-role-only and independently re-check workspace membership and role

### Deterministic retest workflow

Phase 5B adds `security_finding_retests` with immutable execution snapshots. Retesting does not introduce a new scanner or generic request authority.

The closed source registry permits only:

- `scopeforge:runtime-observer` version `0.1` -> existing passive runtime execution
- `scopeforge:runtime-validator` version `cors-origin-policy@1` -> existing bounded active CORS validation

A retest request is accepted only from a supported `resolved` finding. The trusted database transaction creates the immutable retest snapshot, transitions the finding to `retest_pending`, and appends the request event atomically.

Active retesting still requires owner/admin authority and explicit consent. The existing runtime services retain their target, verification, SSRF, request-shape, budget, redaction, cancellation, and persistence controls.

The retest job must match the exact workspace, asset, requester, job kind, source/profile snapshot, and active authorization state before it can be attached. Final status is derived from authoritative database state rather than accepted from the caller.

`verified_fixed` requires a fresh successful exact-source/profile retest with no occurrence of the target finding for that exact scan job while the canonical finding is still `retest_pending`. A recurrence, failed job, blocked job, cancellation, snapshot mismatch, or lifecycle drift cannot verify a fix. Non-verified terminal retests recover a still-pending finding to `in_progress`.

### Security Story v1

Security Story v1 is a deterministic bounded read model over the canonical finding, immutable evidence, occurrence/history, remediation work, and retest state.

It does not call a model provider, execute runtime networking, or mutate validation/lifecycle state. Evidence and workflow facts remain attributable to their provenance. A verified-fix statement is shown only when canonical and authoritative retest state agree.

### Finding detail UI

The finding detail route now includes:

- remediation assignment and note controls
- retest controls and bounded retest history
- explicit active-retest consent where applicable
- deterministic Security Story summary, evidence, impact, remediation, and verification sections

The server-action surface does not accept arbitrary URL, method, headers, body, budget, source/profile, scan job ID, desired retest result, or generic lifecycle target.

## Verification baseline

PR #33 exact head `5c7b8c34432f8bb51731fe069178411a8005d023` passed CI #685 before merge:

- reproducible dependency install
- 148 test files / 654 tests
- strict TypeScript typecheck
- CLI build and compiled version smoke
- scanner benchmark
- Next.js production build

The changed security-sensitive paths were reviewed before merge and no merge-blocking finding remained. PR #33 was merged with expected-head protection as `eb35c2b23468addd817951486c60ac7d68710c9a`.

## Production database state

The hosted ScopeForge Supabase project is currently healthy but its migration history still ends at Phase 5A. The two merged Phase 5B migrations have not yet been applied to production:

- `20260825090000_phase_5b_remediation_retest_security_story.sql`
- `20260825091000_phase_5b_retest_recovery_hardening.sql`

Until those migrations are deployed and verified, Phase 5B application code is merged but the hosted Phase 5B workflow must be treated as not production-ready.

The pre-deployment Supabase security advisor is clean. Four INFO-level unindexed Phase 5A foreign-key notices are expected to be resolved by the first Phase 5B migration, which adds the covering indexes.

## Next boundary

The next product design boundary is **Phase 5C Hosted Phase 3 finding import**. ScopeForge already has strong local/CI code and supply-chain scanning, but those findings are not yet admitted into the hosted canonical ledger. The next design should define a narrow trusted adapter with canonical identity, repository/asset binding, privacy and secret-redaction policy, bounded evidence, scan-run provenance, idempotency, and service-role-only mutation authority.

Do not reuse the runtime-only ingestion contract for code findings. Do not add new network authority as part of this adapter.

After the hosted import boundary, Phase 6 remains queue-backed isolated workers, dedicated egress, concurrency/backpressure, private artifacts, fleet operations, and abuse controls.

# ScopeForge Implementation Log

> **2026-09-01 status notice:** This chronological log contains historical
> boundary text near its end. The current release gate is recorded in
> `PHASE_6D_RELEASE_STATE.md`; the persistent resume queue is
> `UNFINISHED_WORK.md`.

This log records major delivery boundaries and merge evidence. Detailed implementation contracts live in the corresponding design, plan, architecture, scanner, and test documentation.

## 2026-08-24 - Community platform direction

- Approved the open-source application-security platform direction and `Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify` product loop.

## Phase 1 - Foundation

- Added the Next.js application foundation, Supabase authentication/workspaces, tenancy controls, Row Level Security, security headers, CI, and deployment baseline.

## Phase 2 - Asset control and authorization

- Added workspace-scoped assets, canonical target normalization, proof-of-control, SSRF-safe verification, roles, quotas, audit records, and asset UI.
- Merged through PR #4.

## Phase 3 - Code and supply-chain security

### Design and scanner foundation

- PR #5 defined the local/passive scanner architecture and trust boundary.
- PR #6 added normalized findings, stable fingerprints, bounded hostile-repository inventory, coordination, and deterministic JSON.
- PR #7 added identity-checked safe reads, strict root configuration, policy/exit semantics, safe output, and the compiled CLI.

### Detector families and supply chain

- PR #8 added redacted secret detection and one-way secret fingerprints.
- PR #9 added execution-free JavaScript/TypeScript structural SAST.
- PR #10 added bounded Express-to-child-process command taint analysis.
- PR #11 added npm dependency inventory and optional OSV enrichment.
- PR #12 added CycloneDX 1.7 SBOM output.
- PR #13 added Dockerfile analysis.
- PR #15 added Kubernetes analysis.
- PR #16 added Terraform analysis.
- PR #17 added GitHub Actions workflow analysis.
- PR #19 added `.npmrc` and `vercel.json` configuration security and merged as `474bd82a1cad014e796a7faf83369c09f0d3dfc5`.

### Output, baselines, and release hardening

- PR #14 reduced CI noise by skipping full validation while implementation PRs are draft.
- PR #18 added deterministic safe baselines and merged as `6b349b9a07a060d371f5ccf9fccb670e8ddbc1eb`.
- PR #20 added deterministic SARIF 2.1.0 and merged as `f2859f5028965276c9dc69ddf10398740a6f9ec7`.
- PR #21 completed Phase 3 release hardening with mixed-repository integration, hostile-input/no-execution/no-default-network coverage, byte-for-byte JSON/SARIF/terminal goldens, a deterministic 700-file benchmark, GitHub Code Scanning guidance, limitations/performance documentation, reproducible lockfile installs, current GitHub Actions, and whole-phase trust-boundary review.
- PR #21 exact final head `5d1fa820eda4bbc660f92950bbee6568e820f2a9` passed CI #353 with 86 test files / 331 tests, strict typecheck, CLI build/runtime, 700 clean benchmark files, and production build.
- Phase 3 merged as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.

Phase 3 remains local/passive. Repository content is treated as hostile data and is not executed by the scanner. OSV remains the only optional Phase 3 scanner network path and receives normalized npm identity/version only when explicitly enabled.

## Phase 4A - Security domain contracts

### Design

- PR #22 approved the framework-independent security-domain architecture and implementation plan.
- PR #22 exact design/plan head passed CI #358 and merged as `13fb2c3e914181d44f9e6957f9fe66eea2069eb4`.
- Phase 4 was split into 4A contracts, 4B verified passive runtime/API observations, and 4C bounded active validation so later active behavior cannot bypass authorization and network-safety design.

### Implementation

- Added `packages/security-domain` contract versioning, branded identifiers, severity/confidence, finding sources, provenance, typed evidence, product findings, remediation, validation, lifecycle, relationships, provider-neutral advisory contracts, and deterministic advisory context privacy/budget policy.
- Added `packages/security-domain-adapters/phase3` as a one-way adapter from normalized Phase 3 findings into the product domain without copying scanner metadata, baseline state, redacted snippets, or data-flow internals.
- Added `tests/architecture/security-domain-dependencies.test.ts` to block scanner, CLI, Next.js, React, Supabase, application/component, and named model-provider dependencies from the product domain.
- Supporting implementation CI #375 passed with 93 test files / 350 tests, strict typecheck, CLI build/runtime, the 700-file benchmark, and production build.
- Phase 4A final implementation merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.

Phase 4A adds no live model provider, remote DAST, crawler, fuzzing, exploit validation, credential attack, persistence migration, worker fleet, or active runtime behavior.

## Phase 4B - Verified passive runtime observations

### Design

- PR #24 defined the safety-first passive runtime architecture and TDD implementation plan before enabling network behavior.
- The design requires verified web/API assets, authorization at enqueue and execution time, same-host HTTPS port 443 transitions, fresh DNS classification and connection pinning, explicit budgets, cancellation, bounded audit/persistence, and deterministic security-domain mapping.
- PR #24 merged as `d59e55c2d5123f0adb2b2c6d18eaace3b5790276`.

### Shared network safety

- Extracted reusable public-IP classification and resolution-result validation into `packages/network-safety`.
- Retained Phase 2 SSRF/network-boundary regression coverage while making the policy reusable by Phase 4B.
- Kept DNS, HTTP, TLS, database, and framework behavior outside the pure package.

### Runtime execution engine

- Added `packages/runtime-observer` with verified target contracts, HTTPS port 443 and GET-only policy, same-host redirect rules, explicit request/redirect/byte/observation/timeout budgets, fresh DNS classification, and DNS-pinned HTTPS transport.
- Added normalized HTTP status, redirect, selected security-header, cookie-attribute, and TLS observations.
- Response bodies and cookie values are not part of the persistence contract.
- Added deterministic passive runtime rules and mapping into Phase 4A `security-domain` findings/evidence.

### Persistence and double authorization

- Added the Phase 4B migration for passive runtime `scan_jobs`, immutable authorization snapshots, bounded `runtime_observations`, guarded state transitions, workspace-scoped reads, and trusted-server-only writes.
- Added `lib/runtime-observations/authorization.ts` and repository contracts.
- Added `lib/runtime-observations/service.ts` after its contract suite exposed that the orchestration module was missing from the PR head.
- The service authorizes at enqueue and reauthorizes immediately before networking, owns cancellation, stable failure codes, bounded audits, persistence ordering, and deterministic result mapping.

### Minimal asset workflow

- Added trusted server actions and `RuntimeObservationPanel` to the asset detail workflow.
- Unverified assets cannot run observations and repository assets remain unsupported.
- Verified web/API assets can run the bounded passive check, queued/running jobs expose cancellation, and terminal states render safe bounded summaries.
- The UI suite used an intentional RED checkpoint while the component was missing; a later duplicate TLS rendering failure was fixed in production without weakening the assertion.

### Executable architecture boundary

- Added `tests/architecture/runtime-observer-dependencies.test.ts`.
- `runtime-observer` cannot depend on Next.js, React, Supabase, application/component code, or named model-provider SDKs.
- `network-safety` cannot gain DNS, HTTP, TLS, database, or framework behavior.

### Supporting GREEN gate

CI #437 passed on supporting implementation head `364ccd435c824bfdfab75407db967d027bf18656` before the final architecture/documentation changes:

- 109 test files / 474 tests
- strict TypeScript typecheck
- CLI build and compiled `ScopeForge 0.1.0` smoke
- 700-file benchmark with 0 findings and 0 errors
- scanner duration 910 ms
- wall time 971 ms
- RSS delta 34,701,312 bytes
- Next.js production build

CI #437 is supporting evidence only. The final architecture/documentation changes move the head and require a new complete exact-head gate before merge.

## Current boundary

Phase 4B implementation is complete in PR #25 pending full changed-file review, review-thread clearance, exact-final-head CI, squash merge with head protection, and merged-content verification.

Phase 4C may be designed only after Phase 4B is merged. It must remain narrow, explicitly authorized, isolated, and non-destructive while reusing Phase 4B target, network-safety, budget, cancellation, evidence, and audit contracts.

## 2026-09-01 - Phase 6D and Phase 8 documentation checkpoints

- Phase 8 validation-methodology foundation merged through PR #50 as `0b5c27a1226ca5c3f3f3fc40a25558dce05e9b20`; Phase 8 itself remains incomplete by design.
- Phase 6D threat model, containment addendum, and implementation plan merged through PR #51 as `605518bfc2c6f99f6229bbb56a4b2f4b46c2a47a`.
- Phase 6D implementation PR #52 is based on `main`, remains draft, and is verified through exact head `bd558fdf0830bfdb95027374e168835a8a48f43d` except for the fresh exact-project Supabase reconciliation described in `PHASE_6D_TASK16_REVIEW.md`.
- Real Linux rootless-Podman/cgroup-v2 containment acceptance passed all 31 checks. This evidence does not enable either Phase 6D production capability.
- Thirty historical non-UI remote branches whose PRs were already merged were deleted. Open PR refs, Phase 6D checkpoints, worktree refs, and all dashboard/visual branches were preserved.
- The orphaned `feat/phase-6a-worker-foundation` branch was also deleted after confirming its six unique commits changed only superseded Phase 6A handover documents and current `main` already records Phase 6A completion.

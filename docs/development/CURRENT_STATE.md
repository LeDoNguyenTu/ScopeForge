# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

Primary Phase 4 references:

- `docs/superpowers/specs/2026-08-24-phase-4a-security-domain-contracts-design.md`
- `docs/superpowers/specs/2026-08-25-phase-4b-passive-runtime-observations-design.md`
- `docs/superpowers/plans/2026-08-25-phase-4b-passive-runtime-observations.md`

## Completed foundations

### Phase 1 - Foundation

- Next.js and React application shell
- Supabase authentication and workspace tenancy
- Row Level Security and server session handling
- security headers and CI baseline

### Phase 2 - Asset control and authorization

- workspace-scoped web, API, and public-GitHub assets
- canonical target normalization
- proof-of-control challenges
- public HTTPS verification with DNS, IP, and SSRF boundaries
- trusted server writes, roles, quotas, audit events, and asset UI

### Phase 3 - Code and supply-chain security

Phase 3 is complete and merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.

The local scanner remains a separate passive execution path with bounded hostile-repository inventory, normalized findings, redacted secret detection, JavaScript/TypeScript structural SAST and bounded command taint analysis, npm SCA and CycloneDX SBOM, infrastructure/configuration analysis, baselines, JSON/SARIF output, hostile-input coverage, and benchmark evidence.

### Phase 4A - Security domain contracts

Phase 4A is complete and merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.

`packages/security-domain` owns framework-independent product finding, evidence, provenance, validation, lifecycle, remediation, relationship, and provider-neutral advisory contracts. `packages/security-domain-adapters/phase3` maps normalized Phase 3 findings into that domain without copying scanner metadata or creating a reverse dependency.

## Phase 4B - Verified passive runtime observations

PR #24 merged the approved Phase 4B design as `d59e55c2d5123f0adb2b2c6d18eaace3b5790276`. PR #25 implements that design and is in its final architecture/documentation and exact-head merge gate.

### Shared network safety

`packages/network-safety` contains pure public-IP classification and resolution-result validation shared with the Phase 2 authorization boundary. It contains no DNS lookup, HTTP/TLS transport, database, or framework behavior.

### Bounded runtime observer

`packages/runtime-observer` implements the passive execution engine:

- verified web/API target contract
- HTTPS port 443 and GET-only target policy
- explicit request-count, redirect-count, observation-size, request-timeout, and total-time budgets
- fresh DNS classification before each outbound connection
- DNS-pinned HTTPS transport with DNS resolution included in the per-request deadline
- same-host redirects only, with full validation repeated before each connection
- normalized HTTP status, redirect, selected-header, cookie-attribute, and TLS observations
- no response-body persistence and no cookie-value persistence
- deterministic runtime rules and Phase 4A security-domain mapping

Crawling, fuzzing, authentication replay, exploit payloads, credential attacks, persistence, and destructive behavior remain outside Phase 4B.

### Trusted job and authorization layer

The Phase 4B database migration adds passive runtime job state, immutable authorization snapshots, bounded normalized observations, guarded state transitions, and workspace-scoped read policies. Authenticated browser clients do not receive direct write access to runtime jobs or observations.

`lib/runtime-observations` owns trusted orchestration:

- operator/workspace/asset authorization at enqueue
- immutable canonical target, asset kind, and verification timestamp snapshot
- reauthorization immediately before DNS/network execution
- queued/running/succeeded/failed/blocked/cancelled transitions
- asynchronous database-backed cancellation checks between network operations and before persistence
- stable failure codes and bounded audit metadata
- deterministic finding/evidence mapping after successful observation

### Minimal asset workflow

Verified web/API asset pages expose a passive observation panel through trusted server actions. Unverified assets explain the verification requirement and repository assets remain unsupported. The UI shows only bounded job counts, safe failure reasons, selected header state, and TLS summaries.

Current orchestration is deliberately small and synchronous through the trusted control plane. Queue-backed isolated workers, dedicated egress controls, concurrency/backpressure, and worker fleet operations remain a later scaling boundary and must reuse the same Phase 4B safety contracts.

## Executable architecture boundaries

CI contains dependency-direction guards for:

- `packages/security-domain` remaining independent of scanners, UI, database, and provider SDKs
- `packages/runtime-observer` remaining independent of Next.js, React, Supabase, application/component code, and provider SDKs
- `packages/network-safety` remaining free of DNS, HTTP, TLS, database, and framework dependencies

## Supporting Phase 4B verification

CI #459 passed on security-hardening implementation head `3fa117745a002ba6f3c0b01107593b2ff9913254` before these final documentation corrections:

- reproducible dependency install
- 112 test files and 484 tests
- strict TypeScript typecheck
- CLI build and compiled `ScopeForge 0.1.0` smoke
- 700-file scanner benchmark with 0 findings and 0 errors
- Next.js production build

CI #459 includes regression coverage for asynchronous database-backed cancellation, remaining-total-budget request timeouts, URL query/fragment redaction in persisted observations, and DNS resolution inside the request deadline.

This is supporting implementation evidence only. Permanent documentation changes the PR head afterward, so PR #25 still requires the complete repository gate on its exact final head before merge.

## Next boundary

Finish PR #25 with an exact-head CI gate, review the full security-sensitive diff, confirm no unresolved blocking review thread, and squash merge with head protection. Phase 4C may be designed only after Phase 4B is merged. It must remain narrow, explicitly authorized, non-destructive, and isolated from the passive runtime boundary.

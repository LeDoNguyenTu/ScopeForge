# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

Primary Phase 4 references:

- `docs/superpowers/specs/2026-08-24-phase-4a-security-domain-contracts-design.md`
- `docs/superpowers/specs/2026-08-25-phase-4b-passive-runtime-observations-design.md`
- `docs/superpowers/plans/2026-08-25-phase-4b-passive-runtime-observations.md`
- `docs/superpowers/specs/2026-08-25-phase-4c-bounded-active-validation-design.md`
- `docs/superpowers/plans/2026-08-25-phase-4c-bounded-active-validation.md`

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

Phase 4B is complete and merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.

`packages/network-safety` remains pure public-IP/DNS policy. `packages/runtime-observer` remains passive-only and owns verified web/API target policy, same-host redirect decisions, bounded passive observations, deterministic passive findings, and request/redirect/observation/time budgets. `lib/runtime-observations` owns trusted enqueue authorization, immutable target/verification snapshots, execution-time reauthorization, DB-backed asynchronous cancellation, job state, persistence, stable failure codes, and bounded audit events.

No response body or cookie value is persisted. Persisted runtime URLs remove query strings, fragments, and credentials. Broad crawling, fuzzing, authentication replay, exploit payloads, credential attacks, persistence, and destructive behavior remain outside Phase 4B.

## Phase 4C-1 - Bounded CORS origin-policy validation

The approved Phase 4C design merged through PR #26 as `3f0e46c61944976a4ddfd6ef039487498a19f839`. PR #27 implements the first active profile, `cors-origin-policy@1`, and is in its final exact-head completion gate.

### Shared low-level runtime network

`packages/runtime-network` contains the framework-independent DNS/HTTPS mechanics shared by passive and active runtime policy layers:

- fresh DNS resolution before every connection
- complete public-address-set validation through `network-safety`
- deterministic socket pinning to a validated public IP
- original hostname retained for Host, SNI, and certificate verification
- HTTPS port 443 and GET-only transport contract
- DNS plus HTTPS inside one absolute request deadline
- abort of active HTTPS at the outer deadline
- automatic redirects disabled
- response bodies destroyed instead of captured
- no application, UI, database, finding, observer, validator, or provider behavior

Application/component code is architecture-guarded from importing this generic transport directly.

### Active validator authority

`packages/runtime-validator` is separate from the passive observer. Its only active authority is:

- verified `web_application` or `api` asset
- separate explicit owner/admin authorization; verification alone is insufficient
- immutable canonical target, asset kind, exact `verified_at`, profile/version, consent timestamp, actor, and budget snapshot
- execution-time reauthorization immediately before DNS/network
- exact verified HTTPS hostname, port 443
- exactly one unauthenticated GET
- fixed `Origin: https://scopeforge.invalid`
- fixed safe request headers only
- zero redirect following and zero retries
- zero request body, cookie, Authorization, browser state, or caller-provided request configuration
- 5-second DNS-inclusive request deadline and 10-second total bound
- one bounded normalized `cors-policy` observation
- no response-body persistence

A caller cannot choose URL, path, method, Origin, headers, body, credentials, redirect policy, profile, or budget.

### Findings and evidence

CORS evaluation is deterministic and conservative:

- exact synthetic-origin allowance plus credentialed CORS maps to a high/high `runtime_validated` finding
- exact synthetic-origin reflection without credential allowance maps to a low/high `runtime_validated` finding
- wildcard and missing `Vary: Origin` remain observation-only in this slice

Findings reuse `packages/security-domain`; no parallel finding model exists. Active finding/evidence identity and provenance are profile-versioned with `cors-origin-policy@1`, and evidence summaries remain bounded.

### Trusted job, persistence, and cancellation boundary

`lib/active-validation` owns owner/admin authorization, immutable active job snapshots, execution reauthorization, repository access, stable bounded failures/audits, and DB-backed cancellation.

Active validation reuses `scan_jobs` and `runtime_observations`. Authenticated browser clients remain select-only for runtime state; trusted server adapters perform writes.

Persistence and cancellation are serialized in the database:

- `cors-policy` inserts require the exact parent job to be `running`, active, and uncancelled
- the observation guard locks the matching workspace/job/asset parent row before checking state
- if cancellation acquires the row first, observation persistence is rejected
- if the active observation commits first, a later cancellation request is rejected so committed active evidence cannot coexist with a `cancelled` terminal state
- success still requires the job to remain running and uncancelled

### Asset workflow

Verified web/API asset pages keep passive observation and bounded active validation visually and operationally separate. The active panel explains the fixed request contract and requires an explicit consent checkbox. The dedicated server action accepts asset identity plus consent only and binds the profile/budget server-side. Active cancellation is scoped to the active job.

## Executable architecture boundaries

CI guards:

- `packages/security-domain` from scanner/UI/database/provider dependency reversal
- `packages/network-safety` from DNS/HTTP/TLS/database/framework behavior
- `packages/runtime-network` from application/domain/observer/validator dependency reversal
- application/component/lib code from importing generic `runtime-network` authority directly
- `packages/runtime-observer` from active-validator, UI, database, Supabase, and provider dependencies
- `packages/runtime-validator` from passive-observer, UI, database, Supabase, and provider dependencies
- `runtime-validator` from re-exporting generic transport authority

## Supporting Phase 4C-1 verification

CI #546 passed on implementation/security-hardening head `cc57248fd525e1a05312bb221ce35844c18a2530` before the permanent documentation tail:

- reproducible dependency install
- 122 test files and 538 tests
- strict TypeScript typecheck
- CLI build and compiled `ScopeForge 0.1.0` smoke
- 700-file scanner benchmark with 0 findings and 0 errors
- Next.js production build

CI #546 includes the final regression for cancellation/persistence linearization in addition to active authorization, request authority, DNS/pinning/deadlines, profile-versioned finding provenance, trusted persistence, UI/action boundaries, and dependency guards.

The implementation is frozen. The current documentation tail changes no runtime behavior. The exact final PR #27 head must still pass the complete repository gate before merge; only that exact final head counts as the merge gate.

## Next boundary

Complete PR #27 only after the exact documentation head is fully green, mergeable, security-review clean, and free of unresolved blocking review threads. Merge with expected-head protection, verify merged content and post-merge CI when exposed by GitHub, then use the permanent roadmap to design the next delivery boundary without widening the active HTTP authority.

Queue-backed isolated workers, dedicated egress infrastructure, concurrency/backpressure, private artifacts, fleet operations, and production abuse controls remain Phase 6 work and are not claimed by Phase 4C-1.

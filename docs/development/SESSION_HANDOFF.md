# ScopeForge Session Handoff

## Current phase

Phase 4C-1 - bounded CORS origin-policy validation, final exact-head completion gate.

Active branch: `feat/phase-4c-cors-origin-policy`

Active PR: #27 `Build Phase 4C-1 bounded CORS validation`

Approved design: `docs/superpowers/specs/2026-08-25-phase-4c-bounded-active-validation-design.md`

Approved implementation plan: `docs/superpowers/plans/2026-08-25-phase-4c-bounded-active-validation.md`

The design merged through PR #26 as `3f0e46c61944976a4ddfd6ef039487498a19f839`.

## Completed platform work

- Phase 1 foundation is complete.
- Phase 2 asset control and authorization is complete.
- Phase 3 code and supply-chain security is complete and merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- Phase 4A security-domain contracts are complete and merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- Phase 4B passive runtime observations are complete and merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- Phase 4C-1 implementation and security hardening are complete in PR #27; only the exact final documentation-head gate and merge verification remain.

## Phase 4C-1 implementation

### Runtime network extraction

`packages/runtime-network` now owns shared low-level runtime networking:

- fresh DNS resolution before every connection
- complete public-IP set validation through `packages/network-safety`
- deterministic socket pinning
- original hostname retained for Host/SNI/certificate verification
- HTTPS/443 GET-only transport contract
- DNS and HTTPS inside one absolute request deadline
- abort of active HTTPS on the outer deadline
- no automatic redirects
- response-body destruction

`packages/runtime-observer` remains passive-only and delegates only low-level mechanics to this package.

### Active validator

`packages/runtime-validator` implements only `cors-origin-policy@1`:

- verified web/API targets only
- exact canonical HTTPS target, port 443
- fixed synthetic `Origin: https://scopeforge.invalid`
- exactly one unauthenticated GET
- zero redirect following and zero retries
- zero request body
- no cookie, Authorization, browser state, user headers, or caller request configuration
- DNS-inclusive 5-second request limit and 10-second total bound
- bounded `cors-policy` observation only
- no response-body persistence
- deterministic conservative `runtime_validated` findings

The validator cannot be used as a generic HTTP API. Profile/version and budget are bound server-side.

### Authorization and trusted service

`lib/active-validation` owns:

- owner/admin-only active authorization
- separate explicit consent beyond verification
- immutable target/kind/verified-at/profile/version/authorization-time/actor/budget snapshot
- execution-time reauthorization immediately before DNS/network
- DB-backed async cancellation
- stable bounded failure and audit metadata
- active-only repository operations

Changed authorization, target, verification, profile, budget, state, or cancellation blocks execution before network traffic.

### Persistence and cancellation linearization

Phase 4C-1 reuses `scan_jobs` and `runtime_observations`; there is no parallel active job/finding system.

The final migration hardening defines the persistence/cancellation ordering:

- `cors-policy` observations require an exact running, uncancelled `active_validation` parent
- the observation insert trigger locks that workspace/job/asset parent row
- cancellation that acquires the row first prevents observation persistence
- observation persistence that acquires the row first commits before a competing cancellation can proceed
- once an active `cors-policy` observation exists, a later active cancellation request is rejected
- final success still requires the job to be running and uncancelled

This prevents a cancelled active job from retaining committed active evidence while preserving cancellation before the persistence linearization point.

Authenticated browser access to runtime observations remains select-only. Trusted server adapters perform mutations.

### Findings and evidence

Active CORS rules reuse the Phase 4A security domain:

- credentialed exact synthetic-origin allowance -> high severity / high confidence
- exact synthetic-origin reflection without credentials -> low severity / high confidence
- wildcard and missing Vary -> observation only

Finding/evidence identities and source/rule provenance include `cors-origin-policy@1`, so a future profile version cannot collide with v1 identities. Evidence summaries are bounded and descriptions do not claim proven victim credential/data exfiltration.

### Asset workflow

`ActiveValidationPanel` is separate from the passive panel. It shows the fixed request/profile contract, requires explicit consent, exposes dedicated active run/cancel actions, and displays bounded normalized CORS evidence. The browser does not construct raw network requests.

### Architecture guards

Executable guards ensure:

- application/UI code cannot import generic `runtime-network` directly
- `runtime-observer` cannot import active validator authority
- `runtime-validator` cannot depend on passive/UI/database/provider layers
- `runtime-validator` cannot re-export generic transport authority
- `runtime-network` remains below observer/validator/application/domain layers
- `network-safety` remains pure

## TDD and security-review evidence

Important RED/GREEN checkpoints in PR #27 include:

- missing action/UI adapter boundary
- distinct normalized Origin presentation in the active UI
- dependency guards for runtime-network/runtime-validator/passive separation
- active validator cancellation and total-deadline behavior
- observation insert parent-row lock for cancellation/persistence serialization
- profile-specific finding provenance/version identity
- rejection of active cancellation after active evidence has already persisted

The full security-sensitive diff has been reviewed for authorization bypass, arbitrary request authority, target widening, DNS/SSRF rebinding, pinning/TLS, redirect behavior, deadline gaps, cancellation races, persistence/privacy, RLS/trusted writes, evidence bounds, error disclosure, and passive/active dependency mixing. No known blocking security defect remains at the supporting code checkpoint.

## Supporting verification

CI #546 passed on code/security-hardening head `cc57248fd525e1a05312bb221ce35844c18a2530` with:

- 122 test files
- 538 tests
- strict TypeScript typecheck
- CLI TypeScript build
- compiled `ScopeForge 0.1.0` smoke
- 700-file benchmark with 0 findings and 0 errors
- Next.js production build

CI #546 is supporting evidence only because final permanent documentation commits move the PR head afterward.

## Exact remaining actions

1. Finish the remaining permanent documentation updates.
2. Require the complete repository CI gate on the exact final PR #27 head.
3. Re-check that exact head is mergeable and unchanged.
4. Re-check review threads and submitted reviews for blockers.
5. Reconfirm no new security issue was introduced by the docs-only tail.
6. Squash merge PR #27 with `expected_head_sha` protection.
7. Verify merged content on `main` and inspect post-merge CI when GitHub exposes it.
8. Refresh post-merge status wording if needed.
9. Continue from `docs/PHASES.md` into the next approved delivery/design boundary without widening active HTTP authority.

## Next boundary

The next major roadmap boundary after Phase 4C-1 is Phase 5 - Findings, Security Stories, and remediation. It should build hosted workflow and explanation/remediation/retest behavior on the existing `security-domain` rather than inventing another finding model.

Additional active validators are not implicitly authorized by Phase 4C-1. Broader crawling, endpoint discovery, preflight probing, arbitrary origins/methods/headers/bodies, authenticated testing, exploit payloads, fuzzing, credential attacks, DoS, and generalized DAST remain out of scope until separately designed and reviewed.

Worker-scale execution, dedicated egress, queues, concurrency/backpressure, artifacts, fleet isolation, and abuse controls remain Phase 6 work.

## Resume protocol

Read in this order:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/ARCHITECTURE.md`
5. `docs/PHASES.md`
6. `docs/superpowers/specs/2026-08-25-phase-4c-bounded-active-validation-design.md`
7. `docs/superpowers/plans/2026-08-25-phase-4c-bounded-active-validation.md`
8. PR #27 exact head and CI/merge state if still open

Do not infer Phase 4C-1 completion from CI #546. The exact final documentation head must pass the full gate and the merge itself must be verified.

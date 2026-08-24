# ScopeForge Session Handoff

## Current phase

Phase 4C-1 is complete. The next roadmap boundary is Phase 5 - Findings, Security Stories, and remediation.

Merged Phase 4C implementation: PR #27 `Build Phase 4C-1 bounded CORS validation`

Squash merge commit: `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`

Approved Phase 4C design: `docs/superpowers/specs/2026-08-25-phase-4c-bounded-active-validation-design.md`

Approved Phase 4C implementation plan: `docs/superpowers/plans/2026-08-25-phase-4c-bounded-active-validation.md`

## Completed platform work

- Phase 1 foundation is complete.
- Phase 2 asset control and authorization is complete.
- Phase 3 code and supply-chain security is complete and merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- Phase 4A security-domain contracts are complete and merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- Phase 4B passive runtime observations are complete and merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- Phase 4C-1 bounded CORS origin-policy validation is complete and merged through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.

## Phase 4C-1 completed boundary

### Runtime network extraction

`packages/runtime-network` owns shared low-level runtime networking:

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

The database defines the persistence/cancellation ordering:

- `cors-policy` observations require an exact running, uncancelled `active_validation` parent
- the observation insert trigger locks that workspace/job/asset parent row
- cancellation that acquires the row first prevents observation persistence
- observation persistence that acquires the row first commits before a competing cancellation can proceed
- once an active `cors-policy` observation exists, a later active cancellation request is rejected
- final success still requires the job to be running and uncancelled

Authenticated browser access to runtime observations remains select-only. Trusted server adapters perform mutations.

### Findings and evidence

Active CORS rules reuse the Phase 4A security domain:

- credentialed exact synthetic-origin allowance -> high severity / high confidence
- exact synthetic-origin reflection without credentials -> low severity / high confidence
- wildcard and missing Vary -> observation only

Finding/evidence identities and source/rule provenance include `cors-origin-policy@1`. Evidence summaries are bounded and descriptions do not claim proven victim credential/data exfiltration.

### Asset workflow and architecture guards

`ActiveValidationPanel` is separate from the passive panel. It shows the fixed request/profile contract, requires explicit consent, exposes dedicated active run/cancel actions, and displays bounded normalized CORS evidence.

Executable guards ensure application/UI code cannot import generic `runtime-network` directly, `runtime-observer` cannot import active-validator authority, `runtime-validator` cannot depend on passive/UI/database/provider layers or re-export generic transport authority, `runtime-network` remains low-level, and `network-safety` remains pure.

## Final Phase 4C verification

Exact final PR head `11c49e8723654f4279c9d09eed014e0b878281f6` passed CI #555 with:

- 122 test files
- 538 tests
- strict TypeScript typecheck
- CLI TypeScript build
- compiled `ScopeForge 0.1.0` smoke
- 700-file benchmark with 0 findings and 0 errors
- Next.js production build

The final tail after security-reviewed code head `cc57248fd525e1a05312bb221ce35844c18a2530` was documentation-only. The exact head remained mergeable, had no review threads or submitted blocking reviews, and was squash-merged using expected-head protection.

The available commit-workflow query did not expose a post-merge CI run for `fb3aa27...`; no result is inferred.

## Next boundary - Phase 5

Phase 5 is architectural work and should be designed before implementation. It should extend the existing `packages/security-domain` into hosted product workflows without duplicating the finding model.

The first Phase 5 design should determine the narrow initial slice across:

- persistent hosted finding lifecycle
- evidence versus inference storage and display
- finding-to-asset/observation/remediation relationships
- Security Story explanations with provenance and uncertainty
- remediation state and ownership
- retest/verification transitions
- developer versus security views over the same canonical state

The design should preserve this rule: deterministic scanner/runtime evidence or explicit human workflow can change validated security state; advisory/model output alone cannot.

Additional active validators remain a separate design boundary. Broad crawling, endpoint discovery, arbitrary request authority, authenticated testing, exploit probes, fuzzing, credential attacks, DoS, and generalized DAST remain out of scope.

Worker-scale execution, dedicated egress, queues, concurrency/backpressure, artifacts, fleet isolation, and abuse controls remain Phase 6 work.

## Resume protocol

Read in this order:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/ARCHITECTURE.md`
5. `docs/PHASES.md`
6. Phase 4C design/plan only when runtime boundary context is needed
7. Begin Phase 5 design from existing `security-domain` contracts and merged evidence sources

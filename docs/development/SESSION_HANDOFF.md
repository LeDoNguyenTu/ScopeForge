# ScopeForge Session Handoff

## Current phase

Phase 4B - verified passive runtime observations, final completion gate.

Active branch: `feat/phase-4b-passive-runtime-observations`

Active PR: #25 `Build Phase 4B passive runtime observations`

Approved Phase 4B design and implementation plan were merged through PR #24 as `d59e55c2d5123f0adb2b2c6d18eaace3b5790276`.

## Completed platform work

- Phase 1 foundation is complete.
- Phase 2 asset control and authorization is complete.
- Phase 3 code and supply-chain security is complete and merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- Phase 4A security-domain contracts are complete and merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- Phase 4B implementation and final security hardening are complete in PR #25. The PR is in its exact-head merge gate.

## Phase 4B implementation

### Network-safety boundary

`packages/network-safety` contains pure public-IP classification and resolution-result validation. It is shared by Phase 2 verification and Phase 4B runtime execution without owning DNS or transport behavior.

### Runtime observer

`packages/runtime-observer` contains:

- verified web/API target policy
- HTTPS port 443 and GET-only behavior
- explicit request-count, redirect-count, observation-size, request-timeout, and total-time budgets
- fresh DNS classification before each connection
- DNS-pinned HTTPS transport
- DNS resolution included inside each request deadline
- same-host redirect enforcement
- selected/redacted HTTP and TLS observations
- deterministic passive runtime rules
- deterministic mapping into the Phase 4A security domain

No response body or cookie value is persisted. Persisted runtime URLs remove query strings and fragments. Crawling, fuzzing, authentication replay, exploit payloads, credential attacks, and destructive behavior are not part of Phase 4B.

### Trusted application layer

`lib/runtime-observations` contains the migration-backed repository, authorization logic, and service orchestration.

The service requires authorization at enqueue and again immediately before network execution. It injects workspace-bound asynchronous database cancellation checks into the framework-independent observer, owns stable failure handling and bounded audits, and prevents cancelled executions from reaching observation/finding persistence.

The browser does not write runtime jobs or observations directly. Trusted server actions adapt the asset workflow to the service.

### Asset workflow

`RuntimeObservationPanel` exposes the minimal verified asset workflow:

- unverified assets must be verified first
- repository assets are unsupported
- verified web/API assets may run the bounded passive observation
- queued/running jobs expose cancellation
- succeeded jobs show bounded request/redirect/finding counts and selected HTTP/TLS summaries
- failed/blocked jobs show stable safe reasons

### Architecture guards

The final Phase 4B head includes executable dependency rules for `security-domain`, `runtime-observer`, and `network-safety` so framework/infrastructure dependencies cannot silently move inward.

## TDD and verification evidence

Important security checkpoints:

- the original service contract failed because `lib/runtime-observations/service.ts` did not exist; the trusted production orchestration was implemented against that contract
- asynchronous cancellation regression tests demonstrated that a Promise-based cancellation callback was previously treated synchronously and that the service did not inject a database-backed cancellation check
- the total-runtime regression demonstrated that a request could receive the full per-request timeout even when less total budget remained
- URL-redaction regressions demonstrated that query secrets could appear in persisted status and redirect observations
- DNS-deadline regressions demonstrated that DNS resolution previously sat outside the request timeout and that DNS elapsed time was not deducted from the HTTPS timeout

Supporting GREEN gate:

CI #459 passed on head `3fa117745a002ba6f3c0b01107593b2ff9913254` with:

- 112 test files
- 484 tests
- strict TypeScript typecheck
- CLI build
- compiled `ScopeForge 0.1.0` smoke
- 700-file benchmark with 0 findings and 0 errors
- Next.js production build

CI #459 is supporting evidence only because permanent documentation commits change the head afterward.

## Database status

Phase 4B adds passive runtime job and observation persistence with immutable authorization snapshots, guarded transitions, bounded payloads, workspace-scoped reads, and trusted-server-only writes for runtime state.

## Exact remaining actions

1. Complete the final security-sensitive changed-file review.
2. Confirm no unresolved blocking review thread exists.
3. Require a new complete CI run on the exact final documentation head.
4. Squash merge with expected-head protection.
5. Verify the merged PR/main content and resulting `main` CI when available.
6. Clean merged historical branches only when safe tooling is available.
7. Begin Phase 4C design only after Phase 4B merge completion.

## Next boundary

Phase 4C may introduce only narrow, explicitly authorized, non-destructive active validation. It must reuse Phase 4B authorization, target-transition, network-safety, budget, cancellation, evidence, and audit contracts. Broad crawling, generalized fuzzing, exploit frameworks, credential attacks, denial-of-service behavior, persistence, and destructive validation remain out of scope.

Worker-scale runtime execution remains a separate later delivery boundary. Queue-backed isolated workers, dedicated egress controls, concurrency/backpressure, private artifacts, and operational worker isolation are not claimed complete by Phase 4B.

## Resume protocol

Read in this order:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/ARCHITECTURE.md`
5. `docs/superpowers/specs/2026-08-25-phase-4b-passive-runtime-observations-design.md`
6. PR #25 exact head and CI/merge state

Do not infer final Phase 4B completion from CI #459. The exact final documentation head must pass and the merge must be verified first.

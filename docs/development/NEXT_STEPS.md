# ScopeForge Next Steps

## Current completion gate - Phase 4C-1

PR #27 `Build Phase 4C-1 bounded CORS validation` implements the approved PR #26 design for the first narrowly active runtime profile, `cors-origin-policy@1`.

Supporting implementation/security-hardening head `cc57248fd525e1a05312bb221ce35844c18a2530` passed CI #546 with 122 test files / 538 tests, strict typecheck, CLI build/runtime, the 700-file scanner benchmark, and the production build.

That supporting head includes regression coverage and production hardening for:

- explicit owner/admin active authorization separate from verification
- execution-time immutable-snapshot reauthorization before DNS/network
- fixed one-request authority with no arbitrary URL/method/header/body/credential surface
- shared fresh-DNS/public-IP/pinning/TLS/deadline transport without widening the passive observer
- DNS resolution included inside the request deadline
- bounded CORS-only observation persistence with response-body destruction
- deterministic profile-versioned `runtime_validated` findings and bounded evidence
- DB-backed active cancellation checks before persistence/success
- parent-row locking during runtime observation persistence
- cancellation/persistence linearization so committed active evidence cannot coexist with a cancelled terminal state
- dependency guards preventing UI/application code from importing generic runtime transport authority

The implementation is frozen. The remaining commits are permanent documentation only. The exact remaining Phase 4C-1 actions are:

1. Require the exact final documentation head to pass the complete repository CI gate:
   - `npm ci --ignore-scripts --no-audit --no-fund`
   - `npm test`
   - `npm run typecheck`
   - `npm run build:cli`
   - compiled CLI version smoke
   - `npm run benchmark:scanner`
   - `npm run build`
2. Re-check the complete PR #27 security-sensitive diff for authorization bypass, target widening, SSRF/DNS rebinding, generic request authority, redirect behavior, timeout gaps, cancellation races, secret persistence, RLS/trusted-write regression, unbounded evidence, unsafe error disclosure, and passive/active dependency mixing.
3. Confirm the exact head has no unresolved blocking review thread or blocking submitted review.
4. Confirm GitHub still reports the unchanged head mergeable.
5. Squash merge with `expected_head_sha` protection.
6. Verify merged content on `main` and inspect resulting `main` CI when exposed by the available GitHub tooling. Never infer an unavailable post-merge result.
7. Refresh post-merge state wording if required before beginning the next architectural slice.

## Next planned delivery boundary

After Phase 4C-1 is merged and verified, follow `docs/PHASES.md`. The next major product boundary is Phase 5 - Findings, Security Stories, and remediation.

Phase 5 should build on the existing `security-domain` rather than inventing a second finding model. The design should focus on hosted normalized finding lifecycle, evidence/inference separation, risk relationships, explanation workflows, remediation state, retesting, and developer/security views.

Do not widen Phase 4C into generalized DAST merely because an active transport now exists. Additional active profiles require their own narrow design/security review.

## Worker-scale runtime execution

Production runtime scale remains Phase 6. Queue-backed isolated workers, dedicated egress policy, concurrency/backpressure, private artifacts, fleet operations, and abuse controls should reuse the existing target, authorization, budget, cancellation, network, evidence, and audit contracts rather than duplicating or widening them.

## Future AI work

Do not add a model provider merely to prove that AI can be connected. Phase 4A already establishes the provider-neutral advisory seam.

When a concrete Phase 5 workflow benefits from model assistance, place a small provider adapter behind `AdvisoryService`. Apply the advisory context policy before the provider boundary, validate output into domain-owned inferred result types, and retain deterministic or human confirmation for any security-state change. Core product behavior must continue to work with no provider configured.

## Resume protocol

Before a new implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`.
2. Read `docs/development/CURRENT_STATE.md`.
3. Read `docs/development/TEST_STATUS.md`.
4. Read `docs/ARCHITECTURE.md` and `docs/PHASES.md`.
5. Confirm PR #27 exact head and CI/merge state if it is still open.
6. If Phase 4C-1 is merged and verified, begin the next approved roadmap/design boundary without widening `runtime-observer`, `runtime-validator`, or generic transport authority by convenience.

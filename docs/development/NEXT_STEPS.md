# ScopeForge Next Steps

## Current completion gate - Phase 4B

PR #25 `Build Phase 4B passive runtime observations` contains the completed implementation of the approved PR #24 design.

Supporting implementation head `364ccd435c824bfdfab75407db967d027bf18656` passed CI #437 with 109 test files / 474 tests, strict typecheck, CLI build/runtime, the 700-file scanner benchmark, and the production build.

The permanent architecture/documentation and dependency-guard changes move the PR head beyond that supporting checkpoint. The exact remaining Phase 4B actions are:

1. Complete the runtime-observer/network-safety architecture dependency guard.
2. Commit the permanent Phase 4B project-state documentation.
3. Review the complete PR #25 changed-file set against the approved design and security boundary.
4. Confirm there is no unresolved blocking review thread.
5. Require the exact final head to pass the complete repository CI gate:
   - `npm ci --ignore-scripts --no-audit --no-fund`
   - `npm test`
   - `npm run typecheck`
   - `npm run build:cli`
   - compiled CLI version smoke
   - `npm run benchmark:scanner`
   - `npm run build`
6. Squash merge with expected-head protection.
7. Verify merged content and the resulting `main` CI when exposed by the available GitHub tooling. Never infer an unavailable post-merge result.
8. Remove merged historical feature/design branches only if they are no longer needed and tooling permits safe deletion.

## Phase 4C - Bounded active validation

Only after Phase 4B is merged should ScopeForge design narrow active validation. The design must preserve the authorization, target-transition, network-safety, budget, cancellation, evidence, and audit contracts established in Phase 4B.

The first 4C slice should be intentionally small and non-destructive. It should define the exact active behavior before implementation and should require explicit authorization rather than treating verification alone as permission for arbitrary testing.

Do not jump directly to:

- broad crawling
- generalized fuzzing
- exploit frameworks
- credential attacks
- denial-of-service behavior
- cloud-account posture connectors
- persistence
- destructive validation
- arbitrary internet-wide scanning

## Worker-scale runtime execution

The current Phase 4B asset workflow invokes the trusted bounded runtime service from the control plane. Production scanner scale remains a separate delivery boundary. Queue-backed isolated workers, dedicated egress policy, concurrency/backpressure, private artifacts, and operational controls should reuse `packages/runtime-observer` and `lib/runtime-observations` contracts rather than duplicating or widening them.

## Future AI work

Do not add a provider merely to prove that AI can be connected. Phase 4A already establishes the provider-neutral advisory seam.

When a concrete workflow benefits from model assistance, add a small provider adapter behind `AdvisoryService`. Apply the advisory context policy before the provider boundary, validate provider output into domain-owned inferred result types, and retain deterministic or human confirmation for any security-state change. Core product behavior must continue to work with no provider configured.

## Resume protocol

Before a new implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`.
2. Read `docs/development/CURRENT_STATE.md`.
3. Read `docs/development/TEST_STATUS.md`.
4. Confirm PR #25 exact head and CI/merge status.
5. If Phase 4B is merged and its completion gate is satisfied, begin Phase 4C design from the existing authorization and passive-runtime boundary rather than widening `runtime-observer` directly.

# ScopeForge Next Steps

## Current completion gate - Phase 4A

PR #23 `Build Phase 4A security domain contracts` contains the completed Phase 4A implementation. The supporting implementation head `c0e93ac0408a01a8c2b1ec513e38286a7f102cef` passed CI #375 with 93 test files / 350 tests, strict typecheck, CLI build/runtime, the 700-file scanner benchmark, and the production build.

The permanent state documentation changes the head after that supporting gate. The exact remaining Phase 4A actions are:

1. Commit the final permanent project-state documentation.
2. Review the complete PR #23 changed-file set and security/architecture boundaries.
3. Confirm no unresolved blocking review thread exists.
4. Mark PR #23 ready for review only when no further head-changing edit is expected.
5. Require the exact final head to pass the complete repository CI gate:
   - `npm ci --ignore-scripts --no-audit --no-fund`
   - `npm test`
   - `npm run typecheck`
   - `npm run build:cli`
   - compiled CLI version smoke
   - `npm run benchmark:scanner`
   - `npm run build`
6. Squash merge with `expected_head_sha` protection.
7. Verify the merged content and the resulting `main` CI when exposed by the available GitHub tooling. Never infer an unavailable post-merge result.
8. Remove merged historical feature/design branches that are no longer needed, preserving `main` and any branch associated with open work.
9. Begin Phase 4B design and implementation.

## Phase 4B - Verified passive runtime and API observations

Phase 4B should reuse the Phase 4A `security-domain` instead of creating runtime-specific finding objects.

The first slice should design the execution and safety contract before implementing broad network behavior. It should cover:

- workspace and asset authorization at enqueue and execution time
- proof-of-control continuity from Phase 2
- canonical target and allowed-target-transition rules
- DNS resolution, IP classification, rebinding defenses, and redirect validation for every outbound connection
- allowed schemes, ports, and methods
- egress-deny defaults
- request count, response size, body capture, time, concurrency, and retry budgets
- cancellation and timeout semantics
- audit records for authorization and execution decisions
- explicit evidence classification and redaction before persistence or advisory use
- deterministic mapping from passive runtime observations into `security-domain`
- local test fixtures that do not require unsafe public targets

The first Phase 4B implementation should prefer passive, directly observable properties such as bounded HTTP/TLS/security-header/API-surface observations. It must not silently become a crawler or exploit engine.

## Phase 4C - Bounded active validation

Only after the Phase 4B safety properties are implemented and testable should ScopeForge add narrow active validation. Keep it non-destructive and explicitly authorized.

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

## Future AI work

Do not add a provider merely to prove that AI can be connected. Phase 4A already establishes the integration seam.

When a concrete workflow benefits from model assistance, add a small provider adapter behind `AdvisoryService`. Apply the advisory context policy before the provider boundary, validate provider output into domain-owned inferred result types, and retain deterministic or human confirmation for any security-state change. Core product behavior must continue to work with no provider configured.

## Resume protocol

Before a new implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`.
2. Read `docs/development/CURRENT_STATE.md`.
3. Read `docs/development/TEST_STATUS.md`.
4. Confirm PR #23 exact head and CI/merge status.
5. If Phase 4A is merged and its completion gate is satisfied, start Phase 4B from the approved security-domain boundary rather than modifying scanner-core or introducing active behavior directly.

# ScopeForge Next Steps

## Phase 4C-1 completion

Phase 4C-1 is complete. PR #27 `Build Phase 4C-1 bounded CORS validation` was squash-merged as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0` after the exact final head `11c49e8723654f4279c9d09eed014e0b878281f6` passed CI #555.

The exact merge gate passed:

- `npm ci --ignore-scripts --no-audit --no-fund`
- 122 test files / 538 tests
- strict TypeScript typecheck
- CLI build and compiled `ScopeForge 0.1.0` smoke
- 700-file scanner benchmark with 0 findings / 0 errors
- Next.js production build

The final tail after the reviewed code checkpoint was documentation-only. Before merge, the exact head was still mergeable and had no review threads or submitted blocking reviews. Merge used expected-head protection.

The available commit-workflow query did not expose a post-merge run for the squash commit, so no post-merge CI result is inferred.

## Next planned delivery boundary - Phase 5

The next major roadmap boundary is Phase 5 - Findings, Security Stories, and remediation.

Phase 5 should build on `packages/security-domain` rather than define a second finding model. The first design should cover:

- hosted normalized finding persistence and lifecycle
- evidence versus inference separation
- relationships between findings, assets, observations, and remediation work
- Security Story explanation views that preserve provenance and uncertainty
- remediation workflow/state without pretending a fix is verified before retest
- explicit retesting/verification transitions
- developer and security-oriented views over the same canonical finding state

The design should keep deterministic scanner/runtime evidence authoritative for validation state. AI/model assistance, if added later, must remain advisory/inferred and cannot independently promote a finding to validated or resolved.

## Active-testing boundary remains narrow

Do not widen Phase 4C into generalized DAST merely because an active transport exists. Additional active profiles require their own explicit design/security review.

Still out of scope without a new approved active design:

- broad crawling or endpoint discovery
- OPTIONS/preflight probing
- user-supplied origins
- arbitrary methods/headers/bodies
- authenticated/cookie/credential replay
- SQLi/XSS/SSRF exploit probes
- fuzzing or credential attacks
- denial-of-service behavior
- generalized exploit confirmation

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
5. Confirm `main` contains PR #27 squash commit `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.
6. Start Phase 5 from the existing `security-domain` and merged Phase 4 evidence/runtime contracts rather than widening scanner/runtime authority by convenience.

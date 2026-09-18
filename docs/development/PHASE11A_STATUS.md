# Phase 11A Planning Core Status

Last updated: 2026-09-18, Asia/Singapore.

## Baseline

- Released baseline: `main` at `e493f1f339b8410793e94f61306715bfb05c6166` after Phase 10A3 release.
- Active implementation PR: #125.
- Superseded docs-only PR: #124, closed after its design/plan were reconciled onto the post-Phase-10A3 branch.
- No Phase 11 production migration has been created or applied.
- No new hosted execution class or runtime capability has been enabled.

## Implemented in this checkpoint

### Task 1 - planning domain contracts

- Added closed provider-neutral contracts for execution modes, assets, observations, hypotheses, capabilities, action intents, authorizations, action results, coverage, and stop reasons.
- Added runtime constructors that reject unknown planner-visible authority such as provider-native args, shell commands, arbitrary URLs, arbitrary headers, payload paths, or JavaScript.
- Authorization construction rejects already-expired authority.
- Observations require evidence references and normalized primitive facts.

### Task 2 - security graph

- Added deterministic node/edge insertion.
- Duplicate observations collapse while provenance is preserved.
- Edge identity is derived from normalized graph semantics.
- Evidence-backed edges require known endpoints and explicit authorization/provenance references.
- Stale edges are excluded from attack-path derivation.
- Graph fingerprints are deterministic for equivalent normalized state.

### Task 3 - hypothesis lifecycle and coverage

- Added explicit deterministic hypothesis-rule registration and derivation.
- Added reviewed state transitions with evidence required before supported/refuted terminal states.
- Added bounded coverage accounting and deterministic stop conditions for cancellation, authorization expiry, deadline, request budget, graph growth, provider failures, approval waits, coverage completion, and hypothesis exhaustion.

### Task 4 - deterministic policy gate

- Unknown capabilities fail closed.
- Target nodes must be inside the immutable authorization snapshot.
- Workspace mode ceilings are enforced.
- Intrusive actions require fresh owner/admin approval.
- Validation actions require approval unless the workspace is explicitly configured as a lab.
- Request/runtime budgets are narrowed to capability and workspace ceilings.
- Approved authorizations bind exact workspace, nodes, snapshot, capability/version, mode, budgets, expiry, and cancellation key.
- Architecture guards keep planning/policy packages free of application, database, worker, provider, model, network, process, and filesystem authority.

### Task 5 - capability registry

- Added closed static provider registration.
- Duplicate providers are rejected.
- Unknown capability, mode mismatch, disabled provider, and unavailable provider states fail explicitly.
- Selection is deterministic by health, configured priority, then provider ID.
- Unavailable providers fall back only to other explicitly registered compatible providers.
- Registry code is included in the Phase 11 dependency-direction guard.

### Task 6 - native ScopeForge observation adapters

- Added pure adapters for existing hosted Phase 3 findings, passive runtime observations, and active CORS validation observations.
- Adapters consume existing result contracts by type only and never invoke scanners, runtime networking, validators, workers, or persistence.
- Normalized observations keep stable provider/capability provenance and canonical evidence references.
- Phase 3 normalization deliberately omits descriptions, evidence summaries, remediation text, taxonomy, and repository URLs.
- Runtime normalization deliberately omits target URLs and observed header values.
- Architecture tests enforce the transformation-only boundary.

### Task 7 - deterministic planner v1

- Added explainable scoring for information gain, hypothesis confidence, validation value, provider reliability, normalized cost, and policy weight.
- Added deterministic bounded next-iteration planning.
- Hypothesis preconditions and capability preconditions are both evidence-gated.
- Target node type support is checked against the current graph before scheduling.
- The planner emits ActionIntent only. It never authorizes or executes an action.
- Adaptive tests require API discovery evidence before an API-operation action becomes eligible.

## Validation checkpoints

- CI run #1141 on the Tasks 1 to 5 checkpoint reached `npm test` and reported 441 passing test files / 2,020 passing tests, with one architecture-guard failure.
- The failure was a guard false positive: the guard scanned its own test fixture containing the literal rejected string `fetch('/admin')`. No implementation test failed.
- The guard now inspects implementation sources only while keeping the same authority restrictions.
- This documentation checkpoint intentionally does not use `[skip ci]` so the complete Tasks 1 to 7 pure Phase 11A slice receives one full repository CI run.

## Next

Require exact-head CI and Vercel success for the complete Tasks 1 to 7 slice. If green, review and merge PR #125 before beginning Task 8 persistence. Do not apply any Phase 11 production migration or enable any new hosted execution capability as part of this PR.

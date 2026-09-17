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

## Validation checkpoint

This commit intentionally does not use `[skip ci]` so PR #125 receives one full repository CI run after Tasks 1 to 5 are coherent.

## Next

If this checkpoint is green, continue with Task 6 native ScopeForge observation adapters, then Task 7 deterministic planner v1. Keep both pure and authority-free. Do not begin Phase 11 persistence or provider execution until the pure planning slice is accepted.

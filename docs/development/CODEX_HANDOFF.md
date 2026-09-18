# ScopeForge Codex handoff

Last reconciled: 2026-09-18, Asia/Singapore. Live GitHub/provider state wins if newer.

## Current resume point

- Repository: `LeDoNguyenTu/ScopeForge`
- Released `main`: `e4af4d707a7a6139ad12a705e4c3b5ece726d3e0`
- Active branch: `feat/phase-11a-run-orchestration-20260918`
- Active PR: #128
- PR #125 released Phase 11 Tasks 1 to 7.
- PR #126 released Task 8 planning persistence.

## Task 9 implementation

PR #128 implements trusted Phase 11 run orchestration:

- owner/admin verified-asset run creation
- immutable authorization and policy snapshots
- trusted planning-state load
- deterministic planner and policy evaluation
- service-controlled enqueue boundary with replay-safe reservation tokens
- explicit queue idempotency key
- intrusive and validation approval workflow
- cancellation propagation
- bounded member read models
- service-role-only orchestration RPCs
- control-plane authority architecture guard

Important hardening already incorporated:

- no-approval intrusive actions enter `approval_required`, not terminal rejection
- run replay compares immutable authorization scope, mode ceiling, expiry, creator, policy and deadline
- actions persist and compare capability version as part of action identity
- authorization identity is capability-version-bound
- action, authorization, and cancellation identifiers use deterministic SHA-256 stable IDs
- queue idempotency uses the version-bound authorization ID

## Validation evidence

- CI #1150: 446 test files and 2,035 tests passed; only four Task 9 test typing errors failed typecheck.
- Those four typing errors were fixed.
- CI #1151 passed the full pipeline on earlier head `fda54dbf...`.
- Later security hardening means a new exact-head CI/Vercel gate is still required before merge.

## Database/runtime state

- Correct Supabase: `tdgpibrepzcvdivztkta` named `ScopeForge`.
- Never use `xwsergbpvkcsugexssmc` for this repository.
- `20260918061500_phase_11a_planning_graph.sql` is not applied to production.
- `20260918070000_phase_11a_run_orchestration.sql` is not applied to production.
- No Phase 11 external provider execution is enabled.

## Immediate next actions

1. obtain exact-head full CI and Vercel success for #128
2. inspect review threads and final diff
3. merge #128 only if the exact head is green
4. verify released `main` and post-merge CI/Vercel
5. continue the adaptive evaluation harness from the approved Phase 11 plan
6. keep production schema and external provider activation separately gated

## Tooling caveat

Repository guidance requires GitNexus impact/change-detection review. GitNexus MCP is not exposed in this ChatGPT connector session, so no GitNexus report can truthfully be claimed.

Never expose secrets, weaken authorization/RLS/containment, rewrite deployed migrations, confuse Supabase projects, or bypass production/provider release gates.

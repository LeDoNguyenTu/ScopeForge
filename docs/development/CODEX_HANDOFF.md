# ScopeForge Codex handoff

Last reconciled: 2026-09-18, Asia/Singapore. Live GitHub/provider state wins if it differs from this file.

## Current resume point

- Repository: `LeDoNguyenTu/ScopeForge`
- Released `main`: `e4af4d707a7a6139ad12a705e4c3b5ece726d3e0`
- Active branch: `feat/phase-11a-run-orchestration-20260918`
- Active PR: #128, Phase 11A trusted pentest run orchestration
- PR #126 is merged and released. It completed Task 8 planning persistence.
- PR #125 is merged and released. It completed Tasks 1 to 7.

## Task 9 state

PR #128 implements the trusted control plane for Phase 11 runs:

- verified-asset owner/admin run creation
- immutable authorization and policy snapshots
- planner and policy orchestration
- replay-safe enqueue reservations
- approval workflow
- cancellation propagation through injected queue controls
- privacy-reduced read models
- service-role-only orchestration RPCs
- control-plane authority architecture guard

Important review fix:

- intrusive work without approval previously became `rejected`, making the approval RPC unreachable
- policy now emits `approval_required` for intrusive work without fresh owner/admin approval
- approval can then be persisted and the same deterministic action can be re-evaluated and queued

## Validation

- CI #1150: 446 test files passed, 2,035 tests passed.
- CI #1150 failed only at `npm run typecheck` due four test-only typing errors.
- Those four typing errors are fixed.
- Additional approval and orchestration-authority tests are now present.
- Final exact-head full CI and Vercel are still required before merge.

## Database and runtime safety

- Correct Supabase project: `tdgpibrepzcvdivztkta` named `ScopeForge`.
- Do not use `xwsergbpvkcsugexssmc`, which belongs to Brian Job Command Center.
- Phase 11 migrations `20260918061500_phase_11a_planning_graph.sql` and `20260918070000_phase_11a_run_orchestration.sql` are NOT applied to production.
- No external Phase 11 provider execution capability is enabled.
- Do not apply schema or enable provider execution merely because PR #128 merges.

## Immediate next actions

1. run exact-head full CI and Vercel for PR #128
2. inspect any failure and fix only against the live PR head
3. review final diff and review threads
4. merge #128 only if exact-head gates are green
5. verify merged `main`
6. continue the next approved Phase 11 slice from the implementation plan without applying production Phase 11 schema

## Tooling caveat

Repository guidance requires GitNexus impact/change-detection review. GitNexus MCP is not exposed in this ChatGPT connector session, so no GitNexus result should be claimed for this continuation.

Never expose secrets, weaken authorization/RLS/containment, rewrite deployed migrations, confuse Supabase projects, or bypass the separate production-schema/provider-enablement gates.

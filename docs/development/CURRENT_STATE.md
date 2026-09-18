# ScopeForge Current State

Last reconciled: 2026-09-18, Asia/Singapore.

## Released baseline

- `main`: `e4af4d707a7a6139ad12a705e4c3b5ece726d3e0`
- Phase 11 Tasks 1 to 7: released through PR #125.
- Phase 11 Task 8 persistence: released through PR #126.
- Task 8 source validation: CI #1146 and Vercel passed.
- No Phase 11 production migration has been applied.

## Active work

- PR #128: Phase 11A trusted pentest run orchestration.
- Branch: `feat/phase-11a-run-orchestration-20260918`.
- Task 9 migration remains source-only.
- External provider execution remains disabled.

Task 9 includes run creation, immutable authorization/policy snapshots, planning-state loading, planner-policy orchestration, action reservation/idempotency, approval, cancellation propagation, privacy-reduced read models, and service-role-only orchestration RPCs.

Review found and fixed an intrusive-approval lifecycle bug. Intrusive work without fresh approval now enters `approval_required` instead of an irreversible `rejected` state.

## Current validation

- CI #1150: all 446 test files and 2,035 tests passed.
- Its only failure was TypeScript checking in four Task 9 test-only lines.
- Those test typing errors are fixed.
- Additional approval and control-plane authority regression coverage is present.
- Exact-head GREEN CI and Vercel remain the current merge gate.

## Supabase

- ScopeForge project: `tdgpibrepzcvdivztkta`.
- Phase 11 migrations are intentionally unapplied.
- Production rollout is a separate reviewed gate.

## Next

Finish exact-head validation for #128, merge only if green, verify released main, then continue the next approved Phase 11 slice. Do not enable external provider execution as part of Task 9.

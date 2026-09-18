# Phase 11A Planning Core Status

Last updated: 2026-09-18, Asia/Singapore.

## Live checkpoint

- Released main: `e4af4d707a7a6139ad12a705e4c3b5ece726d3e0`, merged through PR #126.
- Active Task 9 PR: #128 on `feat/phase-11a-run-orchestration-20260918`.
- Task 8 persistence is merged. Its source head passed CI #1146 and Vercel.
- The Phase 11 Task 8 and Task 9 migrations remain source-only and have not been applied to production.
- No Phase 11 external provider execution capability is enabled.

## Task 9 - trusted run orchestration

PR #128 currently adds:

- owner/admin verified-asset run creation
- immutable run policy and authorization snapshots
- trusted planning-state loading
- deterministic planner to policy to approved-action enqueue orchestration
- exact enqueue reservation tokens and replay-safe queue finalization
- owner/admin intrusive and validation approval workflow
- cancellation propagation through an injected queue cancellation boundary
- privacy-reduced run and action read models
- private action, attempt, authorization, and approval persistence
- service-role-only SECURITY DEFINER orchestration RPCs with empty search paths
- architecture coverage preventing direct provider, process, network, service-role-key, or worker-credential authority inside `lib/pentest-runs`

A lifecycle defect was found during review: intrusive actions without approval were being persisted as `rejected`, but the approval RPC accepts only `approval_required`. The policy now returns `approval_required` for intrusive work without a fresh owner/admin approval, making the approval-resume path reachable.

## Validation evidence

- CI #1150 ran against the RED/diagnostic Task 9 checkpoint.
- All 446 test files and all 2,035 tests passed.
- CI #1150 failed only in TypeScript checking because of four test-only typing errors in the new create/cancel tests.
- Those test-only type errors are fixed after #1150.
- Focused approval and orchestration authority regression tests have been added after #1150.
- A new exact-head full CI/Vercel gate is required before merge.

GitNexus is required by repository guidance, but the GitNexus MCP tool is not exposed in this ChatGPT connector session. Do not claim a GitNexus report exists for this Task 9 continuation.

## Release boundary

Before merge:

1. require exact-head full CI success
2. require exact-head Vercel success
3. review the final PR diff and unresolved review threads
4. keep both Phase 11 migrations unapplied in production
5. keep external provider execution disabled

After Task 9 merges, the implementation plan places the adaptive evaluation harness before external-provider expansion in the preferred release order. Provider-specific execution remains separately reviewed and gated.


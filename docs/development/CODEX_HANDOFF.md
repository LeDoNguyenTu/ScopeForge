# ScopeForge Codex handoff

Last reconciled: 2026-09-18, Asia/Singapore. Live GitHub/provider state wins.

## Current resume point

- Released `main`: `fbab7d34bad504ecba7b883aba9f8013cc09b351` (PR #128).
- PR #128, Phase 11A trusted pentest run orchestration, is merged.
- Production Vercel deployment: `dpl_E4JJhctqaANC8dTxbfCm3oRvCBU6`, READY at `scopeforge.dev`, from the exact merge SHA.
- Main CI: `35340050884`, SUCCESS.
- Next implementation: Phase 11 Task 11 adaptive end-to-end evaluation harness.

## Task 9 released behavior

- verified-asset owner/admin run creation with immutable authorization and policy snapshots
- deterministic planner -> policy -> approved-action enqueue control flow
- replay-safe reservations and capability-version-bound queue idempotency
- intrusive/validation approval workflow and cancellation propagation
- privacy-reduced member read models and service-role-only orchestration RPCs
- cancellation-aware enqueue finalization and terminal-summary race protection
- fixed-size SHA-256 action, authorization, and cancellation identifiers

## Validation evidence

- Exact-head CI `35331494611`: SUCCESS; 464 test files passed, 4 skipped; 2,125 tests passed, 24 skipped; typecheck, CLI/version, scanner/profile benchmarks, Next build, CSP/browser smoke, and production diagnostics passed.
- Local full suite at the fixed candidate: 460 files passed, 4 skipped; 2,101 tests passed, 24 skipped. The three filesystem-heavy tests passed on a controlled single-worker rerun.
- `npm audit --audit-level=info`: 0 vulnerabilities.
- Codex Security diff scan `ad2fe4bb-10bb-4461-b0a0-f5fc9eecbce1`: complete coverage, 0 findings. Daybreak access was not granted; this is advisory only.
- GitNexus index refreshed for the PR worktree. The planner/test-config fix had LOW direct impact; the orchestration diff was HIGH due to six affected planning flows and was reviewed accordingly. `detect_changes` matched the expected planner/config scope.

## Database and runtime state

- Correct Supabase project: `tdgpibrepzcvdivztkta` (`ScopeForge`). Migration ledger ends at Phase 10A3; Phase 11 planning graph, run orchestration, and hardening migrations are unapplied. Read-only SQL confirmed the Phase 11 tables do not exist in production.
- No Phase 11 external provider execution is enabled.
- Existing security/performance advisor notices remain documented non-blockers: private no-policy tables, reviewed collaborator SECURITY DEFINER RPCs, leaked-password protection, unindexed foreign keys, and unused indexes.

## Next exact task

Build the deterministic adaptive end-to-end evaluation harness from `docs/superpowers/plans/2026-09-17-phase-11-autonomous-security-validation.md` Task 11. Keep it fixture-driven and injected-provider-only; do not apply Phase 11 migrations or enable hosted provider execution.

Never expose secrets, weaken authorization/RLS/containment, rewrite deployed migrations, or confuse this project with `xwsergbpvkcsugexssmc`.

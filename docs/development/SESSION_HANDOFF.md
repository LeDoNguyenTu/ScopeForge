# ScopeForge Session Handoff

## Current phase

Phase 6A zero-egress worker foundation is complete, merged, and production-reconciled.

- exact reviewed feature head: `53ece5cd4b14f6e27961d1fbb478f9420c9761fb`
- direct two-parent merge to `main`: `91f856f53fb57a4b9cd6710ee767361f473cea45`
- production Supabase project: `tdgpibrepzcvdivztkta`
- no pull request was opened for Phase 6A
- no GitHub Actions run was triggered or used for Phase 6A closeout

GitHub Actions monthly allowance is exhausted. The user explicitly directed ScopeForge to continue without GitHub Actions for the remainder of the month. Continue using `[skip ci]` and do not trigger/rerun Actions unless that instruction changes.

## Completed platform work

- Phase 1 foundation complete.
- Phase 2 asset control and authorization complete.
- Phase 3 code/supply-chain security complete through PR #21.
- Phase 4A security-domain contracts complete through PR #23.
- Phase 4B passive runtime observations complete through PR #25.
- Phase 4C-1 bounded CORS validation complete through PR #27.
- Phase 5A hosted finding foundation complete.
- Phase 5B remediation/retest/Security Story complete and production-reconciled.
- Phase 5C hosted Phase 3 import merged as `2867e603df3e2430a78aaca8ba9cb6d09f6bdccb` and production-reconciled.
- Phase 6A zero-egress worker foundation merged as `91f856f53fb57a4b9cd6710ee767361f473cea45` and production-reconciled.

## Phase 6A security boundary

The worker foundation is infrastructure only. No existing product scan is worker-backed yet.

### Closed execution profile

The only execution class is `foundation_no_egress_v1` with `networkPolicy: "none"` and fixed budgets:

- 30s wall time
- 20s CPU time
- 256 MiB memory
- 4 processes
- 100 input files
- 10 MiB input
- 32 MiB scratch
- 1 MiB output

The only executable input is a deterministic `foundation_probe` nonce. It hashes the nonce and has no repository, scanner, filesystem, subprocess, HTTP, DNS, socket, or runtime-target behavior.

### Queue, lease, retry, and cancellation

PostgreSQL is authoritative for worker scheduling while `scan_jobs` remains canonical product lifecycle.

- private worker nodes/tasks/attempts/events
- exact task binding to `(scan_job_id, workspace_id, asset_id)`
- deterministic `FOR UPDATE SKIP LOCKED` claim ordering
- maximum 4 globally leased tasks and one per workspace
- 90-second lease, bounded by absolute task deadline
- lease token generated as 32 random bytes, only SHA-256 digest stored
- maximum 3 attempts
- retry delays 15s then 60s
- cancellation wins finalization and recovery races
- cancellation-aware recovery runs before unleased absolute-deadline dead-lettering
- lease-expiry provenance can be assigned only by database recovery

### Worker authentication and broker

Worker secrets are generated server-side and returned once. Only SHA-256 digests are stored.

Broker routes use worker bearer authentication plus canonical worker UUID and do not accept user-session authentication as worker authority.

- claim accepts no body
- heartbeat/finalize accept strict JSON only
- streamed body cap: 64 KiB
- canonical UUID validation occurs before RPC calls
- no caller command/image/env/URL/headers/body/package-manager/network-policy/lifecycle/validation/budget fields

### Supervisor and executor

The supervisor keeps lease tokens and broker credentials outside the executor contract.

It:

- heartbeats every 30 seconds by default
- aborts on cancellation
- aborts after two consecutive control-channel failures
- validates exact terminal task/attempt/class binding
- accepts only five worker-originated failure codes
- validates fixed resource metrics
- validates the exact expected foundation-probe SHA-256 digest
- enforces an outer hard wall-time boundary even if the executor ignores `AbortSignal`

Future concrete sandbox adapters must additionally terminate their underlying process/container resources.

## Production Phase 6A migrations

Live production migration history includes Phase 6A through:

- `20260826100538 phase_6a_worker_probe_enum`
- `20260826100608 phase_6a_worker_foundation`
- `20260826101122 phase_6a_worker_control`
- `20260826101157 phase_6a_worker_claim_heartbeat`
- `20260826101233 phase_6a_worker_finalize`
- `20260826101305 phase_6a_worker_recovery`
- `20260826101327 phase_6a_worker_auth`
- `20260826152840 phase_6a_worker_fleet_read`
- `20260826152905 phase_6a_worker_deadline_recovery`
- `20260826152912 phase_6a_worker_fk_indexes`
- `20260826152927 phase_6a_worker_recovery_compat`
- `20260826152940 phase_6a_worker_job_contract`
- `20260826153014 phase_6a_worker_terminal_provenance_hardening`
- `20260826153244 phase_6a_worker_private_helper_privileges`

Direct verification confirmed:

- `worker_foundation_probe` exists in `scan_job_kind`
- anon/authenticated cannot read private worker tables
- intended public worker RPCs are `SECURITY DEFINER` with empty `search_path`
- public/anon/authenticated cannot execute worker RPCs
- service_role can execute intended worker broker/operations RPCs
- internal recovery/private helper execution is revoked
- task/job binding constraints and worker indexes are live
- worker probe scan-job snapshot constraint is live
- security advisor is clean
- performance advisor has no Phase 6A missing-FK-index notices
- generated Supabase types confirm the public worker enum/RPC contract

## Production smoke

Production has zero auth users/workspaces/assets, so an enqueue-to-finalize product-bound probe smoke was intentionally not fabricated.

A worker-control smoke passed:

- register
- authenticate
- idle claim
- fleet snapshot visibility
- disable

All smoke rows were removed. Verified final worker table counts are zero for nodes, tasks, attempts, and events.

## Verification limitation

The final Phase 6A head did not run the complete npm/Vitest/typecheck/build suite after the GitHub Actions allowance was exhausted and no materialized dependency-complete repository was available in the execution environment.

Do not claim otherwise. Acceptance evidence is:

- explicit test-first contract commits
- targeted final security/source review
- direct live database migration/privilege/constraint/index verification
- clean Supabase security advisor
- generated Supabase type comparison
- production worker-control smoke
- exact-head inventory showing only approved Phase 6A scope
- direct two-parent `[skip ci]` merge

## Review findings fixed before merge

- hard supervisor deadline now handles uncooperative executors
- worker cannot claim lease-expiry provenance
- cancellation wins the deadline recovery race
- private helper default EXECUTE privileges are revoked
- malformed worker/task/attempt IDs fail before PostgreSQL
- worker RPC repository is now compile-time typed instead of stringly cast

## Exact next task

Begin **Phase 6B repository acquisition and private input artifacts** with threat modeling/design approval before code.

Phase 6B must define:

- exact repository asset/workspace binding
- trusted acquisition authority and credential model
- remote-fetch allowlist/policy
- private immutable input artifacts
- byte/file limits
- artifact classification and retention/deletion
- provenance and audit records
- scanner consumption contract
- no package lifecycle scripts
- no caller-selected commands, clone flags, package-manager config, environment variables, arbitrary URLs/headers/body, credentials, or network policy

Do not move passive runtime, active validation, or Phase 3 import through workers by convenience. Dedicated network-enabled execution remains a later separately approved Phase 6C/6D boundary.

## Resume protocol

Read in this order:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/development/NEXT_STEPS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/PHASES.md`
7. `docs/superpowers/specs/2026-08-26-phase-6a-worker-foundation-design.md` if worker internals are needed
8. `docs/superpowers/plans/2026-08-26-phase-6a-worker-foundation.md` for implementation history
9. Never trigger GitHub Actions while the no-Actions instruction remains active
10. Start Phase 6B with design/threat modeling before implementation
# ScopeForge Test Status

## GitHub Actions constraint

GitHub Actions monthly allowance is exhausted. The user explicitly requested no further GitHub Actions use for the remainder of the month. Phase 6A commits and merge therefore use `[skip ci]`.

Do not describe the Phase 6A final head as having passed a full npm test/type/build suite. The current execution environment did not have a materialized repository with dependencies, so `npm test`, project-wide typecheck, CLI build, scanner benchmark, and Next.js production build could not be run after the quota boundary.

The normal full repository gate remains, when an execution environment is available:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

## Phase 6A merged state

Phase 6A zero-egress worker foundation was reviewed at feature head `53ece5cd4b14f6e27961d1fbb478f9420c9761fb` and merged directly to `main` as `91f856f53fb57a4b9cd6710ee767361f473cea45` without opening a pull request. This avoided any pull-request-triggered Actions workflow.

The feature branch added explicit regression suites covering:

- closed worker contracts and terminal envelopes
- zero-egress dependency direction
- private worker scheduling schema
- atomic claim/lease/heartbeat/finalize/recovery semantics
- cancellation-wins races
- bounded retries and absolute deadlines
- worker credential authentication
- 64 KiB broker transport limits
- trusted worker repository/service behavior
- supervisor cancellation/control-loss/hard-wall-time behavior
- deterministic foundation-probe output and digest checking
- bounded fleet read model
- private helper execution revocation
- worker scan-job snapshot contract
- central database type surface
- preservation of Phase 5C/runtime/active isolation from workers

These tests remain executable repository contracts, but the final Phase 6A head was not run through Vitest after the GitHub Actions quota was exhausted.

## Review-driven defects fixed before merge

Targeted review found and fixed several concrete issues:

1. **Uncooperative executor wall-time escape** - aborting `AbortSignal` alone could leave `runWorkerOnce` awaiting forever. The supervisor now races executor completion against its own abort boundary, so orchestration terminates at the hard deadline even when the executor ignores abort.
2. **Worker-controlled lease-expiry provenance** - live finalization previously allowed `WORKER_LEASE_EXPIRED`. The terminal contract and forward SQL hardening now reserve lease-expiry provenance to database recovery only.
3. **Cancellation versus absolute deadline race** - a queued/retrying cancelled task could be dead-lettered for budget before cancellation recovery. Combined recovery now runs the cancellation-aware/leased pass before unleased deadline dead-lettering.
4. **Private helper EXECUTE exposure** - PostgreSQL's default function privilege left a private recovery helper callable. `phase_6a_worker_private_helper_privileges` revokes direct execution of private event/recovery/trigger helpers from public, anon, authenticated, and service_role.
5. **Malformed worker IDs reaching PostgreSQL** - worker, task, and attempt identifiers are now canonical UUID-validated at broker/terminal boundaries before RPC calls.
6. **Stringly typed worker RPC escape hatch** - production-generated Supabase types were reconciled into `lib/database.types.ts`, and the worker repository now calls typed literal RPCs directly rather than casting a generic `(name, args)` function.

## Production migration verification

ScopeForge production Supabase contains Phase 6A migrations through:

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

Direct SQL verification confirmed:

- `worker_foundation_probe` exists in `scan_job_kind`
- anon/authenticated have no SELECT on worker nodes/tasks/attempts/events
- intended public worker RPCs are `SECURITY DEFINER`
- intended public worker RPCs pin `search_path = ''`
- anon/authenticated cannot execute worker RPCs
- service_role can execute only the intended public broker/operations RPCs
- internal recovery wrappers and private helper functions are not directly executable by application roles/service_role
- task/job composite binding and worker foreign keys/constraints exist
- claim/recovery indexes and workspace FK covering index exist
- worker probe scan jobs are constrained to the fixed no-egress budget, null runtime authorization/profile fields, and zero request/redirect/finding counts
- live recovery processes cancellation-aware state before unleased deadline dead-lettering
- live finalization accepts only the five worker-originated failure codes

Supabase advisor state after reconciliation:

- security advisor: clean
- performance advisor: no Phase 6A missing-FK-index notices
- remaining performance lints: INFO-level unused indexes expected on an empty/new worker subsystem

## Generated type verification

Live Supabase TypeScript generation independently confirmed:

- `scan_job_kind` includes `worker_foundation_probe`
- intended worker RPC names and argument shapes exist
- the generated schema matches the reconciled custom public type surface used by the worker repository
- internal recovery helpers remain deliberately omitted from the application type contract because they are not intended application-callable APIs

## Production smoke

Production currently has zero auth users, workspaces, memberships, and assets, so an end-to-end enqueue/claim/finalize foundation probe could not be executed without fabricating user authentication state. That fabrication was intentionally avoided.

A worker-control smoke was still executed safely:

- registered one temporary worker
- authenticated it through the worker RPC
- confirmed claim returned idle because no tasks exist
- confirmed the bounded fleet snapshot contained the worker
- disabled the worker
- removed the smoke worker/events

Post-cleanup verification confirmed:

```text
worker_nodes    0
worker_tasks    0
worker_attempts 0
worker_events   0
```

## Acceptance rule for Phase 6B

Do not treat Phase 6A infrastructure as permission for repository fetching or scanner execution. Phase 6B requires a separately approved threat model/design plus executable tests for repository/asset binding, acquisition authority, private artifact handling, retention, input limits, credential isolation, and no caller-selected command/network configuration.
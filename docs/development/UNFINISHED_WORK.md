# ScopeForge Unfinished Work Queue

Last reconciled: 2026-08-31

This file is the persistent resume queue for unfinished ScopeForge work. It exists so later sessions continue from repository state rather than conversation memory.

For the current Phase 6D release checkpoint, read `docs/development/PHASE_6D_RELEASE_STATE.md` first, then `docs/development/PHASE6D_WORKING_STATE.md`.

## Global execution rules

- Do not use, trigger, rerun, or depend on GitHub Actions while the monthly allowance remains exhausted.
- Every repository implementation/documentation commit made through this workflow must contain `[skip ci]`.
- Do not claim tests, typecheck, builds, audits, database state, sandbox containment, or runtime gates are green without fresh evidence tied to the exact candidate SHA.
- Existing deployed Supabase migrations are immutable. Any database correction is forward-only.
- Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false` and `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false` unless separately reviewed acceptance authorizes them.
- Keep `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED=false` throughout Phase 6D review/merge. A disabled merge does not authorize runtime enablement.
- Turnstile is not active and must not be described as active.
- Do not add generic URL, HTTP, fetch, proxy, browser-automation, arbitrary-header/body, credential-replay, port-scanning, or unrestricted network authority.
- Phase 6B GitHub networking is not reusable Phase 6D egress authority.

## Current Phase 6D review state

Implementation branch:

`feat/phase-6d-network-workers-v1-task14`

Draft implementation PR:

`#52 - Phase 6D dedicated network workers implementation [skip ci]`

Base:

`design/phase-6d-network-workers-v1` at `2be96ada2cf511b186d5e994c214e12683e76802`

Current reviewed code/security head:

`3e81369a0d3073b9fdca55637c05ad2c1543e995`

Authoritative release-state refresh:

`22a8fb8453f93faff0b321fa8ca48fdb95d11a7f`

Compact working-state refresh:

`145f335ee9aafb0c4aba42e14a050c764929a6a7`

PR #52 remains draft. The source/security review has progressed beyond the earlier checkpoint; do not restart Tasks 1-13 or the initial Task 16 review from scratch unless new evidence identifies a concrete defect.

### Tasks 1-13 - implemented and reconciled

The planned source implementation through Task 13 is present. The reviewed forward Phase 6D migrations have been applied to ScopeForge Supabase and live authority was reconciled. This includes:

- two closed runtime execution classes only
- `max_attempts = 1`
- immutable runtime task/domain-job binding
- lease-bound preparation and Phase 4 reauthorization
- class-aware one-shot mediator
- networkless executor contract
- trusted cancellation/replay-aware publication
- dashboard cutover with no direct Vercel network fallback
- global/class/workspace backpressure
- terminal lost/expired-attempt recovery
- aggregate-only runtime fleet health
- permanent import/authority architecture guards
- service-role-only intended public RPCs and private helper/table restrictions

Do not reopen Tasks 1-13 as if they were unimplemented. Revisit them only if Task 14/15/final Task 16 verification exposes a concrete defect.

### Review hardening already completed

Task 14/16 review found and repaired real defects using forward-only changes:

- canonical cancellation contract alignment
- strict active-CORS observation reconstruction
- Unix mediator multiple/trailing-frame rejection
- runtime CPU/scratch/class budget enforcement
- preparation commit atomic revalidation
- preparation/recovery serialization
- heartbeat/recovery serialization
- dedicated finalization/recovery serialization
- post-lock claim wall-clock sampling
- post-lock recovery wall-clock sampling
- atomic trusted Phase 6D success persistence + finalization
- permanent architecture guard preventing a return to split success persistence/finalization
- mediator host socket-root symlink/non-directory/wrong-owner rejection
- mediator root permission re-establishment to `0700`
- cleanup ordering that closes and unlinks a listening mediator socket if permission publication fails

The repository migration files for the final database hardening are:

- `20260831010900_phase_6d_runtime_worker_finalization_recovery_lock.sql`
- `20260831011000_phase_6d_runtime_worker_claim_clock.sql`
- `20260831011100_worker_recovery_clock.sql`
- `20260831011200_phase_6d_atomic_runtime_publication.sql`

The latest live Phase 6D database/fleet snapshot remains quiescent:

- enabled runtime workers: `0`
- active runtime tasks: `0`
- unfinished runtime attempts: `0`
- active passive/active runtime jobs: `0`

Live Phase 6D public control/publication RPC review confirms `SECURITY DEFINER`, empty `search_path`, and service-role-only execution. The generic finalizer cannot publish Phase 6D success.

The post-documentation mediator hardening from `e90bd6eb7e002e98c37cd401671e036adeda835a` through `3e81369a0d3073b9fdca55637c05ad2c1543e995` changed only the mediator Unix-server boundary and its focused regression test. It did not change package manifests, database migrations, or capability state. All four commits in that delta use `[skip ci]`.

## Active Phase 6D gates

### 1. Task 14 full exact-head software acceptance - blocked on a complete runner

Static/source gates are substantially complete. The exact final candidate still needs the accepted executable command chain on one fresh dependency-complete runner:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
npm run benchmark:scanner
npm audit --audit-level=info
npm run build
```

Also inspect the focused Phase 6D tests directly if the full suite output does not make their execution obvious.

Current executable evidence is partial but useful:

- the last useful Vercel/Next.js compiler checkpoint was `5a7d3d26eb1bfaae5c38f536b0b9b153aa437a41`
- Next.js compilation and framework lint/type validation completed successfully there
- the build then failed during `/auth/sign-in` prerender because the Preview environment lacked the public Supabase URL/publishable key
- code head `3e81369a0d3073b9fdca55637c05ad2c1543e995` has no GitHub Actions runs
- its only commit status is Vercel failure on the account build-rate limit

Treat those as compiler/platform evidence only. They are not a successful production build and do not replace the explicit command chain above.

Do not weaken Supabase client validation or commit configuration/secrets merely to make an incomplete Preview environment build.

The current execution container cannot materialize the exact GitHub repository because outbound GitHub DNS/network access is unavailable, and the available GitHub connector has no repository-archive export action. Do not fabricate a local test result from partial source retrieval.

### 2. Task 15 real Linux containment acceptance - hard runtime-enable gate

This cannot be satisfied by unit tests or source review.

Use a dedicated Linux worker host with **rootless Podman** and cgroup v2. Record OS, kernel/cgroup mode, Podman version, rootless state, immutable runtime image digest, and exact ScopeForge commit.

Prove:

- exact generated container command starts successfully
- executor direct DNS fails
- executor direct public TCP/HTTPS fails
- executor cannot reach supervisor/host TCP services or loopback services
- only the dedicated Unix mediator socket is usable
- arbitrary host Unix sockets are unavailable
- mediator performs only the prepared authorized HTTPS operation
- private/loopback/link-local/reserved targets remain rejected
- active CORS performs exactly one request and its session cannot replay
- passive request/redirect/byte/time budgets hold over the entire attempt
- cancellation stops mediator activity, terminates the Podman workload, and late success cannot publish
- memory, PID/process, CPU/wall-time, scratch, input, and output ceilings are enforced
- mediator failure never causes a direct-network fallback
- the supervisor socket root rejects symlink, non-directory, and wrong-owner states on the real host
- mediator startup/permission failure leaves no listener or stale socket

Explicit host questions discovered during source review:

1. Verify whether `--pids-limit=1` is actually compatible with the Node runtime under rootless Podman. Linux cgroup PID accounting includes tasks/threads, so this must be measured. Do not loosen the limit from source speculation alone.
2. Test whether the single mediator socket bind can be made explicitly read-only while still allowing the executor to connect. If yes, tighten the command and add regression coverage. If not, document the host/runtime reason and maintain the smallest possible writable host surface.
3. Verify abort/cancellation cannot return from the Podman executor until the hostile process is actually stopped. Phase 6D intentionally waits for killable sandbox termination before cleanup/finalization rather than detaching.
4. Exercise the newly hardened socket-root ownership and cleanup paths under the same rootless account used by the production worker.

Neither Phase 6D production capability may be enabled before this evidence is reviewed.

### 3. Final Task 16 same-SHA release review

The broad source/security review pass is substantially complete through code head `3e81369a0d3073b9fdca55637c05ad2c1543e995`. The remaining Task 16 work is a **final release review after Task 14 executable acceptance** on the same candidate SHA.

At that point:

- refresh PR #52 exact head
- compare base to that exact head
- confirm no unrelated authority expansion or dependency/lock drift
- recheck worker task/result contracts and every network import changed since the current checkpoint
- recheck every new `SECURITY DEFINER`/grant if any SQL changed
- confirm cancellation/replay/lost-attempt/cleanup ordering
- confirm mediator root ownership and startup cleanup remain fail-closed
- confirm logging/telemetry privacy
- confirm no direct-network or generic-finalizer fallback
- confirm all newly surfaced implementation/documentation commits comply with `[skip ci]`
- review PR comments/threads
- keep both Phase 6D capability flags false/absent

A **disabled** Phase 6D merge may occur before Task 15 if Task 14 and this final same-SHA Task 16 review are genuinely green. Such a merge is not permission to enable runtime networking.

### 4. Runtime enablement decision - only after Task 15

After Task 15 evidence passes and receives security review:

- reconcile any host-driven source changes with fresh Task 14 verification
- verify the immutable runtime image digest and exact source commit
- document operational monitoring/rollback procedures
- only then consider changing either Phase 6D capability from false/absent

Do not combine code merge approval with runtime enablement approval.

# Phase 6D Working State

Last updated: 2026-08-31

This file is the compact implementation checkpoint for the Phase 6D dedicated network-worker work. The authoritative release-gate record is `docs/development/PHASE_6D_RELEASE_STATE.md`; the broader resume queue is `docs/development/UNFINISHED_WORK.md`.

## Current branch and PR

- Implementation branch: `feat/phase-6d-network-workers-v1-task14`
- Draft implementation PR: `#52 - Phase 6D dedicated network workers implementation [skip ci]`
- Base branch: `design/phase-6d-network-workers-v1` at `2be96ada2cf511b186d5e994c214e12683e76802`
- Current reviewed code/security head: `3e81369a0d3073b9fdca55637c05ad2c1543e995`
- Authoritative release-state refresh commit: `22a8fb8453f93faff0b321fa8ca48fdb95d11a7f`
- PR #52 remains draft and must not leave draft based on static review alone.

## Verification status

Do not interpret source review or Vercel compilation as full executable acceptance.

The reviewed Phase 6D forward migrations are live on the ScopeForge Supabase project. Live reconciliation confirms service-role-only intended RPC authority, hardened empty `search_path`, private helper/table restrictions, immutable runtime task binding, `max_attempts = 1`, backpressure, cancellation-first finalization, and a zero-worker/zero-active-task runtime fleet.

Task 14 static gates are substantially complete. The last useful Vercel/Next.js compiler checkpoint was `5a7d3d26eb1bfaae5c38f536b0b9b153aa437a41`: compilation and framework lint/type validation succeeded, then `/auth/sign-in` prerender stopped because the Preview environment lacked the public Supabase URL/publishable key. The current code head `3e81369a0d3073b9fdca55637c05ad2c1543e995` has no GitHub Actions runs; its only commit status is a Vercel build-rate-limit failure. This is partial compiler/platform evidence only, not a successful production build.

Fresh full-repository execution is still required on one dependency-complete exact candidate:

- `npm test`
- `npm run typecheck`
- `npm run build:cli`
- `node .scopeforge-build/packages/cli/index.js --version`
- `npm run benchmark:scanner`
- `npm audit --audit-level=info`
- `npm run build`

Task 15 real Linux containment acceptance has not been run. The current execution environment has cgroup v2 but does not provide the required dedicated rootless-Podman worker host.

## Implementation state

- Tasks 1-8: closed Phase 6D contracts, queue binding, capability gates, lease-bound preparation, one-shot class-aware mediator, passive/active execution, bounded Unix transport, networkless Podman sandbox contract, and supervisor integration are implemented.
- Task 9: trusted publication is implemented with exact result validation, deterministic server-side rule evaluation, privacy-reduced canonical persistence, exact digest replay, cancellation-first behavior, and dedicated runtime finalization.
- Task 10: hosted passive and active dashboard actions route only through the closed worker request service. The old direct Vercel execution path is removed and there is no worker-unavailable direct-network fallback.
- Task 11: global/class/workspace backpressure, runtime fleet-safe aggregates, queued cancellation recovery, lost/expired-attempt terminality, and single-attempt behavior are implemented and reconciled.
- Task 12: permanent authority guards cover dashboard actions, preparation/execution boundaries, mediator independence, Phase 6B/6C separation, no generic network execution class, network-disabled sandboxes, and atomic runtime success publication.
- Task 13: SQL source review and Supabase reconciliation were completed. The intended Phase 6D public RPCs are live as service-role-only `SECURITY DEFINER` functions with empty `search_path`.
- Task 14: static/source acceptance is substantially complete through code head `3e81369a0d3073b9fdca55637c05ad2c1543e995`. The remaining blocker is the explicit full exact-head executable command chain on a complete runner.
- Task 15: real Linux rootless-Podman containment acceptance remains the hard runtime-enable gate.
- Task 16: source/security review is substantially complete through code head `3e81369a0d3073b9fdca55637c05ad2c1543e995`. Final same-SHA release review remains pending after Task 14 executable acceptance; runtime enablement additionally remains blocked on Task 15.

## Task 14 hardening added during review

Concrete concurrency/timing defects discovered during review were fixed with forward-only migrations:

- `20260831010900_phase_6d_runtime_worker_finalization_recovery_lock.sql` serializes dedicated finalization against worker recovery and samples terminal time after the locked job context.
- `20260831011000_phase_6d_runtime_worker_claim_clock.sql` samples claim time after serialization and resamples before leasing so a queued task cannot receive a stale lease after waiting on locks.
- `20260831011100_worker_recovery_clock.sql` makes live recovery own its post-lock database wall clock instead of trusting a pre-lock application timestamp.
- `20260831011200_phase_6d_atomic_runtime_publication.sql` makes trusted Phase 6D success persistence and broker finalization one transaction under the recovery serialization lock, with replay/cancellation and a fresh lease check before persistence.

The live fleet remained quiescent before and after these DDL changes.

Source review also hardened the mediator socket lifecycle after the prior documentation checkpoint:

- `d8f733551c8d230f3f3932b2db3571453eb1d84d` pins the private supervisor-owned socket-root invariant in regression coverage.
- `9bcccd5e6a210feb210b8eb9b117859b987cac43` rejects symlink/non-directory/wrong-owner mediator roots and resets root permissions to `0700` before use.
- `05ed16276de132c725926b911e5a811e8bd74f72` pins cleanup ordering if socket permission publication can fail after `listen()`.
- `3e81369a0d3073b9fdca55637c05ad2c1543e995` closes the listening server and unlinks the socket if that permission setup fails.

All four commits use `[skip ci]`. They change only the mediator Unix-server boundary and its focused test; they do not change package manifests, database migrations, or capability state.

## Task 15 host checks that must not be skipped

In addition to the approved containment checklist, the real host acceptance must explicitly verify:

1. `--pids-limit=1` is compatible with the actual Node runtime inside the rootless Podman container. Linux cgroup PID accounting includes tasks/threads, so this limit must be proven rather than assumed. Do not weaken the limit without measured evidence and a separate security review.
2. Determine whether the mediator Unix-socket bind can be mounted explicitly read-only while remaining connectable from the executor. If the real host supports that safely, tighten the command and add regression coverage. If not, document the reason and preserve the smallest possible writable host surface.
3. Abort/cancellation must prove the Podman executor terminates before mediator cleanup and trusted finalization. Phase 6D intentionally does not detach from an executor that ignores abort.
4. Prove the supervisor-owned mediator root rejects symlink, wrong-owner, and non-directory states on the actual host, and prove socket startup failures do not leave a listener or stale socket behind.

## Source-review findings already incorporated

- Canonical cancelled worker terminals use `outcome = cancelled`, `failureCode = null`, and no result payload. Internal cancellation provenance is assigned by the trusted finalizer.
- Active CORS terminal observations are reconstructed from explicitly validated fields rather than spread/cast from untrusted RPC or worker data.
- Runtime mediator request/response framing rejects multiple frames and any trailing partial-frame state.
- Runtime mediator session consumption exact-validates task/attempt/class/nonce and is one-shot/expiry-bound.
- Nested runtime result validation uses exact allowed keys, bounded values, HTTPS URLs without userinfo/query/fragment, selected-header allowlisting, and privacy-reduced cookie/TLS fields.
- Runtime worker audit/fleet telemetry is privacy-reduced and does not expose lease tokens, mediator nonces, target URLs, response bodies, cookie values, authorization material, resolver transcripts, or remote exception strings.
- Runtime success publication cannot use the generic finalizer.
- Successful Phase 6D publication cannot be split into separate application-level persist/finalize calls; the permanent architecture guard requires the two class-specific atomic publication dependencies.
- The generic worker finalizer accepts only its older closed classes and fails Phase 6D classes with `WORKER_CLASS_UNAVAILABLE`.
- Dedicated runtime finalization resolves cancellation before success, and its success update independently requires `cancel_requested_at IS NULL`.
- The runtime Podman contract still uses an immutable image digest, `--network=none`, read-only filesystem, dropped capabilities, no-new-privileges, fixed resource ceilings, cleared container environment, and a single validated mediator socket bind.

## Live database/advisor state

Current live Phase 6D fleet snapshot:

- enabled runtime workers: `0`
- active runtime tasks: `0`
- unfinished runtime attempts: `0`
- active passive/active runtime jobs: `0`

Supabase security advisor currently reports only the project-level leaked-password-protection warning. The performance advisor reports INFO-level unused-index notices; new runtime indexes are expected to be unused while the Phase 6D fleet has no traffic and must not be removed solely for that reason.

## Non-negotiable runtime state

`HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false`

`HOSTED_ACTIVE_CORS_WORKER_ENABLED=false`

`HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false`

`HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false`

Turnstile is not active application behavior.

No implementation, migration, source review, disabled PR merge, partial Vercel build, or compiler result authorizes enabling either Phase 6D runtime capability before Task 15 containment acceptance is completed and reviewed.

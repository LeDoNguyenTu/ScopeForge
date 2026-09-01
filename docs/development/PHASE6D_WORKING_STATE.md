# Phase 6D Working State

Last updated: 2026-09-01

This file is the compact implementation checkpoint for the Phase 6D dedicated network-worker work. The authoritative release-gate record is `docs/development/PHASE_6D_RELEASE_STATE.md`; the broader resume queue is `docs/development/UNFINISHED_WORK.md`.

## Current branch and PR

- Implementation branch: `feat/phase-6d-network-workers-v1-task14`
- Draft implementation PR: `#52 - Phase 6D dedicated network workers implementation [skip ci]`
- Base branch: `design/phase-6d-network-workers-v1` at `2be96ada2cf511b186d5e994c214e12683e76802`
- Current reviewed code/security head: `22f80584a9a473051d02556e5942d57291c40fea`
- Authoritative release-state refresh commit: `f7b814d60c5ea9fee60eb5ad16cab28510ec9950`
- PR #52 remains draft and must not leave draft based on static review alone.

## Verification status

Do not interpret source review or Vercel compilation as full executable acceptance.

The reviewed Phase 6D forward migrations are live on the ScopeForge Supabase project. Live reconciliation confirms service-role-only intended RPC authority, hardened empty `search_path`, private helper/table restrictions, immutable runtime task binding, `max_attempts = 1`, backpressure, cancellation-first finalization, and a zero-worker/zero-active-task runtime fleet.

Task 14 passed on clean Linux code/evidence head `22f80584a9a473051d02556e5942d57291c40fea`: 283 files/1,169 tests, typecheck, CLI build/version, 544 ms scanner benchmark, zero audit vulnerabilities, and a successful production build with 9/9 static pages.

The executed chain was:

- `npm test`
- `npm run typecheck`
- `npm run build:cli`
- `node .scopeforge-build/packages/cli/index.js --version`
- `npm run benchmark:scanner`
- `npm audit --audit-level=info`
- `npm run build`

Task 15 real Linux containment acceptance passed on the dedicated Ubuntu 24.04/rootless-Podman/cgroup-v2 host for implementation SHA `faec75ed74e3e919c61d6ac80f249c56ee7f1885`. See `docs/development/PHASE_6D_TASK15_ACCEPTANCE.md` for the 31-item matrix and immutable image digest.

## Implementation state

- Tasks 1-8: closed Phase 6D contracts, queue binding, capability gates, lease-bound preparation, one-shot class-aware mediator, passive/active execution, bounded Unix transport, networkless Podman sandbox contract, and supervisor integration are implemented.
- Task 9: trusted publication is implemented with exact result validation, deterministic server-side rule evaluation, privacy-reduced canonical persistence, exact digest replay, cancellation-first behavior, and dedicated runtime finalization.
- Task 10: hosted passive and active dashboard actions route only through the closed worker request service. The old direct Vercel execution path is removed and there is no worker-unavailable direct-network fallback.
- Task 11: global/class/workspace backpressure, runtime fleet-safe aggregates, queued cancellation recovery, lost/expired-attempt terminality, and single-attempt behavior are implemented and reconciled.
- Task 12: permanent authority guards cover dashboard actions, preparation/execution boundaries, mediator independence, Phase 6B/6C separation, no generic network execution class, network-disabled sandboxes, atomic runtime success publication, and end-to-end abort propagation.
- Task 13: SQL source review and Supabase reconciliation were completed. The intended Phase 6D public RPCs are live as service-role-only `SECURITY DEFINER` functions with empty `search_path`.
- Task 14: complete for code/evidence head `22f80584a9a473051d02556e5942d57291c40fea`.
- Task 15: real Linux rootless-Podman containment acceptance passed; production runtime gates remain disabled.
- Task 16: exact base-to-head source/security review passed with no reportable finding. Fresh live Supabase reconciliation is blocked by unavailable access to the exact project, so PR #52 remains draft and unmerged.

## Task 14 hardening added during review

Concrete concurrency/timing defects discovered during review were fixed with forward-only migrations:

- `20260831010900_phase_6d_runtime_worker_finalization_recovery_lock.sql` serializes dedicated finalization against worker recovery and samples terminal time after the locked job context.
- `20260831011000_phase_6d_runtime_worker_claim_clock.sql` samples claim time after serialization and resamples before leasing so a queued task cannot receive a stale lease after waiting on locks.
- `20260831011100_worker_recovery_clock.sql` makes live recovery own its post-lock database wall clock instead of trusting a pre-lock application timestamp.
- `20260831011200_phase_6d_atomic_runtime_publication.sql` makes trusted Phase 6D success persistence and broker finalization one transaction under the recovery serialization lock, with replay/cancellation and a fresh lease check before persistence.

The live fleet remained quiescent before and after these DDL changes.

Source review hardened the mediator socket lifecycle:

- `d8f733551c8d230f3f3932b2db3571453eb1d84d` pins the private supervisor-owned socket-root invariant in regression coverage.
- `9bcccd5e6a210feb210b8eb9b117859b987cac43` rejects symlink/non-directory/wrong-owner mediator roots and resets root permissions to `0700` before use.
- `05ed16276de132c725926b911e5a811e8bd74f72` pins cleanup ordering if socket permission publication can fail after `listen()`.
- `3e81369a0d3073b9fdca55637c05ad2c1543e995` closes the listening server and unlinks the socket if that permission setup fails.

Source review also found and closed an in-flight cancellation integration gap:

- `c1ea6a7f1a9b8784a955c6ddc14fe353523337c5` pins cancellation behavior at the runtime HTTPS layer.
- `25b4495c3c1afed7b818734ba9edfdc3c1491c3e` adds the trusted runtime cancellation signal contract.
- `a6a53160370b6177d68ac38c88b66df1c717281c` aborts runtime HTTPS orchestration when that signal fires.
- `0d31483713336cdbc9397fc42ba7fd14f34abc63` adds passive/active in-flight cancellation regression coverage for the normal profile APIs.
- `797e08a43a4209624c73a8ba6397603b8ecbd20e` and `632e973043d23f97f6dd4bbbcbd3d2d2abce638d` propagate signal-driven cancellation through passive observation and active CORS validation.
- `7de479f664382d1b84f94f612830e00444a9f444`, `4eeaadd7d698d0a4ad67121f55d4499f02f7ff11`, and `aa42400421bf384544a53611e47ad9d36dbd7121` carry the same supervisor signal through mediator dependencies into those profiles.
- `0fffafa2ea69a78bd0fe2c4c25546cbf5879a2bf` permanently guards the supervisor-to-transport abort connection in the Phase 6D architecture test.

All of these commits use `[skip ci]`. The cancellation work does not change database migrations, package manifests, capability state, or the closed URL/method/header/body authority model.

## Task 15 host checks that must not be skipped

In addition to the approved containment checklist, the real host acceptance must explicitly verify:

1. Verify the measured `--pids-limit=8` cgroup task/thread ceiling with the real fixed Node worker entry. Task 15 found normal Node 22 usage of 7 tasks/threads, degradation at 6, and selected 8 as the smallest explicit margin. This is not a grant of general process-spawn authority to the executor.
2. Reverify the explicitly read-only mediator Unix-socket bind on the final image. Task 15 proved that rootless Podman keeps the socket connectable with `,ro`, and the production command plus regression coverage now require it.
3. Abort/cancellation must prove the in-flight pinned HTTPS request and Podman executor terminate before mediator cleanup and trusted finalization. Phase 6D intentionally does not detach from an executor that ignores abort.
4. Prove the supervisor-owned mediator root rejects symlink, wrong-owner, and non-directory states on the actual host, and prove socket startup failures do not leave a listener or stale socket behind.

## Source-review findings already incorporated

- Canonical cancelled worker terminals use `outcome = cancelled`, `failureCode = null`, and no result payload. Internal cancellation provenance is assigned by the trusted finalizer.
- Active CORS terminal observations are reconstructed from explicitly validated fields rather than spread/cast from untrusted RPC or worker data.
- Runtime mediator request/response framing rejects multiple frames and any trailing partial-frame state.
- Runtime mediator session consumption exact-validates task/attempt/class/nonce and is one-shot/expiry-bound.
- Nested runtime result validation uses exact allowed keys, bounded values, HTTPS URLs without userinfo/query/fragment, selected-header allowlisting, and privacy-reduced cookie/TLS fields.
- Runtime HTTPS is fresh-resolved and public-IP-pinned per request, with hostname/SNI preserved and no automatic redirect following.
- The supervisor attempt abort signal now reaches in-flight passive/active HTTPS; a signal-driven `AbortError` maps to a cancelled profile result instead of a generic network failure.
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

Task 15 acceptance does not itself authorize production enablement. Both Phase 6D runtime capabilities remain false/absent through the disabled merge boundary.

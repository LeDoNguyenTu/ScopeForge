# Phase 6D Working State

Last updated: 2026-08-31

This file is the compact checkpoint for the Phase 6D dedicated network-worker implementation. The complete remaining roadmap is in `docs/development/UNFINISHED_WORK.md`.

## Current branch and PR

- Implementation branch: `feat/phase-6d-network-workers-v1-task14`
- Draft implementation PR: `#52 - Phase 6D dedicated network workers implementation [skip ci]`
- PR #52 is intentionally based on the exact Phase 6D design branch while design PR #51 remains draft.
- Security-review code head immediately before this checkpoint update: `35335d7c5d82cfd670c5541833efaeb0702b365b`.
- PR #52 must remain draft until the remaining acceptance gates are satisfied or explicitly documented as disabled-merge blockers.

## Verification status

Do not interpret source review as executable acceptance.

The reviewed Phase 6D forward migrations have been applied to the ScopeForge Supabase project and live database authority was reconciled. Live review confirmed the intended service-role-only RPC surface, hardened `search_path`, private helper/table restrictions, immutable runtime task binding, `max_attempts = 1`, backpressure limits, and no enabled Phase 6D runtime worker fleet.

Fresh full-repository `npm test`, `npm run typecheck`, CLI build/version, scanner benchmark, `npm audit`, and production build evidence for the current exact head is still missing because the available execution/deployment runners have been constrained. Historical production-build diagnostics exposed several real TypeScript defects that were repaired, but those partial builds are not a full acceptance result.

Task 15 real Linux containment acceptance has not been run. The current execution environment has cgroup v2 but does not provide the required dedicated rootless-Podman worker host.

## Implementation state

- Tasks 1-8: closed Phase 6D contracts, queue binding, capability gates, lease-bound preparation, one-shot class-aware mediator, passive/active execution, bounded Unix transport, networkless Podman sandbox contract, and supervisor integration are implemented in source.
- Task 9: trusted publication is implemented and reviewed for cancellation, lease binding, terminal replay digest, deterministic server-side rule evaluation, privacy-reduced results, canonical persistence, and dedicated runtime finalization.
- Task 10: hosted passive and active dashboard actions route only through the closed worker request service. The old direct Vercel execution path is removed and there is no worker-unavailable direct-network fallback.
- Task 11: global/class/workspace backpressure, runtime fleet-safe aggregates, queued cancellation recovery, lost/expired-attempt terminality, and single-attempt behavior are implemented and reconciled.
- Task 12: permanent import/authority guards are present for dashboard actions, preparation, executor, mediator, Phase 6B, and Phase 6C boundaries.
- Task 13: SQL source review and Supabase reconciliation were performed. The forward migrations are live, while both Phase 6D runtime capability gates remain disabled.
- Task 14: static/source acceptance is substantially reviewed. Full exact-head executable acceptance remains outstanding.
- Task 15: real Linux rootless-Podman containment acceptance remains a hard runtime-enable gate.
- Task 16: security review is in progress on draft PR #52. Recent review fixed the canonical cancellation contract and tightened Unix framing so a mediator connection accepts exactly one complete frame with no trailing partial frame state.

## Task 15 host checks that must not be skipped

In addition to the approved containment checklist, the real host acceptance must explicitly verify:

1. `--pids-limit=1` is compatible with the actual Node runtime inside the rootless Podman container. Linux cgroup PID accounting includes tasks/threads, so this limit must be proven rather than assumed. Do not weaken the limit without measured evidence and a separate security review.
2. Determine whether the mediator Unix-socket bind can be mounted explicitly read-only while remaining connectable from the executor. If the real host supports that safely, tighten the command and add regression coverage. If not, document the reason and preserve the smallest possible writable host surface.
3. Abort/cancellation must prove the Podman executor terminates before mediator cleanup and trusted finalization. Phase 6D intentionally does not detach from an executor that ignores abort.

## Source-review findings already incorporated

- Canonical cancelled worker terminals use `outcome = cancelled`, `failureCode = null`, and no result payload. Internal database cancellation provenance is assigned by the trusted finalizer.
- The public worker-contract package now preserves this canonical cancellation rule while retaining the existing metric/result validation boundary.
- Active CORS terminal observations are reconstructed from explicitly validated fields rather than spread/cast from untrusted RPC or worker data.
- Runtime mediator request/response framing rejects multiple frames and rejects a valid frame followed by any buffered partial trailing frame.
- Runtime worker audit events contain IDs, class, state/outcome, safe timing/version metadata, and aggregate counts only. Lease tokens, mediator nonces, target URLs, response bodies, cookie values, authorization material, and remote exception strings are not placed in the reviewed Phase 6D audit event payloads.
- Runtime fleet reporting exposes aggregate class counts/capacity/availability rather than runtime target identity or response material.

## Non-negotiable runtime state

`HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false`

`HOSTED_ACTIVE_CORS_WORKER_ENABLED=false`

Phase 6B and Phase 6C hosted runtime gates also remain disabled for this work. No implementation, migration, source review, PR merge, or partial build result authorizes enabling either Phase 6D runtime capability before Task 15 containment acceptance is completed and reviewed.

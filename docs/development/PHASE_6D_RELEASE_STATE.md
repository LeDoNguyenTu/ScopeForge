# Phase 6D Release State

This file is the authoritative release-gate checkpoint for **Phase 6D dedicated network workers** while PR #52 remains open. It supersedes older Phase 6D "before implementation" wording in general development notes until those historical documents are reconciled after the phase closes.

## Candidate

- branch: `feat/phase-6d-network-workers-v1-task14`
- PR: #52
- reviewed implementation head before this checkpoint document: `686805d672656709f6fd4ca04f3df14f3cd8bc14`
- base: `design/phase-6d-network-workers-v1` at `2be96ada2cf511b186d5e994c214e12683e76802`
- PR remains **draft**
- no dependency manifest or lockfile drift exists in the Phase 6D base-to-head diff

## Implemented boundary

Phase 6D is implemented behind two closed execution classes:

- `passive_runtime_observation_v1`
- `active_cors_validation_v1`

The implementation does not expose a generic URL, HTTP, fetch, proxy, arbitrary-header/body, browser, port-scan, or credential-replay worker primitive.

Runtime executor containers remain network-disabled. Network authority is isolated behind the class-aware Unix-socket mediator. The worker supervisor requires a prepared Phase 6D contract and fails closed when preparation or dedicated finalization authority is unavailable; it does not fall back to the generic executor/finalizer for runtime success.

Dashboard actions no longer perform runtime networking from Vercel. They call the request service, whose Phase 6D capability check happens before asset loading or queue creation.

## Capability state

These capabilities remain disabled and must stay disabled through merge:

- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED` - false unless the environment value is exactly `true`; currently absent/disabled
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED` - false unless the environment value is exactly `true`; currently absent/disabled
- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED = false`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED = false`

Turnstile is not wired as active application behavior. The auth UI continues to describe it as planned before public trial access.

## Live Supabase reconciliation

Authoritative ScopeForge project: `tdgpibrepzcvdivztkta`.

The reviewed Phase 6D migration stack is live. Later Task 14 hardening was added only through forward migrations:

- `20260831010900_phase_6d_runtime_finalization_recovery_lock`
- `20260831011000_phase_6d_runtime_claim_clock`
- `20260831011100_phase_6d_runtime_recovery_clock`
- `20260831011200_phase_6d_atomic_runtime_publication`

The latest atomic-publication migration is recorded live as `phase_6d_atomic_runtime_publication`.

Live verification after the latest DDL confirmed:

- zero enabled runtime worker nodes
- zero active worker tasks
- zero unfinished worker attempts
- zero active Phase 6D scan jobs
- Phase 6D public control functions are `SECURITY DEFINER`
- trusted functions use an empty `search_path`
- runtime control/publication functions are executable by `service_role` only, not `anon`, `authenticated`, or `public`
- private runtime task state has no direct browser/service-role DML escape where RPC-only mutation is required
- generic `finalize_worker_attempt` accepts only its older closed worker classes and rejects Phase 6D classes via `WORKER_CLASS_UNAVAILABLE`
- dedicated runtime finalization resolves cancellation before success and independently requires `cancel_requested_at IS NULL` for a success transition
- successful Phase 6D result persistence and broker finalization now occur atomically in class-specific RPCs under the shared recovery serialization lock
- atomic success publication rechecks the live lease with `clock_timestamp()` before persistence
- cancellation/replay branches occur before success persistence

The post-DDL Supabase security advisor has no new Phase 6D finding. Its only current warning is the project-level `auth_leaked_password_protection` setting.

## Task 14 software acceptance

Completed static/review gates:

- no `package.json` or lockfile drift relative to the Phase 6D base
- Phase 6D capability parsing is exact-true/fail-closed
- Phase 6B and Phase 6C hosted runtime gates remain false
- Turnstile is not claimed active
- dashboard Phase 6D actions cannot directly invoke the network mediator/runtime executor
- generic worker finalization cannot publish Phase 6D success
- dedicated runtime finalization is cancellation-first
- successful Phase 6D publication is atomic with trusted canonical persistence
- permanent architecture guards pin network ownership, no-generic-network execution classes, sandbox `--network=none`, and atomic success publication
- reviewed supervisor/runtime code does not log prepared targets, mediator secrets, raw terminal payloads, response bodies, authorization material, cookie values, or resolver transcripts

Executable evidence currently available:

- automatic Vercel preview for `e28aa8b8073e15cb52d36b2715a9bce6a07efa73` compiled successfully and passed Next.js lint/type validation
- that preview then failed during `/auth/sign-in` prerender because the **Preview** environment does not contain the public Supabase URL/publishable key
- this is not recorded as a successful production build and is not exact-head evidence for the later checkpoint commit

Still required on one fresh, dependency-complete exact-head runner before Task 14 can be called complete:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
npm run benchmark:scanner
npm audit --audit-level=info
npm run build
```

The scanner benchmark must remain within the existing catastrophic ceiling. The production build must use a complete ScopeForge application environment; missing Preview-only public Supabase configuration must not be worked around by weakening source validation.

## Task 15 containment acceptance - hard enablement blocker

Task 15 has **not** passed and must not be simulated.

The currently available execution container is Linux with cgroup v2, but it does not provide the required dedicated **rootless Podman** worker host. Therefore it is not valid evidence for the production containment gate.

A dedicated Linux rootless-Podman/cgroup-v2 host must still prove, on the exact candidate/runtime image:

- direct DNS from the executor fails
- direct TCP/HTTPS from the executor fails
- loopback and host services are inaccessible
- only the intended mediator Unix socket is usable
- arbitrary Unix sockets are unavailable
- authorized HTTPS succeeds only through the attempt-bound mediator session
- private, loopback, link-local, reserved, and otherwise prohibited destinations are rejected
- active CORS performs exactly one authorized request
- passive request/redirect/byte/time budgets are enforced
- cancellation aborts mediator work and late success is discarded
- memory, process, CPU, wall-time, scratch, input, and output ceilings are enforced
- mediator failure never creates a direct-network fallback

Record OS, Podman version, rootless state, cgroup version, immutable image digest, exact git SHA, and raw acceptance evidence.

Do not enable either Phase 6D capability before this gate passes and receives final security review.

## Task 16 PR/release boundary

Source review currently confirms:

- changed paths are confined to Phase 6D, its tests/docs, and the reviewed repository-snapshot network-authority extraction
- no package/dependency drift
- no unrelated Phase 7/8 product feature implementation
- every reviewed network import remains within an intended authority boundary
- Phase 6D control/publication RPC ACL and `search_path` posture is live-verified
- cancellation, replay, lease timing, backpressure, one-attempt runtime semantics, and atomic publication have explicit regression guards
- capability gates remain false/absent
- PR #52 remains draft

Before changing PR #52 from draft or merging it, rerun the exact-head Task 14 software acceptance above and perform one final base-to-head review against that same SHA.

A disabled Phase 6D code merge may occur before Task 15 only if Task 14 and final Task 16 review are genuinely green. A merge is **not** permission to enable runtime networking.

## Workflow constraints

- Do not use, trigger, rerun, or depend on GitHub Actions for this phase.
- Continue using `[skip ci]` on implementation, test, migration, and documentation commits.
- Do not rewrite already-applied Supabase migrations; defects are fixed with forward migrations.
- Keep ScopeForge Supabase, worker credentials, mediator session material, R2 credentials, and secrets separate from browser-visible configuration and logs.

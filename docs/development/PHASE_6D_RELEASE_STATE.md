# Phase 6D Release State

Last reconciled: 2026-09-04 (Asia/Singapore)

This file is the authoritative release checkpoint for **Phase 6D dedicated network workers**. Detailed executable, containment and security evidence remains in:

- `docs/development/PHASE_6D_TASK15_ACCEPTANCE.md`
- `docs/development/PHASE_6D_TASK16_REVIEW.md`
- `docs/development/TEST_STATUS.md`

## Candidate

- branch: `feat/phase-6d-network-workers-v1-task14`
- PR: #52
- base: `main` at `605518bfc2c6f99f6229bbb56a4b2f4b46c2a47a` before the final merge reconciliation
- reviewed code/security head: `22f80584a9a473051d02556e5942d57291c40fea`
- exact executable/docs acceptance checkpoint: `bd558fdf0830bfdb95027374e168835a8a48f43d`
- no package manifest or lockfile drift was present in the reviewed Phase 6D source range
- GitHub Actions are not verification evidence and must not be triggered while the user's Actions allowance remains exhausted
- implementation and documentation commits in this workflow use `[skip ci]`

## Implemented boundary

Phase 6D provides two closed execution classes only:

- `passive_runtime_observation_v1`
- `active_cors_validation_v1`

The executor remains network-disabled. Bounded HTTPS authority lives only in the class-aware, task/attempt-bound Unix-socket mediator. The design does not add a generic URL, fetch, proxy, arbitrary-header/body, browser, port-scan or credential-replay primitive.

The reviewed implementation includes authorization revalidation, one-shot mediator sessions, DNS/address policy, hostname/SNI binding, active one-request/zero-redirect authority, passive attempt-wide budgets, cancellation propagation into in-flight HTTPS, rootless Podman containment, recovery serialization, atomic class-specific success publication, replay handling, backpressure, aggregate fleet health and generic-finalizer exclusion.

## Runtime capability state

These capabilities must remain disabled through the code merge:

- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED` - false unless explicitly set to exact `true`; last reviewed as absent/disabled
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED` - false unless explicitly set to exact `true`; last reviewed as absent/disabled
- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED = false`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED = false`

A Phase 6D merge does **not** authorize runtime enablement. Production enablement is a separate operational/security gate.

Turnstile remains inactive application behavior and must not be described as enabled.

## Task 14 software acceptance - complete

The clean Linux acceptance chain passed on the reviewed code/evidence candidate:

```text
npm test: PASS - 283 files, 1,169 tests
npm run typecheck: PASS
npm run build:cli: PASS
CLI version: ScopeForge 0.1.0
npm run benchmark:scanner: PASS - 544 ms wall time, 20,000 ms ceiling
npm audit --audit-level=info: PASS - 0 vulnerabilities
npm run build: PASS - compilation, validation and 9/9 static pages
```

Later candidate commits after the executable checkpoint are documentation/handover-only unless a later review record explicitly states otherwise. The exact PR head must be compared to `bd558fdf0830bfdb95027374e168835a8a48f43d` immediately before merge.

## Task 15 real Linux containment acceptance - complete

The dedicated Ubuntu 24.04, rootless-Podman, cgroup-v2 host passed the complete 31-check containment matrix. The final accepted runtime image digest recorded by the release handover is:

`sha256:2d3a622df92c4f2f7984e22d3575ed06f1d706b53e860961d88a5cc443eab79e`

The evidence covers direct-network denial, mediator-only authority, prohibited-address rejection, active/passive request limits, cancellation, resource ceilings, measured Node-compatible PID ceiling, scratch/input/output enforcement and lifecycle cleanup. See `PHASE_6D_TASK15_ACCEPTANCE.md` for the exact evidence history and image rebuild checkpoints.

## Task 16 source/security review - complete

The reviewed Phase 6D source range has no reportable security finding. Review covered capability gates, authorization, contracts, network ownership, DNS/address handling, pinned HTTPS, cancellation, rootless Podman lifecycle, replay/recovery, atomic publication, SQL definer/search-path/grant posture, logging/privacy and the absence of a generic-network fallback.

PR review threads and dependency drift were previously reconciled. Before merge, refresh the exact PR head/base and confirm no new non-documentation source drift exists after the executable acceptance checkpoint.

## Fresh live Supabase reconciliation - complete 2026-09-04

Authoritative production project: `tdgpibrepzcvdivztkta`.

The connected Supabase project tools freshly confirmed the full Phase 6D forward migration stack is applied through:

`20260831042723 phase_6d_atomic_runtime_publication`

Fresh runtime state:

```text
enabled_runtime_workers = 0
active_runtime_tasks = 0
unfinished_runtime_attempts = 0
active_runtime_jobs = 0
```

Fresh authority review confirmed the intended Phase 6D public RPCs are `SECURITY DEFINER`, use `search_path=""`, deny EXECUTE to `anon` and `authenticated`, and allow EXECUTE to `service_role`. Relevant private runtime helpers are not directly executable by those application roles. The generic `public.finalize_worker_attempt` still excludes the Phase 6D execution classes and reaches `WORKER_CLASS_UNAVAILABLE` for unsupported classes.

No database write was required for this reconciliation.

### Advisor state

The current Supabase security advisor reports one project-level warning:

- `auth_leaked_password_protection` - leaked password protection is disabled

This is not a Phase 6D authority regression and does not block the disabled Phase 6D code merge. It is now an explicit Phase 9 authentication-hardening task. Remediation reference: `https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection`.

Performance advisor output currently consists of informational `unused_index` notices. With the production dataset still sparse, no index is being removed based on those statistics.

## Release decision

The previously blocking exact-project Supabase readback is closed. Phase 6D may be merged in the disabled state after the final exact-head reconciliation confirms:

1. PR #52 still targets `main` and is mergeable.
2. The diff from executable checkpoint `bd558fdf0830bfdb95027374e168835a8a48f43d` to the exact PR head is documentation/handover-only.
3. No package manifest, lockfile, migration, runtime authority or capability-gate drift was introduced.
4. No unresolved PR review thread or new reportable finding exists.
5. All newly added repository commits comply with `[skip ci]`.
6. Both Phase 6D runtime capability flags remain false/absent.

After that reconciliation, mark PR #52 ready and merge using exact-head SHA protection. Do not enable Phase 6D networking as part of the merge.

## After merge

- Reconcile `main` documentation to show Phase 6D code merged but production capability still disabled.
- Retarget the stacked Phase 7 implementation branch onto the new `main` history without touching the dashboard V5 branch.
- Continue Phase 7 from Task 3 of `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.
- Keep Phase 6B, Phase 6C and Phase 6D production enablement as separate acceptance gates.
- Carry the leaked-password protection warning into Phase 9 hardening.

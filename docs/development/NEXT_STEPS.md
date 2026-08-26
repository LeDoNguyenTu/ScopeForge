# ScopeForge Next Steps

## Completed boundary - Phase 6A zero-egress worker foundation

Phase 6A is merged to `main` as `91f856f53fb57a4b9cd6710ee767361f473cea45` and its production Supabase schema is reconciled.

Delivered:

- private PostgreSQL worker nodes, tasks, attempts, and bounded events
- internal-only `worker_foundation_probe` scan job kind
- closed `foundation_no_egress_v1` execution profile
- fixed CPU, memory, process, input, scratch, output, and wall-time budgets
- service-role-only worker registration, authentication, enqueue, claim, heartbeat, finalize, recovery, and fleet RPCs
- worker secrets generated server-side and stored only as SHA-256 digests
- exact worker/task/attempt/lease binding with 90-second leases
- deterministic claim ordering, fleet/workspace capacity checks, 15s/60s retry delays, and maximum three attempts
- cancellation-wins finalization and recovery
- authoritative lease-expiry provenance reserved to recovery
- hard supervisor wall-time boundary even when an executor ignores `AbortSignal`
- executor isolation from worker credentials and lease tokens
- deterministic pure-hash foundation probe with no repository, process, scanner, filesystem, or target-network behavior
- 64 KiB streamed broker request cap and strict route schemas
- bounded fleet health read model with no credential/lease/output/source exposure
- permanent dependency guards preventing Phase 5C, passive runtime, active validation, browser, and component code from gaining worker execution authority

Production verification confirmed private worker tables are unreadable by `anon` and `authenticated`, intended public worker RPCs are `SECURITY DEFINER` with empty `search_path` and service-role-only execution, private helper execution is revoked, the worker job snapshot constraint is live, all worker foreign keys have covering indexes, and Supabase security advisor is clean.

A worker-control smoke successfully registered/authenticated a temporary worker, confirmed an idle claim, observed it through the bounded fleet snapshot, disabled it, and then removed all smoke rows. Production contains zero worker nodes/tasks/attempts/events after cleanup.

A full enqueue/claim/finalize probe smoke could not run because production currently has zero auth users, workspaces, memberships, and assets. Do not fabricate auth state just to satisfy that smoke.

## Verification constraint

GitHub Actions monthly allowance is exhausted. The user explicitly requested no further GitHub Actions use for the remainder of the month. Continue using `[skip ci]` and never claim an exact-head full npm test/type/build pass unless it was actually run in another available environment.

Phase 6A final acceptance used targeted source/security review, permanent test contracts, live migration/privilege/constraint/index verification, clean Supabase security advisor, generated Supabase types, production worker-control smoke, and exact-head direct merge without a PR.

## Next major boundary - Phase 6B repository acquisition and private input artifacts

Phase 6B should introduce the first hosted repository-input path without granting the executor arbitrary network or command authority.

Required properties:

1. Acquisition is a separate trusted stage from scanner execution.
2. Browser callers never submit shell commands, clone flags, package-manager options, environment variables, credentials, arbitrary headers/body, resource limits, or network policy.
3. Repository identity must bind to an existing workspace repository asset and immutable acquisition request.
4. Any remote fetch must use a separately reviewed allowlist/credential model and produce a private immutable input artifact.
5. The scanner executor consumes only the broker-selected private artifact plus the closed execution profile.
6. Package lifecycle scripts remain disabled.
7. Input artifacts require classification, byte/file limits, retention policy, deletion/recovery behavior, and audit provenance.
8. Existing Phase 3 deterministic finding semantics remain authoritative.
9. Existing runtime/active network authorities remain separate and must not be reused for repository acquisition by convenience.
10. Phase 6B must receive its own threat-model/design approval before implementation.

## Later Phase 6 slices

- **6C** - scanner execution over approved private repository artifacts, with sandbox enforcement and resource accounting.
- **6D** - dedicated egress for already-authorized runtime/active operations, only after separate target-policy and abuse-control review.

After Phase 6: Community Security Packs, validation/benchmarks/public methodology, then production hardening/public release.

## Resume protocol

Before the next implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`, `CURRENT_STATE.md`, and `TEST_STATUS.md`.
2. Read `docs/ARCHITECTURE.md` and `docs/PHASES.md`.
3. Confirm `main` contains merge `91f856f53fb57a4b9cd6710ee767361f473cea45` or a later reconciliation commit.
4. Confirm Phase 6A production migrations through `phase_6a_worker_private_helper_privileges` remain present.
5. Preserve zero-egress execution, service-role isolation, cancellation-wins semantics, private-table boundary, and product-job separation.
6. Start Phase 6B with a threat model and approved design before implementation.
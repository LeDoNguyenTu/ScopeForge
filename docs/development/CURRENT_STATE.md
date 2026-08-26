# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

Authorization, deterministic evidence, explanation, remediation, and execution authority remain separate concerns. Security state must remain attributable to deterministic/runtime evidence or explicit human workflow rather than model inference alone.

## Completed foundations

- **Phase 1 Foundation** - Next.js/React shell, Supabase auth/workspaces, RLS, security headers, and deployment baseline.
- **Phase 2 Asset control and authorization** - workspace-scoped assets, canonical targets, proof of control, SSRF-safe verification, roles, quotas, audit events, and asset UX.
- **Phase 3 Code and supply-chain security** - local/passive scanner, hostile-repository safety, secrets, JS/TS SAST, SCA/SBOM, IaC/configuration analysis, baselines, JSON/SARIF, golden outputs, and benchmarks. Merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- **Phase 4A Security domain contracts** - merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- **Phase 4B Verified passive runtime observations** - merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- **Phase 4C-1 Bounded CORS origin-policy validation** - merged through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.
- **Phase 5A Hosted finding foundation** - canonical hosted finding/evidence/history ledger and narrow lifecycle workflow.
- **Phase 5B Remediation, deterministic retest, and Security Story** - merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a` and production-reconciled.
- **Phase 5C Hosted Phase 3 finding import** - merged through PR #37 as `2867e603df3e2430a78aaca8ba9cb6d09f6bdccb` and production-reconciled.
- **Phase 6A Zero-egress worker foundation** - reviewed at `53ece5cd4b14f6e27961d1fbb478f9420c9761fb`, merged directly to `main` as `91f856f53fb57a4b9cd6710ee767361f473cea45`, and production-reconciled without GitHub Actions.

## Phase 6A delivered boundary

Phase 6A establishes durable worker infrastructure only. It does **not** move repository scanning, passive runtime observation, active validation, or Phase 3 hosted import onto workers.

### Worker state and scheduling

Production now contains private worker nodes, tasks, attempts, and bounded events. `scan_jobs` remains the canonical job lifecycle, and worker tasks bind exactly to `(scan_job_id, workspace_id, asset_id)`.

The only worker job kind is internal `worker_foundation_probe`. The only execution class is `foundation_no_egress_v1` with a fixed zero-egress profile and fixed resource budget.

Claim/recovery semantics include:

- deterministic `FOR UPDATE SKIP LOCKED` claim order
- maximum four globally leased tasks
- maximum one leased task per workspace
- 90-second lease bounded by the absolute task deadline
- 32-byte random lease token with only SHA-256 digest persisted
- maximum three attempts
- retry delays of 15 seconds and 60 seconds
- cancellation-wins finalization/recovery
- cancellation-aware recovery before deadline dead-lettering
- database-owned lease-expiry provenance

### Worker broker and credentials

Worker secrets are generated server-side, returned once, and stored only as SHA-256 digests. Workers authenticate with a fixed-format bearer secret plus canonical worker UUID.

- claim has no request body
- heartbeat/finalize use strict JSON
- request body maximum is 64 KiB, enforced while streaming
- malformed worker/task/attempt UUIDs fail before RPC calls
- caller-selected commands, images, environment variables, URLs, headers/body, package-manager configuration, network policy, lifecycle state, validation state, or budgets are absent from the API contract

The worker never receives Supabase `service_role`.

### Supervisor and executor

The provider-neutral supervisor retains worker credentials and lease tokens. The executor receives only task/attempt IDs, the fixed execution class, fixed budget, deadline, and foundation-probe input.

The supervisor:

- heartbeats every 30 seconds by default
- aborts on cancellation
- aborts after two consecutive broker/control failures
- validates terminal UUID/class binding
- accepts only five worker-originated failure codes
- validates fixed resource metrics
- validates the exact expected SHA-256 probe result
- stops awaiting at the hard wall-time boundary even when an executor ignores `AbortSignal`

The current foundation probe performs pure SHA-256 hashing only and has no scanner, repository, filesystem, subprocess, or target-network authority.

### Fleet and authority boundary

The bounded fleet read model exposes at most 100 worker nodes with worker ID, execution class, software version, health timestamps, task counts, and active lease count. It excludes credentials, lease hashes/tokens, terminal output, source/repository content, and environment data.

Intended public worker RPCs are `SECURITY DEFINER`, pin `search_path = ''`, deny `anon`/`authenticated`, and grant execute only to `service_role`. Internal recovery and private event/trigger helpers have direct execution revoked.

Executable architecture guards keep worker authority out of browser/components, Phase 5C import, passive runtime, and active validation code, and keep target-network/Supabase/process authority out of the supervisor.

## Production database state

ScopeForge production Supabase project `tdgpibrepzcvdivztkta` contains all Phase 6A migrations through:

`20260826153244 phase_6a_worker_private_helper_privileges`

Direct verification confirmed:

- `worker_foundation_probe` is live in `scan_job_kind`
- browser roles cannot read private worker tables
- intended worker RPC privilege/search-path configuration is correct
- internal helper execution is revoked
- worker task/job constraints and covering indexes are present
- cancellation-first recovery and closed finalization failure provenance are live
- generated Supabase types match the public enum/RPC contract used by the application
- Supabase security advisor is clean
- performance advisor has no Phase 6A missing-FK-index notices

A worker-control production smoke passed registration, authentication, idle claim, fleet visibility, and disable. All smoke rows were removed and worker nodes/tasks/attempts/events were verified back at zero.

Production currently has zero auth users/workspaces/memberships/assets, so an end-to-end enqueue-to-finalize probe smoke was intentionally not fabricated.

## Verification constraint

GitHub Actions monthly allowance is exhausted, and the user explicitly requested no further Actions use for the remainder of the month. Phase 6A used `[skip ci]` throughout closeout and was merged directly without a PR.

The final Phase 6A head therefore must not be described as having passed the complete npm/Vitest/typecheck/build suite. Final acceptance used targeted security/source review, permanent repository test contracts, live Supabase migration/privilege/constraint/index verification, generated production types, clean advisors, production worker-control smoke, and exact-head direct merge.

## Next boundary

The next product boundary is **Phase 6B repository acquisition and private input artifacts**.

Phase 6B must receive separate threat-model/design approval before implementation. It must preserve exact repository asset/workspace binding, separate trusted acquisition from execution, produce bounded classified private immutable input artifacts, define retention/deletion, keep package lifecycle scripts disabled, and never accept arbitrary caller commands, clone flags, package-manager settings, credentials, URLs/headers/body, environment variables, resource limits, or network policy.

Network-enabled runtime/active workers remain a later separately reviewed Phase 6C/6D boundary.
# ScopeForge Unfinished Work Queue

Last reconciled: 2026-09-04

This is the persistent non-UI resume queue. It exists so later sessions continue from repository state rather than conversation memory.

## Global execution rules

- GitHub Actions allowance is available again as of 2026-09-04. Use CI selectively at meaningful implementation, integration and release gates rather than on every small checkpoint.
- Routine documentation-only or intermediate commits may use `[skip ci]` when CI would add no useful executable evidence. Final release candidates and significant code milestones should deliberately run CI.
- Do not claim tests, typecheck, builds, audits, database state, containment or runtime gates are green without evidence tied to the relevant candidate SHA.
- Existing deployed Supabase migrations are immutable. Database corrections are forward-only.
- Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false` and `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false` unless their own production acceptance gates authorize them.
- Keep `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED=false` through the Phase 6D disabled merge. A code merge does not authorize runtime networking.
- Turnstile is not active and must not be described as active.
- Do not add generic URL, HTTP, fetch, proxy, browser automation, arbitrary-header/body, credential replay, port scanning or unrestricted network authority.
- Do not modify, merge, replace or deploy the active dashboard V5/UI preview branch from this non-UI workstream.
- No AI co-author attribution. Preserve user-only authorship conventions.

## Phase 6D - release gate closed, final CI and merge next

Implementation branch:

`feat/phase-6d-network-workers-v1-task14`

PR:

`#52 - Phase 6D dedicated network workers implementation [skip ci]`

Pre-merge base observed before the 2026-09-04 closure update:

`main` at `605518bfc2c6f99f6229bbb56a4b2f4b46c2a47a`

Reviewed code/security head:

`22f80584a9a473051d02556e5942d57291c40fea`

Executable/docs acceptance checkpoint:

`bd558fdf0830bfdb95027374e168835a8a48f43d`

### Completed Phase 6D gates

- Tasks 1-13 implementation and hardening complete.
- Task 14 clean Linux software acceptance complete: 283 test files / 1,169 tests, typecheck, CLI build/version, benchmark, zero-vulnerability audit and production build.
- Task 15 real Linux rootless-Podman/cgroup-v2 31-check containment matrix complete.
- Task 16 source/security review complete with no reportable finding.
- Fresh exact-project Supabase reconciliation completed on 2026-09-04 against `tdgpibrepzcvdivztkta`.

Fresh Supabase Phase 6D state:

```text
enabled_runtime_workers = 0
active_runtime_tasks = 0
unfinished_runtime_attempts = 0
active_runtime_jobs = 0
```

Fresh RPC review confirms the intended Phase 6D public RPCs remain `SECURITY DEFINER`, use empty `search_path`, deny `anon`/`authenticated` execution and allow `service_role`. The generic finalizer still cannot publish Phase 6D success.

The complete Phase 6D migration stack is applied through `20260831042723 phase_6d_atomic_runtime_publication`.

### Final Phase 6D action

Before merging PR #52:

1. Refresh exact PR head and base.
2. Compare `bd558fdf0830bfdb95027374e168835a8a48f43d` to exact PR head.
3. Confirm all post-acceptance changes are documentation/handover-only.
4. Confirm no package/lockfile/migration/capability/authority drift.
5. Recheck PR review threads/comments.
6. Mark the PR ready to intentionally trigger one final GitHub Actions validation on the exact candidate.
7. Require the validate job to pass on that exact head.
8. Merge with exact-head SHA protection.
9. Keep Phase 6D runtime capabilities disabled.

Detailed release evidence: `PHASE_6D_RELEASE_STATE.md`, `PHASE_6D_TASK15_ACCEPTANCE.md`, `PHASE_6D_TASK16_REVIEW.md`.

## Phase 7 - implementation already started, resume from Task 3

Implementation branch:

`feat/phase-7-community-security-packs-v1`

Last audited pre-Phase-6D-merge head:

`c1bbbb936a845ec16e8440d5c3d95009f4e13f63`

This branch is stacked on the Phase 6D implementation history. Do not recreate Tasks 1-2.

Plan:

`docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`

Completed:

- Task 1: closed Security Pack v1 contracts, errors and strict manifest parser.
- Task 2: bounded linear-time path-pattern compiler, including rejection of drive-relative patterns.

Remaining:

- Task 3: identity-checked byte reads, literal matching and deterministic findings.
- Task 4: deterministic registry and scanner adapter.
- Task 5: safe fixture discovery and behavioral validation.
- Task 6: CLI `pack validate`, `pack inspect --json` and explicit repeated `scan --pack` integration.
- Task 7: output compatibility and permanent authority guards, including hosted JSON rejection of Security Pack findings.
- Task 8: first-party example pack plus contributor/reviewer governance docs.
- Task 9: full verification, security review, Linux acceptance, handover and implementation PR/integration.

Phase 7 remains local-only, explicitly selected and data-only. No Supabase, Vercel, hosted worker, runtime, dashboard or production capability changes belong in Phase 7.

After PR #52 merges, refresh the Phase 7 branch relationship to the new `main` and continue from Task 3 using TDD. Do not touch dashboard V5 files.

For Phase 7, prefer targeted CI after coherent task groups and one full exact-head CI gate before integration. Avoid spending Actions minutes on documentation-only checkpoints.

## Vercel Preview configuration gap

Production `scopeforge.dev` is healthy on `main`, but a Phase 7 Preview build previously failed during `/auth/sign-in` prerender because the Preview environment lacked the public Supabase URL/API key required by `@supabase/ssr`.

This is an environment-parity/configuration task, not a dashboard redesign task. Fix Preview using only browser-safe public Supabase configuration. Never expose a service-role/server secret as `NEXT_PUBLIC_*`.

If the connected Vercel toolset cannot mutate environment variables, leave the repo unchanged and record the exact manual/dashboard or authenticated Vercel API step rather than fabricating completion.

## Phase 6B / 6C / 6D production enablement

Code-complete is not the same as production-enabled.

- Phase 6B public GitHub acquisition runtime remains disabled pending its own production operational acceptance.
- Phase 6C zero-egress repository scan runtime remains disabled pending its own real Linux containment/operational acceptance.
- Phase 6D must be merged disabled. Passive and active runtime worker enablement are separate later gates with image/source identity, monitoring, rollback and canary requirements.

Do not infer Phase 6D Task 15 acceptance automatically authorizes 6B or 6C. Their execution boundaries are separate.

## Phase 8 - foundation merged, broader implementation remains

PR #50 merged the validation methodology foundation as `0b5c27a1226ca5c3f3f3fc40a25558dce05e9b20`.

Broader Phase 8 work remains:

- vulnerable labs / ground-truth fixtures
- measurable precision/recall and false-positive tracking where applicable
- scanner benchmarks and regression methodology
- limitations documentation
- technical validation reports

## Phase 9 - production hardening/public release remains

Concrete remaining work includes:

- enable/review Supabase leaked-password protection. Current security advisor warning: `auth_leaked_password_protection`.
- threat review and abuse prevention.
- Turnstile or equivalent abuse-control integration if still desired.
- production observability and alerting.
- private-schema defense-in-depth review without breaking RPC-only worker authority.
- incident response and rollback procedures.
- accessibility/responsive QA after dashboard V5 is finalized.
- release engineering and final public-launch security review.

Do not drop indexes solely because the current Supabase performance advisor reports `unused_index`; the production dataset is still too sparse for those statistics to establish safe removal.

## UI isolation

The dashboard V5/UI preview is a separate active workstream. This queue intentionally excludes its visual implementation. Non-UI backend/security work may merge to `main` only when it does not overwrite or silently integrate the active UI branch. Any later reconciliation with UI should be an explicit branch integration step after both streams have stable acceptance evidence.

# ScopeForge Session Handoff

Last refreshed: 2026-09-04 (Asia/Singapore)

This handoff is the fastest entry point for a new session. For the authoritative non-UI queue, also read `docs/development/UNFINISHED_WORK.md`.

## Hard execution rules

- GitHub Actions allowance is available again as of 2026-09-04. Use CI selectively at meaningful integration/release gates rather than on every small checkpoint commit.
- Routine documentation-only or intermediate commits may still use `[skip ci]` when no executable evidence would be gained. Final release candidates and meaningful code milestones should deliberately allow CI to run.
- Do not modify or merge the active dashboard V5/UI preview work from this non-UI stream.
- Do not enable hosted worker/runtime capability flags as part of a code merge.
- Do not rewrite deployed Supabase migrations. Corrections are forward-only.
- Do not add AI co-author attribution.
- Do not claim verification that was not actually executed or freshly reconciled.

## Current release priority - Phase 6D PR #52

Repository: `LeDoNguyenTu/ScopeForge`

Branch: `feat/phase-6d-network-workers-v1-task14`

PR: `#52 - Phase 6D dedicated network workers implementation [skip ci]`

Pre-closure base: `main` at `605518bfc2c6f99f6229bbb56a4b2f4b46c2a47a`

Reviewed code/security head: `22f80584a9a473051d02556e5942d57291c40fea`

Executable/docs acceptance checkpoint: `bd558fdf0830bfdb95027374e168835a8a48f43d`

### What is complete

- Tasks 1-13 implementation and hardening.
- Task 14 clean Linux software acceptance: 283 test files / 1,169 tests, typecheck, CLI build/version, benchmark, zero-vulnerability audit and production Next.js build.
- Task 15 dedicated Ubuntu/rootless-Podman/cgroup-v2 31-check containment acceptance.
- Task 16 exact-range source/security review with no reportable finding.
- Fresh read-only Supabase reconciliation on 2026-09-04 against exact project `tdgpibrepzcvdivztkta`.

Fresh Supabase counts:

```text
enabled_runtime_workers = 0
active_runtime_tasks = 0
unfinished_runtime_attempts = 0
active_runtime_jobs = 0
```

The complete Phase 6D migration stack is live through `20260831042723 phase_6d_atomic_runtime_publication`.

Phase 6D public RPCs were freshly rechecked as `SECURITY DEFINER` with `search_path=""`, no `anon`/`authenticated` EXECUTE and intended `service_role` EXECUTE. Relevant private runtime helpers do not expose direct application-role execution. The generic `public.finalize_worker_attempt` still excludes Phase 6D classes.

Current Supabase security advisor warning: `auth_leaked_password_protection` is disabled. Carry this into Phase 9; do not misclassify it as a Phase 6D implementation defect.

### Exact next action

1. Refresh PR #52 exact head/base.
2. Compare `bd558fdf0830bfdb95027374e168835a8a48f43d` to the exact PR head.
3. Confirm the entire post-acceptance diff is documentation/handover only.
4. Confirm no package/lockfile/migration/capability/authority drift.
5. Recheck PR reviews/threads.
6. Mark PR #52 ready to intentionally trigger the final GitHub Actions validation on the exact candidate.
7. Require the CI validate job to pass on that exact head.
8. Merge with exact-head SHA protection.
9. Leave `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED` false/absent.

Read `PHASE_6D_RELEASE_STATE.md` and `PHASE_6D_TASK16_REVIEW.md` before that merge.

## Immediately after Phase 6D merge

Do not start dashboard work. Continue the non-UI roadmap:

### 1. Reconcile Phase 7 branch

Branch: `feat/phase-7-community-security-packs-v1`

Last audited head before Phase 6D merge: `c1bbbb936a845ec16e8440d5c3d95009f4e13f63`

The branch is stacked on Phase 6D. Refresh its relation to the new `main` after PR #52 merges. Preserve its existing Task 1 and Task 2 work.

Plan: `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`

Resume from Task 3 using TDD:

- Task 3 identity-checked byte reads, literal matching and findings.
- Task 4 deterministic registry/scanner adapter.
- Task 5 fixture discovery and behavioral validation.
- Task 6 CLI validate/inspect/explicit scan integration.
- Task 7 output compatibility and authority guards.
- Task 8 first-party example pack and governance docs.
- Task 9 whole-phase verification, security review, Linux acceptance, handover and implementation PR.

Phase 7 is local-only, explicitly selected and data-only. It must not change Supabase, Vercel runtime authority, hosted workers, production capability flags or dashboard UI.

### 2. Vercel Preview environment parity

A Phase 7 Preview build previously compiled but failed prerendering `/auth/sign-in` because Preview lacked the browser-safe public Supabase URL/key required by `@supabase/ssr`.

Fix only Preview environment parity. Never expose `service_role` or other server secrets through `NEXT_PUBLIC_*`.

If the connected Vercel tool cannot mutate project environment variables, record the exact manual or authenticated API step and continue with repository work rather than claiming it was fixed.

### 3. Production worker acceptance remains separate

- Phase 6B hosted repository acquisition remains disabled pending its own operational acceptance.
- Phase 6C zero-egress repository scanning remains disabled pending its own execution-boundary acceptance.
- Phase 6D passive and active runtime enablement remain separate post-merge gates requiring source/image identity, monitoring, rollback and staged canary decisions.

Do not use Phase 6D containment evidence as automatic authorization for Phase 6B/6C.

## Later roadmap

Phase 8 broader validation work remains after the already-merged methodology foundation. Phase 9 production hardening includes leaked-password protection, abuse controls, observability, private-schema defense-in-depth review, incident/rollback readiness, release engineering and final security review.

Accessibility/responsive UI QA belongs after dashboard V5 visual work is stable and is intentionally not part of this non-UI handoff.

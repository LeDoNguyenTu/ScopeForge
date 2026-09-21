# ScopeForge Session Handoff

Last reconciled: 2026-09-21, Asia/Singapore. Live GitHub/provider state wins.

## Canonical resume point

Read `docs/development/CODEX_HANDOFF_PHASE11.md` first. It is the detailed Phase 11 closure handoff.

Current project-management estimates:

- Phase 11 source: 100%
- Phase 11 operational acceptance: about 94%
- overall "finish Phase 11" task: about 98%
- whole ScopeForge project: about 90%

These estimates must not be raised until an actual release gate changes.

## Current released state

- Phase 11 source Tasks 1 through 16 are complete for the initial approved scope.
- The latest runtime-changing Phase 11 baseline is PR #164 at `3cc1443ed292a14fe6738bc64a0b8629b5992d56`.
- PR #163 fixed the Linux Unix-socket pathname limit.
- PR #164 fixed trusted preparation to accept the authoritative post-claim `running` action state.
- The dedicated `phase11_http_discovery_v1` worker is enabled and production logs show repeated authenticated idle claim HTTP 200 responses.
- The accepted immutable runtime image remains `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`.
- ScopeForge Supabase is `tdgpibrepzcvdivztkta`. Never use the Job Command Center project `xwsergbpvkcsugexssmc`.
- Three failed Phase 11 canaries remain preserved as `dead_letter` audit evidence. Do not retry, rewrite, or delete them.
- Production currently has no queued or leased Phase 11 task.
- The eligible verified canary target is ScopeForge Production at `https://scopeforge.dev`.

## Recent production maintenance

- PR #170 merged as `844d89c40c232effb1c522c8ffbd89a5429cb32d` after full exact-head CI.
- Production deployment `dpl_Bz7UwyYA4k8aiJXKvga5VcoEisgh` is READY.
- Unauthenticated `/admin/phase11` still reaches sign-in without producing a new Vercel application error.
- Dedicated worker claim traffic remains HTTP 200 on that deployment.

## Remaining Phase 11 gate

From an authenticated platform-admin session at `/admin/phase11`, run exactly one bounded canary:

- `web.http.probe.v1`
- verified ScopeForge-owned HTTPS target only
- root-only GET
- redirects disabled
- one request maximum
- 5000 ms action runtime maximum

Acceptance requires worker lease, successful preparation past the former HTTP 409 boundary, mediator/sandbox execution, exact one-request accounting, valid terminal attempt/run/action/task reconciliation, valid observation or legitimate no-signal result, no duplicate accounting or secret/body leakage, and no leftover runtime container or mediator socket.

Do not manufacture acceptance with service-role SQL or manual worker-task insertion.

## Parallel maintenance already completed

- PR #168 added 16 covering foreign-key indexes after exact-head CI run `35584817649`.
- Production migration `cross_phase_fk_index_hardening` is applied.
- Supabase performance advisor now reports zero `unindexed_foreign_keys` findings.
- Production advisor decisions are documented in `docs/security/PRODUCTION_SUPABASE_ADVISORS.md`.
- The RLS-disabled private worker tables remain a separate defense-in-depth design item. Do not blindly enable RLS without tested trusted-worker policies.

## After the successful canary

1. record exact run/action/task/attempt/observation and coverage evidence
2. verify host cleanup and ordinary log secrecy
3. remove `public/.well-known/scopeforge-verification.txt`
4. update `CURRENT_STATE.md`, `UNFINISHED_WORK.md`, the completion matrix, and this handoff
5. run appropriate exact-head validation
6. merge the closure PR and verify exact-main Vercel production
7. only then mark Phase 11 operationally 100% complete

External Nmap, Nuclei, external httpx, broad exploit frameworks, and deferred advanced providers remain disabled unless separately reviewed.

# ScopeForge Session Handoff

Last reconciled: 2026-09-22, Asia/Singapore. Live GitHub/provider state wins.

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

## Final pre-Codex maintenance

- PR #178 merged as `d767960cc866af01eaaad3f91b5a22c8fa708e29` after exact-head CI run `35629597495` passed the complete validation gate.
- The Phase 11 canary form now announces pending/success/error state accessibly without changing server authority or execution limits.
- Worker-table RLS hardening is documented in `docs/security/WORKER_RLS_HARDENING_PLAN.md`; production audit shows 9 tables, 0 browser grants, and 57 trusted SECURITY DEFINER routines touching the worker/runtime surface.
- All 83 remote refs visible before PR #178 were classified. The cleanup manifest contains 69 reviewed safe-delete branches and 12 diverged branches to preserve.
- `docs/development/HISTORICAL_DOCUMENTATION.md` distinguishes acceptance history from active resume guidance.

## Worker RLS experiment closure

- PR #180 merged as `0f7f0481ed5b7b08bd4efaed704dd3dcc64bb098`.
- Free CI experiment `35694652988` passed 5/5 RLS ownership assertions and the full candidate gate.
- Post-merge main CI `35695129374` also passed the complete gate.
- Exact-main Vercel deployment `dpl_8iFsHwM9fwa9uayZtF6XMimHMsnX` is READY on `scopeforge.dev`.
- Phase 11 preflight remained exactly 3 historical tasks and 0 active tasks; worker remains enabled.
- The RLS experiment made no production database mutation.
- Do not enable/force RLS on the nine current worker/runtime tables merely to clear the advisor. Current `postgres` RPC ownership has `BYPASSRLS`; meaningful hardening requires a later dedicated non-`BYPASSRLS` owner design.

## Remaining Phase 11 gate

The 2026-09-22 single-Codex run already consumed its one authorized canary. Worker execution, one-request accounting, observation persistence, Vercel prepare/finalize, and Oracle cleanup succeeded, but the parent run ended `failed / request_budget_exhausted`. The authoritative verdict was false only for `run_completed`.

The released scoped fix prioritizes provider failure over request-budget exhaustion, and the applied forward-only migration completes clean budget exhaustion. Preserve run `2409c669-306b-4a7f-bf83-e3bcf1efc0cc` and its related rows unchanged. Obtain fresh authorization for one later canary. The temporary verification file remains until that canary passes.

The fix release is complete: PR #182 merged as `81ac30c773b7b9485d019f0a9b3df86535a06412` after exact-head CI `35747536961`; Vercel deployment `dpl_46A1x9oNBJW9G1shiKEDTb7D7eQc` is READY on `scopeforge.dev`; migration `20260922150155_complete_clean_budget_exhaustion` is applied and registered. Post-migration checks show zero active Phase 11 tasks, the worker enabled, expected RPC security, and the preserved fourth canary unchanged.

With the fix released and migration verified, a separately authorized future run may execute exactly one bounded canary from `/admin/phase11`:

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

# ScopeForge Codex Handoff

Last reconciled: 2026-09-22, Asia/Singapore.

This file is intentionally short. If the goal is to finish Phase 11 now, start with `docs/development/PHASE11_SINGLE_CODEX_RUN.md` and follow it as the single closure procedure. For the authoritative detailed resume state, read:

1. `docs/development/CODEX_HANDOFF_PHASE11.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/NEXT_STEPS.md`
4. `docs/development/UNFINISHED_WORK.md`
5. `docs/security/PRODUCTION_SUPABASE_ADVISORS.md`

Live GitHub and provider state wins if it differs from documentation.

## Immediate work

The Phase 11 source scope is complete. Do not reopen Tasks 1 through 16 merely to increase provider count.

The 2026-09-22 single-Codex run used its one authorized platform-admin canary. The worker/action succeeded with one request and a valid observation, but the parent run failed under the confirmed request-budget terminal-status defect. Do not run another canary in that run and do not rewrite its terminal rows.

Release the scoped stop-condition precedence fix and forward-only clean-budget-completion migration first. A new authenticated canary against the existing verified ScopeForge-owned target `https://scopeforge.dev` then requires a separately authorized later run.

Keep the canary fixed at `web.http.probe.v1`, root-only GET, redirects disabled, one request maximum, and 5000 ms action runtime maximum. Do not bypass the normal admin/planner/policy/authorization/queue path.

The failed-at-run-layer canary evidence is recorded in `CODEX_HANDOFF_PHASE11.md`. Oracle cleanup passed. Keep the temporary verification proof and close Phase 11 only after a later canary returns `acceptance_ready = true`.

## Hard boundaries

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Job Command Center Supabase: `xwsergbpvkcsugexssmc` - never use this for ScopeForge
- dedicated worker: `cd9a7769-e21f-4f75-84c3-ffe2d1f4616e`
- immutable runtime image: `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`
- preserve `--network=none`, target-bound mediator authority, cancellation, budgets, and service-role-only worker-control boundaries
- do not reapply existing Phase 11 migrations
- do not rotate/recreate the worker identity without an explicit credential-rotation procedure
- do not enable external Nmap, Nuclei, httpx, broad exploit frameworks, or deferred advanced providers merely to close Phase 11
- do not manually insert tasks or use service-role SQL to fake the production canary
- do not blindly enable RLS on private worker tables without a tested policy design
- no AI co-author metadata

## Recent parallel maintenance

PR #168 released additive covering indexes for all 16 live unindexed foreign-key findings after exact-head CI run `35584817649`. The production migration is applied and the Supabase performance advisor now reports zero `unindexed_foreign_keys` findings.

Do not repeat that migration or treat fresh `unused_index` notices as evidence the new indexes should immediately be removed.

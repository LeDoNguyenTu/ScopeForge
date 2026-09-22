# ScopeForge Latest Session

Last reconciled: 2026-09-22, Asia/Singapore.

Live GitHub, Supabase, Vercel, and worker state wins over this file.

## Current objective

Exactly one authenticated final-canary attempt was made on 2026-09-22. The action path succeeded end to end, but the parent run failed due a confirmed terminal-semantics defect; no second canary is authorized in that run.

- run `2409c669-306b-4a7f-bf83-e3bcf1efc0cc`
- action `phase11-action:0d3b8a92c08aed7f9b351991eb7291c2c5ad6e007bcd7f5f376d0793542da9b4`
- task `d15b183e-d1cd-4f52-a617-64ec2260d309`
- attempt `f81f2f16-30de-41cf-a5ab-ee641e2e7804`
- observation `phase11-obs-http:51f1b31271876b0eee32170ac86a44bf23a19bb4a321fac568d596dafe7b443e`
- one request, zero provider failures, successful worker/action attempt
- Vercel prepare/finalize HTTP 200, no canary-window runtime errors
- Oracle `PHASE11_HOST_CLEANUP_PASS`
- parent run `failed / request_budget_exhausted`; `acceptance_ready = false` only for `run_completed`

The scoped stop-condition precedence and forward-only clean-budget-completion fix is released. Leave the temporary verification proof in place. A separately authorized later run must perform the next canary.

Release completed on 2026-09-23: PR #182 merged as `81ac30c773b7b9485d019f0a9b3df86535a06412` after exact-head CI `35747536961`; deployment `dpl_46A1x9oNBJW9G1shiKEDTb7D7eQc` is READY on `scopeforge.dev`; migration `20260922150155_complete_clean_budget_exhaustion` is applied and registered. Database verification found four historical tasks, zero active tasks, an enabled worker, service-role-only RPC execution, pinned empty `search_path`, and the fourth canary unchanged.

Branch cleanup also removed 56 reviewed, merged, non-worktree remote branches. Thirteen manifest branches remain because they are attached to active worktrees. All twelve diverged branches, `demo/portfolio-20260910`, `main`, and post-audit branches were preserved. Remote refs fell from 88 to 32 (including `origin/HEAD`).

Phase 11 source implementation is complete. The release-critical sequence is now the scoped terminal-semantics fix and migration, followed by one authenticated end-to-end production canary in a separately authorized future run.

Use `docs/development/PHASE11_SINGLE_CODEX_RUN.md` for the exact one-run closure procedure. Do not resume from older Phase 10 or early Phase 11 handoffs.

Current project-management estimates after the non-accepted canary remain:

- Phase 11 source: 100%
- Phase 11 operational acceptance: about 94%
- overall "finish Phase 11" task: about 98%
- whole ScopeForge project: about 90%

Do not raise those percentages until an actual release gate changes.

## Latest executable release

PR #178, **Finish pre-Codex maintenance cleanup**, merged as `d767960cc866af01eaaad3f91b5a22c8fa708e29`.

Exact-head CI run `35629597495` passed:

- full repository tests
- npm audit
- typecheck
- CLI build/version
- worker build
- scanner benchmark
- scanner matrix benchmark
- Phase 11 adaptive/matrix/labeled/legal-lab benchmarks
- Next production build
- CSP browser smoke
- production V5/Turnstile diagnostic
- screenshot upload

PR #178 changes no canary authority, backend authorization, queueing, worker runtime, request/runtime budget, database schema, or execution policy. Its only executable change improves the platform-admin Phase 11 form accessibility with async status announcement semantics.

Later documentation-only commits may move `main`. Resolve live `main` before acting.

## Free worker-RLS experiment completed

PR #180 merged as `0f7f0481ed5b7b08bd4efaed704dd3dcc64bb098`.

- free PGlite/GitHub Actions experiment, no paid Supabase branch or project
- corrected candidate CI `35694652988`: 498 files / 2,304 tests passed plus typecheck, CLI/worker builds, scanner and Phase 11 benchmarks, Next build, CSP browser smoke, and production diagnostic
- post-merge main CI `35695129374`: full validation gate passed
- production `postgres` and `service_role` both have `BYPASSRLS`
- all 57 inspected worker/runtime `SECURITY DEFINER` routines are owned by `postgres` and pin empty `search_path`
- browser roles have zero direct worker-table grants and zero execute grants across those 57 routines
- experiment proves that enabling/forcing RLS alone does not constrain the current `BYPASSRLS` RPC owner
- meaningful future RLS hardening requires a dedicated non-`BYPASSRLS` RPC owner plus explicit policies and integration validation
- no production database mutation was made

See `docs/security/WORKER_RLS_EXPERIMENT_RESULT.md`.

## Final-canary preparation already complete

The repository contains:

- `docs/development/PHASE11_SINGLE_CODEX_RUN.md`
- `scripts/phase11-final-preflight.sql`
- `scripts/phase11-final-evidence.sql`
- `scripts/phase11-final-host-check.sh`

The preflight query has been validated against production and currently proves:

- exactly four historical Phase 11 tasks after the 2026-09-22 attempt
- zero active queued/retry-wait/leased Phase 11 tasks
- the dedicated worker is enabled
- eligible verified asset is `ScopeForge Production` at `https://scopeforge.dev`

The evidence query is read-only and returns a mechanical `acceptance_ready` verdict after the one new canary.

The host helper checks the exact final-canary runtime container, mediator sockets, systemd service, and accepted immutable runtime image without printing environment secrets.

## Production maintenance completed before the canary

- PR #168 added 16 covering foreign-key indexes after exact-head CI `35584817649`.
- Production migration `cross_phase_fk_index_hardening` is applied.
- Supabase performance advisor now reports zero `unindexed_foreign_keys`.
- PR #170 removed expected unauthenticated admin navigation from application-error telemetry while preserving fail-closed sign-in/not-found behavior. Exact-head CI `35585600946` passed.
- PR #178 added a repeatable private worker-table RLS audit and hardening design.
- Live RLS audit: nine target private worker/runtime tables, zero direct `anon`/`authenticated` table grants, zero policies, table owner `postgres`, and 57 inspected `SECURITY DEFINER` routines touching the trusted worker/runtime surface.
- Do not blindly enable RLS. See `docs/security/WORKER_RLS_HARDENING_PLAN.md`.

## Branch hygiene

All 83 remote refs visible before PR #178 were classified.

After PR #178 merged:

- 69 non-main branches are reviewed safe-delete candidates from a remote-reachability perspective
- 12 branches are genuinely diverged and intentionally excluded
- `demo/portfolio-20260910` is intentionally retained
- `main` is retained

See `docs/development/BRANCH_CLEANUP_CANDIDATES.md` for the exact sets.

The current ChatGPT GitHub integration cannot delete refs. The single Codex run may batch-delete the reviewed safe set only after checking open PRs and `git worktree list`.

## Remaining Phase 11 gate

After the fix release and migration, obtain separate authorization and run exactly one new bounded canary:

- target: `ScopeForge Production · https://scopeforge.dev`
- capability: `web.http.probe.v1`
- root-only GET
- redirects disabled
- one request maximum
- 5000 ms action runtime maximum

Do not run another canary in the already-consumed 2026-09-22 single-Codex run.

After the one canary, require database acceptance, Vercel evidence, Oracle host cleanup, temporary verification-file removal, closure documentation, and final production verification as specified in `PHASE11_SINGLE_CODEX_RUN.md`.

External Nmap, Nuclei, external httpx, broad exploit frameworks, and deferred advanced providers remain disabled unless separately reviewed.

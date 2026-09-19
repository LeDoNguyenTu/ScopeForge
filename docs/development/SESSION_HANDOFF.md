# ScopeForge Session Handoff

Last refreshed: 2026-09-20, Asia/Singapore.

## Resume exactly here

- Runtime implementation baseline is PR #147 at `ec3cdb2cf117c81c126973c2fcefb02e38fb4d14`.
- PR #147 released explicit immutable Phase 11 worker-host configuration and passed exact-head CI `35409821247`.
- Subsequent reconciliation/runbook changes are documentation-only and do not change the runtime implementation baseline.
- Vercel production is READY on the PR #147 implementation baseline and `scopeforge.dev` returns HTTP 200.
- Supabase is `tdgpibrepzcvdivztkta`, ACTIVE_HEALTHY on PostgreSQL 17.
- Phase 11A and Phase 11C migrations are already present in production. Do not reapply them.
- The accepted runtime image remains `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`.
- One `phase11_http_discovery_v1` worker identity is already registered for the PR #147 implementation SHA.
- The dedicated Phase 11 service is enabled on the Oracle host with the accepted image. Authenticated empty claims passed before and after a class-scoped stop/start rollback; the pre-existing snapshot and repository-scan worker PIDs were unchanged.
- Idle claims do not update `last_seen_at`; only a leased task heartbeat does. Do not weaken authentication or fabricate a heartbeat to change it.
- Checked Phase 11 worker-control RPC ACLs are service-role only.

## Next action

1. finish and release branch `feat/phase11-production-canary-control-20260920`
2. use `/admin/phase11` to select an existing verified HTTPS web/API asset owned/administered by the signed-in operator
3. run exactly one fixed root-GET canary through the normal planner/policy/authorization/queue path
4. verify terminal task/action state, observations, request/coverage accounting, host cleanup, and logs
5. update this handoff and `PHASE11C_PRODUCTION_ENABLEMENT.md` with exact production evidence

Do not reapply migrations, rotate the worker credential, or enable external Nmap/Nuclei/httpx execution as ordinary follow-up work.

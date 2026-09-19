# ScopeForge Session Handoff

Last refreshed: 2026-09-19, Asia/Singapore.

## Resume exactly here

- Runtime implementation baseline is PR #147 at `ec3cdb2cf117c81c126973c2fcefb02e38fb4d14`.
- PR #147 released explicit immutable Phase 11 worker-host configuration and passed exact-head CI `35409821247`.
- Subsequent reconciliation/runbook changes are documentation-only and do not change the runtime implementation baseline.
- Vercel production is READY on the PR #147 implementation baseline and `scopeforge.dev` returns HTTP 200.
- Supabase is `tdgpibrepzcvdivztkta`, ACTIVE_HEALTHY on PostgreSQL 17.
- Phase 11A and Phase 11C migrations are already present in production. Do not reapply them.
- The accepted runtime image remains `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`.
- One `phase11_http_discovery_v1` worker identity is already registered for the PR #147 implementation SHA.
- The worker has never heartbeated and there are zero Phase 11 HTTP worker tasks.
- Checked Phase 11 worker-control RPC ACLs are service-role only.

## Next action

Use `docs/development/PHASE11C_PRODUCTION_ENABLEMENT.md`.

On the dedicated Oracle host:

1. use only the accepted immutable runtime image
2. start the existing registered worker with the exact reviewed environment
3. prove idle claim/heartbeat
4. prove class-scoped rollback
5. run one bounded authorized canary
6. verify terminal cleanup, accounting, cancellation/recovery, and logs

Do not reapply migrations, rotate the worker credential, or enable external Nmap/Nuclei/httpx execution as ordinary follow-up work.

# ScopeForge Unfinished Work

Last reconciled: 2026-09-19, Asia/Singapore.

## Active

Phase 11C source, production schema, worker identity registration, exact-image Linux containment acceptance, and Vercel deployment are complete.

The remaining release blocker is dedicated Oracle-host operation. The registered `phase11_http_discovery_v1` worker has not heartbeated yet and no production Phase 11 canary has run.

## Completed external gate

Image `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a` passed the affected Linux containment gate. See `PHASE11C_LINUX_ACCEPTANCE.md`.

## Next release gate

1. on the dedicated Oracle host, install/use only the accepted immutable image digest
2. configure/start the already registered `phase11_http_discovery_v1` worker
3. prove authenticated idle claim/heartbeat without creating a target task
4. exercise class-scoped rollback so only the Phase 11 HTTP worker is disabled/stopped
5. run one bounded authorized production canary
6. verify request accounting, result-to-coverage reconciliation, cancellation/recovery, logs, and terminal cleanup
7. leave the class enabled only after the bounded canary and rollback checks pass
8. keep external Nmap, Nuclei, and external httpx process execution disabled

## Production state already complete - do not repeat

- PR #147 is merged into `main`.
- PR #147 exact-head CI passed.
- Vercel production is READY on the exact current `main` SHA.
- Production Supabase already contains the reviewed Phase 11A/11C migrations.
- A Phase 11 HTTP worker identity is already registered.
- Phase 11 worker-control RPCs are service-role only.
- There are currently zero Phase 11 HTTP worker tasks.

## Separately gated

- Do not reapply Phase 11A or Phase 11C migrations that are already present in production.
- Do not use a mutable runtime image tag.
- Do not enable external Nmap, Nuclei, or external httpx process execution.
- Do not weaken Phase 11 authorization, worker authentication, RPC ACLs, or runtime containment.
- Do not blindly enable RLS on existing private worker tables without a separately tested policy design.
- Keep ScopeForge Supabase `tdgpibrepzcvdivztkta` separate from Job Command Center `xwsergbpvkcsugexssmc`.

## Completed - do not repeat

- Phase 11 Tasks 1 through 9.
- Task 11 deterministic evaluation slices released to date.
- Phase 11C provider dependency/threat-model review.
- PR #141 provider contracts.
- PR #142 bounded HTTP mediator/runtime foundation.
- PR #143 trusted HTTP worker control.
- PR #144 reproducible runtime-image candidate source/build gate.
- PR #145 result-to-coverage reconciliation.
- PR #146 Linux acceptance record.
- PR #147 default-off worker-host runtime selection.
- Vercel Hobby deployment-budget filtering.

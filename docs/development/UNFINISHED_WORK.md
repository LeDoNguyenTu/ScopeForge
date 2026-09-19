# ScopeForge Unfinished Work

Last reconciled: 2026-09-19, Asia/Singapore.

## Active

Publish and merge the separately reviewed default-off worker-host configuration slice. PR #146 already released the exact Phase 11C Linux acceptance record.

## Completed external gate

Exact `main` SHA `4f388834cec38aef335f4dbf5657101171416c9e` and image `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a` passed the affected Linux containment gate. See `PHASE11C_LINUX_ACCEPTANCE.md`.

## Next release gate

1. require exact-candidate CI for source commit `dda81ea878b19aa77943e3874de0ccd4230bd8de` plus its handoff documentation
2. deploy only the accepted immutable image digest
3. register a dedicated class-specific worker identity and prove authenticated idle claim/heartbeat
4. document and exercise rollback by disabling the class and stopping only that worker
5. apply the reviewed Phase 11A/11C migrations only after a final live-ledger check
6. enable a bounded acceptance window and prove one authorized production run plus cancellation/recovery/cleanup
7. keep external Nmap, Nuclei, and httpx processes disabled

## Separately gated

- Do not apply Phase 11A or Phase 11C migrations to production yet.
- Do not configure or start a production `phase11_http_discovery_v1` worker before the separate enablement release proves authentication and rollback.
- Do not enable external Nmap, Nuclei, or httpx process execution.
- Do not weaken Phase 11 authorization, worker authentication, RLS, service-role-only RPC boundaries, or runtime containment.
- Keep ScopeForge Supabase `tdgpibrepzcvdivztkta` separate from Job Command Center `xwsergbpvkcsugexssmc`.

## Completed - do not repeat

- Phase 11 Tasks 1 through 9.
- Task 11 deterministic evaluation slices released to date.
- Phase 11C provider dependency/threat-model review.
- PR #141 provider contracts.
- PR #142 bounded HTTP mediator/runtime foundation.
- PR #143 trusted HTTP worker control.
- PR #144 reproducible runtime-image candidate source/build gate.
- Vercel Hobby deployment-budget filtering.

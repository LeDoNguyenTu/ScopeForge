# ScopeForge Unfinished Work

Last reconciled: 2026-09-20, Asia/Singapore.

## Active

Phase 11C source, production schema, worker identity registration, exact-image Linux containment acceptance, and Vercel deployment are complete.

The worker's authenticated idle operation, class-scoped rollback, and fixed-parameter admin canary entry point are complete. Before the one real canary, branch `ops/phase11-production-canary-evidence-20260920` must release retry-safe parent-run advancement after terminal worker finalization.

## Completed external gate

Image `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a` passed the affected Linux containment gate. See `PHASE11C_LINUX_ACCEPTANCE.md`.

## Next release gate

1. release the post-finalization parent-run advancement slice
2. run one bounded authorized production canary
3. verify request accounting, result-to-coverage reconciliation, logs, and terminal cleanup
4. keep external Nmap, Nuclei, and external httpx process execution disabled

## Production state already complete - do not repeat

- PR #147 is merged into `main`.
- PR #150 is merged into `main`; exact-head and post-merge CI passed.
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
- Phase 11 Task 11 adaptive evaluation harness is complete, including deterministic/labeled fixtures, graph-policy coverage, catastrophic ceilings, and pinned legal-lab definitions.
- Phase 11C provider dependency/threat-model review.
- PR #141 provider contracts.
- PR #142 bounded HTTP mediator/runtime foundation.
- PR #143 trusted HTTP worker control.
- PR #144 reproducible runtime-image candidate source/build gate.
- PR #145 result-to-coverage reconciliation.
- PR #146 Linux acceptance record.
- PR #147 default-off worker-host runtime selection.
- Vercel Hobby deployment-budget filtering.

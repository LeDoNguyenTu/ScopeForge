# ScopeForge Current State

Last reconciled: 2026-09-20, Asia/Singapore. Live provider state wins.

## Released baseline

- `main`: `e972ef6d9a9cacbd3f403398754886d4b7ce4bd1`; exact-main CI `35438329301` passed.
- PR #143 released the trusted Phase 11C HTTP worker control path.
- PR #144 released the reproducible Phase 11C runtime-image candidate source and permanent `npm run build:workers` CI gate.
- PR #145 released bounded Phase 11 request/result/coverage reconciliation.
- PR #146 released the exact-image Linux acceptance record.
- PR #147 released explicit default-off worker-host selection for `phase11_http_discovery_v1`.
- PR #147 exact-head CI run `35409821247` passed.
- Vercel production deployment `dpl_3UGR4KQ8Qcj59pR962ubNGTEg5T2` is READY and built from the exact current `main` SHA.
- Vercel reported no production runtime errors in the latest 24-hour check.
- Vercel Hobby deployment filtering remains active for ordinary feature branches.

## Released Phase 11C source

It adds:

- immutable run-level request, graph-expansion, and provider-failure limits
- deterministic stop-condition enforcement before each planner iteration
- request usage on authoritative private action-attempt rows
- atomic terminal-result reconciliation into private coverage and the privacy-reduced public summary
- provider-failure accounting
- conservative HTTP request accounting for ambiguous expired leases
- HTTP-class request accounting capped to the runtime ceiling of 12
- replay-safe accounting through the existing terminal replay boundary
- monotonic graph persistence so stale graph snapshots cannot roll committed request/failure coverage backward
- coverage semantics that charge consumed requests without falsely marking blocked/cancelled/policy-rejected actions as covered
- dedicated worker-host selection requiring an absolute Podman path and immutable runtime-image digest

## Linux runtime acceptance

The accepted source/image combination passed the affected real-Linux rootless-Podman/cgroup-v2 containment gate on the dedicated Oracle host.

- runtime bundle SHA-256: `05dd6f00bb5a1bf9be6b8046d3c7aeff79b4b78a7b73dba5d72acb095cee8153`
- accepted image: `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`
- real mediator-only HTTPS, cross-host redirect rejection, direct-egress denial, cgroup/resource ceilings, cancellation, wall-time/output cleanup, and terminal cleanup passed
- focused Linux validation: 25 files and 121 tests passed

See `docs/development/PHASE11C_LINUX_ACCEPTANCE.md`.

## Production database state

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`.
- Project state: ACTIVE_HEALTHY.
- PostgreSQL: 17.
- Live migration history includes:
  - `phase_11a_planning_graph`
  - `phase_11a_run_orchestration`
  - `phase_11a_run_orchestration_hardening`
  - `phase_11c_http_worker_control`
  - `phase_11c_result_coverage_reconciliation`
- Do not reapply these migrations.
- One `phase11_http_discovery_v1` worker identity is registered against the current `main` software version.
- The registered Phase 11 worker is deployed and authenticated empty claims passed. Idle claims leave `last_seen_at = null` by design; it advances only for leased task heartbeats.
- There are zero Phase 11 HTTP worker tasks.
- Phase 11 worker-control RPCs checked in production are executable by `service_role` only.

## Production boundary

- Authenticated idle operation and class-scoped rollback are proven on the dedicated host.
- Production canary acceptance has not yet been run.
- The active source slice adds the missing closed HTTP planner parameters and a platform-admin-only verified-asset canary entry point.
- The accepted immutable runtime image must be used unchanged for the enablement gate.
- External Nmap, Nuclei, and external httpx process runners remain disabled.

## Security-advisor note

Supabase flags RLS-disabled private worker tables. Direct checks show the inspected worker tables are not granted to `anon` or `authenticated`, and the Phase 11 RPC boundary is service-role only. Do not auto-enable RLS without a separate policy design and regression gate because doing so without policies would break trusted worker access.

The public workspace collaborator `SECURITY DEFINER` RPCs are intentionally authenticated endpoints with explicit `auth.uid()` and owner/admin authorization checks.

## Next

1. release the canary-control source slice
2. run one bounded authorized production canary from `/admin/phase11`
3. verify accounting, terminal state, cleanup, and logs
4. keep Nmap, Nuclei, and external httpx process execution disabled until separately reviewed

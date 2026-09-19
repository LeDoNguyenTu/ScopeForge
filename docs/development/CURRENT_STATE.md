# ScopeForge Current State

Last reconciled: 2026-09-19, Asia/Singapore. Live provider state wins.

## Released baseline

- `main`: `54c347e5f989711624e0acfd65bf86b3008ddb8f`.
- PR #143 released the source-only trusted Phase 11C HTTP worker control path.
- PR #144 released the reproducible Phase 11C runtime-image candidate source and permanent `npm run build:workers` CI gate.
- PR #145 released bounded Phase 11 request/result/coverage reconciliation.
- Exact post-merge CI run `35406951340` passed and Vercel production deployment `6534790299` succeeded.
- PR #146 released the exact-image Linux acceptance record after exact-head CI `35408781659` passed.
- Exact post-merge CI `35409209893` passed for `54c347e5f989711624e0acfd65bf86b3008ddb8f`, including browser/security acceptance.
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

The new migration is `20260919020000_phase_11c_result_coverage_reconciliation.sql`. It remains unapplied.

## Linux runtime acceptance

The exact `main` SHA above passed the affected real-Linux rootless-Podman/cgroup-v2 containment gate on the dedicated Oracle host.

- runtime bundle SHA-256: `05dd6f00bb5a1bf9be6b8046d3c7aeff79b4b78a7b73dba5d72acb095cee8153`
- accepted image: `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`
- real mediator-only HTTPS, cross-host redirect rejection, direct-egress denial, cgroup/resource ceilings, cancellation, wall-time/output cleanup, and terminal cleanup passed
- focused Linux validation: 25 files and 121 tests passed

See `docs/development/PHASE11C_LINUX_ACCEPTANCE.md`.

## Production boundary

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`.
- Production migration history still ends at Phase 10A3.
- Phase 11 and Phase 11C migrations remain source-only and unapplied.
- Hosted `phase11_http_discovery_v1` execution remains disabled.
- Production worker configuration still does not select the Phase 11 HTTP class.
- Pending source commit `dda81ea878b19aa77943e3874de0ccd4230bd8de` permits a dedicated worker host to select the class only when both an absolute Podman path and immutable `SCOPEFORGE_RUNTIME_IMAGE` digest are supplied.
- PR #147 carries that source slice and remains subject to exact-head CI.
- The reproducible runtime image has passed its exact-image Linux containment acceptance.
- No external Nmap, Nuclei, or httpx process runner is enabled.

## Next

1. merge PR #147 after exact-candidate CI
2. prove authenticated idle registration/claim/heartbeat and rollback before enabling the class
3. apply only the reviewed absent Phase 11 migrations during that separately recorded release gate
4. keep Nmap, Nuclei, and external httpx process execution disabled

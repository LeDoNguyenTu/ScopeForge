# ScopeForge Current State

Last reconciled: 2026-09-19, Asia/Singapore. Live provider state wins.

## Released baseline

- `main`: `83855118b36fb7c65f7a5882bcd8abfef7ac5ec1`.
- PR #143 released the source-only trusted Phase 11C HTTP worker control path.
- PR #144 released the reproducible Phase 11C runtime-image candidate source and permanent `npm run build:workers` CI gate.
- Both corresponding production Vercel deployments reached READY.
- Vercel Hobby deployment filtering remains active for ordinary feature branches.

## Active implementation

PR #145, branch `feat/phase-11c-result-coverage-reconciliation-20260919`, is the active source-only follow-up.

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

The new migration is `20260919020000_phase_11c_result_coverage_reconciliation.sql`.

## Production boundary

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`.
- Production migration history still ends at Phase 10A3.
- Phase 11 and Phase 11C migrations remain source-only and unapplied.
- Hosted `phase11_http_discovery_v1` execution remains disabled.
- The normal worker runtime configuration still cannot select the Phase 11 HTTP class.
- The reproducible runtime image has not yet passed the required new real-Linux containment acceptance.
- No external Nmap, Nuclei, or httpx process runner is enabled.

## Next

1. finish exact-head validation of the result-to-coverage reconciliation slice
2. merge source-only only if the exact head is green
3. build the exact Phase 11 runtime image on the accepted Linux/rootless-Podman host and record its immutable digest
4. run the affected rootless-Podman/cgroup-v2 containment matrix for `phase11_http_discovery_v1`
5. keep production migration application and hosted enablement as separate reviewed gates

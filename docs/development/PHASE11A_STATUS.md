# Phase 11A Status

Last reconciled: 2026-09-20, Asia/Singapore. Live provider state wins.

## Released

- Tasks 1 to 7: PR #125.
- Task 8 persistence: PR #126.
- Task 9 trusted run orchestration: PR #128.
- Task 11 two-stage adaptive fixture: PR #130.
- Task 11 evaluation matrix: PR #132.
- Task 11 labeled evaluation fixture: PR #134.
- Task 11 graph-expansion and approval fixtures: PR #136.
- Phase 11C provider/runtime/control follow-through: PRs #141 through #147.

## Production state

- Supabase project: `tdgpibrepzcvdivztkta`.
- Project state: ACTIVE_HEALTHY on PostgreSQL 17.
- Phase 11A planning graph, run orchestration, and hardening migrations are already present in production.
- Phase 11C HTTP worker control and result-coverage migrations are also already present.
- Do not reapply those migrations.
- A `phase11_http_discovery_v1` worker identity is already registered against current `main`.
- The registered worker is running on the dedicated host. Authenticated empty claims and class-scoped rollback passed; idle claims do not update `last_seen_at` because no task is leased.

## Current boundary

The planning, policy, persistence, bounded HTTP provider, trusted queue/control plane, containment image, and worker-host selection are released.

The remaining release gate is operational:

1. release the fixed-parameter platform-admin canary control
2. run one bounded authorized canary
3. verify accounting, cleanup, terminal state, and logs

External Nmap, Nuclei, and external httpx process execution remain separately gated and disabled.

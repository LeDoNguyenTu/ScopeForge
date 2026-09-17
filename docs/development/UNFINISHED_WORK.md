# ScopeForge Unfinished Work

Last reconciled: 2026-09-17, Asia/Singapore.

## Release blocking

### PR #76

Code, schema, provider access, workers, containment, private canary, recovery, cleanup, production UI, and rollback evidence are complete.

Remaining: commit/push handoff, mark ready, obtain exact-head CI/Vercel, merge, and verify released `main` and production.

### PR #77

Blocked until #76 releases. Then reconcile it and complete webhook schema, secret configuration, signed-delivery/replay/recovery/privacy canaries, end-to-end acceptance, CI, and release.

## Non-blocking backlog

- backup platform-admin delegation and access-control-management design
- leaked-password protection
- measured performance-advisor follow-up
- PR #124 Phase 11 review
- branch cleanup after reachability proof

## Completed; do not repeat

Issue #79 canaries, Phase 10A2 migrations/ACL review, Linux containment, legitimate private-canary selection, real private snapshot/scan/finding flow, recovery, cleanup, UI consolidation, and finding-detail route repair. Do not repeat Phase 6D Task 15 acceptance.

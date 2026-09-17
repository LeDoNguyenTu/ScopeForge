# ScopeForge Unfinished Work

## Current PR #77 release remainder

Implementation, schema, provider activation, local validation, exact-source CI/Vercel, production deployment, private same-head recovery, live database verification, authenticated UI acceptance, and the focused security scan are complete.

Source commit `37c3e68a6e188b30a1c23399449cc794fa776335` fixed the finalize-order defect. Production deployment `dpl_HkfuaAJ33qY8cs3xbWJFAPKqRTzV` settled head `f13f3d72...` to idle and successful without creating another snapshot.

Remaining:

- obtain exact-head CI/Vercel after the final documentation checkpoint
- merge PR #77 normally
- verify released `main`, main CI, production, workers, advisors, and authenticated browser behavior
- then reconcile PR #124

PR #76 and issue #79 are complete. Do not repeat their acceptance.

Older unfinished-work sections below are historical.
Last reconciled: 2026-09-18, Asia/Singapore.

## Current release blocker

### PR #77

Code hardening, exact local validation, final security review, Phase 10A3 schema deployment, and Vercel secret creation are complete.

The GitHub App webhook URL/secret and required event subscriptions are configured. Successful `ping` and `installation.new_permissions_accepted` deliveries prove GitHub-to-production transport.

Remaining:

- run the remaining replay/lifecycle/coalescing/recovery/public-private and end-to-end production webhook/security acceptance matrix; deployment, provider transport, and non-mutating edge canaries are complete
- confirm rapid private-canary head `f13f3d72d0782e4260898201d8dd2f08885a8088` is the terminal production scan; route logs prove the webhook and worker sequence but do not expose the bounded read-model SHA
- obtain exact-head CI/Vercel after the final documentation checkpoint, merge, and verify released production

PR #76 is merged/released and is no longer unfinished. Do not repeat issue #79 or Phase 10A2 acceptance.

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

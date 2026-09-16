# ScopeForge Current State

Last reconciled: 2026-09-16, Asia/Singapore

Fetch live refs before acting. This document records semantic state, not a promise that embedded SHAs remain branch tips after documentation commits.

## Repository and release queue

- repository: `LeDoNguyenTu/ScopeForge`
- pre-documentation live `main`: `c94748ba70079f28f9c6a84615ca4f5e96c0a395`
- issue #79: OPEN
- PR #76: OPEN/DRAFT, Phase 10A2 private repository acquisition
- current executable/security-hardening merge on #76 after PR #119: `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`
- PR #77: OPEN/DRAFT, head `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`, stacked on #76
- strict release order: `#79 -> #76 -> #77`

The only open PRs observed after PR #119 merged were #76 and #77. Verify again at resume time.

## Production/provider state

Positive GitHub App owner/admin acceptance is complete:

- hosted GitHub integration is active
- owner/admin Connect GitHub succeeded
- active `LeDoNguyenTu` connection persisted
- `LeDoNguyenTu/ScopeForge` listing/import succeeded
- unauthenticated connect/callback remains behind sign-in
- prior provider/log/integration/browser-readable leakage review found no release-blocking token/secret exposure

PR #118 workspace collaborator controls are released and deployed. A legitimate collaborator now exists as a member of Brian's workspace while owning a separate workspace. This supplies the normal-member path needed for the remaining #79 authorization canary without fabricating database state.

## Issue #79 remaining acceptance

Exactly two authenticated production browser checks remain:

1. owner/admin normal signed flow with a different valid GitHub installation ID must be rejected because it does not belong to the authorized connection/workspace
2. legitimate normal member/viewer must select Brian's workspace and be unable to initiate or complete Connect GitHub

Do not substitute unit tests, forged callback state, fabricated membership, direct role mutation, or an owner downgrade.

## Phase 10A2 state

PR #76 contains the private repository acquisition implementation and remains deliberately unreleased.

Integrated security hardening includes:

- #113 trusted claim workspace/asset binding
- #114 broker authority expiry rechecks
- #115 private archive stream cleanup
- #119 expired repository-scan download fail-closed enforcement

PR #119 evidence:

- RED head `24c6f442c946fa1a676f7c79c401638c0f391895`
- RED CI `35054474634`
- GREEN head `9658a652f1e5416475489f9971da13409e5319d9`
- GREEN CI `35054754370`
- merged into #76 only as `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

The Phase 10A2 migrations remain intentionally unapplied:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

PR #113 changed the first migration's private worker claim body. Re-review the exact current migration before any production apply.

Do not reconcile #76 merely to catch up with docs/main while #79 remains open. Reconcile once after #79 clears, then require fresh exact-candidate validation.

## Runtime gates

Keep false/absent until independent operational and rollback acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Code presence, migration presence, historical Linux containment, or green CI does not authorize production enablement.

## Phase 10A3 state

PR #77 is still draft and stacked on #76. It must not be released before Phase 10A2.

After #76 releases, reconcile #77 onto the released baseline and run fresh exact-candidate validation before any Phase 10A3 production migration or webhook configuration.

## External account targets

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- wrong/different Job Command Center Supabase: `xwsergbpvkcsugexssmc`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- production domain: `scopeforge.dev`

No external provider account mutation occurred in the latest continuation other than ordinary GitHub repository/PR/documentation writes.

## Branch state warning

The historical cleanup manifest said the repository had four remote refs. A fresh GitHub branch listing on 2026-09-16 returned 21 branches. Treat the old four-ref statement as stale. No deletion was performed from that stale list.

## Completed work not to repeat

- PR #116 upload expiry TOCTOU fix
- PR #117 signup confirmation repair
- PR #118 collaborator controls and forward migration
- PR #119 repository-scan download expiry enforcement
- positive owner/admin GitHub provider canary
- Phase 6D real Linux/rootless-Podman acceptance

## Immediate resume point

Finish the two #79 browser canaries through normal authenticated product flows if a suitable browser/session surface is available. If not, continue only isolated security/regression/tooling work. Never use independent maintenance to infer #79, Phase 10A2, or Phase 10A3 operational acceptance.

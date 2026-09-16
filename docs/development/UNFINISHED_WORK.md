# ScopeForge Unfinished Work Queue

Last reconciled: 2026-09-16, Asia/Singapore

This file lists genuinely unfinished work only. Fetch live refs before acting.

## 1. Issue #79 - two authenticated production browser canaries

Positive owner/admin GitHub App activation/import is complete. PR #118 collaborator controls are released and a legitimate normal-member path now exists.

Still unfinished:

1. authorized owner/admin normal signed flow with a different valid GitHub installation ID must be rejected as not belonging to the authorized connection/workspace
2. legitimate normal member/viewer must select Brian's workspace and be unable to initiate or complete Connect GitHub

Do not satisfy either check with forged callback state, fabricated membership, direct role mutation, owner downgrade, weakened authorization, or CI/unit tests.

If a real canary exposes a defect, remediate before Phase 10A2 release work.

## 2. Phase 10A2 - PR #76 private repository acquisition

PR #76 remains open/draft. Latest executable/security-hardening merge after PR #119:

`79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

Integrated maintenance now includes #113, #114, #115, and #119.

PR #119 is complete and must not be recreated:

- RED head `24c6f442c946fa1a676f7c79c401638c0f391895`
- RED CI `35054474634`
- GREEN head `9658a652f1e5416475489f9971da13409e5319d9`
- GREEN CI `35054754370`
- merged into #76 as `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

After #79 clears:

1. fetch live main/#76 and production migration history
2. reconcile once onto current released main
3. run fresh exact-candidate validation
4. re-review exact current Phase 10A2 migrations
5. apply only absent reviewed migrations to `tdgpibrepzcvdivztkta`
6. verify schema/functions/ACL/RLS/Security Advisor posture
7. keep private worker gates off until dedicated acceptance
8. prove containment, quotas, cleanup, cancellation, observability, rollback, and credential isolation
9. prove exact private archive lease -> immutable snapshot -> zero-egress repository scan -> findings
10. merge/release only after all provider/schema/runtime/privacy/rollback checks pass

Pending Phase 10A2 migrations:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

PR #113 changed the first migration. Re-review it before apply.

## 3. Phase 10A3 - PR #77 webhook reconciliation

PR #77 remains open/draft and stacked on #76. It cannot release before Phase 10A2.

After #76 releases:

1. reconcile #77 to released main
2. run fresh exact-candidate validation
3. apply only reviewed absent Phase 10A3 migrations
4. configure independent server-only webhook secret/endpoint
5. prove signature and size rejection, replay/lifecycle/coalescing/recovery behavior, public/private separation, leak boundaries, and one complete automatic scan
6. release only after operational acceptance

## 4. Branch cleanup reconciliation

The previous branch cleanup snapshot is stale. Fresh GitHub state returned 21 branches while only #76 and #77 are open PRs.

No deletion was performed in the latest continuation. Before cleanup:

- fetch all branches and all open PR pages
- inspect actual local worktrees
- prove merged/reachability/supersession status for every candidate
- preserve main, #76, #77, the portfolio demo branch, active tasks, and active worktrees
- re-list refs after any deletion

Known merged source branch from the latest work: `fix/repository-scan-download-expiry-20260916` for PR #119.

## 5. Safe independent work while #79 is blocked

Allowed:

- narrow TDD security/regression hardening
- dependency/runtime/tooling maintenance
- evidence-based UI fixes
- documentation/release hygiene
- architecture/security review

Not allowed as a workaround:

- early Phase 10A2/10A3 migration apply
- early private/repository worker enablement
- synthetic production identities/state
- weakening provider authorization
- treating green CI as operational acceptance

## Runtime gates still requiring their own acceptance

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Completed, do not recreate

- PR #116 upload capability expiry fix
- PR #117 signup confirmation repair
- PR #118 collaborator controls
- PR #119 repository-scan download expiry fix
- positive owner/admin GitHub provider canary
- Phase 6D real Linux/rootless-Podman acceptance

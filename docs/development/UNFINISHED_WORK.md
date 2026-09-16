# ScopeForge Unfinished Work Queue

Last reconciled: 2026-09-16, Asia/Singapore

This file lists genuinely unfinished work only. Fetch live refs before acting.

## 1. Issue #79 - completed release prerequisite

Both live negative authorization canaries passed on 2026-09-16. A normal member was denied Connect GitHub, and a fresh owner-signed flow rejected a different real installation ID with `?error=installation`. The original `LeDoNguyenTu/ScopeForge` connection remained verified. Issue #79 is closed and is no longer unfinished work.

## 2. Phase 10A2 - PR #76 private repository acquisition

PR #76 remains open/draft. Latest executable/security-hardening merge after PR #120:

`2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`

Integrated maintenance now includes #113, #114, #115, #119, and #120.

PR #119 is complete and must not be recreated:

- RED head `24c6f442c946fa1a676f7c79c401638c0f391895`
- RED CI `35054474634`
- GREEN head `9658a652f1e5416475489f9971da13409e5319d9`
- GREEN CI `35054754370`
- merged into #76 as `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

PR #120 is complete and must not be recreated:

- RED head `a88ab371628f3262f881243f117818f67fdddda4`
- Linux RED CI `35067132487`
- GREEN head `05b7959e61902d2916b4ba4e1166421b599d9f67`
- GREEN CI `35067478620`; exact-head Vercel passed
- merged into #76 as `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`
- completed all-file Phase 10A2 security diff review recorded one reportable issue, remediated by this PR

With #79 closed:

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

Known merged source branches from the latest work: `fix/repository-scan-download-expiry-20260916` for PR #119 and `fix/private-supervisor-abort-drain-20260916` for PR #120.

## 5. Independent maintenance

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
- PR #120 private snapshot cancellation/finalization ordering fix
- positive owner/admin GitHub provider canary
- Phase 6D real Linux/rootless-Podman acceptance

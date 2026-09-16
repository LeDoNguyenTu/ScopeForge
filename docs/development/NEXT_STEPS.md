# ScopeForge Next Steps

Last reconciled: 2026-09-16, Asia/Singapore

Always fetch live `main`, #79, #76, #77, open PRs, and branch refs before starting. Live state wins.

## Priority 1 - finish issue #79 through real product flows

Positive owner/admin GitHub App acceptance is complete. PR #118 is released and provides a legitimate normal-member path.

The legitimate member canary passed on 2026-09-16: `214nsa@gmail.com` selected Brian's workspace as `Member`, and the GitHub integration page denied access with `Workspace owner or admin access is required.` and no Connect GitHub control.

One production browser canary remains:

1. owner/admin normal signed flow with a different valid GitHub installation ID must be rejected as unauthorized for the active connection/workspace

Required constraints:

- use the normal authenticated application flow
- do not forge callback state
- do not fabricate membership or identity
- do not directly mutate an owner role merely for testing
- do not weaken authorization
- do not substitute unit/CI evidence

If either live canary exposes a defect, remediate it before Phase 10A2 release work.

## Priority 2 - Phase 10A2 PR #76 after #79 clears

Current executable/security-hardening merge after PR #120:

`2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`

Do not reconcile #76 early while #79 is open. Once #79 genuinely clears:

1. fetch current `main`, #76, production migration history, and exact runtime/config state
2. reconcile #76 once onto the current released mainline, preserving #113/#114/#115/#119/#120 and released mainline fixes
3. run fresh exact-candidate validation; historical branch CI is not release proof
4. re-review the exact current Phase 10A2 migrations
5. apply only absent reviewed migrations to ScopeForge Supabase `tdgpibrepzcvdivztkta`
6. verify schema, function bodies, ACLs, grants/revokes, RLS/private-table posture, and Security Advisor results
7. keep private repository snapshot/scan gates off until the dedicated private worker passes its own acceptance
8. prove containment, scratch/output ceilings, quotas, cancellation, cleanup, observability, rollback, and credential boundaries
9. prove one end-to-end private flow: provider revalidation -> exact private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings
10. verify provider credentials remain control-plane-only and private source/capability material does not leak to browser state or ordinary logs
11. merge/release #76 only after all provider, schema, runtime, privacy, and rollback gates pass
12. verify production after release

Phase 10A2 migrations currently waiting:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

PR #113 changed the first migration's claim body, so the older preflight is not sufficient authorization to apply the current migration.

## Priority 3 - Phase 10A3 PR #77 only after #76 releases

Current live head observed before this docs refresh:

`d9466f40e38e84e2fc694396c5947aa0f95a2d5d`

After Phase 10A2 release:

1. reconcile #77 onto released Phase 10A2/main
2. run fresh exact-candidate validation
3. re-read and apply only reviewed absent Phase 10A3 migrations
4. configure the independent server-only webhook secret/endpoint without exposing it
5. canary raw-body HMAC verification, invalid-signature rejection, oversize rejection, replay, installation/repository lifecycle, latest-head coalescing, same-head recovery, stale-trigger authoritative-head recovery, public/private separation, and leak boundaries
6. prove a full automatic webhook-triggered flow through immutable snapshot publication and findings
7. merge/release only after all operational gates pass
8. verify production after merge

## Safe work while #79 is externally blocked

Safe independent work includes:

- narrowly scoped TDD security/regression fixes
- dependency/runtime/tooling maintenance
- evidence-based UI fixes
- documentation/handoff repair
- architecture/security review
- branch/release hygiene after fresh live verification

Any independent fix must use genuine RED, minimal GREEN, and exact-candidate validation. It must not be used as evidence that #79 or either Phase 10 release gate passed.

## Runtime gates that stay off until accepted

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Branch cleanup next step

A live branch listing returned 21 refs, contradicting the previous four-ref cleanup claim. Before deleting anything:

1. fetch every branch
2. fetch every open PR, including pagination
3. inspect current worktrees in the actual checkout
4. prove reachability/merged or superseded status for each candidate
5. preserve `main`, #76, #77, `demo/portfolio-20260910`, every active task branch, and every active worktree
6. delete only after the candidate list is freshly reviewed
7. re-list branches and document the exact result

No branch deletion was performed during the latest continuation.

## Completed latest maintenance

PR #119 is complete. Do not redo it:

- RED `24c6f442...`, CI `35054474634`
- GREEN `9658a652...`, CI `35054754370`
- merged only into #76 as `79e4b2a1...`

PR #120 is complete. Do not redo it:

- RED `a88ab371...`, Linux CI `35067132487`
- GREEN `05b7959e...`, CI `35067478620`, exact-head Vercel passed
- merged only into #76 as `2ff2bf07...`
- completed Phase 10A2 security diff review found this one reportable issue and confirmed its remediation

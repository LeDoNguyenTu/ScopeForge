# ScopeForge Codex handoff

Last reconciled: 2026-09-16, Asia/Singapore

This file is the primary resume point. Live GitHub/provider state always wins over embedded SHAs. Fetch before acting.

## Mandatory startup

1. Read root `AGENTS.md`.
2. Verify the repository is `LeDoNguyenTu/ScopeForge`.
3. Run `git status --short --branch`, `git fetch --all --prune`, resolve live `origin/main`, current branch/worktree, and recent commits.
4. Inspect every open PR and issue plus exact checks. At this handoff the only open PRs are #76 and #77, but verify again.
5. Read `LATEST_SESSION.md`, `CURRENT_STATE.md`, `NEXT_STEPS.md`, `SESSION_HANDOFF.md`, `UNFINISHED_WORK.md`, `ACCOUNT_CONTEXT_CHECKLIST.md`, and the Phase 10A2 working state from PR #76.
6. Compare docs with live state. Repair stale docs when the difference matters.

## Reconciled live state before this documentation commit

- `main`: `fe4dd20d7b777ee3f6f4c28b80ead4834438ed88`
- issue #79: OPEN
- PR #76: OPEN, draft, Phase 10A2 branch
- PR #76 current documentation head: `368dee1` (fetch the full live SHA)
- PR #76 executable/security-hardening merge head after PR #120: `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`
- PR #77: OPEN, draft, head `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`, stacked on #76
- PR #119: merged only into #76 as `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`
- PR #120: merged only into #76 as `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`
- production domain: `https://scopeforge.dev`
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- never confuse it with Job Command Center Supabase `xwsergbpvkcsugexssmc`

This handoff commit is documentation-only and will advance `main`; fetch the live tip instead of assuming `fe4dd20...` remains current.

## Work completed in this continuation - PR #119

A targeted Phase 10A2 audit found a fail-closed capability-expiry defect in `packages/worker-supervisor/repository-scan-download.ts`.

`downloadRepositoryScanArtifact()` parsed `descriptor.expiresAt` but did not reject an already elapsed capability before starting the R2 GET. An expired signed descriptor could reach `fetch()` and rely on R2 to reject it.

TDD evidence:

- test-only RED head: `24c6f442c946fa1a676f7c79c401638c0f391895`
- RED CI: `35054474634`
- RED result: 401/402 test files and 1,791/1,792 tests passed; the sole failure was the new regression because the promise resolved instead of rejecting
- exact GREEN head: `9658a652f1e5416475489f9971da13409e5319d9`
- GREEN CI: `35054754370`
- GREEN result: install, audit, full tests, typecheck, CLI build/version, both scanner benchmarks, optimized app build, CSP browser smoke, production UI diagnostic, and artifact step all passed
- Vercel status for the exact GREEN head passed
- PR #119 merged into the Phase 10A2 branch only as `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

Minimal fix: reject a non-finite or elapsed `expiresAt` synchronously before the first R2 request. No production schema, provider state, runtime gate, secret, membership, or Phase 10A3 state changed.

Do not redo PR #119 unless new evidence shows a regression.

## Work completed in this continuation - PR #120

A full security diff review of the 34 Phase 10A2 source files found one medium-severity, high-confidence CWE-664 resource-lifetime defect. Private snapshot execution used the supervisor's detachable abort wrapper, so a deadline, cancellation request, or lost lease could finalize the attempt while private repository processing or upload work was still running.

TDD and exact-candidate evidence:

- test-only RED head: `a88ab371628f3262f881243f117818f67fdddda4`
- Linux RED CI: `35067132487`; the intended assertion proved trusted finalization ran before the held-open private executor settled
- exact GREEN head: `05b7959e61902d2916b4ba4e1166421b599d9f67`
- GREEN CI: `35067478620`
- local focused suite: 14 passed; local typecheck passed
- CI passed audit, full tests, typecheck, CLI build/version, both benchmarks, Next build, CSP browser smoke, production V5/Turnstile diagnostic, and artifact handling
- exact-head Vercel deployment passed
- PR #120 merged into the Phase 10A2 branch only as `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`

Minimal fix: private snapshot execution now uses the existing drain-on-abort path for resource-owning execution classes. Trusted finalization waits until the executor settles and releases its process/source/scratch/upload lifetime. No migration, runtime gate, provider authorization, membership, or production state changed.

Do not redo PR #120 unless new evidence shows a regression.

## Hard release gate - issue #79

Positive GitHub App owner/admin acceptance is complete. PR #118 is also released and created a legitimate collaborator path: the designated collaborator is a member of Brian's workspace and owner of a separate workspace.

The legitimate normal-member production canary completed on 2026-09-16 through the normal product UI:

- authenticated `214nsa@gmail.com` selected `Brian's workspace`
- the dashboard identified the active role as `Member`
- `/dashboard/integrations/github` rendered `GitHub integration unavailable` and `Workspace owner or admin access is required.`
- no Connect GitHub control was available

Exactly one authenticated production browser canary remains:

1. authorized owner/admin normal signed flow with a different valid GitHub installation ID must be rejected because the installation does not belong to the authorized connection/workspace

Do not satisfy the remaining #79 canary with forged callback state, fabricated membership, direct production role mutation, owner downgrade, weakened authorization, or unit/CI evidence. If the real canary finds a defect, remediate before Phase 10A2 release work.

The member canary passed with direct authenticated production browser evidence. #79 remains open only for the owner/admin wrong-valid-installation rejection.

## Strict release order

Preserve this sequence unless live evidence proves it has legitimately advanced:

1. finish the remaining #79 owner/admin wrong-valid-installation browser canary
2. reconcile PR #76 once onto the then-current released `main`
3. run fresh exact-candidate Phase 10A2 validation
4. re-review and apply only absent reviewed Phase 10A2 migrations
5. complete private worker containment/runtime/privacy/rollback/end-to-end acceptance
6. merge and verify PR #76
7. only then reconcile PR #77 onto released Phase 10A2/main
8. run fresh Phase 10A3 validation and operational acceptance before release

Do not reconcile #76 early merely to make it current while #79 is open.

## Phase 10A2 production boundaries

The following remain intentionally unapplied:

- `supabase/migrations/20260911100000_phase_10a2_private_repository_snapshot.sql`
- `supabase/migrations/20260911110000_phase_10a2_private_project_scan_routing.sql`

PR #113 changed the first migration's private worker claim body, so the exact current migration requires re-review before production apply.

Keep these runtime gates false/absent until their own acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

`HOSTED_GITHUB_INTEGRATION_ENABLED` is separate and already active after positive provider acceptance.

## Completed work that must not be repeated

- PR #116 upload-capability expiry TOCTOU fix is released on main
- PR #117 signup/confirmation repair is released
- PR #118 workspace collaborator controls are released and deployed
- PR #113 trusted private claim workspace/asset binding is integrated into #76
- PR #114 broker authority expiry recheck is integrated into #76
- PR #115 private archive stream cleanup is integrated into #76
- PR #119 expired repository-scan download fail-closed check is integrated into #76
- PR #120 private snapshot abort drain/finalization ordering is integrated into #76
- positive owner/admin GitHub provider connect/import canary is complete
- Phase 6D real Linux/rootless-Podman containment acceptance is complete

## Branch hygiene warning

The old branch-cleanup docs claimed only four remote refs. Live GitHub on 2026-09-16 instead returned 21 branches, including several recent merged maintenance branches and Phase 10A2 temporary refs. That old four-ref statement is stale.

Do not delete from the historical manifest blindly. Re-fetch all branches, all open PRs, reachability, and worktrees before deletion. `fix/repository-scan-download-expiry-20260916` and `fix/private-supervisor-abort-drain-20260916` are known merged source branches for #119 and #120, but no branch deletion was performed in this continuation.

## External account safety

Before external writes verify non-secret identity:

- GitHub repo/owner: `LeDoNguyenTu/ScopeForge`
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- domain: `scopeforge.dev`

Never use secret values as identity proof and never paste secrets into repository files, PRs/issues, ordinary logs, browser state, or chat.

## Exact next resume point

1. Fetch live `main`, #79, #76, #77, open PR list, and branch list.
2. Confirm #79 still has exactly the one owner/admin browser canary above.
3. If a normal authenticated owner/admin browser surface and a different valid GitHub installation ID are available, execute that canary through the normal product flow without fabricating state.
4. If #79 is still externally blocked, continue only isolated regression/security/tooling work. Do not advance schema or runtime gates.
5. Any new fix must use genuine TDD RED, minimal GREEN, and exact-candidate verification.
6. Update persistent docs and PR bodies again after meaningful state changes.

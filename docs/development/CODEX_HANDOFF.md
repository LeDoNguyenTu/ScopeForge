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

- `main`: `bc6d50d5ffee782dc8aa48c8ec82c94d3fc82bd3`
- issue #79: CLOSED after both live negative authorization canaries passed
- PR #76: OPEN, draft, Phase 10A2 branch
- PR #76 current documentation head: `3439fd9095b65ddcd7e4d8bd3943ffed1766d7c6`
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

## Cleared release gate - issue #79

Positive GitHub App owner/admin acceptance is complete. PR #118 is released and supplied the legitimate normal-member path.

Both live negative canaries passed on 2026-09-16:

- `214nsa@gmail.com` selected Brian's workspace as `Member`; the GitHub integration page denied access and exposed no Connect GitHub control.
- a fresh owner-signed flow continued with a different real installation ID; GitHub authorization completed and ScopeForge terminated at `?error=installation`.
- a clean reload still showed `Connected`, `Repository access verified`, and `LeDoNguyenTu/ScopeForge`.

The GitHub App setting **Redirect on update** is enabled so an existing-installation update returns to the configured Setup URL. Repository access remains limited to `LeDoNguyenTu/ScopeForge` with read-only code/metadata permission.

No signed state, OAuth code, token, provider secret, or private key was recorded. Issue #79 is closed. This clears the provider prerequisite for Phase 10A2; it does not authorize runtime gate enablement.

## Strict release order

Issue #79 is closed. Preserve this sequence:

1. reconcile PR #76 once onto the current released `main`
2. run fresh exact-candidate Phase 10A2 validation
3. re-review and apply only absent reviewed Phase 10A2 migrations
4. complete private worker containment/runtime/privacy/rollback/end-to-end acceptance
5. merge and verify PR #76
6. only then reconcile PR #77 onto released Phase 10A2/main
7. run fresh Phase 10A3 validation and operational acceptance before release

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

1. Fetch live `main`, #76, #77, open PR/issue lists, and branch refs.
2. Inspect exact #76 and production migration state.
3. Reconcile #76 once, validate the exact candidate, re-review migrations, and proceed through controlled schema/runtime acceptance.
4. Keep private/repository runtime gates off until dedicated acceptance passes.
5. Release #77 only after #76 is released.
6. Update persistent docs and PR bodies again after meaningful state changes.

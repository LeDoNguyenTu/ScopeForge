# ScopeForge Latest Session Reconciliation

Last reconciled: 2026-09-16, Asia/Singapore

Live state wins over this document. Fetch refs/checks before acting.

## Session objective

Resume after the latest Codex work without repeating completed implementation, finish issue #79 through real production flows, and preserve the Phase 10 release boundaries.

## Live state at session start

- `main`: `fe4dd20d7b777ee3f6f4c28b80ead4834438ed88`
- issue #79: OPEN with one authenticated production browser canary outstanding at session start; CLOSED during this session
- PR #76: OPEN, draft, initial observed head `b09e03258329251361cf8d515458e0ff7d708e2c`
- PR #77: OPEN, draft, head `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`, stacked on #76
- PR #116/#117/#118 were already merged/released
- Phase 10A2/10A3 production migrations remained unapplied
- private repository snapshot/scan worker gates remained off

PR #118 materially changed #79's practical state: a legitimate collaborator path now exists. The designated collaborator is a member of Brian's workspace and owner of a separate workspace. The member canary therefore no longer requires fabricating or directly editing membership state.

## Security finding and TDD - PR #119

Audit target: `packages/worker-supervisor/repository-scan-download.ts` on the Phase 10A2 branch.

Finding: `descriptor.expiresAt` was parsed but only checked for a finite timestamp. The download worker did not reject an already elapsed signed R2 capability before starting `fetch()`.

Regression added in `tests/repository-scans/stager.test.ts`:

- expired capability must reject with `Repository scan artifact authorization is expired.`
- R2 fetch must not start
- no destination file may remain

### Genuine RED

- test-only head: `24c6f442c946fa1a676f7c79c401638c0f391895`
- CI run: `35054474634`
- result: 401/402 test files passed, 1,791/1,792 tests passed
- sole failure: the new expiry test, because the promise resolved instead of rejecting

This was accepted as genuine behavior RED, not a harness failure.

### Minimal GREEN

Implementation head: `9658a652f1e5416475489f9971da13409e5319d9`

Minimal change: fail closed when `expiresAt` is non-finite or `<= Date.now()` before the network request.

Exact-head CI `35054754370` passed:

- install
- npm audit
- full tests
- typecheck
- CLI build/version
- scanner benchmark
- benchmark matrix
- optimized app build
- CSP browser smoke
- production UI/Turnstile diagnostic
- artifact step

Vercel status for the exact GREEN head also passed.

PR #119 merged only into PR #76's branch as:

`79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

No production schema, provider state, user identity, runtime flag, webhook, or Phase 10A3 state changed.

## Full Phase 10A2 security diff and TDD - PR #120

The review covered all 34 source files changed between Phase 10A2's merge base `33d21de652f3c04aa88ebd4f122348803e59b153` and pre-fix head `d485d435b7b62132ea088dbe16caae7c1a7038ca`. One reportable issue was found: a medium-severity, high-confidence CWE-664 resource-lifetime defect in private snapshot cancellation.

`repository_snapshot_github_private_v1` used the supervisor's detachable abort wrapper. A deadline, cancellation request, or lost lease could publish a terminal result while the private executor was still reading, processing, or uploading repository data.

- test-only RED head: `a88ab371628f3262f881243f117818f67fdddda4`
- Linux RED CI: `35067132487`, failed at the intended assertion because trusted finalization ran before the held-open executor settled
- exact GREEN head: `05b7959e61902d2916b4ba4e1166421b599d9f67`
- focused local suite: 14 passed; local typecheck passed
- exact-head GREEN CI: `35067478620`, including audit, full tests, typecheck, CLI build/version, both benchmarks, Next build, CSP browser smoke, production diagnostic, and artifact handling
- exact-head Vercel deployment passed
- merge into #76: `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`

The minimal change routes private snapshot execution through the existing drain-on-abort path. No production schema, provider state, identity, runtime flag, or Phase 10A3 state changed.

## Post-merge reconciliation

After #120:

- PR #119: CLOSED/MERGED
- PR #120: CLOSED/MERGED
- PR #76: OPEN/DRAFT, documentation head `3439fd9095b65ddcd7e4d8bd3943ffed1766d7c6`, executable hardening merge `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`
- PR #77: OPEN/DRAFT, still stacked and unreleased
- `main`: unchanged before the documentation commit
- issue #79: CLOSED after both live negative authorization canaries passed

The provider prerequisite has advanced; Phase 10A2 schema and runtime acceptance have not.

## Issue #79 acceptance complete

Positive owner/admin provider acceptance is already complete. The legitimate member denial canary passed on 2026-09-16:

- authenticated `214nsa@gmail.com` selected Brian's workspace
- the dashboard rendered the active role as `Member`
- the GitHub integration page rendered `GitHub integration unavailable` and `Workspace owner or admin access is required.`
- no Connect GitHub control was available

The owner/admin negative canary also passed on 2026-09-16. A fresh signed production flow continued with a different real installation ID, completed GitHub authorization, and ScopeForge rejected it at `?error=installation`. A clean reload still showed `Connected`, `Repository access verified`, and `LeDoNguyenTu/ScopeForge`.

The GitHub App's **Redirect on update** setting is enabled so existing-installation updates return to the configured Setup URL. No signed state, OAuth code, token, provider secret, or private key was recorded. Issue #79 is closed.

## Production actions deliberately not taken

- no Phase 10A2 migration apply
- no Phase 10A3 migration apply
- no private/repository worker runtime-gate enablement
- no webhook secret/configuration change
- no provider authorization weakening
- no production identity fabrication or role mutation
- no #76/#77 reconciliation or merge

## Branch hygiene finding

Live GitHub returned 21 branches, while the previous cleanup document claimed four. The old cleanup state is therefore stale. No deletion was attempted from the stale manifest. The merged #119 and #120 source branches remain future cleanup candidates only after a fresh branch/open-PR/reachability/worktree audit.

## Next exact resume point

1. fetch live state
2. reconcile #76 exactly once onto current main and run fresh exact-candidate validation
3. review and apply only absent Phase 10A2 migrations to `tdgpibrepzcvdivztkta`
4. keep runtime gates off until dedicated private-worker operational acceptance passes
5. release #76 only after all gates pass
6. reconcile and accept #77 only after #76 releases

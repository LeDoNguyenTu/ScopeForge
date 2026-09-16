# ScopeForge Session Handoff

Last refreshed: 2026-09-16, Asia/Singapore

Use this with `CODEX_HANDOFF.md`, `CURRENT_STATE.md`, `NEXT_STEPS.md`, and `UNFINISHED_WORK.md`. Always inspect live GitHub first.

## Exact handoff state

Before this documentation commit:

- live `main`: `bc6d50d5ffee782dc8aa48c8ec82c94d3fc82bd3`
- issue #79: CLOSED after both live negative authorization canaries passed
- PR #76: OPEN/DRAFT, documentation head `3439fd9095b65ddcd7e4d8bd3943ffed1766d7c6`, executable hardening merge `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`
- PR #77: OPEN/DRAFT, head `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`
- open PR pagination showed no third open PR after #120 merged
- Phase 10A2 and Phase 10A3 production migrations remained unapplied
- private repository snapshot/scan runtime gates remained off

The docs commit itself advances main. Fetch instead of assuming the SHA above remains the current tip.

## Latest completed engineering work

PR #119, `Fail closed on expired repository scan downloads`, is complete and merged only into Phase 10A2.

Root cause:

- `downloadRepositoryScanArtifact()` parsed `descriptor.expiresAt`
- it did not reject an elapsed signed R2 capability before `fetch()`
- worker-side authorization therefore did not fail closed at time of use

TDD:

- RED head `24c6f442c946fa1a676f7c79c401638c0f391895`
- RED CI `35054474634`
- sole failure was the intended new regression, with 1,791/1,792 tests passing
- GREEN head `9658a652f1e5416475489f9971da13409e5319d9`
- GREEN CI `35054754370` fully passed
- Vercel exact-head status passed
- merge into #76: `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

Minimal fix: reject non-finite or elapsed `expiresAt` before the first network request.

PR #120, `Drain private snapshot execution before cancellation finalization`, is also complete and merged only into Phase 10A2.

- root cause: the private snapshot execution class detached immediately on abort, allowing trusted finalization to race repository processing/upload cleanup
- RED head `a88ab371628f3262f881243f117818f67fdddda4`, Linux RED CI `35067132487`
- GREEN head `05b7959e61902d2916b4ba4e1166421b599d9f67`, GREEN CI `35067478620`
- audit, full tests, typecheck, CLI build/version, both benchmarks, Next build, browser smoke, production diagnostic, and exact-head Vercel passed
- merge into #76: `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`

Minimal fix: use the existing drain-on-abort path so finalization waits for the private executor to settle and release its owned resources.

## Do not repeat completed work

- PR #116 upload expiry TOCTOU hardening is released on main
- PR #117 signup confirmation repair is released
- PR #118 workspace collaborator controls are released and deployed
- PR #113/#114/#115 hardening is integrated into #76
- PR #119 download-expiry hardening is integrated into #76
- PR #120 private snapshot abort-drain hardening is integrated into #76
- positive owner/admin GitHub App canary is complete
- Phase 6D real Linux/rootless-Podman acceptance is complete

## Issue #79 acceptance complete

Both live negative canaries passed on 2026-09-16. The legitimate member was denied Connect GitHub. The owner/admin flow used a fresh signed state and a different real installation ID; GitHub authorization completed and ScopeForge rejected it at `?error=installation`. A clean reload still rendered `Connected`, `Repository access verified`, and `LeDoNguyenTu/ScopeForge`.

The GitHub App's **Redirect on update** setting is enabled so existing-installation updates return to the configured Setup URL. No signed state, OAuth code, token, secret, or private key was recorded. Issue #79 is closed.

## Unsafe actions deliberately not taken

- no fabricated production identity/membership
- no owner role downgrade
- no forged callback state
- no authorization weakening
- no Phase 10A2/10A3 migration apply
- no private/repository runtime enablement
- no webhook secret/configuration change
- no #76 or #77 release/reconciliation

## Exact resume procedure

1. Read root `AGENTS.md`.
2. Fetch/prune and inspect current worktree/status.
3. Resolve live `origin/main`.
4. Inspect PR #76, PR #77, all newer/open PRs/issues, exact heads and checks.
5. Compare against persistent docs. Live state wins.
6. Reconcile #76 exactly once to current released main and fresh-validate the exact candidate.
7. Re-review and apply only absent reviewed Phase 10A2 migrations to `tdgpibrepzcvdivztkta`.
8. Keep runtime gates off until private-worker containment, rollback, privacy, and end-to-end acceptance pass.
9. Release #76 only when all gates pass.
10. Reconcile/release #77 only after #76.

## Branch hygiene

A fresh GitHub listing returned 21 branches, not the four claimed by the old cleanup snapshot. Do not delete based on the old manifest. A fresh open-PR/reachability/worktree audit is required first. The source branches `fix/repository-scan-download-expiry-20260916` and `fix/private-supervisor-abort-drain-20260916` are known to back merged PRs #119 and #120, but no deletion was performed here.

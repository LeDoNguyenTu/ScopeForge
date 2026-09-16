# ScopeForge Branch Cleanup Candidates

Last live audit: 2026-09-16, Asia/Singapore

This is a reconciliation record, not deletion authorization. Always re-fetch branches, open PRs, reachability, and local worktrees immediately before deleting refs.

## Live state observed

GitHub returned **21 remote branches**. This supersedes the older claim that only four refs remained.

Only two PRs remain open after PR #119 merged:

- PR #76: `feat/phase-10a2-private-repository-acquisition`
- PR #77: `feat/phase-10a3-github-webhook-reconciliation`

Open-PR pagination page 3 with one result per page was empty, confirming there was no third open PR at this checkpoint.

Observed branch set:

- `chore/refresh-compatible-dependencies`
- `demo/portfolio-20260910`
- `docs/mobile-session-handoff-20260915`
- `docs/session-reconciliation-20260915`
- `feat/phase-10a2-private-repository-acquisition`
- `feat/phase-10a3-github-webhook-reconciliation`
- `feat/workspace-collaborator-controls-20260916`
- `fix/ci-production-webdriver-isolation-20260915`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp2`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp3`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp4`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp5`
- `fix/phase-10a2-broker-authority-expiry-20260915`
- `fix/phase-10a2-private-claim-binding-20260915`
- `fix/phase-10a2-private-stream-cleanup-20260915`
- `fix/repository-scan-download-expiry-20260916`
- `fix/repository-upload-expiry-toctou-20260915`
- `fix/signup-confirmation-flow-20260916`
- `main`
- `test/github-connection-reauthorization-20260915`

## Must retain without further question

- `main`
- `feat/phase-10a2-private-repository-acquisition` - open draft PR #76
- `feat/phase-10a3-github-webhook-reconciliation` - open draft PR #77
- `demo/portfolio-20260910` - intentional demo/portfolio ref
- any branch backing a new open PR created after this audit
- any branch attached to an active local worktree at deletion time

## Known merged/superseded candidates requiring final pre-delete verification

The following have strong live-history reasons to be cleanup candidates, but no deletion was performed in this continuation:

- `fix/repository-scan-download-expiry-20260916` - PR #119 merged into #76 as `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`
- `feat/workspace-collaborator-controls-20260916` - PR #118 merged/released
- `fix/signup-confirmation-flow-20260916` - PR #117 merged/released
- `fix/repository-upload-expiry-toctou-20260915` - PR #116 merged/released
- `fix/phase-10a2-private-claim-binding-20260915` - PR #113 integrated into #76
- `fix/phase-10a2-broker-authority-expiry-20260915` - PR #114 integrated into #76
- `fix/phase-10a2-private-stream-cleanup-20260915` - PR #115 integrated into #76
- the five `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp*` refs - historical temporary reconciliation refs; verify they are not active worktrees before deletion

The remaining maintenance/docs/test refs also require fresh merged/reachability and worktree verification before deletion. Do not infer safety only from their names.

## Required cleanup procedure

1. Fetch `main`, all branches, and all open PR pages.
2. Inspect `git worktree list` and local branch state in the actual checkout.
3. For each candidate, prove at least one reviewed preservation path: merged PR, tip reachable from a retained ref, or explicitly superseded/closed work whose commits remain reachable.
4. Preserve all active PR heads, active worktree branches, intentional demo refs, and current task branches.
5. Delete refs only through a genuine delete-ref operation. Never simulate deletion by force-moving or repointing a branch.
6. Re-fetch the complete branch list after deletion.
7. Record exact deleted refs, retained refs, final count, and any exceptions in `LATEST_SESSION.md` and `SESSION_HANDOFF.md`.

## Latest-work cleanup note

PR #119 is merged, but its source branch was intentionally left in place because this chat did not have a reviewed delete-ref action exposed and the broader manifest was already stale. That is safer than attempting partial cleanup from outdated assumptions.

Branch hygiene does not change the release sequence and never clears issue #79 or authorizes Phase 10A2/10A3 production actions.

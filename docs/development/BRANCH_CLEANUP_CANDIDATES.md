# ScopeForge Branch Cleanup Candidates

Last live audit: 2026-09-22, Asia/Singapore.

This is a deletion manifest, not a substitute for a real delete-ref operation. The current ChatGPT GitHub integration can prove reachability but does not expose branch deletion, so no refs were deleted in this reconciliation.

## Current rule

Before deleting any branch:

1. fetch/prune the repository
2. inspect open PRs
3. inspect local worktrees
4. prove the branch tip is reachable from a retained ref, preferably `main`
5. preserve `main`, active PR heads, active worktree branches, and intentional long-lived refs
6. delete only with a genuine delete-ref operation
7. re-fetch branches after deletion

Do not simulate deletion by force-moving a branch.

## Verified safe-delete candidates

The following branches were compared directly against current `main` on 2026-09-22. For each one, GitHub reported the branch tip as the merge base, with `main` ahead and the branch having zero commits not reachable from `main`.

- `docs/active-agent-resume-20260921`
- `docs/admin-auth-release-evidence-20260921`
- `docs/phase11-live-reconcile-20260921b`
- `docs/phase11-roadmap-reconcile-20260921`
- `docs/phase11-stable-baseline-20260921`
- `docs/post-fk-hardening-state-20260921`
- `docs/production-advisor-reconciliation-20260921`
- `fix/admin-auth-telemetry-20260921`
- `fix/findings-human-readable-ui-20260921`
- `fix/phase11-running-preparation-20260921`
- `fix/phase11-unix-socket-path-length-20260921`
- `ops/phase11-single-codex-acceptance-evaluator-20260922`
- `ops/phase11-single-codex-close-prep-20260922`
- `ops/phase11-single-codex-preflight-20260922`
- `perf/fk-index-hardening-20260921`
- `feat/phase11-final-validation-gates`
- `feat/phase11-production-canary-control-20260920`
- `feat/phase11-task12-web-api-discovery`
- `feat/phase11-task13-session-browser`
- `feat/phase11-task14-proof-validation`

These are safe from a remote-reachability perspective. A Codex/local cleanup still must check `git worktree list` immediately before deletion.

## Intentionally not classified here

This manifest does not declare every other remote branch safe. The repository still contains older Phase 10, Phase 11, demo, dependency, test, temporary reconciliation, and maintenance branches.

In particular, preserve until separately reviewed:

- `demo/portfolio-20260910`
- `chore/refresh-compatible-dependencies`
- any branch with local unmerged work
- any branch attached to a worktree
- any branch backing an open PR created after this audit

The final Phase 11 Codex run may delete the verified list above in one batch after successful closure if it has a genuine delete-ref capability and the worktree/open-PR recheck is clean.

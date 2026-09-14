# ScopeForge Branch Cleanup Candidates

Last reconciled: 2026-09-14 (Asia/Singapore)

This is the historical branch-cleanup manifest from the 2026-09-13 audit, not a current deletion list. It is intentionally documentation-only and does not authorize rewriting, force-moving, or repointing refs.

## Audited repository state

Audit baseline:

- `main`: `4c65c1f179653f4a478e22ac4069ad004017c68f`
- total live branches: **60**
- branch-list page 2 with `per_page=100`: empty
- open PRs: exactly **2**
  - PR #76: `feat/phase-10a2-private-repository-acquisition`
  - PR #77: `feat/phase-10a3-github-webhook-reconciliation`
- open-PR page 3 with `per_page=1`: empty

2026-09-14 reconciliation: a fresh audit found 68 remote branches. The authenticated local Git CLI deleted 31 refs whose live tips exactly matched merged PR heads and were not attached to local worktrees. A post-delete fetch returned 37 branches. The two open PR heads, intentional/demo state, active local-worktree refs, and 31 ambiguous historical refs were retained. Never simulate deletion by force-moving refs.

The historical lists below explain the original audit but are no longer an executable deletion manifest. Before any further deletion, re-read live refs, open PRs and worktrees and reconcile the retained historical branch individually.

Deleting a branch ref does not delete commits that are already reachable from merged history or another retained branch. The list below classifies refs only.

## Retain - 4 branches

Do not delete these refs:

- `main` - production integration branch
- `feat/phase-10a2-private-repository-acquisition` - active draft PR #76
- `feat/phase-10a3-github-webhook-reconciliation` - active draft PR #77, stacked behind Phase 10A2
- `demo/portfolio-20260910` - intentional portfolio/demo branch, outside engineering cleanup

## Safe to delete - 56 branches

No branch below is the head of an open PR. They are merged, superseded, closed, diagnostic/preview-only, or temporary historical refs whose work is preserved by `main`, PR #76, PR #77, or repository history.

### Completed maintenance and release branches

- `chore/ci-doc-runtime-alignment` - PR #90 merged; Node 24 public CI example now released
- `chore/main-runtime-tooling-alignment` - PR #88 merged into `main`
- `chore/node24-runtime-alignment` - PR #83 merged into the retained Phase 10A3 branch
- `chore/vitest-config-esm` - PR #84 merged into the retained Phase 10A3 branch
- `docs/csp-v5-restoration-release-state` - merged PR #68
- `docs/current-handoff-cleanup` - merged PR #69
- `docs/phase-9d-release-state` - merged PR #63
- `docs/phase-9e-release-state` - merged PR #65
- `docs/pr90-release-state` - PR #91 merged into `main`
- `docs/runtime-tooling-release-state` - PR #89 merged into `main`
- `feat/admin-ui-responsive-control-plane` - PR #87 merged into `main`
- `feat/command-center-ui-v4` - merged PR #49; historical branch name for the V5 integration
- `feat/phase-9b-provider-edge-hardening-v1` - merged PR #60
- `feat/phase-9c-database-rpc-hardening-v1` - merged PR #59
- `feat/phase-9e-incident-release-engineering-v1` - merged PR #64
- `feat/phase-10a-github-connected-projects` - merged/released PR #74
- `feat/phase-10c-platform-admin-console` - merged PR #75
- `feat/strict-csp-compatibility-v1` - merged PR #66
- `fix/phase-10a3-superseded-head-recovery` - PR #86 merged into retained PR #77; implementation remains in the Phase 10A3 branch
- `fix/restore-approved-command-center-v3` - merged PR #71
- `fix/restore-approved-v5-ui` - merged PR #67
- `fix/turnstile-visible-ui-production-v5` - merged PR #70
- `reconcile/phase-9d-v5-main` - merged PR #62
- `revert/pr49-ui-only` - merged PR #73

### Explicitly superseded or closed work

- `design/phase-7-security-packs-v1` - PR #53 superseded by merged PR #54
- `feat/phase-9d-security-telemetry-browser-hardening-v1` - PR #61 superseded by merged reconciliation PR #62
- `revert/pre-pr49-baseline` - closed PR #72, explicitly DO NOT MERGE
- `docs/phase-10a2-design-staging` - temporary/empty Phase 10A2 staging ref; not an implementation baseline

### Historical design, diagnostic, preview, restoration, and temporary refs

- `design/command-center-ui-v4`
- `design/strict-csp-compatibility-v1`
- `diag/v5-poster-red`
- `diag/v5-reference-live-capture`
- `diag/v5-release-gates`
- `diag/v5-release-gates-actual`
- `diag/v5-release-gates-final`
- `diag/v5-release-gates-once`
- `diag/v5-release-gates-run`
- `diag/v5-release-gates-working`
- `feat/phase-6d-network-workers-v1-task9`
- `fix/phase-6b-snapshot-runtime-gate`
- `fix/restore-approved-v5-ui-canonical`
- `fix/restore-approved-v5-ui-final`
- `fix/restore-approved-v5-ui-impl`
- `fix/restore-approved-v5-ui-mainline`
- `fix/restore-approved-v5-ui-red`
- `fix/restore-approved-v5-ui-work`
- `fix/snapshot-runtime-gate-launch`
- `preview/command-center-v5-1-citadel`
- `preview/command-center-v5-1-citadel-safety`
- `preview/command-center-v5-1-citadel-spec`
- `preview/command-center-v5-reference-rebuild`
- `preview/command-center-v5-reference-rebuild-red`
- `preview/command-center-v5-reference-rebuild-work`
- `preview/command-center-v5-visual-review-20260901`
- `reconcile/command-center-ui-v5-main`
- `test/restore-approved-v5-ui-red`

## Required deletion procedure

When a genuine delete-ref surface becomes available:

1. Re-fetch `main`, the full branch list, and all open PRs immediately before deletion.
2. Preserve the four **Retain** refs above and any newly created branch that backs a new open PR or active task.
3. Delete only refs still present in the **Safe to delete** list.
4. Do not force-move or repoint any branch as a substitute for deletion.
5. Re-fetch the complete branch list after deletion.
6. Expected branch count is **4** if no new branch has been created in the meantime.
7. Record the actual deleted refs, retained refs, and final branch count in the session handoff.

Expected ideal branch set after cleanup, assuming no new work has started:

```text
main
feat/phase-10a2-private-repository-acquisition
feat/phase-10a3-github-webhook-reconciliation
demo/portfolio-20260910
```

## Release sequencing remains unchanged

Branch cleanup is repository hygiene only. It does not clear issue #79, does not authorize Phase 10A2/10A3 migrations, and does not enable any hosted worker/runtime flag. The required release order remains #79 negative production canaries -> Phase 10A2 PR #76 operational acceptance/release -> Phase 10A3 PR #77 reconciliation and operational acceptance/release.

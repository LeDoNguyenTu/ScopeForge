# ScopeForge Branch Cleanup Candidates

Last reconciled: 2026-09-12 (Asia/Singapore)

## Tooling limitation

The connected GitHub write surface currently exposes branch creation/update but **no genuine delete-ref operation**. Do not simulate deletion by force-moving stale refs to `main`.

This file is the authoritative cleanup manifest until a real branch-delete surface is available. At this reconciliation point Phase 10A1 PR #74 is merged/released, while PR #76 and PR #77 remain the active stacked implementation branches.

## Retain

These branches must not be deleted:

- `main` - production integration branch
- `feat/phase-10a2-private-repository-acquisition` - active PR #76; Phase 10A2 private repository acquisition
- `feat/phase-10a3-github-webhook-reconciliation` - active PR #77 stacked on Phase 10A2; retain until Phase 10A3 is released or explicitly superseded
- `demo/portfolio-20260910` - intentional portfolio/demo branch; not part of completed engineering cleanup

## Safe cleanup candidates - completed/merged release branches

These are historical heads for work already integrated/superseded by current `main`:

- `docs/csp-v5-restoration-release-state` - merged PR #68
- `docs/current-handoff-cleanup` - merged PR #69
- `docs/phase-9d-release-state` - merged PR #63
- `docs/phase-9e-release-state` - merged PR #65
- `feat/command-center-ui-v4` - merged PR #49; historical V5 integration branch despite the legacy branch name
- `feat/phase-9b-provider-edge-hardening-v1` - merged PR #60
- `feat/phase-9c-database-rpc-hardening-v1` - merged PR #59
- `feat/phase-9e-incident-release-engineering-v1` - merged PR #64
- `feat/phase-10a-github-connected-projects` - merged/released PR #74; Phase 10A1 now lives on `main`
- `feat/phase-10c-platform-admin-console` - merged PR #75; verified branch head is contained by `main`
- `feat/strict-csp-compatibility-v1` - merged PR #66
- `fix/restore-approved-command-center-v3` - merged PR #71
- `fix/restore-approved-v5-ui` - merged PR #67
- `fix/turnstile-visible-ui-production-v5` - merged PR #70
- `reconcile/phase-9d-v5-main` - merged PR #62
- `revert/pr49-ui-only` - merged PR #73

## Safe cleanup candidates - explicitly superseded/closed work

These branches must not become implementation baselines and may be deleted:

- `design/phase-7-security-packs-v1` - PR #53 explicitly superseded by merged PR #54
- `feat/phase-9d-security-telemetry-browser-hardening-v1` - PR #61 superseded by merged/reconciled PR #62
- `revert/pre-pr49-baseline` - PR #72 explicitly closed as **DO NOT MERGE** because it would remove later security work
- `docs/phase-10a2-design-staging` - accidental empty staging ref created from the frozen #74 head on 2026-09-11; no work was committed to it

## Safe cleanup candidates - historical design/diagnostic/preview/reconciliation refs

Current release documentation declares V4, preview, diagnostic, temporary restoration and old reconciliation branches non-authoritative. No open PR uses these refs.

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

## Deletion procedure when a genuine delete-ref operation becomes available

1. Refresh the complete branch list and open PR list.
2. Preserve every branch in **Retain** and any newly opened PR head.
3. For each candidate above, confirm no newer PR or release document has promoted it back to an active baseline.
4. Delete the candidate refs using a genuine Git ref deletion operation.
5. Refresh branch list after deletion and confirm only intended active/special branches remain.
6. Do not rewrite, force-move, or repoint stale branch refs as a substitute for deletion.

Expected ideal branch set after cleanup, assuming no new work has started:

```text
main
feat/phase-10a2-private-repository-acquisition
feat/phase-10a3-github-webhook-reconciliation
demo/portfolio-20260910
```

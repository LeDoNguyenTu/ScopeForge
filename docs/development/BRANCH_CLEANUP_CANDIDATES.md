# ScopeForge Branch Cleanup Candidates

Last live audit: 2026-09-22, Asia/Singapore.

This is a reviewed deletion manifest. It is not a substitute for checking local worktrees immediately before deletion.

At this audit, GitHub exposed 83 remote refs before PR #178 merged. Every non-main branch was classified by direct comparison against `main`.

Cleanup execution on 2026-09-23 rechecked zero open PRs, fetched/pruned refs, and inspected every active worktree. It deleted 56 manifest branches that remained fully reachable from `main` and were not attached to a worktree, plus two run-created merged source branches after their PRs landed. Thirteen safe manifest branches remain protected by active worktrees. All diverged, intentional, and post-audit branches were preserved. Remote refs decreased from 88 to 31, including `origin/HEAD`.

## Summary

- 69 branches below are fully reachable from `main` and have zero unique commits from a remote-reachability perspective.
- 12 branches are genuinely diverged and are explicitly excluded from deletion.
- `demo/portfolio-20260910` is intentionally retained.
- `main` is retained.

PR #178's source branch is included in the safe set because it was rechecked after merge and its tip is the merge base with `main` ahead.

The current ChatGPT GitHub connector does not expose genuine ref deletion. Do not simulate deletion by force-moving refs.

## Required local pre-delete check

Before batch deletion:

1. fetch/prune
2. confirm there is no open PR backed by a candidate
3. run `git worktree list`
4. remove any branch attached to an active worktree from the deletion command
5. preserve `main`, the intentional demo ref, and every diverged branch below
6. delete only with a genuine branch/ref deletion operation
7. fetch/prune again and record the final branch list

## Reviewed safe-delete set - 69 branches

- `chore/final-pre-codex-maintenance-20260922`
- `chore/refresh-compatible-dependencies`
- `chore/vercel-hobby-deployment-budget-20260918`
- `docs/active-agent-resume-20260921`
- `docs/admin-auth-release-evidence-20260921`
- `docs/phase11-codex-handoff-20260921`
- `docs/phase11-live-reconcile-20260921b`
- `docs/phase11-roadmap-reconcile-20260921`
- `docs/phase11-stable-baseline-20260921`
- `docs/phase-11-task9-release-handoff`
- `docs/phase-11-task10-provider-review-20260918`
- `docs/phase-11-task11-handoff-20260918`
- `docs/phase-11-task11-labeled-handoff-20260918`
- `docs/phase-11-task11-matrix-handoff-20260918`
- `docs/phase-11c-linux-acceptance-20260919`
- `docs/post-fk-hardening-state-20260921`
- `docs/production-advisor-reconciliation-20260921`
- `docs/reconcile-phase11-production-state-20260919`
- `docs/session-reconciliation-20260915`
- `docs-phase11-pr164-reconcile-20260921`
- `feat/phase11-final-validation-gates`
- `feat/phase11-production-canary-control-20260920`
- `feat/phase11-task12-web-api-discovery`
- `feat/phase11-task13-session-browser`
- `feat/phase11-task14-proof-validation`
- `feat/phase11-task15-continuous-validation`
- `feat/phase-10a2-private-repository-acquisition`
- `feat/phase-10a3-github-webhook-reconciliation`
- `feat/phase-11-task10-httpx-adapter-20260918`
- `feat/phase-11-task11-adaptive-harness-20260918`
- `feat/phase-11-task11-evaluation-matrix-20260918`
- `feat/phase-11-task11-labeled-fixtures-20260918`
- `feat/phase-11-task11-legal-labs-20260920`
- `feat/phase-11a-run-orchestration-20260918`
- `feat/phase-11c-http-runtime-clean-20260918`
- `feat/phase-11c-http-worker-control-20260919`
- `feat/phase-11c-provider-foundation-main-20260918`
- `feat/phase-11c-result-coverage-reconciliation-20260919`
- `feat/phase-11c-runtime-image-candidate-20260919`
- `feat/phase-11c-worker-enablement-config-20260919`
- `feat/workspace-collaborator-controls-20260916`
- `fix/admin-auth-telemetry-20260921`
- `fix/ci-production-webdriver-isolation-20260915`
- `fix/findings-human-readable-ui-20260921`
- `fix/phase10a3-runtime-gate-watermark-20260916`
- `fix/phase10a3-unsupported-event-202-20260916`
- `fix/phase11-mediator-runtime-directory`
- `fix/phase11-running-preparation-20260921`
- `fix/phase11-unix-socket-path-length-20260921`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp2`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp3`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp4`
- `fix/phase-10a2-broker-authority-expiry-20260915-reconciled-temp5`
- `fix/phase-10a2-broker-authority-expiry-20260915`
- `fix/phase-10a2-private-claim-binding-20260915`
- `fix/phase-10a2-private-stream-cleanup-20260915`
- `fix/private-supervisor-abort-drain-20260916`
- `fix/repository-scan-download-expiry-20260916`
- `fix/repository-upload-expiry-toctou-20260915`
- `fix/signup-confirmation-flow-20260916`
- `fix/worker-runtime-dir-20260916`
- `ops/phase11-production-canary-evidence-20260920`
- `ops/phase11-scopeforge-verification-20260920`
- `ops/phase11-single-codex-acceptance-evaluator-20260922`
- `ops/phase11-single-codex-close-prep-20260922`
- `ops/phase11-single-codex-preflight-20260922`
- `perf/fk-index-hardening-20260921`
- `test/github-connection-reauthorization-20260915`

## Preserve - diverged branches

These branches have commits not reachable from current `main`. They were intentionally not classified as safe-delete:

- `docs/mobile-session-handoff-20260915`
- `docs/phase11-operational-release-runbook-20260919`
- `docs/phase-11-autonomous-security-validation-20260917`
- `feat/phase-11-task11-graph-policy-fixtures-20260918`
- `feat/phase-11a-persistence-20260918`
- `feat/phase-11a-planning-core-20260918`
- `feat/phase-11a-planning-persistence-20260918`
- `feat/phase-11b-planning-persistence-20260918`
- `feat/phase-11c-http-discovery-runtime-20260918`
- `feat/phase-11c-http-discovery-runtime-main-20260918`
- `feat/phase-11c-provider-foundation-20260918`
- `test/phase11-task11-legal-labs-20260920`

In particular, `docs/mobile-session-handoff-20260915` contains two unique historical phone-session handoff commits. Its content is obsolete as current guidance, but its commits are not silently discarded.

## Preserve - intentional refs

- `main`
- `demo/portfolio-20260910`

## Future rule

New branches created after this audit are not automatically safe. Re-run reachability, open-PR, and worktree checks before deleting them.

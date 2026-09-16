# Post-Codex live reconciliation - 2026-09-16

This record captures the live repository reconciliation performed after the latest Codex implementation. Live GitHub/provider evidence always supersedes embedded SHAs below.

## Live repository state

- Repository: `LeDoNguyenTu/ScopeForge`.
- Latest observed `main` commit before this documentation commit: `b1a56ae7165482a4a42a994747b0791d998e48d1` (`docs: record collaborator controls release acceptance [skip ci]`).
- Latest executable merge on `main`: `d0a2521879fb76d5a7b2c013add11536f0dc3fd4`, PR #118 `Add workspace collaborator controls`.
- PR #116 is already merged and released on `main` as `a956e4b305a25d1e074e7b4bc2120a87b48d5050`; do not repeat the old upload-expiry TDD work.
- PR #117 signup confirmation repair is merged as `12a2609458d8b4c7369e2bb7d4926dd686a84769`.
- PR #118 collaborator controls are merged, deployed, and documented in `WORKSPACE_COLLABORATOR_CONTROLS_ACCEPTANCE.md`.
- Open release branches remain PR #76 Phase 10A2 and PR #77 Phase 10A3.

## What Codex completed since the older handoff

The old immediate-task wording around PR #116 is historical. Live commits and acceptance records prove that the repository advanced substantially:

1. PR #116 completed the signed upload-capability expiry recheck and merged to `main`.
2. The positive GitHub provider connection/import path was completed and documented.
3. PR #117 repaired signup and confirmation outcomes and merged.
4. PR #118 added owner/admin workspace collaborator controls, active-workspace selection, member/viewer management, and the production migration needed to create a legitimate normal-member acceptance path.
5. PR #118 exact-head CI `35041678098` and post-merge CI `35042019694` are recorded as successful in `WORKSPACE_COLLABORATOR_CONTROLS_ACCEPTANCE.md`.

Do not redo these completed tasks unless new evidence demonstrates a regression.

## Current hard release gate

Issue #79 remains open. The positive owner/admin provider canary is complete. Two authenticated production negative canaries remain:

1. an authorized owner/admin must exercise the normal signed flow with a different valid GitHub installation ID and ScopeForge must reject it because it does not belong to the authorized connection/workspace;
2. the designated legitimate normal member must sign in normally, select Brian's workspace, attempt Connect GitHub, and be denied initiation/completion by the existing authorization boundary.

PR #118 materially improved the second canary's prerequisites: a designated collaborator now exists as a `member` of Brian's workspace while remaining `owner` of a separate workspace. However, the member's own authenticated production browser session is still required. Database membership, unit tests, owner sessions, forged state, role downgrades, or synthetic callbacks are not substitutes for this canary.

The unrelated-installation canary still requires a different valid GitHub installation ID through the normal signed application flow. Do not forge callback state or mutate provider identity solely to manufacture acceptance.

## Phase 10A2 and 10A3 state

- PR #76 is still open and draft at observed head `b09e03258329251361cf8d515458e0ff7d708e2c`. It must not be merged or reconciled merely for freshness while #79 remains open.
- PR #77 is still open and draft at observed head `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`, stacked on Phase 10A2. Its PR body contains older embedded SHAs, so use the live head.
- Phase 10A2 and Phase 10A3 production migrations remain intentionally unapplied according to the latest acceptance record.
- Private repository snapshot, repository scan, passive worker, and active CORS worker runtime gates remain default-off until their independent operational acceptance.

Strict release order remains:

`issue #79 -> PR #76 Phase 10A2 -> PR #77 Phase 10A3`

## Safe work performed in this reconciliation

No production authorization, provider identity, Supabase schema, runtime flag, webhook secret, or release branch executable code was changed. The correct next release action requires authenticated production browser evidence that is not safely reproducible from repository-only automation.

Because #79 is an explicit operational security gate, this reconciliation intentionally did not bypass it and did not prematurely reconcile or release #76/#77.

## Exact next resume point

1. Fetch live `main`, #79, #76, #77, and any newer PRs/issues first.
2. Read `WORKSPACE_COLLABORATOR_CONTROLS_ACCEPTANCE.md` before historical #79 wording.
3. If the designated member has completed the normal authenticated member Connect GitHub denial canary, record the browser evidence on #79.
4. Complete the separate different-valid-installation-ID negative canary through the normal signed flow.
5. Only when both #79 canaries genuinely pass, close #79 and reconcile #76 once onto current released `main`.
6. Run fresh exact-candidate validation for #76, then re-review/apply only absent Phase 10A2 migrations and complete private-worker operational acceptance before release.
7. Release #77 only after released Phase 10A2, fresh reconciliation, exact validation, reviewed migrations, webhook configuration, and full operational canaries.

## Safety reminders

- ScopeForge Supabase is `tdgpibrepzcvdivztkta`; never use Job Command Center project `xwsergbpvkcsugexssmc`.
- Do not expose provider credentials or presigned private capabilities.
- Do not rewrite deployed migrations.
- Do not enable unaccepted hosted runtime gates.
- Do not weaken auth or fabricate production identities/state to clear #79.
- Historical Phase 6D Task 15 Linux/rootless-Podman acceptance is complete and should not be repeated as generic setup work.

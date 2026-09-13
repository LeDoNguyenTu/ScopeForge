# ScopeForge Current State

Last reconciled: 2026-09-13 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `33d21de652f3c04aa88ebd4f122348803e59b153`
- released baseline includes Phase 10A1 GitHub connected-projects core, default-off worker/runtime gates, the accepted command-center presentation, platform administration, and the prior security-hardening phases
- production domain: `https://scopeforge.dev`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`

The released `main` tree remains authoritative until a later PR is merged and production-verified.

## Responsive admin control-plane work

The current UI work is isolated from Phase 10A2/10A3 backend behavior:

- branch: `feat/admin-ui-responsive-control-plane`
- PR: #87 - Responsive admin control plane and GitHub UI
- approved design: `docs/superpowers/specs/2026-09-13-responsive-admin-control-plane-design.md`
- implementation plan: `docs/superpowers/plans/2026-09-13-responsive-admin-control-plane.md`
- latest implementation head before this documentation checkpoint: `6dbc272372bd3431ebb6a580d74b5355bace5dbe`

Implemented UI work includes:

- dedicated responsive platform-admin navigation with pathname-aware active state;
- compact desktop admin rail and purpose-built phone navigation rather than the former five-wide horizontal strip;
- mobile record cards for Users, Workspaces and Audit while preserving dense desktop tables;
- richer Overview hierarchy and reusable admin header/metric components;
- grouped Settings composition with separated operational caution/provider-owned controls;
- first-class responsive GitHub connected-project screen and repository cards;
- preview-only synthetic admin fixture covering Overview, Users, Workspaces, Audit, Settings and GitHub states;
- browser acceptance at 390 px, 430 px and desktop widths with document-overflow, clipped-control, mobile-navigation, mobile-card and GitHub-action assertions;
- screenshot output for representative phone and desktop states.

No Supabase schema, provider permission, authorization model, GitHub connect/callback contract, runtime capability flag or Phase 10A worker behavior is intentionally changed by PR #87.

### Current UI verification state

The first full UI CI exposed two compatibility regressions in tests/copy, both corrected:

- the legacy admin boundary test now follows labels into the extracted `AdminNavigation` component;
- the private repository card again preserves the established `Private repository acquisition requires Phase 10A2` release wording.

The next browser-acceptance RED test exposed one over-specific static assertion for the screenshot filename prefix. The browser script already generated the intended `${prefix}-${width}-${view}.png` names; the test has been corrected to assert that real naming contract.

A fresh full CI is required on the current documented tree before PR #87 can be merged. Do not claim visual acceptance complete until that run reaches the browser step and the generated screenshots have been inspected.

## GitHub App provider acceptance

Issue #79 remains the release-order gate for Phase 10A2.

The production provider gate is now active and the positive owner/admin canary passed:

- `HOSTED_GITHUB_INTEGRATION_ENABLED=true` is active in the production deployment;
- the production connect endpoint reaches the normal ScopeForge authentication boundary rather than `error=disabled`;
- the GitHub App connection persisted as active for account `LeDoNguyenTu` with repository selection `selected`;
- `LeDoNguyenTu/ScopeForge` was imported successfully on default branch `main`;
- the persisted repository link reports active access;
- the expected connect -> callback -> integration -> import request sequence is present in Vercel logs;
- no fresh production runtime error was observed during the canary.

Issue #79 is not closed yet. Remaining operational evidence is:

1. reject a different/unauthorized installation ID;
2. prove a normal workspace member/viewer cannot initiate or complete the connection;
3. finish token/secret leakage checks across logs, redirects, persisted integration rows and browser-readable state/cookies.

Do not invent operational evidence for these checks. Close #79 only when the required evidence is actually available.

## Production Supabase truth

Production currently includes Phase 10A1 migrations through:

- `20260910160000_phase_10a1_github_connected_projects`
- `20260910160010_phase_10a1_project_scan_retry_idempotency`
- `20260910160020_phase_10a1_project_scan_waiting_idempotency`
- `20260910160030_phase_10a1_project_scan_recovery`
- `20260911143049_phase_10a1_service_role_table_acl_hardening`

The reviewed Phase 10A2 and Phase 10A3 migrations remain unapplied to production at this checkpoint.

The next reviewed Phase 10A2 migrations are:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

They must not be applied until the provider acceptance gate is complete and the actual PR #76 head/migration history has been re-read.

## Phase 10A2

PR #76 (`feat/phase-10a2-private-repository-acquisition`) remains draft/open. The last independently recorded head is `709ef8af4ce4befae12ba910d3bca15599b5cab1`; re-read the actual head before any mutation because it may have advanced.

Required release order after #79:

1. re-read the actual PR #76 head and production migration history;
2. apply only absent reviewed Phase 10A2 migrations to `tdgpibrepzcvdivztkta`;
3. complete private worker containment, quota, cleanup, observability and rollback acceptance;
4. prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings while GitHub credentials remain control-plane-only;
5. merge/release #76 only after provider/schema/runtime acceptance passes.

## Phase 10A3

PR #77 (`feat/phase-10a3-github-webhook-reconciliation`) remains draft/open.

Recorded state:

- documentation-only head: `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- latest executable candidate: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- exact synthetic merge: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- exact executable validation: CI #981 / run `34711218370` - SUCCESS

After Phase 10A2 release, reconcile #77 onto released main, run a fresh exact validation, then apply/accept the reviewed webhook migrations and independent webhook secret/endpoint before release.

## Runtime gates

Keep these false/absent until independent canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Product implementation, migration presence or CI success does not authorize hosted worker activation.

## Historical external-host work

Phase 6D Tasks 14, 15 and 16 are complete. The dedicated Oracle Linux/rootless-Podman acceptance, including the measured Node 22 `--pids-limit=8` containment boundary, is already documented in `PHASE_6D_TASK15_ACCEPTANCE.md` and `PHASE_6D_TASK16_REVIEW.md`.

Do not send that completed work to Codex again. A future task should be handed to an external terminal/Codex environment only if it genuinely requires SSH/host-level control that is not available in the current ChatGPT tool surface.

## Immediate resume point

1. Finish and visually inspect PR #87 exact-head CI/browser screenshots.
2. Review and merge PR #87 only when the full validation matrix and visual acceptance are green.
3. Verify the merged main/production deployment remains healthy.
4. Return immediately to issue #79 and complete its remaining negative/leak canaries.
5. Continue into PR #76 Phase 10A2 in the strict release order above.
6. Then reconcile/accept/release PR #77 Phase 10A3.
7. Continue with the next documented ScopeForge task rather than stopping after one PR.

# ScopeForge Next Steps

Last reconciled: 2026-09-13 (Asia/Singapore)

## Released baseline

Current released `main`:

`33d21de652f3c04aa88ebd4f122348803e59b153`

Production remains `https://scopeforge.dev` on Vercel project `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8` with ScopeForge Supabase project `tdgpibrepzcvdivztkta`.

Preserve together: strict nonce CSP, authenticated workspace/admin boundaries, workspace RLS/RPC authority separation, worker/runtime authority separation, public/private repository acquisition separation, and default-off hosted runtime gates.

## Priority 0 - finish and release responsive admin UI

PR #87: `Responsive admin control plane and GitHub UI`
Branch: `feat/admin-ui-responsive-control-plane`
Authoritative executable/documented tree: `d4f578ef87b0919bf1978652befdc78b2e49af47`
Synthetic PR merge tested by CI: `904666d0cfa8a2a2ce24e8c2bb6663c431f513d6`
CI #1017 / run `34730799690`: SUCCESS
Visual artifact: `10309385932`

CI #1017 passed:

- dependency audit: 0 vulnerabilities;
- 393 test files / 1,740 tests;
- typecheck;
- CommonJS CLI build/version;
- scanner benchmark and benchmark matrix;
- optimized Next.js production build;
- strict-CSP browser smoke;
- responsive admin browser acceptance;
- production landing/Turnstile diagnostic;
- 15-image visual acceptance artifact upload.

Visual acceptance was manually reviewed from the artifact at 390 px, 430 px and 1440 px. The reviewed states cover Admin Overview, Users, Workspaces, Audit, Settings and GitHub connected projects. The phone layouts use mobile record cards and bottom navigation without the former horizontally scrolling admin strip, and the GitHub repository content stays contained inside responsive cards.

Remaining work for PR #87:

1. keep any final evidence/documentation commits docs-only;
2. update the PR body with CI/artifact evidence;
3. final changed-file/release-isolation review;
4. merge #87 if the final diff remains UI/docs/tests only;
5. verify the merged production deployment is READY and has no fresh runtime errors.

Do not start unrelated UI expansion after this acceptance. Return directly to issue #79 and Phase 10A release work.

## Priority 1 - complete GitHub App provider issue #79

The positive production canary already passed:

- `HOSTED_GITHUB_INTEGRATION_ENABLED=true` is live;
- owner/admin Connect GitHub flow completed;
- GitHub App installation proof completed;
- production connection persisted active for `LeDoNguyenTu`;
- repository selection is `selected`;
- `LeDoNguyenTu/ScopeForge` imported successfully on `main`;
- repository access is active;
- Vercel request sequence and fresh runtime health were checked.

Remaining issue #79 evidence:

1. prove an unauthorized/different valid numeric installation ID is rejected;
2. prove a normal workspace member/viewer cannot initiate or complete GitHub connection;
3. complete leak checks covering provider secrets/tokens/signed state across ordinary logs, redirects, persisted rows and browser-readable state/cookies;
4. close #79 only when those checks are actually evidenced.

Keep every hosted worker/runtime flag false/absent throughout this provider gate.

## Priority 2 - reconcile and release Phase 10A2

PR #76: `feat/phase-10a2-private-repository-acquisition`, draft/open.
Last recorded head: `709ef8af4ce4befae12ba910d3bca15599b5cab1` - re-read before any mutation.

Reviewed production migrations still awaiting the release gate:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

After #79 closes:

1. re-read actual PR #76 head and production migration history;
2. reconcile #76 with released `main` as needed after PR #87;
3. review the exact migration diff/order and apply only absent reviewed Phase 10A2 migrations to `tdgpibrepzcvdivztkta`;
4. verify resulting private-table/RPC ACL, RLS and security posture;
5. complete private snapshot worker containment, quotas, cancellation/cleanup, observability and rollback acceptance;
6. prove one private connected-project flow: archive lease -> immutable snapshot -> exact zero-egress scan -> findings;
7. prove GitHub credentials stay control-plane-only and private source/capability material does not leak into browser state or ordinary logs;
8. enable a hosted private worker capability only inside an accepted canary boundary when required by the canary;
9. merge/release #76 only after code, schema, provider and runtime gates are green;
10. verify merged production and return unaccepted runtime flags to the documented conservative state.

If final Phase 10A2 containment needs SSH/host-level control over a Linux worker and no supported host connector is available here, hand off only that exact host-level probe to Codex/VS Code or another environment with SSH access. Do not hand off the broader Phase 10A2 implementation.

## Priority 3 - reconcile and release Phase 10A3

PR #77: `feat/phase-10a3-github-webhook-reconciliation`, draft/open.

Recorded evidence:

- docs-only head: `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- executable candidate: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior exact synthetic merge: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- prior executable CI #981 / run `34711218370`: SUCCESS

After Phase 10A2 releases:

1. reconcile #77 onto released main/Phase 10A2;
2. run fresh exact validation;
3. re-read/apply only reviewed absent Phase 10A3 migrations;
4. configure the independent webhook secret/endpoint without exposing secret material;
5. verify invalid signature and oversize rejection, replay handling, installation/repository lifecycle reconciliation, coalescing, same-head recovery and superseded-head recovery;
6. complete leak checks and one automatic scan path;
7. merge/release #77 only after operational acceptance passes.

## Runtime gates

Keep false/absent until independently accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

CI success, schema presence, or product UI availability does not authorize production worker activation.

## Historical Codex/Oracle work

Phase 6D Tasks 14-16, including real Oracle Linux/rootless-Podman Task 15 containment acceptance, are complete. Do not repeat or reassign them to Codex.

## Continuation rule

After each release milestone, update `CURRENT_STATE.md` and this file with the exact branch/head, validation evidence, production state and remaining blocker. Then continue to the next item rather than stopping after one PR.

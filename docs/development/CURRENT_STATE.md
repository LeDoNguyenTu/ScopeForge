# ScopeForge Current State

Last reconciled: 2026-09-14 (Asia/Singapore)

## Live reconciliation - 2026-09-14

This section supersedes older current-state wording below. Fetch live refs again before acting.

- Startup checkout was clean but 212 commits behind; it was fast-forwarded from `86d342216cf05d2951fd9ed427d35b6d575e7765` to live main `da719b3ff1204bd2d6589cebb0b3a5dac2e22195` after reading the newly introduced root `AGENTS.md` from the fetched ref. Git remote and authenticated GitHub identity both match `LeDoNguyenTu/ScopeForge` / `LeDoNguyenTu`.
- PR #96 internal Action pinning is released. Its exact main CI [34777528921](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34777528921) passed on `ec7b00d1f533704100e224bc53f6a6647a3e1a4b`; PR #98 added the startup/account handoff. Older references to PR #90 as the latest validation are historical.
- PR #97's public example was separately reconciled with live main without rewriting history, then pinned to official commit objects resolved from checkout v7, setup-node v7 and CodeQL v4. Validated candidate: `17c8c41b3ac79c3c7426612ce3bd9aba5c038824`; [CI 34778529251](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34778529251) passed 398 files / 1,746 tests, audit, typecheck, CLI, benchmarks, build, CSP browser acceptance and production diagnostic. PR #97 merged as `39fa4b147d9ecbb12ae60335412bad95fbad91fe`. Its post-merge checks must be read independently; the candidate CI is not post-merge evidence.
- Startup production: Vercel `dpl_4irNreqdjtrtezYwoVvyp7od5JwM`, READY on main `da719b3ff1204bd2d6589cebb0b3a5dac2e22195`, aliased to `scopeforge.dev`; verified team/project IDs and Node 24.x. The homepage returned 200 with nonce CSP, HSTS, DENY, nosniff, permissions-policy and referrer-policy. This is a timestamped observation, not a claim about later deployments.
- Supabase project `tdgpibrepzcvdivztkta` was independently verified as ScopeForge / ACTIVE_HEALTHY. Migration history still ends at `20260911143049_phase_10a1_service_role_table_acl_hardening`. No Phase 10A2/10A3 migration was applied and the completed schema compatibility preflight was not repeated.
- #79 remains open. Owner browser access and GitHub passkey/MFA confirmation now work, and the authenticated GitHub App settings show the intended read-only permission model. The existing production connection redirects a new Connect GitHub attempt to its installed-App settings, so no unrelated installation has been submitted through a fresh signed ScopeForge callback. Production has two owner memberships and no member/viewer session for the second canary. [Precise blocker evidence](https://github.com/LeDoNguyenTu/ScopeForge/issues/79#issuecomment-5655657881).
- #76 remains draft at `709ef8af4ce4befae12ba910d3bca15599b5cab1`; #77 remains draft at `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`, stacked on #76. Neither was reconciled or released ahead of #79.
- A complete static security diff review of exact PR #76 head `709ef8af4ce4befae12ba910d3bca15599b5cab1` found no reportable source-level security issue. The review and its operational limitations are recorded in [PR #76 comment 5659605414](https://github.com/LeDoNguyenTu/ScopeForge/pull/76#issuecomment-5659605414). This does not clear provider, schema, runtime, privacy, rollback, or end-to-end release acceptance.
- No provider credentials, hosted gates, webhook, runtime host, production identities or schema were modified. Live runtime environment values were not re-read; prior flag observations remain historical and all unaccepted capabilities must stay disabled.
- PR #102 merged the general Windows portability fixes as `70e014495c0c5355c60d39f96dc961c0eb3e846e`; exact post-merge [CI 34810194348](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34810194348) passed. PR #103 makes the remaining symlink cases depend on a real host capability probe and splits combined tests so unrelated assertions still run. On Node 24.16.0, its focused run passed 51 tests with 16 capability skips; typecheck passed; the full Windows run passed 394 files / 1,724 tests with 4 files / 24 tests skipped and no failures. Linux CI remains necessary and must execute the symlink, POSIX and rootless-Podman coverage unavailable on this host.
- Branch cleanup deleted 62 historical remote refs after a live 68-branch audit. Thirty-one exact tips matched merged PR heads; twenty more were commit-reachable from retained refs; the final eleven matched the prior manifest's diagnostic, superseded, temporary, or explicitly closed categories. A post-delete fetch returned six branches: `main`, #76, #77, the intentional demo branch, and two branches attached to active local worktrees.

## Resume/ref semantics

Always fetch the live `main` ref before acting. Do not treat a SHA embedded in this file as the repository's current tip, because merging a documentation-only synchronization PR necessarily advances `main` after the file was written.

Use exact SHAs only for evidence that must remain immutable:

- historical executable merge validated on `main` before PR #96/#97: `c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`
- post-merge CI #1030 / run `34745795461`: SUCCESS
- historical production deployment recorded before PR #96/#97: `dpl_FQ8JPMgvFbSY4SkK6tCxHuKZdEd6`, READY on docs-only main SHA `e157fb8150df76cc8166e3c695a6ed83d74d0077`

CI #1030 is historical PR #90 evidence. Later CI/workflow/test changes require their own exact-candidate validation; consult the current reconciliation above.

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- production domain: `https://scopeforge.dev`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`

`scopeforge.dev` was directly fetched after PR #93 and returned HTTP 200 with strict nonce CSP, HSTS, `nosniff`, frame denial, permissions policy, and referrer policy intact. PR #92, #93, and #94 are documentation-only, and preserve that application behavior. PR #96 subsequently changed the internal CI pins, and PR #97 addresses the published example separately.

Released main includes Phase 10A1 GitHub connected-project core, Phase 10C platform administration, strict nonce CSP/security headers, the accepted Command Center presentation, PR #87 responsive admin/GitHub UI, PR #88 Node 24/runtime-tooling alignment, PR #90 public CI-guide runtime alignment, PR #92 branch-cleanup audit documentation, PR #93 resume-state synchronization, and PR #94 GitHub App setup-state reconciliation.

## Recent maintenance releases

### PR #88 - runtime/tooling alignment

Squash merge:

`e12bbbe51515fc3d738428737ecd6281f2a2a3c8`

Post-merge CI #1027 / run `34744753785`: SUCCESS.

- Node 24 runtime contract `>=24 <25`
- `actions/upload-artifact@v7`
- `vitest.config.mts` without converting the CommonJS CLI package contract
- 396/396 test files, 1,743/1,743 tests
- typecheck, CLI, benchmarks, optimized build, strict-CSP browser acceptance, production diagnostic, artifact upload: PASS

### PR #90 - published CI example alignment

Squash merge:

`c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`

TDD evidence:

- RED CI #1028 / run `34745362606`: 1,743 pre-existing tests passed and only the new public-CI-example Node 24 guard failed because `docs/scanner/CI.md` still used Node 22
- GREEN CI #1029 / run `34745529387`: SUCCESS, 396/396 files and 1,744/1,744 tests
- post-merge main CI #1030 / run `34745795461`: SUCCESS
- post-merge artifact: `10314341432`, 3,443,940 bytes

The public GitHub CI example now uses Node 24 and is permanently guarded against drifting back to Node 22.

Detailed evidence: `docs/development/CI_DOC_RUNTIME_ALIGNMENT_WORKING_STATE.md`.

### PR #92 - branch cleanup audit

Merge:

`80c1d4710b31dab0081d0d8918fcd8ce4091119c`

Fresh branch/PR audit before the audit branch itself was created:

- 60 live branches
- exactly 2 open PR heads: #76 and #77
- 4 refs retained by policy: `main`, #76, #77, and `demo/portfolio-20260910`
- 56 refs classified safe to delete through a genuine delete-ref operation

The authenticated local Git CLI deleted 62 historical refs after a fresh 68-branch/open-PR/worktree audit. A post-delete fetch returned the intended six remote refs. The two non-PR development refs remain because they are attached to active local worktrees; three additional active local worktree branches currently have no remote ref. Never simulate deletion by force-moving refs.

Authoritative manifest: `docs/development/BRANCH_CLEANUP_CANDIDATES.md`.

### PR #93 / #94 - operational documentation reconciliation

PR #93 synchronized the four persistent resume files with the verified production/provider state. PR #94 reconciled `PHASE_10A1_GITHUB_APP_SETUP.md` so completed provider activation/import work is no longer presented as pending and only the two issue #79 negative canaries remain outstanding.

Both are documentation-only and do not replace executable CI evidence.

## Responsive admin/GitHub UI

PR #87 is the released responsive admin/GitHub UI baseline. Do not reopen cosmetic UI work without concrete visual or behavioral evidence. Preserve no whole-page horizontal scrolling on mobile, safe-area handling, touch/accessibility behavior, strict CSP, and existing authorization boundaries.

## GitHub App provider acceptance - issue #79

The positive production owner/admin canary is proven:

- `HOSTED_GITHUB_INTEGRATION_ENABLED=true` is active
- owner/admin connection/install proof completed
- connection metadata for `LeDoNguyenTu` persisted active with repository selection `selected`
- `LeDoNguyenTu/ScopeForge` imported on default branch `main`
- repository access is active
- expected connect -> callback -> integration -> import flow was observed
- safe metadata/RLS/cookie/redirect/log boundaries have been reviewed

Issue #79 explicitly records that only two independent live authenticated production browser canaries remain:

1. from an authenticated owner/admin callback flow, submit a different valid numeric GitHub installation ID and prove rejection
2. from an authenticated normal member/viewer session, prove Connect GitHub cannot be initiated or completed

Regression tests cover these properties, but they are not a substitute for live provider acceptance. Read-only production verification on 2026-09-14 found two memberships, both owner, and no member/viewer identity for the second canary. Do not weaken authorization, expose provider secrets, or mutate an owner account merely to manufacture a pass.

## Production Supabase truth

Production migration history remains recorded through:

`20260911143049_phase_10a1_service_role_table_acl_hardening`

The reviewed Phase 10A2/10A3 migrations remain intentionally unapplied while #79 is open.

Phase 10A2 migrations awaiting the gate:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

Read-only transactional/schema preflight for both Phase 10A2 migrations is already complete. Required live function signatures, keys, constraints, ACL assumptions, and existing-row compatibility were verified, and the Phase 10A2 target column/FK/index/RPCs are absent as expected. Do not redo that preflight unless PR #76 or production schema changes materially.

## Phase 10A2

PR #76 (`feat/phase-10a2-private-repository-acquisition`) remains draft/open at recorded head:

`709ef8af4ce4befae12ba910d3bca15599b5cab1`

Its PR description has been refreshed to reflect the completed positive provider canary and schema preflight. Main has advanced since that candidate. Do not reconcile or apply migrations merely to make the PR current while #79 remains open.

After #79:

1. re-read actual #76 and live current main, then reconcile
2. run fresh exact-candidate validation
3. re-read production migration history and apply only absent reviewed Phase 10A2 migrations
4. verify schema, RLS, grants/revokes and service-role boundaries
5. complete private worker containment, quotas, cancellation/cleanup, observability and rollback acceptance
6. prove private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings
7. prove GitHub credentials remain control-plane-only and no private source/capability material leaks into browser state or ordinary logs
8. merge/release only when provider, code, schema, runtime, privacy and rollback gates are green

If the final host-level containment canary genuinely requires direct SSH unavailable here, hand off only that exact probe to Codex/VS Code or another approved SSH environment.

## Phase 10A3

PR #77 (`feat/phase-10a3-github-webhook-reconciliation`) remains draft/open.

Recorded pre-reconciliation evidence:

- docs-only head: `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- executable candidate: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

Its PR description has also been refreshed so it no longer incorrectly says Phase 10A1 is dark-gated. After Phase 10A2 release, reconcile #77 onto released main, run fresh exact validation, apply only reviewed absent Phase 10A3 migrations, configure the independent webhook secret/endpoint, and complete invalid-signature/oversize, replay, lifecycle, coalescing, same-head recovery, stale-trigger authoritative-head recovery, leak-boundary, and full automatic-scan acceptance before merge.

## Runtime gates

Keep false/absent until independent canary and rollback acceptance authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

CI success, migration presence, historical containment evidence, or product UI availability does not authorize hosted worker activation.

## Historical external-host work

Phase 6D Tasks 14-16, including real Oracle Linux/rootless-Podman Task 15 containment acceptance, are complete. Do not repeat them.

## Immediate resume point

1. Fetch the live `main` ref first; do not use a docs-embedded main SHA as the current tip.
2. Keep #79 open until owner GitHub confirmation and a legitimate member/viewer session allow both negative canaries to complete.
3. While parked, continue isolated maintenance/security/documentation/regression work that cannot weaken or bypass #79.
4. Do not apply Phase 10A2 migrations or enable private/runtime capability flags before #79 clears.
5. After #79, release #76 in strict order, then #77.
6. Preserve the six verified remote refs. Re-audit open PRs and active local worktrees before any future cleanup.
7. Keep `CURRENT_STATE.md`, `NEXT_STEPS.md`, `SESSION_HANDOFF.md`, and `UNFINISHED_WORK.md` synchronized for semantic state, not by chasing every docs-only main SHA.

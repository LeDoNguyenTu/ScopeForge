# ScopeForge Current State

Last reconciled: 2026-09-13 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current `main`: `80c1d4710b31dab0081d0d8918fcd8ce4091119c`
- production domain: `https://scopeforge.dev`
- current Vercel production deployment: `dpl_wdy769VVk1cqb55nJ65x8qiHrtHa`, READY on exact main SHA `80c1d4710b31dab0081d0d8918fcd8ce4091119c`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`

`scopeforge.dev` was directly fetched after PR #92 and returned HTTP 200 with strict nonce CSP, HSTS, `nosniff`, frame denial, permissions policy, and referrer policy intact. PR #92 is documentation-only, so executable application behavior remains the already-validated PR #90/PR #88 baseline.

Released main includes Phase 10A1 GitHub connected-project core, Phase 10C platform administration, strict nonce CSP/security headers, the accepted Command Center presentation, PR #87 responsive admin/GitHub UI, PR #88 Node 24/runtime-tooling alignment, PR #90 public CI-guide runtime alignment, and PR #92 branch-cleanup audit documentation.

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

The connected GitHub surface still has no branch-delete operation. Do not simulate deletion by force-moving refs. Re-fetch refs immediately before any future deletion because documentation/maintenance branches created after the audit will also need classification.

Authoritative manifest: `docs/development/BRANCH_CLEANUP_CANDIDATES.md`.

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

Issue #79 now explicitly records that only two independent live authenticated production browser canaries remain:

1. from an authenticated owner/admin callback flow, submit a different valid numeric GitHub installation ID and prove rejection
2. from an authenticated normal member/viewer session, prove Connect GitHub cannot be initiated or completed

Regression tests cover these properties, but they are not a substitute for live provider acceptance. Production currently has no known member/viewer identity available for the second canary. Do not weaken authorization, expose provider secrets, or mutate an owner account merely to manufacture a pass.

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

1. re-read actual #76 and current main, then reconcile
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

1. Keep #79 parked until a suitable authenticated production browser/session surface is available for the two remaining negative canaries.
2. While parked, continue isolated maintenance/security/documentation/regression work that cannot weaken or bypass #79.
3. Do not apply Phase 10A2 migrations or enable private/runtime capability flags before #79 clears.
4. After #79, release #76 in strict order, then #77.
5. Branch deletion is separately parked until a genuine delete-ref surface is available; use `BRANCH_CLEANUP_CANDIDATES.md` and re-audit immediately before deletion.
6. Keep `CURRENT_STATE.md`, `NEXT_STEPS.md`, `SESSION_HANDOFF.md`, and `UNFINISHED_WORK.md` synchronized after each milestone.

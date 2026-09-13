# ScopeForge Current State

Last reconciled: 2026-09-13 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `e12bbbe51515fc3d738428737ecd6281f2a2a3c8`
- production domain: `https://scopeforge.dev`
- production Vercel deployment: `dpl_6ZcxVWhvudce8AzaQGxg3ufzmwx7` - READY
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`

Released main includes Phase 10A1 GitHub connected-project core, Phase 10C platform administration, strict nonce CSP/security headers, the accepted command-center presentation, PR #87 responsive admin/GitHub control-plane UI, and PR #88 runtime/tooling alignment.

## Main runtime/tooling alignment - released

PR #88 (`Align main runtime and tooling baseline`) was squash-merged to main at `e12bbbe51515fc3d738428737ecd6281f2a2a3c8`.

The change is intentionally isolated from the Phase 10A2/10A3 release stack. It aligns the root/CI runtime to Node `>=24 <25`, upgrades visual artifact upload to `actions/upload-artifact@v7`, and loads Vitest through `vitest.config.mts` without converting the package or CLI to ESM.

Candidate evidence before merge:

- executable head: `b987fd9db36173b0a338cce7796ac599ae46e163`
- synthetic merge: `ecc0cd2f77616086d49588c6e69336f8b3dfeed5`
- CI #1026 / run `34744282931`: SUCCESS
- Node `v24.20.0`, npm `11.19.0`
- audit: 0 vulnerabilities
- tests: 396/396 files, 1,743/1,743 tests
- typecheck: PASS
- CommonJS CLI build/version: PASS
- scanner benchmark and deterministic matrix: PASS
- optimized Next.js build: PASS
- strict-CSP responsive browser acceptance: PASS
- production UI/Turnstile diagnostic: PASS
- `actions/upload-artifact@v7`: PASS
- visual artifact: `10313449144`

Final integration/release evidence:

- pre-merge full diff review found no Critical or Important issue and confirmed no application authorization/product behavior, Supabase migration/data, provider secret/configuration, Vercel environment, hosted runtime flag, or Phase 10A2/10A3 release-gate change
- merge: `e12bbbe51515fc3d738428737ecd6281f2a2a3c8`
- post-merge main CI #1027 / run `34744753785`: SUCCESS
- post-merge CI passed install, audit, full test suite, typecheck, CommonJS CLI build/version, scanner benchmark, deterministic benchmark matrix, optimized Next build, strict-CSP browser acceptance, production UI/Turnstile diagnostic, and visual artifact upload
- post-merge artifact: `10313589714`, 3,448,428 bytes
- production deployment `dpl_6ZcxVWhvudce8AzaQGxg3ufzmwx7`: READY, production, exact main SHA, `aliasError=null`, region `sin1`
- `scopeforge.dev`: HTTP 200 with strict nonce CSP, HSTS, nosniff, frame denial, permissions policy, and referrer policy present
- no fresh error/fatal runtime log entries were found for the exact production deployment in the checked window

Detailed maintenance record: `docs/development/MAIN_RUNTIME_TOOLING_BACKPORT_WORKING_STATE.md`.

## Responsive admin control plane - released

PR #87 (`Responsive admin control plane and GitHub UI`) remains the current UI baseline. It was squash-merged at `f4f76e823718b6571966e731ed5a5a85a67152b3` after exact responsive/CSP browser and screenshot acceptance.

Do not reopen cosmetic UI work without concrete visual or behavioral evidence. Preserve no whole-page horizontal scrolling on mobile, iOS safe-area handling, touch/accessibility behavior, strict CSP, and existing authorization boundaries.

## GitHub App provider acceptance - issue #79

The positive production owner/admin canary is proven:

- `HOSTED_GITHUB_INTEGRATION_ENABLED=true` is active
- owner/admin connection/install proof completed
- the connection persisted active for `LeDoNguyenTu` with repository selection `selected`
- `LeDoNguyenTu/ScopeForge` imported successfully on default branch `main`
- repository access is active
- expected connect -> callback -> integration -> import flow was observed
- no fresh runtime failure was observed during the positive canary

Leak/boundary verification also confirms safe metadata-only persistence, RLS boundaries, browser SELECT-only access, service-role mutation boundaries, secure short-lived callback cookies, normalized redirects, and regression coverage for normal-member rejection, cross-user signed-state rejection, spoofed valid numeric installation rejection, and safe-metadata persistence.

Issue #79 remains open because two checklist items still require independent live authenticated negative canaries that this chat cannot currently execute:

1. live rejection of a different valid numeric installation ID from an authenticated owner/admin callback flow
2. live rejection of Connect GitHub from an authenticated normal member/viewer session

Do not convert regression-test evidence into a claimed live production pass. Do not weaken authorization or expose provider secrets to complete the canary.

## Production Supabase truth

Production migration history still ends at:

`20260911143049_phase_10a1_service_role_table_acl_hardening`

The reviewed Phase 10A2/10A3 migrations remain unapplied.

Phase 10A2 production absence preflight previously confirmed that the private snapshot worker registration/enqueue RPCs, private connected-project enqueue RPC, and `github_repository_link_id` snapshot-task linkage are not yet deployed.

The next reviewed Phase 10A2 migrations remain:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

Do not apply them until issue #79's live negative provider acceptance is complete.

## Phase 10A2

PR #76 (`feat/phase-10a2-private-repository-acquisition`) remains draft/open at recorded head `709ef8af4ce4befae12ba910d3bca15599b5cab1`.

Main has advanced since that candidate, so stack reconciliation will be required after #79 clears. Do not reconcile/rebase the release stack ahead of the provider gate merely to make the PR green.

Required order after #79:

1. re-read actual #76 head and current main, then reconcile
2. run fresh exact-head validation
3. re-read production migration history and apply only absent reviewed Phase 10A2 migrations
4. verify private tables/RPCs, grants/revokes, RLS and security posture
5. complete private worker containment, quotas, cancellation/cleanup, observability and rollback acceptance
6. prove archive lease -> immutable private snapshot -> exact zero-egress repository scan -> findings
7. prove GitHub credentials remain control-plane-only and no private source/capability material leaks into browser state or ordinary logs
8. merge/release #76 only when provider, code, schema, runtime, privacy and rollback gates are green

## Phase 10A3

PR #77 (`feat/phase-10a3-github-webhook-reconciliation`) remains draft/open.

Recorded pre-reconciliation evidence:

- docs-only head: `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- executable candidate: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

After Phase 10A2 release, reconcile #77 onto released main, run fresh exact validation, apply only reviewed absent Phase 10A3 migrations, configure the independent webhook secret/endpoint, and complete invalid-signature/oversize, replay, lifecycle, coalescing, recovery, leak, and automatic-scan acceptance before merge.

## Runtime gates

Keep these false/absent until independent canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Product implementation, migration presence, CI success, or historical containment evidence does not authorize hosted worker activation.

## Historical external-host work

Phase 6D Tasks 14-16, including the real Oracle Linux/rootless-Podman Task 15 containment acceptance, are complete. Do not repeat that work.

A future external/Codex handoff is appropriate only for an exact host-level probe that genuinely requires SSH/control unavailable in the current tool surface.

## Immediate resume point

1. Keep issue #79 open and postpone its two browser-only negative canaries until a suitable authenticated browser/session surface is available.
2. While #79 is postponed, continue only isolated maintenance/security/documentation/evidence-based UI work that cannot weaken or bypass the provider gate.
3. Do not apply Phase 10A2 migrations or enable private repository/runtime capability flags before #79 clears.
4. After #79, reconcile/validate/apply/accept/release PR #76 in strict order.
5. Then reconcile/validate/apply/accept/release PR #77 in strict order.
6. Continue with the next documented ScopeForge task rather than stopping after one PR.

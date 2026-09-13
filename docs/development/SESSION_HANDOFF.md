# ScopeForge Session Handoff

Last refreshed: 2026-09-13 (Asia/Singapore)

Use this as the fastest resume point for current ScopeForge work. Read it together with `CURRENT_STATE.md`, `NEXT_STEPS.md`, and `UNFINISHED_WORK.md`. Do not resume from historical preview, diagnostic, restoration, reconciliation, or superseded phase branches.

## Hard execution rules

- treat current `main` as the integration baseline and inspect actual heads before changing anything
- preserve the accepted Command Center presentation, PR #87 responsive admin/GitHub UI, strict nonce CSP, and browser security headers
- never rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim CI, provider, schema, environment, runtime, WAF, or production state without direct evidence
- do not enable hosted worker/runtime flags merely because code, migrations, or containment tests exist
- keep provider control-plane credentials out of browser state, repository files, ordinary logs, worker payloads, and chat
- use exact-SHA validation for executable release candidates

## Released product baseline

Current released main before the independent tooling maintenance PR is:

`f4f76e823718b6571966e731ed5a5a85a67152b3`

That release includes:

- Phase 10A1 GitHub connected-project core
- Phase 10C platform administration
- strict nonce CSP and security-header baseline
- accepted Command Center UI
- PR #87 responsive admin/GitHub control-plane UI

PR #87 release evidence is recorded in `CURRENT_STATE.md`.

## Independent main tooling maintenance - PR #88

PR #88, `Align main runtime and tooling baseline`, is intentionally isolated from the Phase 10A2/10A3 release stack.

Authoritative executable candidate:

- branch: `chore/main-runtime-tooling-alignment`
- executable head: `b987fd9db36173b0a338cce7796ac599ae46e163`
- exact synthetic merge: `ecc0cd2f77616086d49588c6e69336f8b3dfeed5`
- CI #1026 / run `34744282931`: SUCCESS
- Node: `v24.20.0`
- npm: `11.19.0`
- audit: 0 vulnerabilities
- tests: 396/396 files, 1,743/1,743 tests
- typecheck: PASS
- CommonJS CLI build/version: PASS, `ScopeForge 0.1.0`
- scanner benchmark and deterministic matrix: PASS
- optimized Next.js build: PASS
- strict-CSP responsive browser acceptance: PASS
- production UI/Turnstile diagnostic: PASS
- `actions/upload-artifact@v7`: PASS
- visual artifact: `10313449144`, 15 PNG files

The branch aligns root/CI runtime to Node `>=24 <25`, uses `upload-artifact@v7`, and loads Vitest through `vitest.config.mts` without converting the package or CLI to ESM. The former CommonJS-loaded ESM Vitest warning is absent from CI #1026.

Documentation-only `[skip ci]` commits after `b987fd9...` do not replace CI #1026 as executable-tree evidence. Before merging, confirm the final PR diff still contains no application behavior, migration, provider, environment, or runtime-flag changes.

Detailed maintenance record: `MAIN_RUNTIME_TOOLING_BACKPORT_WORKING_STATE.md`.

## GitHub App provider acceptance - issue #79

The positive production owner/admin canary has passed:

- GitHub App connection/install proof completed
- `LeDoNguyenTu` connection metadata persisted active
- `LeDoNguyenTu/ScopeForge` imported with active access
- expected connect -> callback -> integration -> import sequence observed
- safe metadata/RLS/browser-cookie/log boundaries were separately checked

Issue #79 remains open only because two independent live authenticated negative canaries still need a suitable production browser/session surface:

1. prove a different valid numeric GitHub installation ID is rejected during an authenticated owner/admin callback flow
2. prove a normal workspace member/viewer cannot initiate or complete Connect GitHub

Current regression tests cover both authorization properties, but test evidence must not be presented as a live production canary.

Do not create or paste provider secrets merely to complete these checks. If the required browser/account surface is unavailable, leave #79 open and continue only work that does not bypass this release gate.

## Phase 10A2 - private repository acquisition

PR #76 remains draft/open at recorded head:

`709ef8af4ce4befae12ba910d3bca15599b5cab1`

PR #87 advanced main, so stack reconciliation will be required after #79 clears. Do not reconcile or merge #76 ahead of the provider gate merely to make the branch green.

Production migration history still ends at:

`20260911143049_phase_10a1_service_role_table_acl_hardening`

The reviewed Phase 10A2 migrations remain unapplied:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

After #79 clears: reconcile #76 -> exact validation -> migration re-read -> apply only absent reviewed migrations -> schema/RLS/grant verification -> private worker containment/quota/cleanup/observability/rollback canary -> immutable private snapshot -> exact zero-egress scan -> findings -> merge/release only if all gates pass.

## Phase 10A3 - GitHub webhook reconciliation

PR #77 remains draft/open.

Recorded pre-reconciliation evidence:

- docs-only head: `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- executable candidate: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

Do not release #77 before Phase 10A2. After #76 is released, reconcile #77 onto released main, run fresh exact validation, apply only reviewed absent Phase 10A3 migrations, configure the independent webhook secret/endpoint, then prove invalid-signature/oversize rejection, replay, lifecycle, coalescing/recovery, leak boundaries, and a complete automatic scan before merge.

## Hosted runtime gates

Keep these false/absent until each capability receives its own operational canary and rollback acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 6D host-level containment acceptance is already complete and must not be repeated. It does not authorize production enablement.

## UI state

PR #87 is released. Its responsive admin/GitHub control-plane work is the current UI baseline.

Do not reopen cosmetic UI work without concrete visual or behavioral evidence. If a new UI defect is found, preserve mobile no-horizontal-page-scroll, safe-area handling, semantic/accessibility behavior, CSP compatibility, and the existing authenticated authorization boundaries.

## Branch hygiene

Historical completed branches still exist. Delete them only through a genuine delete-ref operation after re-auditing each candidate against current `main`. Never simulate deletion by force-moving/repointing refs.

## Resume procedure

1. Fetch current `main`, PR #88, #76, #77, and issue #79 and compare their actual heads with this document.
2. If PR #88 is still open, finish its review/integration from the exact green executable candidate above. If it is already merged, treat the current main commit and post-merge CI as authoritative.
3. Keep #79 open until both live negative canaries are independently proven.
4. Do not apply Phase 10A2 migrations or enable private worker/runtime gates before #79 clears.
5. After #79, follow the strict #76 then #77 release sequence in `NEXT_STEPS.md`.
6. Continue independent maintenance/security/documentation work only when it cannot weaken or bypass those gates.

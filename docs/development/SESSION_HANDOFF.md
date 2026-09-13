# ScopeForge Session Handoff

Last refreshed: 2026-09-13 (Asia/Singapore)

Use this as the fastest resume point. Read it with `CURRENT_STATE.md`, `NEXT_STEPS.md`, and `UNFINISHED_WORK.md`. Do not resume from historical preview, diagnostic, restoration, reconciliation, or superseded phase branches.

## Hard execution rules

- inspect actual `main`, PR #76, PR #77 and issue #79 heads before changing anything
- preserve the accepted Command Center UI, PR #87 responsive admin/GitHub UI, strict nonce CSP and browser security headers
- never rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim CI/provider/schema/runtime/production state without direct evidence
- do not enable hosted worker/runtime flags merely because code, migrations, tests or historical containment evidence exist
- keep provider credentials and control-plane capability material out of browser state, repository files, ordinary logs, worker payloads and chat
- use exact-SHA validation for executable release candidates

## Current main baseline

Current `main`:

`c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`

Latest post-merge validation:

- CI #1030 / run `34745795461`: SUCCESS
- 396/396 test files, 1,744/1,744 tests
- audit 0, typecheck, CommonJS CLI, scanner benchmark/matrix, optimized Next build, strict-CSP browser acceptance, production diagnostic and artifact upload all passed
- artifact `10314341432`

Recent released maintenance:

- PR #87 responsive admin/GitHub control-plane UI
- PR #88 Node 24/runtime-tooling alignment
- PR #90 public CI workflow example aligned to Node 24 with a permanent regression guard

At the last check, Vercel had not yet surfaced a production deployment whose Git SHA equals the PR #90 merge SHA. The currently served `scopeforge.dev` still returned HTTP 200 with strict nonce CSP and expected security headers. PR #90 contains no executable application change.

## GitHub App provider acceptance - issue #79

Positive owner/admin provider acceptance and controlled public repository import are proven.

Two independent live authenticated negative canaries remain:

1. a different valid numeric installation ID must be rejected in an authenticated owner/admin callback flow
2. a normal workspace member/viewer must be unable to initiate or complete Connect GitHub

The available connector surface cannot run those production browser sessions. Production currently has no known member/viewer identity available for the second canary. Regression tests exist, but they must not be represented as live provider acceptance.

Keep #79 open. Do not expose provider secrets, weaken authorization, mutate an owner role, or bypass the gate to make the canaries easier.

## Phase 10A2 - private repository acquisition

PR #76 remains draft/open at recorded head:

`709ef8af4ce4befae12ba910d3bca15599b5cab1`

Production migration history remains recorded through:

`20260911143049_phase_10a1_service_role_table_acl_hardening`

Reviewed Phase 10A2 migrations remain unapplied:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

Do not reconcile/apply/activate #76 ahead of #79. After #79 clears: re-read actual #76/current main -> reconcile -> exact validation -> migration re-read -> apply only absent reviewed migrations -> schema/RLS/grant verification -> private worker containment/quota/cleanup/observability/rollback canary -> immutable private snapshot -> exact zero-egress scan -> findings -> merge/release only if every gate passes.

If a final host-level containment probe genuinely needs SSH unavailable here, hand off only that probe to Codex/VS Code or another approved SSH environment.

## Phase 10A3 - GitHub webhook reconciliation

PR #77 remains draft/open.

Recorded pre-reconciliation evidence:

- docs-only head `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- executable candidate `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

Do not release #77 before #76. After #76 is released, reconcile #77 onto released main, run fresh exact validation, apply only reviewed absent Phase 10A3 migrations, configure the independent webhook secret/endpoint, then prove signature/oversize rejection, replay, lifecycle, coalescing/recovery, public/private separation, leak boundaries and a complete automatic scan before merge.

## Hosted runtime gates

Keep false/absent until each capability receives its own operational canary and rollback acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 6D host-level containment acceptance is already complete. It does not authorize production enablement.

## UI state

PR #87 remains the responsive admin/GitHub UI baseline. Do not create cosmetic churn without evidence of a real defect. Any future UI repair must preserve mobile no-horizontal-page-scroll, safe-area handling, touch/accessibility behavior, strict CSP and authorization boundaries.

## Branch hygiene

Historical completed branches may remain. Delete them only through a genuine delete-ref operation after re-auditing each candidate against current `main`; never simulate deletion by force-moving refs. Preserve branches backing open PR #76/#77 and any active maintenance PR.

## Resume procedure

1. Fetch current main, #76, #77 and #79 and compare actual heads with these docs.
2. Keep #79 parked until the two live negative canaries can be executed safely.
3. While parked, continue isolated maintenance/security/documentation/regression work that cannot weaken or bypass #79.
4. Do not apply Phase 10A2 migrations or enable private/runtime gates before #79 clears.
5. When #79 clears, follow strict #76 then #77 release order.
6. Update all resume docs after every completed milestone.
7. Do not stop after one safe PR if another independent task is actionable.

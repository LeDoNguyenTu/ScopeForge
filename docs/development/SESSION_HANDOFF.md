# ScopeForge Session Handoff

Last refreshed: 2026-09-15 (Asia/Singapore)

Use this as the fastest resume point with CURRENT_STATE.md, NEXT_STEPS.md and UNFINISHED_WORK.md. Do not resume from historical preview, diagnostic, restoration or superseded branches.

## Live reconciliation - 2026-09-15

See `CURRENT_STATE.md` for the complete startup, provider and validation evidence. This summary supersedes older latest-state wording below; always fetch live refs.

- PR #96 internal Action pins and PR #98 startup/account instructions are released. PR #97 public Action pins are now merged as `39fa4b147d9ecbb12ae60335412bad95fbad91fe`; exact candidate `17c8c41b3ac79c3c7426612ce3bd9aba5c038824` passed [CI 34778529251](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34778529251), 398 files / 1,746 tests and every build/benchmark/browser step. Read post-merge checks separately.
- Startup Vercel production was READY on `da719b3ff1204bd2d6589cebb0b3a5dac2e22195` with the correct team/project/domain and Node 24.x. Direct production HTTP/security-header checks passed. Migration history in verified ScopeForge Supabase still stops at `20260911143049_phase_10a1_service_role_table_acl_hardening`.
- #79 remains open: owner Chrome access and GitHub confirmation work, but the existing production connection redirects a new Connect GitHub attempt to installed-App settings before ScopeForge can receive a fresh signed callback carrying an unrelated installation ID. Production has only two owner memberships and no member/viewer identity for the second canary. [Blocker evidence](https://github.com/LeDoNguyenTu/ScopeForge/issues/79#issuecomment-5655657881). Positive import was not repeated.
- Release order remains #79 -> draft #76 (`709ef8af4ce4befae12ba910d3bca15599b5cab1`) -> draft #77 (`7e2c8ef3dc9354eb5545867e91567960a692079f`). No schema, hosted gate, provider credential, webhook or host change occurred; runtime environment values were not re-read.
- Exact-head static security review of PR #76 found no reportable source issue; [the review comment](https://github.com/LeDoNguyenTu/ScopeForge/pull/76#issuecomment-5659605414) preserves the cleanup/retention and exact production acceptance questions. It does not clear the release gates.
- PR #102's Windows portability work is merged with green post-merge Linux CI. PR #103 adds a real symlink-capability probe; its local focused tests, typecheck and full Windows suite pass (394 files / 1,724 tests, with unavailable symlink/POSIX/Podman cases skipped). A fresh branch audit deleted 62 historical refs and retained all open-PR, intentional, and active-worktree refs; six pre-PR-#103 remote branches remained.

## Hard execution rules

- fetch actual live `main`, PR #76, PR #77 and issue #79 before changing anything; do not infer the current main tip from a SHA embedded in a resume document
- preserve the accepted Command Center UI, PR #87 responsive admin/GitHub UI, strict nonce CSP and browser security headers
- never rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim CI/provider/schema/runtime/production state without direct evidence
- do not enable hosted worker/runtime flags merely because code, migrations, tests or historical containment evidence exist
- keep provider credentials and control-plane capability material out of browser state, repository files, ordinary logs, worker payloads and chat
- use exact-SHA validation for executable release candidates

## Executable baseline and production evidence

Historical executable validation before PR #96/#97:

- executable main merge `c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`
- CI #1030 / run `34745795461`: SUCCESS
- 396/396 test files, 1,744/1,744 tests
- audit 0, typecheck, CommonJS CLI, scanner benchmark/matrix, optimized Next build, strict-CSP browser acceptance, production diagnostic and artifact upload all passed
- artifact `10314341432`

Recent released maintenance/documentation:

- PR #87 responsive admin/GitHub control-plane UI
- PR #88 Node 24/runtime-tooling alignment
- PR #90 public CI workflow example aligned to Node 24 with a permanent regression guard
- PR #92 branch-cleanup audit/manifest
- PR #93 persistent resume-state synchronization
- PR #94 GitHub App setup-state reconciliation

Historical production deployment recorded before PR #96/#97:

`dpl_FQ8JPMgvFbSY4SkK6tCxHuKZdEd6`

It was READY on docs-only main SHA `e157fb8150df76cc8166e3c695a6ed83d74d0077`, aliased to `scopeforge.dev`. Direct production fetch returned HTTP 200 with strict nonce CSP and the expected HSTS, frame-denial, `nosniff`, permissions-policy and referrer-policy headers.

Documentation-only main advances after this record do not invalidate the executable evidence above. Any later executable change requires fresh exact-SHA validation.

## GitHub App provider acceptance - issue #79

Positive owner/admin provider acceptance and controlled public repository import are proven. Issue #79 and `PHASE_10A1_GITHUB_APP_SETUP.md` now explicitly distinguish completed activation/import work from remaining live negative checks.

Two independent live authenticated negative canaries remain:

1. a different valid numeric installation ID must be rejected in an authenticated owner/admin callback flow
2. a normal workspace member/viewer must be unable to initiate or complete Connect GitHub

An authenticated owner Chrome session is now available, but the normal Connect GitHub flow stops at GitHub Confirm access (passkey/MFA). Production still has only owner memberships and no member/viewer identity for the second canary. Regression tests exist, but they must not be represented as live provider acceptance.

Keep #79 open. Do not expose provider secrets, weaken authorization, mutate an owner role, or bypass the gate to make the canaries easier.

## Phase 10A2 - private repository acquisition

PR #76 remains draft/open at recorded head:

`709ef8af4ce4befae12ba910d3bca15599b5cab1`

Its PR description records the completed positive provider canary and completed read-only migration preflight.

Production migration history remains recorded through:

`20260911143049_phase_10a1_service_role_table_acl_hardening`

Reviewed Phase 10A2 migrations remain unapplied:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

Do not reconcile/apply/activate #76 ahead of #79. Do not repeat the already-completed schema/transactional preflight unless PR #76 or production schema changes materially.

After #79 clears: fetch live main -> re-read actual #76 -> reconcile -> exact validation -> migration re-read -> apply only absent reviewed migrations -> schema/RLS/grant verification -> private worker containment/quota/cleanup/observability/rollback canary -> immutable private snapshot -> exact zero-egress scan -> findings -> merge/release only if every gate passes.

If a final host-level containment probe genuinely needs SSH unavailable here, hand off only that probe to Codex/VS Code or another approved SSH environment.

## Phase 10A3 - GitHub webhook reconciliation

PR #77 remains draft/open. Its PR description no longer says Phase 10A1 is dark-gated.

Current pre-reconciliation evidence:

- executable head `7e2c8ef3dc9354eb5545867e91567960a692079f`
- terminal-watermark fix candidate `dfc4e4e0dad4c705f0ff7ef82183ed5247aa1fe8`
- validated synthetic merge `31f8a741c884907704f11e25eabb2fdbf343f116`
- identical validated/current tree `d7dd1422664edf78b78be76afa36bc40aadc6c6b`
- PR #104 / CI run `34868229377`: SUCCESS, 415 files / 1,901 tests

Exact-head review found one medium workflow-integrity defect: snapshot completion advanced the successful SHA before repository-scan findings completed. PR #104 fixed it with forward migration `20260915010000_phase_10a3_terminal_scan_watermark.sql` and terminal task/job settlement. The migration is reviewed/validated only and remains unapplied.

Do not release #77 before #76. After #76 is released, reconcile #77 onto released live main, run fresh exact validation, apply only reviewed absent Phase 10A3 migrations, configure the independent webhook secret/endpoint, then prove signature/oversize rejection, replay, lifecycle, terminal success/failure, coalescing/recovery, public/private separation, leak boundaries and a complete automatic scan before merge.

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

PR #92 published `docs/development/BRANCH_CLEANUP_CANDIDATES.md` from a live audit. At the audit point there were 60 branches, 4 retain refs and 56 safe-delete refs. Only #76 and #77 were open PR heads.

The local authenticated Git CLI deleted 62 historical refs after checking all 68 branches, open PRs, commit reachability, the prior cleanup manifest, and active local worktrees. A post-delete fetch returned six refs: `main`, #76, #77, the demo branch, and two active-worktree branches. Three other active local worktree branches have no remote ref and were untouched.

## Resume procedure

1. Fetch live main, #76, #77 and #79 first.
2. Use exact embedded SHAs only as immutable validation/history evidence, not as a substitute for the live main ref.
3. Keep #79 parked until the two live negative canaries can be executed safely.
4. While parked, continue isolated maintenance/security/documentation/regression work that cannot weaken or bypass #79.
5. Do not apply Phase 10A2 migrations or enable private/runtime gates before #79 clears.
6. When #79 clears, follow strict #76 then #77 release order.
7. Preserve the six verified remote refs and re-audit before any future branch cleanup.
8. Update resume docs for semantic state changes, not merely because a docs-only merge advanced main.
9. Do not stop after one safe PR if another independent task is actionable.

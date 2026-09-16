# ScopeForge Unfinished Work Queue

## Latest collaborator-controls continuation - 2026-09-16

Read [Workspace collaborator controls](WORKSPACE_COLLABORATOR_CONTROLS_ACCEPTANCE.md) before historical status below. It records the active branch, security model, test evidence, pending migration/release validation, and the legitimate normal-member path for issue #79.

## Latest signup repair - 2026-09-16

Read [Signup confirmation acceptance](SIGNUP_CONFIRMATION_ACCEPTANCE.md) before the historical records below. It records the current user-reported onboarding defect, collaborator context, validation, and provider rollout. Issue #79 remains the Phase 10 release gate.

## Authoritative PR #116 continuation - 2026-09-15

Read [PR #116 upload expiry acceptance](PR_116_UPLOAD_EXPIRY_ACCEPTANCE.md) for the current implementation, genuine RED evidence, validation checkpoint, and ordered continuation. It supersedes all older status and immediate-task instructions below, including the former instruction to repair the HTTPS mock before implementation. Fetch live refs and checks before release decisions.

The Phase 10A2 working-state file exists on the fetched #76 branch, not on main; the acceptance record gives the exact read command. Issue #79 remains the release gate before #76, then #77. Historical production observations below are not new verification of memberships, schema, or runtime flags.

## Historical handoff snapshot

Last reconciled: 2026-09-15 (Asia/Singapore)

This is the persistent queue for genuinely unfinished work. Historical branches, old phase checklists and completed acceptance tasks are not new work by themselves.

## Live reconciliation - 2026-09-15

See `CURRENT_STATE.md` for the complete startup, provider and validation evidence. This summary supersedes older latest-state wording below; always fetch live refs.

- PR #96 internal Action pins and PR #98 startup/account instructions are released. PR #97 public Action pins are now merged as `39fa4b147d9ecbb12ae60335412bad95fbad91fe`; exact candidate `17c8c41b3ac79c3c7426612ce3bd9aba5c038824` passed [CI 34778529251](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34778529251), 398 files / 1,746 tests and every build/benchmark/browser step. Read post-merge checks separately.
- Startup Vercel production was READY on `da719b3ff1204bd2d6589cebb0b3a5dac2e22195` with the correct team/project/domain and Node 24.x. Direct production HTTP/security-header checks passed. Migration history in verified ScopeForge Supabase still stops at `20260911143049_phase_10a1_service_role_table_acl_hardening`.
- #79 remains open: owner Chrome access and GitHub confirmation work, but the existing production connection redirects a new Connect GitHub attempt to installed-App settings before ScopeForge can receive a fresh signed callback carrying an unrelated installation ID. Production has only two owner memberships and no member/viewer identity for the second canary. [Blocker evidence](https://github.com/LeDoNguyenTu/ScopeForge/issues/79#issuecomment-5655657881). Positive import was not repeated.
- Release order remains #79 -> draft #76 (`709ef8af4ce4befae12ba910d3bca15599b5cab1`) -> draft #77 (`d9466f40e38e84e2fc694396c5947aa0f95a2d5d`). No schema, hosted gate, provider credential, webhook or host change occurred; runtime environment values were not re-read.
- Exact-head static security review of PR #76 found no reportable source issue; [the review comment](https://github.com/LeDoNguyenTu/ScopeForge/pull/76#issuecomment-5659605414) preserves the cleanup/retention and exact production acceptance questions. It does not clear the release gates.
- PR #102's Windows portability work is merged with green post-merge Linux CI. PR #103 adds a real symlink-capability probe; its local focused tests, typecheck and full Windows suite pass (394 files / 1,724 tests, with unavailable symlink/POSIX/Podman cases skipped). Final branch cleanup is complete: exactly four remote refs remain (`main`, #76, #77 and the demo branch), with only local `main` and its worktree.

## Global rules

- fetch actual current `main`; do not infer it from a SHA embedded in this document
- inspect current PR/issue heads before acting
- preserve the accepted Command Center presentation, PR #87 responsive admin/GitHub UI, strict nonce CSP and browser security headers
- never rewrite deployed Supabase migrations; corrections are forward-only
- do not claim green gates without exact executable-SHA evidence
- do not enable hosted runtime capabilities merely because code, migrations or tests exist
- do not add generic URL/proxy/browser/arbitrary network authority
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- keep provider credentials/control-plane capability material out of browser state, ordinary logs, worker payloads, repository files and chat
- no AI co-author attribution

## Executable baseline

Historical executable main evidence before PR #96/#97:

- merge `c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`
- post-merge CI #1030 / run `34745795461`: SUCCESS
- 396/396 files and 1,744/1,744 tests
- typecheck, CommonJS CLI, benchmarks, optimized build, strict-CSP browser acceptance, production diagnostic and artifact upload: PASS

Historical production evidence recorded before PR #96/#97:

- deployment `dpl_FQ8JPMgvFbSY4SkK6tCxHuKZdEd6`
- READY on docs-only main SHA `e157fb8150df76cc8166e3c695a6ed83d74d0077`
- `scopeforge.dev` HTTP 200 with expected nonce CSP and security headers

Documentation-only merges may advance live main without changing executable behavior. Fetch the live ref at resume time. Any future executable change requires fresh exact-candidate validation.

Recent independent maintenance now complete:

- PR #88 Node 24/runtime-tooling alignment
- PR #90 public CI-guide Node 24 alignment and permanent regression guard
- PR #92 branch-cleanup audit/manifest
- PR #93 resume-state synchronization
- PR #94 GitHub App setup-state reconciliation

Do not recreate these tasks from older documents.

## Completed - do not recreate

- Phase 7 Community Security Packs local v1
- Phase 8A offline accuracy foundation
- Phase 8B deterministic scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A through 9E production/security hardening scope
- strict nonce CSP compatibility/enforcement
- accepted Command Center presentation restoration
- Phase 6D Tasks 14-16, including real Linux/rootless-Podman containment acceptance
- Phase 10A1 GitHub connected-project core
- Phase 10C platform administration
- PR #87 responsive admin/GitHub control-plane UI
- Phase 10A3 hardening issues #78, #80, #81, #82 and #85, terminal-watermark correction PR #104, and delivery-retention correction PR #106
- PR #88 runtime/tooling alignment
- PR #90 published CI runtime documentation alignment
- PR #92 complete branch audit and cleanup manifest
- PR #93 persistent resume-state synchronization
- PR #94 GitHub App setup-state reconciliation
- positive owner/admin GitHub App connection/install/import canary
- read-only Phase 10A2 migration/schema transactional preflight

## 1. Issue #79 - remaining live GitHub App negative canaries

Positive owner/admin provider activation, controlled repository import and safe metadata/RLS/cookie/redirect/log review are proven. Issue #79 and the GitHub App setup guide explicitly mark these checks complete.

Two live production checks still require a suitable authenticated browser/session surface:

1. submit a different valid numeric GitHub installation ID through an authenticated owner/admin callback flow and prove rejection
2. use an authenticated normal workspace member/viewer and prove Connect GitHub cannot be initiated or completed

Regression tests are not a substitute for these live canaries. Production currently has no known member/viewer identity available for the second check. Leave #79 open until both are independently evidenced. Do not expose secrets, weaken authorization, or mutate an owner role merely to create test data.

## 2. Phase 10A2 - PR #76 private repository acquisition

PR #76 remains draft/open at recorded head:

`709ef8af4ce4befae12ba910d3bca15599b5cab1`

Its PR description reflects the completed positive provider canary and completed schema preflight.

Production migration history remains recorded through `20260911143049_phase_10a1_service_role_table_acl_hardening`; Phase 10A2 migrations remain unapplied.

Do not repeat the same migration compatibility preflight unless PR #76 or production schema changes materially.

After #79 clears:

1. fetch live main, re-read actual #76, and reconcile
2. run fresh exact-candidate CI
3. re-read production migration history and apply only absent reviewed Phase 10A2 migrations
4. verify schema, RLS, grants/revokes, service-role boundaries and Security Advisor posture
5. complete private acquisition-worker containment, quotas, cancellation, cleanup, observability, rollback and staged canary acceptance
6. prove provider credential use remains control-plane-only
7. prove private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings
8. merge/release only when provider, code, schema, runtime, privacy and rollback gates are green

Do not enable ahead of acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`

If the final containment canary requires SSH/host control unavailable here, hand off only that exact probe to Codex/VS Code or another approved SSH environment.

## 3. Phase 10A3 - PR #77 webhook reconciliation

PR #77 remains draft/open and must follow Phase 10A2 release. Its PR description has been refreshed and no longer treats Phase 10A1 provider activation as dark-gated.

Current executable evidence before future reconciliation:

- executable head `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`
- delivery-retention fix candidate `d21641123659191eb50c126fe2f972eed73e44d4`
- validated synthetic merge `865dfe1443ae2995f73cdca6ea93dc8c1ea9c90f`
- identical validated/current tree `3f222059811008ed973d4e30b47550776cef7d6d`
- PR #106 / CI run `34869590260`: SUCCESS, 415 files / 1,901 tests; Vercel preview READY

PR #104 corrected a medium workflow-integrity defect: immutable snapshot acquisition no longer advances `successful_commit_sha` before the exact repository scan and findings publication succeed. Forward migration `20260915010000_phase_10a3_terminal_scan_watermark.sql` is unapplied and belongs in the eventual Phase 10A3 migration review/canary.

PR #106 added forward migration `20260915020000_phase_10a3_webhook_delivery_retention.sql`, which bounds authenticated delivery rows to seven days during service-role admission. It is unapplied and belongs in the eventual Phase 10A3 migration review/canary.

After #76 releases:

1. reconcile #77 onto released live main
2. run fresh exact-candidate validation
3. re-read production migration history and apply only absent reviewed Phase 10A3 migrations, including the terminal-watermark and webhook-delivery-retention forward corrections
4. configure the independent server-only webhook secret/endpoint without exposing it
5. prove invalid-signature and oversize rejection before JSON processing
6. prove replay, installation/repository lifecycle, latest-head coalescing, terminal success/failure settlement, same-head pending recovery and stale-trigger authoritative-head recovery
7. prove public/private separation and leak boundaries
8. prove a full automatic webhook-triggered scan through immutable snapshot publication to findings
9. merge/release only after all operational checks pass

## 4. Other hosted runtime enablement

Passive and active runtime worker code/release acceptance exists, but production enablement remains independently gated.

Keep false/absent until dedicated monitoring, rollback and staged-canary evidence authorizes them:

- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Do not use Phase 6D containment evidence, Phase 8 benchmark success or Phase 10 progress as automatic authorization.

## 5. Provider/security operations not yet directly verified

When supported account surfaces become available, separately verify external controls that repository source cannot prove, including any still-unverified Cloudflare/Vercel WAF/rate-limit state and Supabase/provider security settings recorded as unknown.

Do not silently upgrade `NOT VERIFIED` to enabled/enforced from application code alone.

## 6. Branch cleanup - complete

PR #92 published `docs/development/BRANCH_CLEANUP_CANDIDATES.md` from a fresh live audit.

Audit-point state:

- 60 branches
- exactly 2 open PR heads: #76 and #77
- 4 retain refs: `main`, #76, #77, `demo/portfolio-20260910`
- 56 refs classified safe to delete

The authenticated local Git CLI first deleted 62 historical refs after a fresh audit. On 2026-09-15, a second audit removed four clean completed worktrees, ten finished local branches, and the final two historical remote refs. The verified remote count is four and the local checkout has only `main`. Before any future cleanup:

1. re-fetch the complete branch list and active worktrees
2. preserve `main`, #76, #77, intentional/demo refs, every active worktree ref, and any newly active task/PR branch
3. preserve the current four-ref set unless later state provides a reviewed reason to change it
4. re-list refs after deletion and document the result

Never fake deletion by force-moving or repointing refs.

## UI baseline

PR #87 remains the responsive admin/GitHub UI baseline. Do not create cosmetic churn without concrete evidence of a real defect. Any future visual repair must preserve mobile no-horizontal-page-scroll, iOS safe-area behavior, minimum touch targets, semantic/accessibility behavior, strict CSP and authorization boundaries.

## Safe work while #79 is postponed

Safe independent work includes:

- documentation/handoff repair
- dependency/runtime/tooling maintenance
- regression-test strengthening
- architecture/security review
- evidence-based UI fixes
- branch/release hygiene

Any such work must stay isolated from provider authorization, production schema, hosted capability flags and the #76/#77 release order. It must not be used to claim #79, Phase 10A2 or Phase 10A3 operational acceptance.

At each resume, fetch live main first. Update this file for semantic state changes, not merely because a docs-only merge changed the main SHA.

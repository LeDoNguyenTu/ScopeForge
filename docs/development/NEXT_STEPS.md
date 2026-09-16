# ScopeForge Next Steps

## Latest collaborator-controls continuation - 2026-09-16

Read [Workspace collaborator controls](WORKSPACE_COLLABORATOR_CONTROLS_ACCEPTANCE.md) before historical status below. It records the active branch, security model, test evidence, pending migration/release validation, and the legitimate normal-member path for issue #79.

## Latest signup repair - 2026-09-16

Read [Signup confirmation acceptance](SIGNUP_CONFIRMATION_ACCEPTANCE.md) before the historical records below. It records the current user-reported onboarding defect, collaborator context, validation, and provider rollout. Issue #79 remains the Phase 10 release gate.

## Authoritative PR #116 continuation - 2026-09-15

Read [PR #116 upload expiry acceptance](PR_116_UPLOAD_EXPIRY_ACCEPTANCE.md) for the current implementation, genuine RED evidence, validation checkpoint, and ordered continuation. It supersedes all older status and immediate-task instructions below, including the former instruction to repair the HTTPS mock before implementation. Fetch live refs and checks before release decisions.

The Phase 10A2 working-state file exists on the fetched #76 branch, not on main; the acceptance record gives the exact read command. Issue #79 remains the release gate before #76, then #77. Historical production observations below are not new verification of memberships, schema, or runtime flags.

## Historical handoff snapshot

Last reconciled: 2026-09-15 (Asia/Singapore)

## Live reconciliation - 2026-09-15

See `CURRENT_STATE.md` for the complete startup, provider and validation evidence. This summary supersedes older latest-state wording below; always fetch live refs.

- PR #96 internal Action pins and PR #98 startup/account instructions are released. PR #97 public Action pins are now merged as `39fa4b147d9ecbb12ae60335412bad95fbad91fe`; exact candidate `17c8c41b3ac79c3c7426612ce3bd9aba5c038824` passed [CI 34778529251](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34778529251), 398 files / 1,746 tests and every build/benchmark/browser step. Read post-merge checks separately.
- Startup Vercel production was READY on `da719b3ff1204bd2d6589cebb0b3a5dac2e22195` with the correct team/project/domain and Node 24.x. Direct production HTTP/security-header checks passed. Migration history in verified ScopeForge Supabase still stops at `20260911143049_phase_10a1_service_role_table_acl_hardening`.
- #79 remains open: owner Chrome access and GitHub confirmation work, but the existing production connection redirects a new Connect GitHub attempt to installed-App settings before ScopeForge can receive a fresh signed callback carrying an unrelated installation ID. Production has only two owner memberships and no member/viewer identity for the second canary. [Blocker evidence](https://github.com/LeDoNguyenTu/ScopeForge/issues/79#issuecomment-5655657881). Positive import was not repeated.
- Release order remains #79 -> draft #76 (`709ef8af4ce4befae12ba910d3bca15599b5cab1`) -> draft #77 (`d9466f40e38e84e2fc694396c5947aa0f95a2d5d`). No schema, hosted gate, provider credential, webhook or host change occurred; runtime environment values were not re-read.
- Exact-head static security review of PR #76 found no reportable source issue; [the review comment](https://github.com/LeDoNguyenTu/ScopeForge/pull/76#issuecomment-5659605414) preserves the cleanup/retention and exact production acceptance questions. It is not release evidence.
- PR #102's Windows portability work is merged with green post-merge Linux CI. PR #103 adds a real symlink-capability probe; its local focused tests, typecheck and full Windows suite pass (394 files / 1,724 tests, with unavailable symlink/POSIX/Podman cases skipped). Final branch cleanup is complete: exactly four remote refs remain (`main`, #76, #77 and the demo branch), with only local `main` and its worktree.

## Resume/ref rule

Fetch the live `main` ref at the start of every session. Do not use a SHA embedded in this file as the current tip because documentation-only merges advance `main` after this text is authored.

Historical executable evidence before PR #96/#97 (see the current reconciliation above):

- historical validated executable main merge: `c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`
- CI #1030 / run `34745795461`: SUCCESS
- Node 24, audit 0 vulnerabilities
- 396/396 test files, 1,744/1,744 tests
- typecheck, CommonJS CLI, scanner benchmark, deterministic benchmark matrix, optimized Next build, strict-CSP browser acceptance, production diagnostic and artifact upload: PASS
- artifact `10314341432`

Historical production evidence recorded before PR #96/#97:

- deployment `dpl_FQ8JPMgvFbSY4SkK6tCxHuKZdEd6`
- READY on docs-only main SHA `e157fb8150df76cc8166e3c695a6ed83d74d0077`
- `scopeforge.dev` HTTP 200 with strict nonce CSP and expected security headers

Subsequent documentation-only merges do not require new executable CI. Any executable change does.

ScopeForge Supabase: `tdgpibrepzcvdivztkta`.

Recent independent maintenance released:

- PR #87 responsive admin/GitHub UI
- PR #88 Node 24/runtime-tooling alignment
- PR #90 public CI-guide Node 24 alignment and regression guard
- PR #92 branch-cleanup audit/manifest
- PR #93 persistent resume-state synchronization
- PR #94 GitHub App setup-state reconciliation

## Priority 1 - issue #79 live negative provider acceptance

Positive provider acceptance is already proven and issue #79 now states that clearly:

- provider gate active
- owner/admin GitHub App install/proof completed
- `LeDoNguyenTu` connection persisted active
- `LeDoNguyenTu/ScopeForge` imported successfully
- repository access active
- safe metadata, RLS, cookie, redirect and checked log boundaries reviewed

Still required as live authenticated production canaries:

1. authenticated owner/admin callback with a different valid numeric installation ID must be rejected
2. authenticated normal member/viewer must be unable to initiate or complete Connect GitHub

An authenticated owner Chrome session is available, but the normal Connect GitHub flow reaches GitHub Confirm access and requires owner passkey/MFA. Read-only production verification found only two owner memberships and no member/viewer identity for the second canary. Keep #79 open. Do not substitute unit/regression evidence, weaken authorization, expose secrets, or mutate an owner account to manufacture a pass.

Keep all repository snapshot/scan worker runtime flags false/absent while #79 remains open.

## Priority 2 - Phase 10A2 private repository acquisition

PR #76:

- branch `feat/phase-10a2-private-repository-acquisition`
- recorded head `709ef8af4ce4befae12ba910d3bca15599b5cab1`
- draft/open
- PR description refreshed on 2026-09-13 to reflect completed positive provider acceptance and schema preflight

Production migration history remains recorded through `20260911143049_phase_10a1_service_role_table_acl_hardening`; Phase 10A2 targets remain intentionally unapplied.

Reviewed migrations waiting behind #79:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

Read-only schema/transactional preflight for those two migrations is already complete. Required tables, keys, exact function signatures, ACL assumptions, CHECK-constraint compatibility, existing-row compatibility, and absence of the new target objects were verified. Do not repeat that preflight unless #76 or production schema changes materially.

After #79 clears:

1. fetch live `main`, re-read actual #76, and reconcile
2. run fresh exact-candidate CI
3. re-read production migration history and apply only absent reviewed Phase 10A2 migrations
4. verify private tables/RPCs, ACLs, revokes/grants, RLS and Security Advisor posture
5. verify the selected private repository remains accessible to the GitHub App with intended read-only permissions
6. complete dedicated private snapshot worker containment, quotas, cancellation/cleanup, observability and rollback acceptance
7. prove one complete private connected-project flow: project scan request -> private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings
8. prove provider credentials remain control-plane-only and private source/capability material does not appear in browser state or ordinary logs
9. merge/release #76 only when provider, code, schema, runtime, privacy and rollback gates are green
10. verify production after merge

If the exact containment canary requires SSH/host control unavailable here, hand off only that host-level probe to Codex/VS Code or another approved SSH environment.

## Priority 3 - Phase 10A3 GitHub webhook reconciliation

PR #77 remains draft/open and its description has been refreshed to remove stale dark-gated Phase 10A1 wording.

Current pre-reconciliation evidence:

- executable head `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`
- delivery-retention fix candidate `d21641123659191eb50c126fe2f972eed73e44d4`
- validated synthetic merge `865dfe1443ae2995f73cdca6ea93dc8c1ea9c90f`
- identical validated/current tree `3f222059811008ed973d4e30b47550776cef7d6d`
- PR #106 / CI run `34869590260`: SUCCESS, 415 files / 1,901 tests; Vercel preview READY

PR #104 fixed a medium workflow-integrity defect found in exact-head review: snapshot publication had advanced the successful commit watermark before repository-scan findings completed. Forward migration `20260915010000_phase_10a3_terminal_scan_watermark.sql` now binds settlement to exact terminal scan task/job and immutable snapshot state. It remains unapplied pending the ordered release gates.

PR #106 added forward migration `20260915020000_phase_10a3_webhook_delivery_retention.sql`, which bounds authenticated delivery records to a rolling seven-day window during the same service-role admission transaction. It remains unapplied pending the ordered release gates.

After Phase 10A2 releases:

1. reconcile #77 onto released main/Phase 10A2
2. run fresh exact validation
3. re-read/apply only reviewed absent Phase 10A3 migrations, including the terminal-watermark and webhook-delivery-retention forward corrections
4. configure the independent server-only webhook secret/endpoint without exposing secret material
5. prove invalid-signature and oversize rejection before JSON processing
6. prove replay, installation/repository lifecycle, latest-head coalescing, terminal success/failure settlement, same-head pending recovery and stale-trigger authoritative-head recovery
7. prove public/private separation and leak boundaries
8. prove a complete automatic webhook-triggered immutable-snapshot scan through findings
9. merge/release only after operational acceptance passes
10. verify production after merge

## Runtime gates

Keep false/absent until independently accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

CI success, schema presence, UI availability or historical containment evidence does not authorize production worker activation.

## Priority 4 - branch cleanup after a fresh active-work audit

PR #92 published the authoritative cleanup manifest after a live audit:

- audit baseline: 60 branches
- only #76 and #77 backed open PRs
- 4 retain refs: `main`, #76, #77, `demo/portfolio-20260910`
- 56 refs were safe-delete candidates at that audit point

The authenticated local Git CLI first deleted 62 historical refs. On 2026-09-15, a fresh audit removed four clean completed worktrees, ten finished local branches, and the final two historical remote refs. The verified final remote set is `main`, #76, #77 and `demo/portfolio-20260910`; the only local branch/worktree is `main`. Preserve this set and re-audit before any future deletion.

Use `docs/development/BRANCH_CLEANUP_CANDIDATES.md` as the starting manifest.

## Safe work while #79 is postponed

Continue only work independent of the provider gate, including:

- narrowly scoped documentation repair
- dependency/runtime/tooling maintenance
- regression-test strengthening
- architecture/security review
- evidence-based UI bug fixes
- branch/handoff hygiene

Do not use any independent maintenance PR as evidence that #79, Phase 10A2 or Phase 10A3 operational acceptance has passed.

## Historical external-host work

Phase 6D Tasks 14-16, including the real Oracle Linux/rootless-Podman Task 15 acceptance, are complete. Do not repeat them.

## Continuation rule

Fetch live refs first. Keep working through safe independent tasks while #79 is parked. Once owner GitHub confirmation and a legitimate member/viewer session are available, finish #79 without weakening its live-canary requirements, then proceed #76 -> #77 in strict order. Keep the resume documents synchronized semantically, but do not chase each documentation-only main SHA.

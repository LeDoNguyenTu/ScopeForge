# ScopeForge Codex handoff

## Latest collaborator-controls continuation - 2026-09-16

Read [Workspace collaborator controls](WORKSPACE_COLLABORATOR_CONTROLS_ACCEPTANCE.md) before historical status below. It records the active branch, security model, test evidence, pending migration/release validation, and the legitimate normal-member path for issue #79.

## Latest signup repair - 2026-09-16

Read [Signup confirmation acceptance](SIGNUP_CONFIRMATION_ACCEPTANCE.md) before the historical records below. It records the current user-reported onboarding defect, collaborator context, validation, and provider rollout. Issue #79 remains the Phase 10 release gate.

## Authoritative PR #116 continuation - 2026-09-15

Read [PR #116 upload expiry acceptance](PR_116_UPLOAD_EXPIRY_ACCEPTANCE.md) for the current implementation, genuine RED evidence, validation checkpoint, and ordered continuation. It supersedes all older status and immediate-task instructions below, including the former instruction to repair the HTTPS mock before implementation. Fetch live refs and checks before release decisions.

The Phase 10A2 working-state file exists on the fetched #76 branch, not on main; the acceptance record gives the exact read command. Issue #79 remains the release gate before #76, then #77. Historical production observations below are not new verification of memberships, schema, or runtime flags.

## Historical handoff snapshot

Prepared: 2026-09-15, Asia/Singapore

This is the primary handoff for resuming ScopeForge in Codex. It supersedes older Codex resume instructions where they conflict.

The core rule is: **synchronize live state first, then continue from the exact active candidate.** Do not trust an embedded SHA until you confirm it still matches GitHub.

## 1. Mandatory startup

At the start of the Codex session:

```bash
git remote -v
git status --short --branch
git fetch --all --prune
git branch -vv
git rev-parse HEAD
git rev-parse origin/main
```

Then inspect live GitHub state for:

- `main`
- PR #116
- issue #79
- PR #76
- PR #77
- any newer open PRs/issues created after this handoff
- exact CI/check state for the active candidate

Read in this order:

1. root `AGENTS.md`
2. `docs/development/CODEX_HANDOFF.md`
3. `docs/development/LATEST_SESSION.md`
4. `docs/development/ACCOUNT_CONTEXT_CHECKLIST.md`
5. `docs/development/CURRENT_STATE.md`
6. `docs/development/NEXT_STEPS.md`
7. `docs/development/SESSION_HANDOFF.md`
8. `docs/development/UNFINISHED_WORK.md`
9. `docs/development/PHASE_10A2_WORKING_STATE.md`
10. live PR/issue bodies, comments, diffs, checks, and review state

If a document conflicts with live repository/provider evidence, live evidence wins. Repair stale documentation when the difference matters to future sessions.

## 2. Current repository snapshot

Live state reconciled immediately before this handoff:

- repository: `LeDoNguyenTu/ScopeForge`
- executable `main` baseline before these documentation-only commits: `b2dfde44399195f560064d99c8df50e790d56e5e`
- production domain: `https://scopeforge.dev`
- Vercel team: `itsbrian` / `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- Vercel project: `scopeforge` / `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- wrong/different Supabase, Brian Job Command Center: `xwsergbpvkcsugexssmc`
- Node runtime baseline: Node 24

Documentation-only commits may advance `main` after the executable baseline above. Fetch live refs before acting.

## 3. Immediate work item - PR #116

PR #116 is the first Codex task.

Title: `Recheck repository upload capability expiry before PUT`

Current branch at handoff:

- branch: `fix/repository-upload-expiry-toctou-20260915`
- head: `65ff37a2d3de2fae76951313f73ba626dba91985`
- base: `main`
- production code changed so far: **no**
- current diff: test-only

### Root cause under investigation

Shared repository snapshot uploader:

`packages/repository-snapshot-network/upload.ts`

Current behavior validates `RepositorySnapshotUploadDescriptor.expiresAt` before awaiting filesystem `stat()`. There is no second expiry check immediately before `httpsRequest()` starts the signed R2 PUT.

Potential TOCTOU sequence:

1. signed upload descriptor is valid
2. `assertUploadDescriptor()` passes
3. code awaits `stat(artifactPath)`
4. descriptor expires during that async gap
5. current code can still proceed toward the HTTPS PUT

The intended security requirement is fail-closed authorization at time of use: if the signed upload capability expires before the PUT starts, no network request should begin.

### TDD status - no valid RED yet

The regression file is:

`tests/repository-snapshots/upload-expiry.test.ts`

It advances the mocked clock from before expiry to after expiry across the async `stat()` boundary and expects:

- rejection with `Repository snapshot upload authorization is expired.`
- `stat()` called once
- HTTPS request not called

Two CI attempts failed in the test harness before the assertion executed. **Neither is valid RED evidence.**

#### Attempt 1

- test-only head before harness repair: `e8faa986411d41c526f4238654dc50cd892b7cb7`
- CI run: `34943411866`
- audit: 0 vulnerabilities
- existing suite reached 398 passing files / 1,759 passing tests
- failure: the full replacement mock for `node:fs/promises` omitted required/default exports

This run proves only that the test harness was invalid.

#### Attempt 2

- current head: `65ff37a2d3de2fae76951313f73ba626dba91985`
- CI run: `34943713195`
- audit: 0 vulnerabilities
- existing suite again reached 398 passing files / 1,759 passing tests
- `node:fs/promises` was converted to a partial mock successfully
- failure moved to the `node:https` mock because it still replaces the module and omits required/default exports

This run also does not count as RED.

### Exact Codex resume step for PR #116

Do this before any production code change:

1. fetch live `main` and PR #116
2. inspect `tests/repository-snapshots/upload-expiry.test.ts`
3. preserve the current partial `node:fs/promises` mock
4. convert `node:https` to a partial mock using `importOriginal`, preserving all real exports and overriding only `request`
5. run the focused test if practical
6. push the test-harness-only candidate
7. require CI to reach the actual regression assertion

A **valid RED** must fail because current product code attempts or reaches the network request after expiry, or otherwise fails the explicit expiry expectation. Module-loading, mock-shape, TypeScript, or unrelated failures are not valid RED.

Only after valid RED:

1. make the smallest fail-closed production change
2. expected minimal shape: recheck descriptor expiry after `stat()` and immediately before starting the HTTPS PUT, while preserving existing URL/method/policy validation and error wording
3. do not redesign the upload layer unless evidence requires it
4. run focused GREEN
5. run full validation on the exact candidate
6. merge PR #116 to `main` only if the exact candidate is genuinely green

Expected validation after GREEN:

- `npm audit --audit-level=info`
- full `npm test`
- `npm run typecheck`
- CLI build/version
- scanner benchmark
- benchmark matrix
- optimized Next build
- CSP/responsive browser acceptance
- production `scopeforge.dev` diagnostic
- Vercel status
- exact PR merge candidate verification

PR #116 is shared infrastructure on `main`. It is intentionally independent from draft Phase 10A2. PR #76 should inherit the released fix later through its post-#79 reconciliation.

## 4. Work completed immediately before handoff

### PR #115 - private archive stream cleanup

PR #115 was completed and merged **only into the draft Phase 10A2 branch**, not into `main`.

Root cause:

- private executor calls `openArchive()` before creating its local scratch directory
- if `openArchive()` succeeds but scratch setup fails, parsing never begins
- parser cleanup therefore never owns the already-open private response stream
- the executor could return failure without destroying that response

Fix:

- retain the opened response at executor scope
- on execution failure, destroy it if a lower layer has not already destroyed it
- preserve successful behavior, parser cleanup, cancellation semantics, failure mapping, provider authorization, schema, and runtime gates

TDD evidence:

- RED run: `34942092028`
- RED result: 401/402 test files and 1,790/1,791 tests passed, with the sole new failure proving `destroy()` was called 0 times
- GREEN head: `209af3ab174742e31c1011ac428bc50048e30698`
- exact GREEN merge candidate: `6bec7471c1fb9376fe7943ab1617eb7d619f9b2a`
- GREEN CI run: `34942497310`
- GREEN result: 402/402 test files and 1,791/1,791 tests passed
- audit: 0 vulnerabilities
- typecheck, CLI, benchmarks, optimized build, CSP browser acceptance, production diagnostic, artifact upload, and Vercel passed
- artifact: `10385602800`
- merge into #76 branch: `778b5bf2abff4678bb1c4fce7f378fe5f179cb9b`

Do not redo PR #115 unless new evidence shows a regression.

### Phase 10A2 working-state documentation

`docs/development/PHASE_10A2_WORKING_STATE.md` was updated after #115.

PR #76 body was also refreshed so its current security-hardening history includes:

- PR #113 - trusted claim workspace/asset binding
- PR #114 - broker authority expiry recheck
- PR #115 - private archive stream cleanup

Historical validation on these isolated hardening PRs is useful branch evidence, but it is **not** final Phase 10A2 release proof after future reconciliation with `main`.

## 5. Hard release blocker - issue #79

Issue #79 remains OPEN.

Positive production provider acceptance is already complete and must not be repeated as pending:

- `HOSTED_GITHUB_INTEGRATION_ENABLED=true` is active
- owner/admin Connect GitHub succeeded
- active GitHub connection for `LeDoNguyenTu` persisted
- `LeDoNguyenTu/ScopeForge` listing/import succeeded
- unauthenticated connect/callback remains behind sign-in
- provider/log/integration-row/browser-readable leakage review found no release-blocking token/secret exposure

Exactly two live authenticated negative production browser canaries remain:

1. authenticated owner/admin normal signed flow with a **different valid GitHub installation ID**, proving rejection because the installation does not belong to the authorized connection/workspace
2. authenticated legitimate normal workspace member/viewer, proving that role cannot initiate or complete Connect GitHub

Known blocker conditions:

- production currently has no legitimate member/viewer identity suitable for the second canary
- the existing GitHub App installation can redirect a new Connect attempt into installed-App settings, making the first canary difficult to exercise through a fresh normal signed flow

Never satisfy #79 by:

- fabricating a membership
- downgrading an owner solely for testing
- forging callback state
- bypassing authorization
- editing production database state to manufacture acceptance
- substituting unit/CI tests for the required browser canary

If either live canary exposes a defect, keep Phase 10A2 gates off and remediate before release work continues.

## 6. Phase 10A2 - PR #76

Current live state at handoff:

- PR: #76 `Phase 10A2 private repository acquisition`
- state: open, draft
- branch: `feat/phase-10a2-private-repository-acquisition`
- head: `b09e03258329251361cf8d515458e0ff7d708e2c`
- latest executable hardening merge before docs: `778b5bf2abff4678bb1c4fce7f378fe5f179cb9b`

Do **not** merge #76 while #79 remains open.

Do **not** reconcile #76 onto current `main` merely to make it current while #79 remains open. The existing plan is to reconcile once after #79 clears and then run fresh exact-candidate validation.

Production Phase 10A2 migrations remain unapplied:

- `supabase/migrations/20260911100000_phase_10a2_private_repository_snapshot.sql`
- `supabase/migrations/20260911110000_phase_10a2_private_project_scan_routing.sql`

Important migration note:

- older read-only compatibility preflight passed
- PR #113 later changed the first migration's private worker claim body so it returns authoritative `workspaceId` and `assetId` for trusted control-plane reauthorization
- therefore the exact current migration must be re-reviewed before production apply
- do not treat the older preflight alone as authorization to apply the changed migration

After #79 genuinely clears:

1. fetch live `main`, #76, and production migration history
2. reconcile #76 onto current/released `main`, preserving #113/#114/#115 and all mainline security fixes, including PR #116 if released
3. run fresh exact-candidate validation
4. re-review the changed Phase 10A2 migration
5. apply only absent reviewed Phase 10A2 migrations to ScopeForge Supabase `tdgpibrepzcvdivztkta`
6. verify schema, ACLs, RLS/private-table privileges, function bodies, and Supabase Security Advisor results
7. keep private snapshot/scan runtime gates off until dedicated private worker acceptance
8. complete containment, quotas, scratch/output ceilings, cancellation/cleanup, observability, rollback, and credential-boundary checks
9. prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings end to end
10. prove GitHub credentials remain control-plane-only
11. merge/release only after provider, schema, runtime, privacy, rollback, and production verification all pass

Historical Phase 6D Task 15 Linux/rootless-Podman acceptance is complete. Do not repeat it as generic setup work.

## 7. Phase 10A3 - PR #77

Current live state at handoff:

- PR: #77 `Phase 10A3 GitHub webhook reconciliation`
- state: open, draft
- branch: `feat/phase-10a3-github-webhook-reconciliation`
- current head observed: `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`
- PR body contains older embedded executable SHAs, so always trust live head/checks over those historical references
- base remains the Phase 10A2 branch

Do not merge or release #77 before #76 releases.

After Phase 10A2 release:

1. reconcile live #77 onto the released Phase 10A2/main baseline
2. run fresh exact-candidate validation
3. apply only reviewed absent Phase 10A3 migrations
4. configure independent server-only webhook secret/endpoint
5. prove raw-body HMAC verification, invalid-signature rejection, oversize rejection, replay handling, install/repository lifecycle handling, latest-head coalescing, same-head pending recovery, stale-trigger authoritative-head recovery, public/private separation, leak checks, and a complete automatic scan
6. merge/release only after operational acceptance

Do not reuse old CI as release proof if executable code changes during reconciliation.

## 8. Runtime gates and production safety

Keep these false/absent until their exact capability has staged operational and rollback acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

`HOSTED_GITHUB_INTEGRATION_ENABLED` is separate and is already active after the positive provider canary.

Do not infer runtime acceptance from code presence, schema presence, historical containment evidence, unit tests, or successful builds.

No Phase 10A2/10A3 production migration, webhook secret, production membership, provider authorization rule, or private worker runtime gate was changed during the latest work.

## 9. External account checks before writes

Verify exact non-secret target identity before any provider mutation.

### GitHub

- repository: `LeDoNguyenTu/ScopeForge`
- expected owner identity: `LeDoNguyenTu`

### Supabase

- ScopeForge: `tdgpibrepzcvdivztkta`
- never confuse with Job Command Center: `xwsergbpvkcsugexssmc`

### Vercel

- team: `itsbrian`
- team ID: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- project: `scopeforge`
- project ID: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- domain: `scopeforge.dev`

### Cloudflare

Verify the account containing:

- authoritative `scopeforge.dev` DNS zone
- ScopeForge Turnstile resource
- production R2 account/bucket matching server-side configuration

Do not use secret values as identity proof and do not paste them into Codex, issues, PRs, docs, logs, or browser-readable state.

### Oracle Cloud / worker host

Historical worker acceptance used Oracle Cloud in Singapore. Verify tenancy, compartment, region, and host before any new host mutation. Do not rerun historical acceptance without a source/runtime change that actually requires it.

A provider-account mismatch is a stop condition for external writes.

## 10. Engineering rules for Codex

- inspect before editing
- use TDD for bug fixes/features where applicable
- require a real failing regression, not a broken test harness
- keep changes scoped
- do not expose secrets
- do not rewrite deployed Supabase migrations
- preserve RLS and service-role boundaries
- preserve strict nonce CSP/security headers
- preserve zero-egress/containment boundaries
- do not add AI co-author attribution
- avoid force-push unless explicitly required and approved
- do not delete branches backing open PRs
- do not enable production runtime gates merely because code is green
- do not weaken authorization to unblock a test
- require fresh exact-candidate validation after reconciliation
- update persistent documentation after meaningful state changes

## 11. Recommended Codex continuation order

1. **Finish PR #116 TDD correctly**
   - repair `node:https` partial mock
   - obtain valid RED
   - implement minimal expiry recheck
   - obtain full GREEN
   - review and merge to `main`
2. Re-fetch live refs and update docs if #116 advances `main`.
3. Check whether legitimate conditions now exist to perform the two issue #79 live canaries.
4. If #79 is still blocked, continue only independent safe maintenance/security work.
5. When #79 clears, execute Phase 10A2 release sequence for #76.
6. Only after #76 releases, reconcile and release #77.

## 12. Copy-paste prompt for Codex

```text
Continue my ScopeForge project autonomously from the actual current repository state.

Repository:
https://github.com/LeDoNguyenTu/ScopeForge

Start with reconciliation, not remembered context.

MANDATORY STARTUP

1. Read root AGENTS.md.
2. Verify the remote is LeDoNguyenTu/ScopeForge.
3. Run git status, fetch --all --prune, resolve live origin/main, current branch/worktree, all open PRs/issues, and exact current checks.
4. Read in order:
   - docs/development/CODEX_HANDOFF.md
   - docs/development/LATEST_SESSION.md
   - docs/development/ACCOUNT_CONTEXT_CHECKLIST.md
   - docs/development/CURRENT_STATE.md
   - docs/development/NEXT_STEPS.md
   - docs/development/SESSION_HANDOFF.md
   - docs/development/UNFINISHED_WORK.md
   - docs/development/PHASE_10A2_WORKING_STATE.md
5. Compare docs with live GitHub state. Live state wins.
6. Before any external-provider write, verify the non-secret target identity. ScopeForge Supabase is tdgpibrepzcvdivztkta. Never confuse it with Brian Job Command Center xwsergbpvkcsugexssmc.

FIRST TASK: PR #116

Resume PR #116, Recheck repository upload capability expiry before PUT.

At handoff time:
- branch: fix/repository-upload-expiry-toctou-20260915
- head: 65ff37a2d3de2fae76951313f73ba626dba91985
- production code has NOT been changed
- current work is test-only

The suspected bug is in packages/repository-snapshot-network/upload.ts: the signed R2 descriptor expiry is checked before awaiting stat(), but not rechecked immediately before the HTTPS PUT starts.

The intended regression is tests/repository-snapshots/upload-expiry.test.ts.

Important: no valid RED exists yet. CI 34943411866 failed because the node:fs/promises mock replaced required exports. CI 34943713195 then failed because node:https still replaces required exports. Do not count either as TDD RED.

First convert node:https to a partial mock that preserves the real module and overrides only request. Keep production code unchanged. Run focused test/CI until the test reaches the actual behavior assertion. Accept RED only if current product behavior fails the expiry-at-time-of-use requirement. Then implement the smallest fail-closed fix, expected to be a second expiry check after stat() and immediately before starting the PUT. Run full exact-candidate validation and merge only when genuinely green.

PRIMARY RELEASE QUEUE AFTER PR #116

- issue #79: two remaining live authenticated GitHub App negative canaries
- PR #76 Phase 10A2 private repository acquisition, only after #79 clears
- PR #77 Phase 10A3 webhook reconciliation, only after #76 releases

Do not repeat completed work:
- positive owner/admin GitHub App connection/import canary is complete
- Phase 6D Task 15 Linux/rootless-Podman acceptance is complete
- PR #113, #114, #115 hardening is already integrated into #76

SECURITY/RELEASE RULES

- never expose secrets or private provider credentials
- never fabricate production membership/state to pass #79
- never rewrite deployed migrations
- keep private/repository worker gates off until their own operational acceptance
- do not merge #76 while #79 is open
- do not merge #77 before #76 releases
- require fresh exact-candidate validation after reconciliation
- use TDD and require genuine RED evidence
- do not add AI co-author attribution
- document meaningful state changes before finishing

Handle normal engineering decisions autonomously. Continue safe independent work if #79 remains legitimately blocked, but never bypass the release gate.
```

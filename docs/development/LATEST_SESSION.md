# ScopeForge Latest Session Reconciliation

## Latest signup repair - 2026-09-16

Read [Signup confirmation acceptance](SIGNUP_CONFIRMATION_ACCEPTANCE.md) before the historical records below. It records the current user-reported onboarding defect, collaborator context, validation, and provider rollout. Issue #79 remains the Phase 10 release gate.

## Authoritative PR #116 continuation - 2026-09-15

Read [PR #116 upload expiry acceptance](PR_116_UPLOAD_EXPIRY_ACCEPTANCE.md) for the current implementation, genuine RED evidence, validation checkpoint, and ordered continuation. It supersedes all older status and immediate-task instructions below, including the former instruction to repair the HTTPS mock before implementation. Fetch live refs and checks before release decisions.

The Phase 10A2 working-state file exists on the fetched #76 branch, not on main; the acceptance record gives the exact read command. Issue #79 remains the release gate before #76, then #77. Historical production observations below are not new verification of memberships, schema, or runtime flags.

## Historical handoff snapshot

Last reconciled: 2026-09-15, Asia/Singapore

Read this immediately after root `AGENTS.md` and `docs/development/CODEX_HANDOFF.md` when resuming work. This file records the latest implementation session and supersedes older status wording where it conflicts. Always fetch live refs before acting.

## Current baseline at handoff

- repository: `LeDoNguyenTu/ScopeForge`
- executable `main` baseline before the latest documentation-only commits: `b2dfde44399195f560064d99c8df50e790d56e5e`
- Codex handoff refresh commit: `4c807b6c2e74f055c1bff2e7f21a85bc56207bc5`
- production: `https://scopeforge.dev`
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- do not use Job Command Center Supabase `xwsergbpvkcsugexssmc`

This file update itself advances `main` again as documentation-only. Fetch live `main` instead of assuming the SHA above is still the tip.

## Session objective

The session resumed ScopeForge from the repository documentation and live GitHub state while issue #79 remained the hard Phase 10 release blocker.

The operating rule was:

- do not bypass #79
- do not apply Phase 10A2/10A3 production migrations
- do not enable private/repository worker runtime gates
- continue only safe, independently reviewable security/CI hardening
- use TDD for defects
- require exact-candidate evidence before merge

## Live state reconciled at session start

At the start of the work:

- `main` was still the post-PR #112 documentation baseline
- PR #76 remained open and draft
- PR #77 remained open and draft
- issue #79 still required exactly two live authenticated negative provider canaries
- Phase 10A2 migrations remained unapplied
- hosted repository/private scan worker gates remained off

PR #77 had advanced from older embedded documentation, so its old recorded SHA was treated as stale and no executable Phase 10A3 work was attempted.

## Work completed - PR #115

### Finding

While auditing the Phase 10A2 private snapshot execution path, a cleanup gap was found in:

`packages/worker-supervisor/private-repository-snapshot.ts`

The executor performs this sequence:

1. `openArchive()` obtains the private codeload response stream
2. local scratch work directory is created
3. archive parsing begins

The parser already destroys the input stream and removes its scratch state on parser failures. However, if `openArchive()` succeeded and `createWorkDirectory()` failed before parsing started, the parser never owned the stream. The executor could return a failure while the already-open private response remained undestroyed.

### RED

A focused regression was added to:

`tests/repository-snapshots/private-executor.test.ts`

The test proved:

- codeload response stream exists
- scratch setup throws
- parser is never called
- bundle creation is never called
- upload is never called
- the response must be destroyed

RED CI run:

- run: `34942092028`
- result: 401/402 test files passed
- result: 1,790/1,791 tests passed
- audit: 0 vulnerabilities
- sole new failure: expected `destroy()` once, received 0
- no unrelated failures

This was accepted as valid RED.

### GREEN

Minimal production fix:

- retain the opened private archive response at executor scope
- in the execution failure path, destroy it if it exists and a lower layer has not already destroyed it

The fix intentionally did not change:

- successful private acquisition flow
- parser cleanup semantics
- cancellation semantics
- failure-code mapping
- provider authorization
- worker contract
- schema
- production flags

GREEN evidence:

- implementation head: `209af3ab174742e31c1011ac428bc50048e30698`
- exact merge candidate: `6bec7471c1fb9376fe7943ab1617eb7d619f9b2a`
- CI run: `34942497310`
- 402/402 test files passed
- 1,791/1,791 tests passed
- audit: 0 vulnerabilities
- typecheck passed
- CLI build/version passed
- scanner benchmark passed
- benchmark matrix passed
- optimized Next build passed
- CSP browser acceptance passed
- production `scopeforge.dev` UI/Turnstile diagnostic passed
- UI artifact upload passed
- artifact ID: `10385602800`
- Vercel status passed

PR #115 merged **only into the Phase 10A2 branch** as:

`778b5bf2abff4678bb1c4fce7f378fe5f179cb9b`

It was not merged directly to `main` because the private executor belongs to unreleased Phase 10A2.

## Phase 10A2 documentation refresh

After #115 merged, the authoritative Phase 10A2 working-state document was refreshed:

`docs/development/PHASE_10A2_WORKING_STATE.md`

PR #76 body was also updated.

Current live PR #76 state observed before Codex handoff:

- state: open, draft
- branch: `feat/phase-10a2-private-repository-acquisition`
- head: `b09e03258329251361cf8d515458e0ff7d708e2c`
- latest executable hardening merge: `778b5bf2abff4678bb1c4fce7f378fe5f179cb9b`

The latest hardening history on #76 is:

### PR #113

Trusted claim workspace/asset binding.

Closed a private-source authorization TOCTOU boundary by carrying authoritative `workspaceId` and `assetId` through the trusted control-plane claim path and reauthorizing the repository link plus GitHub connection against the claimed workspace/asset/repository identity before minting provider authority.

Those control-plane identifiers remain stripped from the worker-facing contract.

### PR #114

Broker authority expiry recheck.

Closed the timing boundary where worker lease/task deadline/installation authority could expire during asynchronous GitHub provider operations before the temporary private codeload capability crossed into the worker contract.

### PR #115

Private archive stream cleanup, described above.

Historical branch CI for #113/#114/#115 is useful hardening evidence, but it is not final Phase 10A2 release proof after future reconciliation with `main`.

## New shared-mainline finding - PR #116

After #115, the audit moved to the shared artifact-upload capability boundary in:

`packages/repository-snapshot-network/upload.ts`

### Suspected root cause

`uploadRepositorySnapshotArtifact()` currently:

1. checks abort state
2. calls `assertUploadDescriptor()`
3. validates descriptor method, expiry, URL, host/path/signature policy
4. awaits filesystem `stat()`
5. begins HTTPS PUT

The descriptor expiry is checked before `stat()` but not rechecked immediately before the PUT.

Potential TOCTOU:

- descriptor valid at step 2
- descriptor expires while awaiting `stat()`
- request can still start afterward

This is shared repository snapshot infrastructure already present on released `main`, so it was isolated as a separate PR targeting `main` rather than mixed into Phase 10A2.

PR #116:

- title: `Recheck repository upload capability expiry before PUT`
- branch: `fix/repository-upload-expiry-toctou-20260915`
- current head at handoff: `65ff37a2d3de2fae76951313f73ba626dba91985`
- base: `main`
- production code changes: none yet
- current diff: test-only

## PR #116 TDD attempts - both invalid RED so far

### Test design

New file:

`tests/repository-snapshots/upload-expiry.test.ts`

The intended test:

- mocks clock so first `Date.now()` is before expiry
- after async `stat()`, clock is after expiry
- expects `Repository snapshot upload authorization is expired.`
- expects `stat()` once
- expects HTTPS request never called

### First RED attempt

Branch sequence:

- initial test commit: `14b292c7c8354601eaf38da6d2c1a6cf7b7cdc78`
- no-content CI verification commit: `e8faa986411d41c526f4238654dc50cd892b7cb7`
- CI run: `34943411866`

Result:

- install passed
- audit found 0 vulnerabilities
- 398 existing test files passed
- 1,759 existing tests passed
- new test suite failed during module loading
- failure: full `node:fs/promises` mock did not expose the required/default module exports

This was rejected as invalid RED because product behavior was never exercised.

### First harness repair

`node:fs/promises` was changed to a partial mock using `importOriginal`, preserving the real module exports and overriding only `stat`.

Commit/head:

`65ff37a2d3de2fae76951313f73ba626dba91985`

### Second RED attempt

CI run:

`34943713195`

Result:

- install passed
- audit found 0 vulnerabilities
- 398 existing test files passed
- 1,759 existing tests passed
- new test suite again failed during module loading
- this time the remaining full `node:https` mock omitted required/default exports

This is also invalid RED.

### Exact stop point

No production uploader change has been made.

The next agent must:

1. fetch live `main` and PR #116
2. keep product code unchanged
3. convert the `node:https` mock to a partial mock using `importOriginal`
4. preserve real `node:https` exports and override only `request`
5. run focused test and CI
6. require the regression to reach the intended assertion

Only a behavior failure at the expiry/network boundary counts as valid RED.

After valid RED, implement the smallest fail-closed production fix, expected to recheck expiry after `stat()` and immediately before `httpsRequest()` begins.

Then require full GREEN and exact-candidate validation before merge to `main`.

PR #116 body has been updated with this exact resume state.

## Current hard blocker - issue #79

Issue #79 remains OPEN.

Completed provider acceptance that must not be repeated as pending:

- production GitHub integration gate is active
- owner/admin Connect GitHub passed
- active connection for `LeDoNguyenTu` persisted
- `LeDoNguyenTu/ScopeForge` repository listing/import passed
- unauthenticated connect/callback remains behind sign-in
- provider/log/integration/browser-readable leakage review found no release-blocking token/secret leak

Exactly two live authenticated negative canaries remain:

1. owner/admin normal signed callback/continuation using a different valid GitHub installation ID must be rejected as not belonging to the authorized connection/workspace
2. legitimate normal workspace member/viewer must be unable to initiate or complete Connect GitHub

Known constraints:

- no legitimate normal member/viewer session currently exists in production
- the existing GitHub App installation flow can redirect new Connect attempts into installed-App settings, making a fresh unrelated installation-ID path difficult to exercise through normal signed flow

Do not:

- fabricate membership
- downgrade an owner solely for the test
- forge state
- bypass authorization
- mutate production DB solely to manufacture acceptance
- substitute unit tests for the live browser checks

If a real negative canary fails, keep Phase 10A2 runtime gates off and remediate before proceeding.

## Phase 10A2 production state

Production migrations remain unapplied:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

Older read-only production preflight passed, but PR #113 materially changed the first migration's private worker claim body to return authoritative workspace/asset identity for trusted reauthorization.

Therefore, after #79 clears and before apply:

- re-read exact current migration
- repeat the relevant compatibility/security review for the changed migration
- do not assume the older preflight alone authorizes production apply

Hosted private snapshot and repository-scan runtime gates remain off.

## Phase 10A3 state

Current PR #77 observed during handoff:

- state: open, draft
- branch: `feat/phase-10a3-github-webhook-reconciliation`
- live head: `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`
- base remains the Phase 10A2 branch

Its PR body still contains older embedded executable SHAs. Treat those as historical evidence only and fetch live state before reconciliation.

Phase 10A3 remains blocked behind both #79 and Phase 10A2 release.

## Strict release order

Preserve this sequence:

1. finish and merge independent PR #116 if valid TDD/validation supports it
2. complete the two real #79 negative provider browser canaries
3. reconcile and release Phase 10A2 PR #76
4. only then reconcile and release Phase 10A3 PR #77

For Phase 10A2 after #79:

1. fetch live `main`, #76, production migration history
2. reconcile once, preserving #113/#114/#115 and released mainline fixes such as #116
3. run fresh exact-candidate validation
4. review/apply only absent reviewed Phase 10A2 migrations
5. verify schema/ACL/RLS/function/security posture
6. accept dedicated private-worker containment/quotas/cleanup/observability/rollback
7. prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings
8. merge/release only after all provider/schema/runtime/privacy/rollback gates pass

For Phase 10A3 after #76 release:

1. reconcile #77 onto released main
2. run fresh exact-candidate validation
3. apply only reviewed absent Phase 10A3 migrations
4. configure independent server-only webhook secret/endpoint
5. canary signature, body size, replay, lifecycle, coalescing, same-head recovery, stale-trigger authoritative-head recovery, public/private separation, leak boundaries, and full automatic scan
6. merge/release only after operational acceptance

## Runtime gates

Keep false/absent until independently accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

`HOSTED_GITHUB_INTEGRATION_ENABLED` is separate and already active after positive provider acceptance.

## External account targets

Before writes, verify:

- GitHub repo: `LeDoNguyenTu/ScopeForge`
- GitHub owner identity: `LeDoNguyenTu`
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- wrong Job Command Center Supabase: `xwsergbpvkcsugexssmc`
- Vercel team ID: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- Vercel project ID: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- domain: `scopeforge.dev`
- Cloudflare account must contain the correct DNS zone, Turnstile resource, and R2 production resources before mutation
- Oracle Cloud tenancy/compartment/region/host must be verified before host-level changes

Do not expose secrets or use them as account-identity evidence.

## Do not repeat completed work

- positive owner/admin GitHub provider canary is complete
- PR #110 GitHub reauthorization regression coverage is complete
- PR #111 CI production WebDriver isolation is complete
- PR #113 private claim workspace/asset binding is integrated in #76
- PR #114 broker authority expiry rechecks are integrated in #76
- PR #115 private archive stream cleanup is integrated in #76
- Phase 6D Task 15 real Linux/rootless-Podman acceptance is complete

## Immediate Codex resume

The exact next engineering task is PR #116 test-harness repair and genuine RED proof.

Do not implement the uploader fix before obtaining real RED.

After PR #116 is completed, re-fetch all live refs. If #79 still cannot be safely exercised, continue independent regression/security/tooling work without advancing production Phase 10 state.

The full ready-to-paste Codex prompt is in `docs/development/CODEX_HANDOFF.md`.

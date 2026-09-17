# Phase 10A2 Private Repository Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click hosted scanning for connected private GitHub repositories without exposing reusable GitHub credentials outside the trusted control plane.

**Architecture:** Phase 10A2 adds a distinct `repository_snapshot_github_private_v1` execution class. The control plane reauthorizes the exact private repository only after an authenticated worker claims an attempt, consumes a repository-scoped installation token itself, and returns only a temporary validated codeload archive lease to that worker; the existing public class stays public-only and the existing zero-egress repository scanner consumes the resulting immutable snapshot unchanged.

**Tech Stack:** Next.js 15 App Router/server actions, TypeScript, Vitest, Node crypto/HTTPS, GitHub App REST APIs, Supabase/PostgreSQL RPCs, existing rootless-Podman worker supervisor, Cloudflare R2 presigned attempt uploads.

**Spec:** `docs/superpowers/specs/2026-09-11-phase-10a2-private-repository-acquisition-design.md`

## Global Constraints

- Stack from verified Phase 10A1 head `30e8b880fd7fd44e8ea40e59501c6565accdfb85`; do not merge/release Phase 10A2 before Phase 10A1.
- Do not widen `repository_snapshot_github_public_v1`; public acquisition semantics remain public-only.
- GitHub installation tokens remain control-plane-only and must never be persisted, logged, audited, returned to browsers, or returned to workers.
- The worker may receive only an attempt-bound `github_private_archive_lease_v1` capability for exact `codeload.github.com` acquisition plus the existing attempt-specific R2 PUT.
- Add `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`; only exact `true` enables it and production remains false/absent until separate canary acceptance.
- Browser roles receive no private-acquisition mutation authority.
- New `SECURITY DEFINER` functions use `search_path = ''`, explicit qualification, explicit execution revocation, and service-role-only grants.
- No repository code, Git hooks, submodules, LFS, package managers, builds, tests, or target executables are run.
- No GitHub repository write permission is introduced.
- Existing strict CSP, Phase 10C admin, V5 presentation, scanner authority, and public/runtime gates remain unchanged.
- Every feature/bugfix task uses RED -> GREEN -> refactor verification before completion.

---

### Task 1: Private execution contract and runtime capability

**Files:**
- Modify: `packages/worker-contracts/types.ts`
- Modify: `packages/worker-contracts/profiles.ts`
- Modify: `packages/worker-contracts/validation.ts`
- Modify: `lib/runtime-capabilities/server.ts`
- Modify: `lib/repository-snapshots/runtime.ts`
- Test: `tests/workers/repository-snapshot-contracts.test.ts`
- Test: `tests/runtime-capabilities/server.test.ts`
- Create: `tests/repository-snapshots/private-contract.test.ts`

**Interfaces:**
- Produces execution class `repository_snapshot_github_private_v1`.
- Produces network policy `github_private_archive_lease_and_attempt_artifact_put_v1`.
- Produces `GitHubPrivateArchiveLease` with `kind`, canonical repository URL, default branch, resolved commit SHA, archive URL and expiry.
- Produces `PrivateRepositorySnapshotInput` with kind `repository_snapshot_github_private` and no token/header/credential fields.
- Produces `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` from the existing strict server capability parser.

- [ ] **Step 1: Write failing contract/runtime tests**

Assert the private execution profile exists with the same containment budgets as public snapshot acquisition, but a distinct execution class/network policy. Assert the private input/lease validator rejects unknown keys, credential-like keys, non-GitHub canonical targets, non-codeload archive hosts, malformed SHA/expiry, and public/private class mismatches. Assert the new private runtime gate is false for missing/`TRUE`/`1` and true only for `true`.

- [ ] **Step 2: Run the focused tests and witness RED**

Run:

```bash
npm test -- --run tests/workers/repository-snapshot-contracts.test.ts tests/runtime-capabilities/server.test.ts tests/repository-snapshots/private-contract.test.ts
```

Expected: failures because the private execution class/input/network policy/runtime capability do not exist.

- [ ] **Step 3: Implement the minimal closed contract**

Add the private class/policy/input/lease to the worker-contract unions, a dedicated parser branch in `validation.ts`, an exact profile in `profiles.ts`, and add `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` to the server capability-name union and repository snapshot runtime module.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command; expected all selected tests pass.

- [ ] **Step 5: Run public-class regressions**

Run:

```bash
npm test -- --run tests/repository-snapshots/github-client.test.ts tests/repository-snapshots/executor-architecture.test.ts tests/workers/repository-snapshot-contracts.test.ts
```

Expected: public snapshot tests remain unchanged and pass.

- [ ] **Step 6: Commit**

```bash
git add packages/worker-contracts lib/runtime-capabilities/server.ts lib/repository-snapshots/runtime.ts tests/workers tests/runtime-capabilities tests/repository-snapshots/private-contract.test.ts
git commit -m "feat: define private repository snapshot contract [skip ci]"
```

---

### Task 2: Claim-time private GitHub source-lease broker

**Files:**
- Modify: `lib/github-app/client.ts`
- Create: `lib/repository-snapshots/private-source-broker.ts`
- Modify: `lib/worker-control/types.ts`
- Modify: `lib/worker-control/service.ts`
- Modify: `lib/worker-control/server-dependencies.ts`
- Modify: `app/api/internal/workers/claim/route.ts` only if composition cannot remain entirely in service dependencies
- Create: `tests/repository-snapshots/private-source-broker.test.ts`
- Modify: `tests/workers/service.test.ts`
- Modify: `tests/repository-snapshots/broker.test.ts`
- Modify: `tests/workers/broker-routes.test.ts`

**Interfaces:**
- Produces `createPrivateRepositorySourceLease(claim, deps): Promise<GitHubPrivateArchiveLease>`.
- Extends persistence claim shape only with safe stable private repository/link identifiers; no token or archive URL.
- `claimWorkerTaskForNode` composes the source lease only after the repository layer has atomically claimed the exact private task.

- [ ] **Step 1: Write failing broker and claim-boundary tests**

Test that a private worker claim causes: exact repository-scoped installation token creation, exact private repository metadata revalidation, immutable commit resolution, authenticated tarball request, validation of one HTTPS codeload redirect, then a worker response containing only the private source lease. Assert serialized claim output does not contain `access_token`, `Authorization`, `Bearer`, client secret/private-key fields, or raw provider error bodies. Assert inactive/mismatched/public repository state fails closed.

- [ ] **Step 2: Witness RED**

```bash
npm test -- --run tests/repository-snapshots/private-source-broker.test.ts tests/workers/service.test.ts tests/repository-snapshots/broker.test.ts tests/workers/broker-routes.test.ts
```

Expected: private source broker/dependency/claim types are missing.

- [ ] **Step 3: Add a bounded GitHub archive-redirect helper**

In `lib/github-app/client.ts`, add a function that accepts the already repository-scoped installation token, exact owner/repository/commit identity, requests only GitHub's fixed tarball API endpoint with redirects disabled, requires the expected temporary redirect status, and returns only a validated bounded location string. Do not expose provider body/error text.

- [ ] **Step 4: Implement `private-source-broker.ts`**

Require exact claim/workspace/asset/link/connection relationships; mint the repository-restricted token; re-fetch metadata; require `private === true`; resolve the default branch commit; obtain and validate the temporary codeload redirect; compute an application expiry no later than the provider capability window; return the lease. Keep token variables function-local and never write them to audit/log/persistence APIs.

- [ ] **Step 5: Compose claim response after atomic claim**

Extend worker-control service dependencies with the private broker. For `repository_snapshot_github_private_v1`, call the broker only after `repository.claim...` returns the exact attempt and before returning `WorkerTaskContract`. Keep claim route body-free and worker-authenticated.

- [ ] **Step 6: Verify GREEN and non-leakage**

Run Step 2 command; then grep/test architecture sources to prove no private lease/token enters audit/log/database structures.

- [ ] **Step 7: Commit**

```bash
git add lib/github-app lib/repository-snapshots lib/worker-control app/api/internal/workers/claim tests/repository-snapshots tests/workers
git commit -m "feat: broker private repository source leases [skip ci]"
```

---

### Task 3: Private codeload acquisition adapter and worker executor

**Files:**
- Create: `packages/repository-acquisition-network/private-archive.ts`
- Modify: `packages/repository-acquisition-network/policy.ts`
- Modify: `packages/repository-acquisition-network/index.ts`
- Modify: `packages/worker-supervisor/repository-snapshot.ts` or split private/public executors into focused sibling modules if necessary
- Modify: `packages/worker-supervisor/executor.ts`
- Modify: `packages/worker-supervisor/supervisor.ts`
- Create: `tests/repository-snapshots/private-archive-network.test.ts`
- Create: `tests/repository-snapshots/private-executor.test.ts`
- Modify: `tests/repository-snapshots/executor-architecture.test.ts`

**Interfaces:**
- Produces `openPrivateGitHubArchive(lease, signal)` that can contact only the exact validated codeload lease URL.
- Produces private executor handling only `repository_snapshot_github_private_v1` / `repository_snapshot_github_private`.

- [ ] **Step 1: Write failing network/executor tests**

Assert exact codeload host/HTTPS, pinned public DNS/TLS, zero redirects, GET-only/no caller headers/body, no Authorization header, compressed byte ceiling, lease-expiry precheck, and rejection of arbitrary URL/host/path substitution. Assert the private executor never invokes the public acquirer's `resolveRepository`/`api.github.com` path and reuses hostile archive parser/bundle/upload limits.

- [ ] **Step 2: Witness RED**

```bash
npm test -- --run tests/repository-snapshots/private-archive-network.test.ts tests/repository-snapshots/private-executor.test.ts tests/repository-snapshots/executor-architecture.test.ts
```

- [ ] **Step 3: Implement the private archive adapter**

Reuse the existing pinned HTTPS transport/network-safety primitives but accept only the already validated codeload lease URL; reject redirects and unexpected response status/content-length; stream under the existing compressed archive ceiling.

- [ ] **Step 4: Implement and register the private executor**

Validate class/input/expiry, open archive, parse/write deterministic bundle, upload using existing attempt descriptor, emit non-secret private snapshot terminal result, and remove work directory in `finally`. Add bounded private failure codes where required.

- [ ] **Step 5: Verify GREEN plus public regression**

Run Step 2 and existing public snapshot executor/client tests.

- [ ] **Step 6: Commit**

```bash
git add packages/repository-acquisition-network packages/worker-supervisor packages/worker-contracts tests/repository-snapshots
git commit -m "feat: execute private repository snapshots [skip ci]"
```

---

### Task 4: Private snapshot queue, claim and immutable publication schema

**Files:**
- Create: next forward migration after Phase 10A1 migration history for private snapshot intent/class/source-kind support
- Modify: `lib/database.phase10a1.types.ts` or introduce `lib/database.phase10a2.types.ts` to keep the overlay explicit
- Modify: `lib/worker-control/repository.ts`
- Modify: `lib/repository-snapshots/service.ts`
- Modify: `lib/repository-snapshots/server-dependencies.ts`
- Test: `tests/repository-snapshots/migration.test.ts`
- Test: `tests/repository-snapshots/service.test.ts`
- Test: `tests/workers/repository.test.ts` / current worker repository contract test file
- Test: `tests/database/function-acl-hardening.test.ts`

**Interfaces:**
- Produces idempotent private snapshot enqueue RPC bound to workspace/asset/link/repository.
- Produces worker registration/claim persistence for `repository_snapshot_github_private_v1` with safe metadata only.
- Extends immutable snapshot provenance source kind with `github_private_archive` while preserving all public rows/semantics.

- [ ] **Step 1: Write RED migration/repository/publication tests**

Assert forward-only source-kind expansion, private task metadata constraints and same-workspace relationships, no credential/archive URL columns, service-role-only privileged RPC execution, explicit function ACL revocation, class-aware claim, cancellation-safe publication, replay idempotency and derivation of `github_private_archive` only from the trusted private execution class.

- [ ] **Step 2: Witness RED**

Run focused migration/repository/publication tests; failures must point to absent private schema/functions/class mapping.

- [ ] **Step 3: Implement one reviewed forward migration**

Add only the minimal new private intent/task relationship and source-kind support. Do not edit applied migrations. All privileged functions use empty search path and explicit ACLs.

- [ ] **Step 4: Wire repository/service type overlays**

Map private registration/claim/finalization to the new class. Persist no lease URL/token. Make successful private snapshot finalization use the same dedicated publication boundary as public snapshot success.

- [ ] **Step 5: Verify GREEN and ACL guards**

Run focused tests including `tests/database/function-acl-hardening.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations lib/database.phase10a2.types.ts lib/worker-control lib/repository-snapshots tests/repository-snapshots tests/workers tests/database
git commit -m "feat: persist private snapshot workflow [skip ci]"
```

---

### Task 5: Connected-project private scan routing and recovery

**Files:**
- Modify: `lib/project-scans/types.ts`
- Modify: `lib/project-scans/service.ts`
- Modify: `app/dashboard/assets/[assetId]/project-scan-actions.ts`
- Modify: `components/assets/ConnectedProjectScanPanel.tsx`
- Modify: `app/dashboard/assets/[assetId]/page.tsx`
- Test: `tests/project-scans/service.test.ts`
- Test: `tests/project-scans/action.test.ts`
- Test: `tests/components/ConnectedProjectScanPanel.test.tsx`
- Test: `tests/project-scans/asset-page-integration.test.ts`

**Interfaces:**
- Private project scan request queues the private snapshot class when the private gate is enabled.
- Private runtime disabled returns `private_snapshot_runtime_unavailable` without enqueue.
- Published private snapshot reuses Phase 10A1 exact-snapshot scan continuation and recovery.

- [ ] **Step 1: Write failing private-routing/UI tests**

Cover private gate off, private gate on, public route unchanged, visibility-change fail-closed behavior, no silent public fallback, waiting scan-runtime state after successful private publication, and updated UI copy/actions.

- [ ] **Step 2: Witness RED**

Run focused project-scan/action/component tests.

- [ ] **Step 3: Implement private routing**

After exact provider revalidation, public projects continue to existing public enqueue. Private projects require the private runtime gate and invoke the private enqueue path. Keep scan-runtime continuation unchanged and exact-snapshot-bound.

- [ ] **Step 4: Update UI truthfully**

Remove the “future private worker” placeholder. Show disabled private acquisition when its runtime is unavailable and the same project-level workflow state when available.

- [ ] **Step 5: Verify GREEN**

Run focused tests plus all Phase 10A1 project-scan tests.

- [ ] **Step 6: Commit**

```bash
git add lib/project-scans app/dashboard/assets components/assets tests/project-scans tests/components
git commit -m "feat: route connected private project scans [skip ci]"
```

---

### Task 6: Security architecture guards and documentation

**Files:**
- Create: `tests/repository-snapshots/private-acquisition-architecture.test.ts`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ENVIRONMENT.md`
- Modify: `docs/development/PHASE_10A1_WORKING_STATE.md` only after #74 integration reconciliation; otherwise add a Phase 10A2 working-state file
- Create: `docs/development/PHASE_10A2_WORKING_STATE.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`

**Interfaces:**
- Permanent tests pin the credential, network, class, runtime and provenance boundaries.

- [ ] **Step 1: Add architecture tests**

Assert no GitHub installation token/header/private-key/client-secret field in worker contract/persistence/publication; public acquirer still requires `private === false`; private executor source contains no `api.github.com`; claim route remains body-free/authenticated; new privileged RPCs have explicit revokes; runtime flags remain default-off.

- [ ] **Step 2: Run architecture suite**

Expected: pass only after Tasks 1-5 satisfy all boundaries.

- [ ] **Step 3: Update durable architecture/environment/working-state docs**

Document private source lease threat model, separate runtime flag, no-token worker boundary, rollout/canary requirements and Supabase/provider blockers truthfully.

- [ ] **Step 4: Commit**

```bash
git add tests/repository-snapshots/private-acquisition-architecture.test.ts docs
git commit -m "docs: record Phase 10A2 private acquisition state [skip ci]"
```

---

### Task 7: Full preflight, review and stacked release gate

**Files:**
- Modify only documentation if validation evidence must be recorded; any executable fix restarts focused TDD and invalidates the candidate SHA.

- [ ] **Step 1: Run full validation**

```bash
npm audit --audit-level=info
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run benchmark:matrix
npm run build
```

Also require repository CI CSP/browser and production diagnostic steps on the exact candidate.

- [ ] **Step 2: Perform full changed-file security review**

Review for credential persistence/leakage, archive URL logging, arbitrary egress, public-class widening, cross-workspace/task claim confusion, expiry/retry bypass, privileged RPC ACL regressions, and runtime-gate bypass.

- [ ] **Step 3: Keep the PR stacked while #74 is unreleased**

Open the Phase 10A2 PR against `feat/phase-10a-github-connected-projects`. Do not merge it to `main` while Phase 10A1 is open.

- [ ] **Step 4: Reconcile after #74 release**

After #74 safely merges, retarget/rebase Phase 10A2 to `main`, reconcile migration history/shared docs, and rerun the entire exact-head gate.

- [ ] **Step 5: Production schema/provider/canary gate**

Only when the supported Supabase management surface is available: inspect exact production migration head, apply reviewed forward migrations to the ScopeForge project, verify schema/RPC ACLs and Security Advisor. Then verify GitHub App private repository permissions and execute a private-acquisition canary with the private runtime flag enabled only in the explicitly accepted environment/rollback window.

- [ ] **Step 6: Merge/release only after all gates**

Require exact-head green CI, no blocking review threads, safe Supabase/provider state, private canary success, expected-head protected integration, post-merge `main` validation and exact production deployment verification.

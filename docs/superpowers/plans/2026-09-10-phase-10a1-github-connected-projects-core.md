# Phase 10A1 GitHub Connected Projects Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure GitHub App connected-project flow that lets authorized users connect GitHub, select a repository, automatically create and verify a repository asset, and initiate one project-level snapshot-to-scan workflow while preserving default-off hosted runtime gates.

**Architecture:** Add a small server-only GitHub App module for configuration, signed state, App JWTs, GitHub API calls, and bounded provider errors. Persist only safe installation/repository metadata in new RLS-protected tables. Reuse the existing Phase 6B/6C worker services through an orchestration service, with automatic scan continuation after successful snapshot publication and strict default-off runtime gates.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.8, Node crypto, Supabase/PostgreSQL RLS, Vitest, existing ScopeForge worker contracts and repository snapshot/scan services.

**Spec:** `docs/superpowers/specs/2026-09-10-phase-10a1-github-connected-projects-core-design.md`

## Global Constraints

- Branch from exact baseline `afc99eb92da6b4cb84bc994f2fb66a983a941626`; never implement on `main`.
- Preserve the accepted current public/authenticated presentation outside the explicitly added connected-project entry points.
- Preserve strict nonce CSP and existing browser security headers.
- No GitHub user OAuth token, installation token, App JWT, private key, client secret, or signed state may be persisted in public tables, audit metadata, or logs.
- Do not widen `repository_snapshot_github_public_v1` for private repositories; private hosted acquisition belongs to Phase 10A2.
- Hosted repository snapshot and scan runtimes remain disabled unless the exact server environment value is `true`; production values are not enabled by this plan.
- All database changes are additive forward migrations. Never rewrite deployed migrations.
- Browser roles may SELECT safe GitHub connection/link metadata for their workspace but may not directly INSERT, UPDATE, or DELETE it.
- Repository metadata supplied by the browser must be revalidated through the GitHub installation before asset linking or scanning.
- Commits must not add AI co-author attribution.
- Keep documentation resumable after every major task.

---

### Task 1: Default-off hosted repository capability configuration

**Files:**
- Create: `lib/runtime-capabilities/server.ts`
- Modify: `lib/repository-snapshots/runtime.ts`
- Modify: `app/dashboard/assets/[assetId]/scan-actions.ts`
- Test: `tests/runtime-capabilities/server.test.ts`
- Test: `tests/repository-scans/runtime-gate.test.ts`

**Interfaces:**
- Produces: `serverCapabilityEnabled(name: HostedCapabilityName, env?: NodeJS.ProcessEnv): boolean`
- Produces: `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- Produces: `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- Consumes: server-only `process.env`

- [ ] **Step 1: Write failing tests for exact-true parsing and default-off behavior**

```ts
import { describe, expect, it } from "vitest";
import { serverCapabilityEnabled } from "@/lib/runtime-capabilities/server";

describe("serverCapabilityEnabled", () => {
  it("enables only an exact true value", () => {
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED", { HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED: "true" })).toBe(true);
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED", { HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED: "TRUE" })).toBe(false);
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED", { HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED: "1" })).toBe(false);
  });

  it("defaults missing capability values to disabled", () => {
    expect(serverCapabilityEnabled("HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED", {})).toBe(false);
  });
});
```

Add an architecture assertion that repository scan actions no longer contain a hard-coded local `false` gate and instead import the shared server capability.

- [ ] **Step 2: Run targeted tests and verify RED**

Run:

```bash
npm test -- tests/runtime-capabilities/server.test.ts tests/repository-scans/runtime-gate.test.ts
```

Expected: FAIL because the shared server capability module and scan runtime export do not exist.

- [ ] **Step 3: Implement the minimal strict parser and replace the two hard-coded repository gates**

```ts
export type HostedCapabilityName =
  | "HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED"
  | "HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED"
  | "HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED"
  | "HOSTED_ACTIVE_CORS_WORKER_ENABLED";

export function serverCapabilityEnabled(name: HostedCapabilityName, env: NodeJS.ProcessEnv = process.env): boolean {
  return env[name] === "true";
}
```

Keep the existing exported runtime constants as compatibility shims around the strict parser.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run the same targeted command. Expected: PASS.

- [ ] **Step 5: Run TypeScript typecheck**

Run `npm run typecheck`. Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `refactor: centralize hosted runtime gates [skip ci]` after local/branch preflight. The later exact candidate receives substantive CI.

---

### Task 2: GitHub App security primitives

**Files:**
- Create: `lib/github-app/types.ts`
- Create: `lib/github-app/config.ts`
- Create: `lib/github-app/state.ts`
- Create: `lib/github-app/jwt.ts`
- Create: `lib/github-app/client.ts`
- Test: `tests/github-app/config.test.ts`
- Test: `tests/github-app/state.test.ts`
- Test: `tests/github-app/jwt.test.ts`
- Test: `tests/github-app/client.test.ts`

**Interfaces:**
- Produces: `getGitHubAppConfig(env?: NodeJS.ProcessEnv): GitHubAppConfig`
- Produces: `createGitHubConnectionState(input, secret, now?): string`
- Produces: `verifyGitHubConnectionState(value, secret, now?): GitHubConnectionState`
- Produces: `createGitHubAppJwt(config, now?): string`
- Produces: `exchangeGitHubUserCode(code, config, fetchImpl?): Promise<GitHubUserToken>`
- Produces: `listUserInstallations(userToken, fetchImpl?): Promise<GitHubInstallationSummary[]>`
- Produces: `createInstallationToken(installationId, config, options?, fetchImpl?): Promise<GitHubInstallationToken>`
- Produces: `listInstallationRepositories(token, page, fetchImpl?): Promise<GitHubRepositoryPage>`
- Produces: `getInstallationRepository(token, repositoryId, fetchImpl?): Promise<GitHubRepositorySummary>`

- [ ] **Step 1: Write failing configuration tests**

Tests must reject missing App ID, client ID, client secret, private key, slug, and state secret. Assert that no config field supports `NEXT_PUBLIC_` fallbacks.

- [ ] **Step 2: Write failing state tests**

Cover round-trip, tampering rejection, user/workspace binding, expiration at 10 minutes, malformed payload rejection, and constant-time signature comparison behavior through the public verifier.

The state payload shape is:

```ts
interface GitHubConnectionState {
  version: 1;
  workspaceId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}
```

Use HMAC-SHA256 over base64url canonical JSON.

- [ ] **Step 3: Write failing App JWT tests**

Decode the JWT locally and assert `alg=RS256`, `iss=appId`, `iat <= now`, `exp-now <= 600`, and a valid RSA signature using a test key pair generated inside the test.

- [ ] **Step 4: Write failing provider client tests**

Use injected `fetchImpl` and assert:

- OAuth code exchange posts only to GitHub's fixed endpoint
- provider error bodies are not returned in thrown public error messages
- user installation listing uses the temporary user token
- installation token requests use a GitHub App JWT
- repository-restricted installation token request includes `repository_ids: [repositoryId]` and read-only permissions
- repository pagination is bounded to 100 entries per page
- requests have an explicit abort timeout

- [ ] **Step 5: Run targeted GitHub App tests and verify RED**

Run:

```bash
npm test -- tests/github-app/config.test.ts tests/github-app/state.test.ts tests/github-app/jwt.test.ts tests/github-app/client.test.ts
```

Expected: FAIL because the GitHub App module does not exist.

- [ ] **Step 6: Implement the minimal server-only module using Node crypto and fetch**

Do not add Octokit/Jose. Use fixed `https://github.com` / `https://api.github.com` endpoints, `application/vnd.github+json`, and explicit GitHub API version header. Normalize provider data into narrow internal types before returning it.

- [ ] **Step 7: Run targeted tests and verify GREEN**

Expected: all GitHub App primitive tests PASS.

- [ ] **Step 8: Run typecheck and dependency audit**

Run `npm run typecheck` and `npm audit --audit-level=info`. No dependency change is expected.

- [ ] **Step 9: Commit**

Commit: `feat: add GitHub App security primitives [skip ci]`.

---

### Task 3: GitHub connection and repository-link schema

**Files:**
- Create: next forward migration under `supabase/migrations/` after migration history is inspected
- Create: `lib/database.phase10a1.types.ts`
- Test: `tests/github-app/migration.test.ts`
- Test: `tests/github-app/database-types.test.ts`

**Interfaces:**
- Produces tables: `public.github_connections`, `public.github_repository_links`
- Produces safe authenticated SELECT policies scoped by `private.is_workspace_member(workspace_id)`
- Produces no browser write grants
- Produces FK from repository link to exact workspace asset and connection

- [ ] **Step 1: Inspect production migration head before naming the migration**

Run the Supabase migration listing and record the current deployed head in the working-state document.

- [ ] **Step 2: Write failing migration contract tests**

Read the new migration file and require:

```ts
expect(sql).toContain("create table public.github_connections");
expect(sql).toContain("create table public.github_repository_links");
expect(sql).toContain("alter table public.github_connections enable row level security");
expect(sql).toContain("alter table public.github_repository_links enable row level security");
expect(sql).toMatch(/revoke all on table public\.github_connections from anon, authenticated/i);
expect(sql).toMatch(/grant select on table public\.github_connections to authenticated/i);
expect(sql).not.toMatch(/grant (insert|update|delete).*github_connections.*authenticated/i);
```

Also require workspace-scoped RLS, unique installation/workspace constraints, unique `(workspace_id, repository_id)`, unique asset linkage, private/public metadata bounds, and timestamp/update triggers.

- [ ] **Step 3: Run migration tests and verify RED**

Expected: FAIL because the Phase 10A1 migration and types do not exist.

- [ ] **Step 4: Implement additive migration and narrow TypeScript database extension**

The migration contains no credentials or token columns. Use CHECK constraints for bounded strings/status enums, composite workspace FKs where available, RLS, explicit grants/revokes, and indexes for workspace/connection/repository lookup.

- [ ] **Step 5: Run migration tests and typecheck**

Expected: PASS.

- [ ] **Step 6: Apply only after SQL review**

Use the Supabase migration action once, then list migrations and run Security Advisor. If application code is not ready enough to safely deploy the schema, keep this step pending and do not fabricate deployment evidence.

- [ ] **Step 7: Commit**

Commit: `feat: add GitHub connected project schema [skip ci]`.

---

### Task 4: GitHub installation start and callback flow

**Files:**
- Create: `lib/github-app/authorization.ts`
- Create: `app/api/integrations/github/connect/route.ts`
- Create: `app/api/integrations/github/callback/route.ts`
- Test: `tests/github-app/authorization.test.ts`
- Test: `tests/github-app/routes.test.ts`

**Interfaces:**
- Produces: `beginGitHubConnection(input, dependencies): Promise<URL>`
- Produces: `completeGitHubConnection(input, dependencies): Promise<GitHubConnectionRecord>`
- Connect route sets HttpOnly/Secure/SameSite=Lax state cookie and redirects to the configured App installation path.
- Callback route exchanges code, validates the installation against the authenticated GitHub user's installations, upserts safe connection metadata, clears the state cookie, and redirects to the integration page.

- [ ] **Step 1: Write failing service tests for authorization and spoof prevention**

Require owner/admin role, same signed-in ScopeForge user/workspace as state, and explicit membership of the claimed installation in the GitHub user installation list.

The critical test must prove an arbitrary callback `installation_id` is rejected even when its format is valid.

- [ ] **Step 2: Write failing route tests**

Assert safe redirect behavior, secure cookie attributes, bounded error redirect codes, callback state clearing, and no provider token in redirect parameters.

- [ ] **Step 3: Run route/service tests and verify RED**

- [ ] **Step 4: Implement minimal authorization service and routes**

The OAuth user token exists only inside the callback function scope. Do not return or persist it.

- [ ] **Step 5: Run targeted tests and verify GREEN**

- [ ] **Step 6: Run typecheck**

- [ ] **Step 7: Commit**

Commit: `feat: connect verified GitHub installations [skip ci]`.

---

### Task 5: Repository picker and trusted repository import

**Files:**
- Create: `lib/github-app/repositories.ts`
- Create: `app/dashboard/integrations/github/page.tsx`
- Create: `app/dashboard/integrations/github/actions.ts`
- Create: `components/integrations/GitHubRepositoryPicker.tsx`
- Modify: `app/dashboard/assets/new/page.tsx`
- Test: `tests/github-app/repositories.test.ts`
- Test: `tests/github-app/repository-actions.test.ts`
- Test: `tests/github-app/ui.test.tsx`

**Interfaces:**
- Produces: `listConnectedRepositories(workspaceId, page, dependencies)`
- Produces: `linkGitHubRepository(repositoryId): ActionResult<{ assetId: string; linkId: string }>`
- Reuses exact existing repository asset when `(workspace_id, canonical_target)` already exists.
- Sets repository verification status only after a fresh installation-scoped GitHub repository lookup succeeds.

- [ ] **Step 1: Write failing repository discovery tests**

Require connection ownership, active connection, bounded pagination, safe metadata normalization, and no provider credentials returned.

- [ ] **Step 2: Write failing link/import tests**

Cover:

- browser provides only `repositoryId`
- server re-fetches repository through installation before trusting owner/name/default branch/private state
- exact repository asset is created when absent
- exact existing asset is reused when present
- another workspace's asset/link cannot be reused
- asset becomes `verified` with current actor and time only after trusted provider validation
- private repositories may be linked but are marked not eligible for Phase 6B public acquisition
- duplicate link requests are idempotent

- [ ] **Step 3: Write failing UI tests**

Require a prominent GitHub import path on the new-asset page, connected/disconnected states, repository public/private badges, default branch display, and no claim that private hosted scanning is available yet.

- [ ] **Step 4: Run targeted tests and verify RED**

- [ ] **Step 5: Implement repository service, server action, page, and picker**

Keep the existing manual asset form as a secondary path for web/API registration.

- [ ] **Step 6: Run targeted tests and verify GREEN**

- [ ] **Step 7: Run typecheck and production build**

- [ ] **Step 8: Commit**

Commit: `feat: import GitHub repositories as verified projects [skip ci]`.

---

### Task 6: One-click project scan orchestration and automatic continuation

**Files:**
- Create: `lib/project-scans/types.ts`
- Create: `lib/project-scans/service.ts`
- Create: `app/dashboard/assets/[assetId]/project-scan-actions.ts`
- Modify: `app/api/internal/workers/finalize/route.ts`
- Modify: `lib/repository-snapshots/service.ts` only if publication needs to return additional safe identifiers already persisted
- Test: `tests/project-scans/service.test.ts`
- Test: `tests/project-scans/finalize-continuation.test.ts`
- Test: `tests/project-scans/action.test.ts`

**Interfaces:**
- Produces: `requestConnectedProjectScan(input, dependencies): Promise<ProjectScanRequestResult>`
- Produces: `continueConnectedProjectScanAfterSnapshot(input, dependencies): Promise<ProjectScanContinuationResult>`
- Existing worker finalization calls continuation only after successful, lease-valid, published snapshot completion.

- [ ] **Step 1: Write failing request orchestration tests**

Cover authorized linked public project, missing connection, stale GitHub access, private repository, disabled snapshot runtime, active duplicate intent, and successful snapshot enqueue.

- [ ] **Step 2: Write failing continuation tests**

Cover:

- successful snapshot publication continues to repository scan when scan runtime is enabled
- scan runtime disabled returns/records waiting state without bypass
- replayed finalization is idempotent and does not enqueue duplicate scans
- snapshot/link/workspace mismatch fails closed
- private repository cannot reach public snapshot continuation path

- [ ] **Step 3: Run project-scan tests and verify RED**

- [ ] **Step 4: Implement minimal orchestration service and server action**

Use existing Phase 6B/6C services and persistence functions. Do not duplicate scanner logic.

- [ ] **Step 5: Integrate trusted worker finalization continuation**

The worker route must continue returning bounded worker responses. A continuation failure after a successfully published snapshot must not corrupt the published snapshot. Record a safe waiting/failure state for later retry rather than rolling back immutable provenance.

- [ ] **Step 6: Run targeted tests and verify GREEN**

- [ ] **Step 7: Run worker authorization and replay regression suites**

Include existing worker finalize, repository snapshot publication, repository scan enqueue/publication, cancellation, lease, and stale-attempt tests.

- [ ] **Step 8: Commit**

Commit: `feat: orchestrate connected project scans [skip ci]`.

---

### Task 7: Documentation, security review, and exact-candidate release gate

**Files:**
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/UNFINISHED_WORK.md`
- Create/Modify: `docs/development/PHASE_10A1_WORKING_STATE.md`
- Create: `docs/development/PHASE_10A1_RELEASE_STATE.md` when release evidence exists
- Modify: `docs/PHASES.md`
- Modify: `docs/ARCHITECTURE.md` if the integration boundary ships
- Test: architecture/security guard tests as needed

**Interfaces:**
- Produces a truthful resume point containing exact branch/head, completed tasks, pending gates, provider state, migration state, and rollback notes.

- [ ] **Step 1: Reconcile legacy unfinished work truth**

Record current observed facts:

- current baseline `afc99eb92da6b4cb84bc994f2fb66a983a941626`
- no open pre-Phase-10 PRs/issues
- current production Vercel deployment on that SHA is READY
- inspected Vercel runtime error clusters: none in the checked 24-hour window
- Supabase leaked-password protection: verified disabled
- Supabase Auth-setting mutation: unavailable through current connector
- Vercel env value inspection/mutation: unavailable through current connector
- GitHub delete-ref: unavailable through current connector
- Phase 6B/6C/6D runtime activation remains separately gated

- [ ] **Step 2: Perform secret/logging/security review**

Search the branch for GitHub token/JWT/private-key persistence, `NEXT_PUBLIC_GITHUB`, provider error-body leakage, direct browser GitHub tokens, broad repository write permissions, cross-workspace mutations, and runtime gate bypasses.

- [ ] **Step 3: Run full preflight**

```bash
npm audit --audit-level=info
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
npm run benchmark:scanner
npm run benchmark:matrix
npm run build
```

Expected: PASS with no newly introduced audit vulnerability.

- [ ] **Step 4: Run Supabase verification if migration was deployed**

List migrations, query the two tables/policies/grants, and run Security Advisor. Do not claim leaked-password protection fixed unless the provider setting is actually changed and re-verified.

- [ ] **Step 5: Create exact candidate commit without `[skip ci]`**

The candidate commit must move the tree only for the intended final reconciliation and trigger substantive repository validation.

- [ ] **Step 6: Require exact-head GitHub validation and Vercel Preview READY**

Record exact run/deployment IDs and head SHA. Resolve any real failure before merge.

- [ ] **Step 7: Browser acceptance**

Verify the GitHub integration entry points plus existing public/auth dashboard/CSP visual gates. Do not rely on DOM-only assertions for the established presentation.

- [ ] **Step 8: Full diff review and merge**

Require no unresolved review threads or change requests, then merge with the expected head SHA pinned.

- [ ] **Step 9: Post-merge verification**

Require independent `main` validation, exact production deployment READY, fresh `scopeforge.dev` HTTP/CSP verification, and runtime-log check.

- [ ] **Step 10: Finalize release state and queue Phase 10A2**

Update the persistent docs so the next session begins with private GitHub repository acquisition as the next product boundary, while separately retaining any external provider/runtime/branch-deletion blockers that still exist.

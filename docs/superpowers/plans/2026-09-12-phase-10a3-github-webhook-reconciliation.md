# Phase 10A3 GitHub Webhook Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated GitHub App webhook reconciliation so connected repositories continuously scan the newest authoritative default-branch head without weakening the Phase 10A1/10A2 credential, runtime, or public/private worker boundaries.

**Architecture:** A public Next.js webhook route verifies HMAC-SHA256 over the untouched raw body, then delegates to a provider-aware reconciliation service. Forward-only service-role RPCs provide replay protection, per-link desired-head coalescing, lifecycle state reconciliation, and system-triggered snapshot enqueue. Existing public/private snapshot workers and the exact-snapshot zero-egress scanner remain unchanged; a narrow completion hook advances the successful SHA watermark and schedules at most one follow-up when the provider head advanced during an active scan.

**Tech Stack:** Next.js App Router, TypeScript, Node `crypto`, Supabase/PostgreSQL, GitHub App REST API, Vitest, existing ScopeForge worker/snapshot/scan contracts.

**Spec:** `docs/superpowers/specs/2026-09-12-phase-10a3-github-webhook-reconciliation-design.md`

## Global Constraints

- Phase 10A3 stays stacked after Phase 10A2; do not merge/release it ahead of Phase 10A1 or Phase 10A2.
- Add no GitHub repository write permission, check-run permission, issue/comment permission, PAT support, or generic arbitrary GitHub API client.
- `GITHUB_APP_WEBHOOK_SECRET` is server-only, separate from client/state secrets, and 32-512 characters.
- Verify `X-Hub-Signature-256` with HMAC-SHA256 over exact raw bytes and constant-time byte comparison before JSON parsing or persistence.
- Hard webhook raw-body ceiling is 10 MiB, enforced from `Content-Length` when present and from actual bytes read.
- Persist no raw webhook body, signature, secret, App JWT, installation/user token, authorization header, commit message/author data, temporary archive URL, or source bytes.
- Webhook repository metadata is non-authoritative. Re-fetch exact repository/default-branch state before mutating link identity or scheduling a scan.
- Only current authoritative default-branch head scans automatically. Rapid pushes coalesce to a per-link desired-head watermark.
- Automatic scans are system-triggered and carry explicit `trigger_kind = github_webhook`; do not invent a browser session or treat historical `installed_by` as fresh authorization.
- Existing manual owner/admin scan authorization remains unchanged.
- Existing public/private acquisition classes remain separate and runtime-gated.
- Every new public `SECURITY DEFINER` function uses `set search_path = ''`, fully qualified objects, revoked default/browser execution, and minimum `service_role` grant.
- `private.github_webhook_deliveries` and `private.github_repository_auto_scan_state` have RLS enabled and no browser policy/grant.
- No Phase 10A3 production DDL, webhook registration, secret activation, or runtime flag activation is authorized by implementation alone.

---

### Task 1: Server-only webhook configuration and raw HMAC boundary

**Files:**
- Modify: `lib/github-app/types.ts`
- Modify: `lib/github-app/config.ts`
- Create: `lib/github-app/webhook.ts`
- Modify: `tests/github-app/config.test.ts`
- Create: `tests/github-app/webhook.test.ts`

**Interfaces:**
- Consumes: existing `GitHubAppEnvironment` and `GitHubAppConfig`.
- Produces:
  - `GitHubAppConfig.webhookSecret: string`
  - `verifyGitHubWebhookSignature(rawBody: Uint8Array, signatureHeader: string, secret: string): boolean`
  - `readGitHubWebhookRequest(request: Request): Promise<VerifiedGitHubWebhookRequest>`
  - `GitHubWebhookInputError` with bounded codes/status only.

- [ ] **Step 1: Write RED config tests for the seventh server-only setting**

Extend `validEnv` and expected config:

```ts
GITHUB_APP_WEBHOOK_SECRET: "webhook-secret-0123456789abcdef0123456789",
```

Assert missing/short values fail and a `NEXT_PUBLIC_GITHUB_APP_WEBHOOK_SECRET` fallback is ignored.

- [ ] **Step 2: Write RED webhook primitive tests**

Cover exact-byte HMAC, altered bytes, malformed signature, 10 MiB+1 rejection, malformed delivery UUID/event headers, and `Content-Length` early rejection. Use a known HMAC constructed with Node `createHmac` in the test.

```ts
const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
expect(verifyGitHubWebhookSignature(raw, signature, secret)).toBe(true);
expect(verifyGitHubWebhookSignature(new TextEncoder().encode("changed"), signature, secret)).toBe(false);
```

- [ ] **Step 3: Run targeted RED tests**

Run:

```bash
npm test -- tests/github-app/config.test.ts tests/github-app/webhook.test.ts
```

Expected: failure because `webhookSecret` and webhook helpers do not exist.

- [ ] **Step 4: Extend the config/type contract minimally**

`GitHubAppConfig` becomes:

```ts
export interface GitHubAppConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  slug: string;
  stateSecret: string;
  webhookSecret: string;
}
```

`getGitHubAppConfig` must call `required(env, "GITHUB_APP_WEBHOOK_SECRET")` and reject lengths outside 32-512.

- [ ] **Step 5: Implement strict raw webhook parsing**

`lib/github-app/webhook.ts` must:

```ts
export const MAX_GITHUB_WEBHOOK_BODY_BYTES = 10 * 1024 * 1024;

export interface VerifiedGitHubWebhookRequest {
  deliveryId: string;
  event: string;
  rawBody: Uint8Array;
  payload: Record<string, unknown>;
}
```

Use `request.arrayBuffer()` only after rejecting an excessive declared length, enforce the actual byte length after read, verify signature over those exact bytes, then parse JSON. `verifyGitHubWebhookSignature` decodes both digests to 32-byte buffers and uses `timingSafeEqual` only after equal-length validation.

- [ ] **Step 6: Run targeted GREEN tests and typecheck**

```bash
npm test -- tests/github-app/config.test.ts tests/github-app/webhook.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add lib/github-app/types.ts lib/github-app/config.ts lib/github-app/webhook.ts tests/github-app/config.test.ts tests/github-app/webhook.test.ts
git commit -m "feat: add GitHub webhook trust boundary [skip ci]"
```

---

### Task 2: Narrow authoritative GitHub provider reads

**Files:**
- Modify: `lib/github-app/types.ts`
- Modify: `lib/github-app/client.ts`
- Modify: `tests/github-app/client.test.ts`
- Modify: `tests/github-app/repositories.test.ts` only if repository fixtures require the new archived field.

**Interfaces:**
- Consumes: existing installation token/App JWT helpers.
- Produces:
  - `GitHubRepositorySummary.isArchived: boolean`
  - `getInstallationDefaultBranchHead(token, repository): Promise<string>`
  - `getAppInstallation(installationId, config): Promise<GitHubInstallationSummary>`

- [ ] **Step 1: Write RED provider tests**

Require repository parser to fail closed when `archived` is missing/non-boolean, require default-head lookup to hit the exact commits endpoint for the authoritative default branch and return a 40-hex SHA, and require installation lookup to validate `id`, account identity/type, and `repository_selection`.

- [ ] **Step 2: Run RED provider tests**

```bash
npm test -- tests/github-app/client.test.ts tests/github-app/repositories.test.ts
```

Expected: failure because the new provider methods/field do not exist.

- [ ] **Step 3: Extend repository parsing**

`repositoryFromProvider` must validate `row.archived` and return:

```ts
{
  id,
  ownerLogin,
  name,
  fullName,
  defaultBranch,
  isPrivate: row.private,
  isArchived: row.archived,
  htmlUrl,
}
```

Update all existing repository fixtures with explicit `archived: false`.

- [ ] **Step 4: Implement exact default-head and installation reads**

Reuse bounded `providerJson`, `githubHeaders`, `positiveSafeInteger`, and existing SHA validation. Do not add a generic arbitrary URL helper.

- [ ] **Step 5: Run targeted GREEN tests and typecheck**

```bash
npm test -- tests/github-app/client.test.ts tests/github-app/repositories.test.ts tests/project-scans/service.test.ts
npm run typecheck
```

Expected: PASS, including existing project-scan provider identity fixtures updated for `isArchived`.

- [ ] **Step 6: Commit Task 2**

```bash
git add lib/github-app/types.ts lib/github-app/client.ts tests/github-app/client.test.ts tests/github-app/repositories.test.ts tests/project-scans/service.test.ts
git commit -m "feat: add authoritative GitHub reconciliation reads [skip ci]"
```

---

### Task 3: Forward-only Phase 10A3 persistence, replay protection, and automatic enqueue RPCs

**Files:**
- Create: `supabase/migrations/20260912020000_phase_10a3_github_webhook_reconciliation.sql`
- Create: `lib/database.phase10a3.types.ts`
- Create: `tests/github-app/webhook-migration.test.ts`
- Create: `tests/github-app/webhook-database-types.test.ts`
- Modify: `tests/repository-scans/database-types.test.ts` only if latest trusted worker/control overlay expectations must point through Phase 10A3.

**Interfaces:**
- Consumes: Phase 10A2 schema/functions, `github_connections`, `github_repository_links`, `private.github_project_scan_intents`, worker snapshot tables/functions.
- Produces public service-role-only RPCs:
  - `admit_github_webhook_delivery(...) -> jsonb`
  - `get_github_webhook_repository_context(...) -> jsonb`
  - `record_github_webhook_push_head(...) -> jsonb`
  - `enqueue_github_webhook_project_snapshot(...) -> jsonb`
  - `record_github_webhook_delivery_result(...) -> jsonb`
  - `reconcile_github_webhook_connection_state(...) -> jsonb`
  - `reconcile_github_webhook_repository_state(...) -> jsonb`
  - `complete_github_webhook_project_scan(...) -> jsonb`

- [ ] **Step 1: Write RED migration security tests**

Require:

```sql
private.github_webhook_deliveries
private.github_repository_auto_scan_state
```

and explicit trigger provenance columns on `private.github_project_scan_intents`:

```text
trigger_kind
trigger_delivery_id
trigger_commit_sha
```

Assert migration source contains no columns matching token/secret/signature/raw_payload/archive_url/authorization/source_body patterns.

- [ ] **Step 2: Write RED RPC/idempotency assertions**

Tests must pin unique delivery UUID admission, repository/SHA watermark dedupe, advisory/row locks, service-role-only ACLs, `search_path = ''`, and no browser grants.

- [ ] **Step 3: Run migration RED**

```bash
npm test -- tests/github-app/webhook-migration.test.ts tests/github-app/webhook-database-types.test.ts
```

Expected: migration/type overlay missing.

- [ ] **Step 4: Create private tables and provenance columns**

`github_webhook_deliveries` stores only bounded event/action/installation/repository/SHA/result/timestamps. `github_repository_auto_scan_state` stores workspace/link/repository, desired SHA, successful SHA, latest delivery, `pending`, `provider_archived`, bounded outcome, timestamps.

Use checks for event/action/error lengths and `^[a-f0-9]{40}$` SHAs. Add one-to-one FK from auto state to repository link and unique delivery UUID PK.

- [ ] **Step 5: Add atomic delivery/context/watermark RPCs**

`admit_github_webhook_delivery` inserts once and returns `{ replayed: boolean }`. `get_github_webhook_repository_context` joins exact installation/repository/link/asset state and returns only safe stable metadata. `record_github_webhook_push_head` locks the link/state row, records desired SHA/latest delivery, and returns whether an automatic chain is already active/pending/scanned.

- [ ] **Step 6: Add system-triggered automatic snapshot enqueue RPC**

`enqueue_github_webhook_project_snapshot` must revalidate active connection/link, `auto_scan_enabled`, non-archived state, desired SHA equality, and class visibility. It creates the same public/private worker task shapes as Phase 10A1/10A2 but records `trigger_kind='github_webhook'`, exact delivery UUID, exact commit SHA, and historical `installed_by` only for required audit/FK attribution. It must not require a current browser session or current membership for that historical actor.

Preserve existing cooldown/daily/active-task limits. Replayed same desired SHA returns a replayed/no-op result rather than creating another active chain.

- [ ] **Step 7: Add lifecycle and completion RPCs**

`reconcile_github_webhook_connection_state` handles `active|suspended|removed` and marks links accordingly. `reconcile_github_webhook_repository_state` atomically updates verified safe repository/link/asset metadata and archive/access state by stable repository ID. `complete_github_webhook_project_scan` binds exact intent/snapshot resolved SHA, advances successful SHA only for matching webhook-triggered intent, and returns `{ followUpRequired, desiredCommitSha }` under lock.

- [ ] **Step 8: Add Phase 10A3 type overlay**

Compose `Phase10a2Database` and add exact RPC argument/return `Json` types as `Phase10a3Database`.

- [ ] **Step 9: Run targeted GREEN and security regression tests**

```bash
npm test -- tests/github-app/webhook-migration.test.ts tests/github-app/webhook-database-types.test.ts tests/project-scans/private-routing-migration.test.ts tests/github-app/service-role-acl-hardening.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add supabase/migrations/20260912020000_phase_10a3_github_webhook_reconciliation.sql lib/database.phase10a3.types.ts tests/github-app/webhook-migration.test.ts tests/github-app/webhook-database-types.test.ts tests/repository-scans/database-types.test.ts
git commit -m "feat: add webhook reconciliation persistence [skip ci]"
```

---

### Task 4: Webhook service and default-branch push coalescing

**Files:**
- Create: `lib/github-app/webhook-service.ts`
- Create: `app/api/integrations/github/webhook/route.ts`
- Create: `tests/github-app/webhook-service.test.ts`
- Create: `tests/github-app/webhook-route.test.ts`
- Modify: `lib/github-app/types.ts`

**Interfaces:**
- Consumes: Task 1 verified request, Task 2 provider reads, Task 3 RPCs, existing runtime gates.
- Produces:
  - `processGitHubWebhook(input, deps?): Promise<GitHubWebhookResult>`
  - bounded result states: `accepted | ignored | replayed | queued | pending | superseded | runtime_unavailable`
  - public `POST` route with bounded JSON/status mapping.

- [ ] **Step 1: Write RED service tests for ping/unknown/push**

Tests must prove:
- signed ping produces no provider/DB scan side effect
- signed unsupported event is ignored without delivery persistence
- push payload URL/private/default-branch values cannot override provider state
- non-default/tag/delete/zero-SHA push is ignored
- stale `after` versus authoritative head is `superseded`
- current default-head push records desired SHA
- disconnected, inactive, archived, or auto-scan-disabled project queues nothing
- public/private source runtime flags are respected independently
- existing active chain sets pending rather than concurrent enqueue
- same repository/SHA semantic replay queues nothing.

- [ ] **Step 2: Run RED service tests**

```bash
npm test -- tests/github-app/webhook-service.test.ts
```

Expected: service missing.

- [ ] **Step 3: Implement dependency-injected webhook service**

Keep event parsing strict and bounded. For push, trust only candidate installation ID, repository ID, ref, after/deleted signal from payload. Load stored context, mint repository-restricted installation token, fetch authoritative repository plus default-head SHA, reconcile verified metadata, record desired watermark, then conditionally call the automatic enqueue RPC.

- [ ] **Step 4: Write RED route tests**

Assert invalid signature/malformed headers/oversize fail before service invocation. Assert successful route calls `readGitHubWebhookRequest` then service and never includes raw body/signature in response.

- [ ] **Step 5: Implement route**

`POST` only, `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Map bounded input errors to 400/401/413, permanent ignored/accepted states to 2xx, and transient internal/provider failure to generic retryable 503.

- [ ] **Step 6: Run targeted GREEN tests and typecheck**

```bash
npm test -- tests/github-app/webhook.test.ts tests/github-app/webhook-service.test.ts tests/github-app/webhook-route.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add lib/github-app/webhook-service.ts app/api/integrations/github/webhook/route.ts tests/github-app/webhook-service.test.ts tests/github-app/webhook-route.test.ts lib/github-app/types.ts
git commit -m "feat: process GitHub default-branch webhooks [skip ci]"
```

---

### Task 5: Installation and repository lifecycle reconciliation

**Files:**
- Modify: `lib/github-app/webhook-service.ts`
- Modify: `tests/github-app/webhook-service.test.ts`
- Modify: `lib/github-app/client.ts`
- Modify: `tests/github-app/client.test.ts`

**Interfaces:**
- Consumes: Task 3 lifecycle RPCs and Task 2 installation/repository reads.
- Produces event handlers for `installation`, `installation_repositories`, and `repository` allowlisted actions.

- [ ] **Step 1: Write RED lifecycle tests**

Cover:
- installation suspend -> connection suspended, links inaccessible, no scan
- deleted -> connection/links removed, pending cleared
- unsuspend -> provider revalidation required before active
- installation repositories removed -> matching existing links inaccessible immediately
- added -> no import; existing matching link can reactivate only after provider revalidation
- repository rename/transfer -> stable numeric ID lookup + provider re-fetch + atomic link/asset canonical target update
- privatized/publicized -> safe metadata update only; no queued task class mutation
- archived -> `provider_archived=true`, no new auto scan
- unarchived -> provider revalidation then false
- deleted/inaccessible -> retained historical data, link becomes removed/inaccessible.

- [ ] **Step 2: Run lifecycle RED**

```bash
npm test -- tests/github-app/webhook-service.test.ts
```

Expected: new lifecycle cases fail.

- [ ] **Step 3: Implement strict allowlisted lifecycle dispatch**

Unknown actions are ignored. Never auto-import from webhook payloads. Use stable installation/repository IDs and provider revalidation before any reactivation/identity mutation.

- [ ] **Step 4: Run lifecycle GREEN and provider regression tests**

```bash
npm test -- tests/github-app/webhook-service.test.ts tests/github-app/client.test.ts tests/github-app/repositories.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add lib/github-app/webhook-service.ts tests/github-app/webhook-service.test.ts lib/github-app/client.ts tests/github-app/client.test.ts
git commit -m "feat: reconcile GitHub installation lifecycle [skip ci]"
```

---

### Task 6: Automatic scan completion and no-lost-head follow-up

**Files:**
- Modify: `lib/project-scans/service.ts`
- Modify: `lib/project-scans/types.ts`
- Modify: `app/api/internal/workers/finalize/route.ts`
- Create: `tests/project-scans/webhook-reconciliation.test.ts`
- Modify: `tests/project-scans/finalize-continuation.test.ts`

**Interfaces:**
- Consumes: exact snapshot publication result and Task 3 `complete_github_webhook_project_scan` RPC.
- Produces:
  - `reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId, snapshotId }): Promise<...>`
  - exactly one follow-up enqueue when successful immutable SHA differs from desired watermark.

- [ ] **Step 1: Write RED completion tests**

Pin:
- manual intents are ignored by auto completion
- exact webhook intent + matching resolved snapshot SHA advances successful SHA
- equal desired/successful SHA clears pending and enqueues nothing
- advanced desired SHA returns one follow-up requirement
- replayed finalization is idempotent
- failed snapshot/scan does not advance successful SHA
- inaccessible/disabled/runtime-unavailable link does not create unauthorized follow-up.

- [ ] **Step 2: Run RED completion tests**

```bash
npm test -- tests/project-scans/webhook-reconciliation.test.ts tests/project-scans/finalize-continuation.test.ts
```

Expected: reconciliation function/hook missing.

- [ ] **Step 3: Implement server dependencies and completion service**

Use `Phase10a3Database`, call the completion RPC after successful snapshot continuation state is established, and enqueue at most one follow-up through the system automatic enqueue path. Revalidate provider head again before follow-up so the watermark can advance from C to D without scanning obsolete intermediate commits.

- [ ] **Step 4: Integrate worker finalize route**

After successful repository snapshot publication and `continueConnectedProjectScanAfterSnapshot`, invoke the automatic reconciliation hook. It must be safe for public and private snapshot classes and return no secrets to the worker.

- [ ] **Step 5: Run GREEN completion + worker regression tests**

```bash
npm test -- tests/project-scans/webhook-reconciliation.test.ts tests/project-scans/finalize-continuation.test.ts tests/workers/private-finalization.test.ts tests/repository-snapshots/service.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add lib/project-scans/service.ts lib/project-scans/types.ts app/api/internal/workers/finalize/route.ts tests/project-scans/webhook-reconciliation.test.ts tests/project-scans/finalize-continuation.test.ts
git commit -m "feat: coalesce automatic project scan completion [skip ci]"
```

---

### Task 7: Browser read-model truth and architecture regression guards

**Files:**
- Modify: `lib/project-scans/read-model.ts`
- Modify: `components/assets/ConnectedProjectScanPanel.tsx`
- Modify: `tests/project-scans/read-model.test.ts`
- Modify: `tests/components/ConnectedProjectScanPanel.test.tsx`
- Create: `tests/github-app/webhook-security-architecture.test.ts`

**Interfaces:**
- Consumes: existing browser-readable `github_repository_links.auto_scan_enabled`, access status, project scan state.
- Produces: truthful automatic-scanning status only; exposes no private webhook tables/payload metadata.

- [ ] **Step 1: Write RED UI/read-model tests**

Require connected project model/panel to show automatic scanning on/off from `auto_scan_enabled`, preserve manual scan action, and show inactive access status truthfully. Explicitly assert browser code does not query `github_webhook_deliveries` or `github_repository_auto_scan_state`.

- [ ] **Step 2: Write RED architecture guard**

Scan Phase 10A3 migration/service/route source and fail if credential/raw payload/archive URL/signature fields appear in persistence contracts or if route/service imports browser auth as its trust boundary.

- [ ] **Step 3: Run RED tests**

```bash
npm test -- tests/project-scans/read-model.test.ts tests/components/ConnectedProjectScanPanel.test.tsx tests/github-app/webhook-security-architecture.test.ts
```

Expected: new UI/status/guard assertions fail until implementation is aligned.

- [ ] **Step 4: Implement minimal read-model/UI copy**

Use existing link fields only. Do not expose delivery UUIDs, event payload details, or private auto-scan table state to browser code.

- [ ] **Step 5: Run GREEN tests and typecheck**

```bash
npm test -- tests/project-scans/read-model.test.ts tests/components/ConnectedProjectScanPanel.test.tsx tests/github-app/webhook-security-architecture.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add lib/project-scans/read-model.ts components/assets/ConnectedProjectScanPanel.tsx tests/project-scans/read-model.test.ts tests/components/ConnectedProjectScanPanel.test.tsx tests/github-app/webhook-security-architecture.test.ts
git commit -m "feat: surface automatic scan state safely [skip ci]"
```

---

### Task 8: Documentation, PR, full validation, and release gates

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ENVIRONMENT.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Create: `docs/development/PHASE_10A3_WORKING_STATE.md`
- Modify: `.env.example` if present and server-only settings are documented there.
- Create/update draft PR for `feat/phase-10a3-github-webhook-reconciliation` stacked on `feat/phase-10a2-private-repository-acquisition`.

**Interfaces:**
- Consumes: all prior Task evidence.
- Produces: durable release state and exact-head verification evidence.

- [ ] **Step 1: Reconcile architecture/environment docs**

Document webhook trust boundary, `GITHUB_APP_WEBHOOK_SECRET`, event allowlist, desired-head coalescing, explicit system trigger provenance, lifecycle state, existing runtime flags, and no-production-activation rule.

- [ ] **Step 2: Add working-state/release sequencing doc**

Record exact branch/head, implemented tasks, migrations, CI evidence, unresolved Phase 10A1/10A2 provider/runtime gates, and Phase 10A3 production requirements.

- [ ] **Step 3: Run targeted security suite**

```bash
npm test -- \
  tests/github-app/config.test.ts \
  tests/github-app/webhook.test.ts \
  tests/github-app/webhook-migration.test.ts \
  tests/github-app/webhook-database-types.test.ts \
  tests/github-app/webhook-service.test.ts \
  tests/github-app/webhook-route.test.ts \
  tests/github-app/webhook-security-architecture.test.ts \
  tests/project-scans/webhook-reconciliation.test.ts \
  tests/project-scans/finalize-continuation.test.ts \
  tests/workers/private-finalization.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run complete local validation matrix**

```bash
npm audit --audit-level=info
npm test
npm run typecheck
npm run cli:build
node packages/cli/dist/index.js --version
npm run benchmark:scanner
npm run benchmark:scanner:matrix
npm run build
npm run test:csp
```

Use the repository's exact existing script names if CI defines the production diagnostic under a different script; do not invent or skip a gate.

- [ ] **Step 5: Changed-file security review**

Review every Phase 10A3 changed file for raw-payload persistence, secret/token leakage, browser exposure, webhook trust-before-HMAC, replay races, provider-state trust mistakes, public/private class collapse, lifecycle race, runtime-gate bypass, and finalization replay.

- [ ] **Step 6: Open/update draft stacked PR and trigger exact-head CI once**

PR body must state:
- exact Phase 10A2 base/head
- no production migration applied
- no webhook registered
- webhook secret/provider canary unverified until supported production configuration is available
- full test/type/build evidence
- Phase 10A1 -> 10A2 -> 10A3 merge order.

- [ ] **Step 7: Inspect complete CI logs before claiming GREEN**

Require install, audit, all Vitest tests, typecheck, CLI build/version, scanner benchmarks, production Next.js build, CSP smoke, production diagnostic, and artifact step to succeed on the exact merge candidate.

- [ ] **Step 8: Keep PR draft after validation**

Do not apply Phase 10A3 production migration, configure/register the webhook, or merge while Phase 10A1/10A2 release gates remain unresolved.

- [ ] **Step 9: Commit documentation checkpoint if docs changed after executable validation**

```bash
git add docs/ARCHITECTURE.md docs/ENVIRONMENT.md docs/development/CURRENT_STATE.md docs/development/NEXT_STEPS.md docs/development/PHASE_10A3_WORKING_STATE.md .env.example
git commit -m "docs: record Phase 10A3 validation state [skip ci]"
```

Then formally compare the documentation head to the last executable GREEN head. If executable files differ, rerun the full exact-head matrix.
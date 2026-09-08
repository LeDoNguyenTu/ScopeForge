# Phase 9D Security Telemetry and Browser Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add privacy-reduced typed security telemetry to the centralized worker HTTP boundary, strengthen durable audit metadata safety, pin the released browser-header baseline, and publish evidence-driven alert/CSP guidance without adding another telemetry store or enforcing an unproven CSP.

**Architecture:** Phase 9D keeps two channels. Low-frequency workspace history continues through `public.audit_events`; high-frequency operational security signals use one server-only closed-union logger whose bounded JSON lines are captured by Vercel Runtime Logs. Worker classification happens only at `workerRouteError`; browser hardening in this release is regression coverage plus production-origin/CSP inventory, not CSP enforcement.

**Tech Stack:** Next.js 15.5, TypeScript 5.8, Vitest 3.2, Supabase, Vercel Runtime Logs, Node.js console transport.

**Spec:** `docs/superpowers/specs/2026-09-09-phase-9d-security-telemetry-browser-hardening-design.md`

## Global Constraints

- Work on `feat/phase-9d-security-telemetry-browser-hardening-v1`; approved spec head is `f0466e3596f82f220a6bcc865b9c4c8313c54ef9`.
- Branch base is production docs checkpoint `2af9a92b68c224d290a9597ff1907e5f1098791e`.
- Use TDD ordering. Commit each focused failing contract before its implementation.
- This harness historically has no executable repository checkout. If that remains true, call RED structural only and do not claim a test ran. The frozen candidate CI is the first required executable proof.
- Every intermediate code/docs commit uses `[skip ci]`. Spend substantive Actions only on the frozen candidate.
- Add no runtime or development dependency and no database migration/table.
- Do not modify `app/layout.tsx`, landing/dashboard visual files, package files, Supabase Auth provider settings, Vercel WAF settings, or PR #49.
- Preserve worker response status, body shape, cache headers, authentication semantics, task state, and lease state.
- Never log request objects, headers, cookies, authorization values, bodies, raw `Error` objects, repository source, executor output, environment dumps, IDs, IPs, or emails.
- Telemetry schema is exactly `scopeforge.security.v1`; event objects are flat, allowlisted, and at most 1024 UTF-8 bytes serialized.
- This plan does not enforce CSP. It documents the observed origin requirements and target policy; enforcement requires a separate later approved compatibility sub-gate.
- Keep false/absent: `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`, `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`, `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`, `HOSTED_ACTIVE_CORS_WORKER_ENABLED`.
- Before freeze and merge, refresh `main`. If concurrent UI work overlaps, preserve newest `main` and reapply only the Phase 9D security delta, then rerun preview/candidate validation.

---

### Task 1: Closed operational telemetry contract

**Files:**
- Create: `tests/security/security-telemetry.test.ts`
- Create: `lib/security/telemetry.ts`

**Interfaces:**
- Produces `WorkerSecurityRoute`:
  - `worker.claim`
  - `worker.heartbeat`
  - `worker.finalize`
  - `worker.repository_scan_artifact`
  - `worker.repository_scan_finalize`
  - `worker.runtime_prepare`
  - `worker.runtime_finalize`
- Produces a closed `SecurityTelemetryEvent` union.
- Produces `writeSecurityTelemetry(event: SecurityTelemetryEvent): void`.
- Warning events use `console.warn(serializedJson)`; error events use `console.error(serializedJson)`.
- Invalid/oversized input emits nothing and throws nothing.

- [ ] **Step 1: Write the failing unit contract**

Create `tests/security/security-telemetry.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeSecurityTelemetry } from "@/lib/security/telemetry";

afterEach(() => vi.restoreAllMocks());

describe("security telemetry", () => {
  it("writes one bounded warning JSON object", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    writeSecurityTelemetry({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "WORKER_AUTHENTICATION_FAILED",
      status: 401,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    const serialized = String(warn.mock.calls[0]?.[0]);
    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(1024);
    expect(JSON.parse(serialized)).toEqual({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "WORKER_AUTHENTICATION_FAILED",
      status: 401,
    });
  });

  it("uses error output for unexpected worker failure", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    writeSecurityTelemetry({
      schema: "scopeforge.security.v1",
      event: "worker.request_failed",
      severity: "error",
      route: "worker.runtime_prepare",
      code: "WORKER_REQUEST_FAILED",
      status: 500,
    });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("silently drops runtime-invalid input", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    writeSecurityTelemetry({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "X".repeat(200),
      status: 401,
    } as never);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run tests/security/security-telemetry.test.ts
```

Expected: FAIL because `@/lib/security/telemetry` is absent.

If no local checkout exists, verify the committed test imports the absent module and record RED as structural only.

- [ ] **Step 3: Commit RED**

```bash
git add tests/security/security-telemetry.test.ts
git commit -m "test: define Phase 9D security telemetry contract [skip ci]"
```

- [ ] **Step 4: Implement the minimum logger**

Create `lib/security/telemetry.ts` using the Next.js server-only marker and this type model:

```ts
import "server-only";

export type WorkerSecurityRoute =
  | "worker.claim"
  | "worker.heartbeat"
  | "worker.finalize"
  | "worker.repository_scan_artifact"
  | "worker.repository_scan_finalize"
  | "worker.runtime_prepare"
  | "worker.runtime_finalize";

type WorkerSecurityEvent = {
  schema: "scopeforge.security.v1";
  event:
    | "worker.authentication_rejected"
    | "worker.access_rejected"
    | "worker.rate_limited"
    | "worker.request_failed";
  severity: "warning" | "error";
  route: WorkerSecurityRoute;
  code: string;
  status: number;
};

type ControlMisconfigurationEvent = {
  schema: "scopeforge.security.v1";
  event: "security.control_misconfigured";
  severity: "error";
  route: "security.config";
  control: string;
};

export type SecurityTelemetryEvent = WorkerSecurityEvent | ControlMisconfigurationEvent;
```

Runtime validation must require:

```text
schema == scopeforge.security.v1
worker route in the fixed union
worker code matches ^[A-Z0-9_]{1,80}$
worker status is integer 400..599
control matches ^[a-z0-9_.-]{1,64}$
serialized normalized object <= 1024 UTF-8 bytes
```

Construct a new normalized object from allowlisted fields. Never stringify the caller object. Wrap validation, serialization, and output in an internal `try/catch`; rejected input produces no secondary log.

- [ ] **Step 5: Verify GREEN**

```bash
npx vitest run tests/security/security-telemetry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit implementation**

```bash
git add lib/security/telemetry.ts tests/security/security-telemetry.test.ts
git commit -m "feat: add bounded security telemetry logger [skip ci]"
```

---

### Task 2: Durable audit metadata hardening

**Files:**
- Create: `tests/security/audit-metadata.test.ts`
- Modify: `lib/audit/write-audit-event.ts`

**Interfaces:**
- Produces `assertSafeAuditMetadata(value: Json, path?: string): void`.
- `writeAuditEvent` retains its current public input and 8 KiB serialized metadata limit.
- Valid existing fields such as `sourceType`, `reasonCode`, `kind`, `hostname`, `method`, `expires_at`, `jobId`, and bounded `details` remain legal.

- [ ] **Step 1: Write failing metadata tests**

Create `tests/security/audit-metadata.test.ts` with nested rejection cases for:

```ts
const forbiddenKeys = [
  "accessToken",
  "refresh_token",
  "captchaToken",
  "serviceRoleKey",
  "apiKey",
  "workerCredential",
  "leaseToken",
  "password",
  "cookie",
  "authorization",
  "requestBody",
  "responseBody",
  "source",
  "sourceCode",
  "stdout",
  "stderr",
  "environment",
  "headers",
  "privateKey",
];
```

Representative expectations:

```ts
expect(() => assertSafeAuditMetadata({ nested: { requestBody: "payload" } })).toThrow(/Sensitive audit metadata key/);
expect(() => assertSafeAuditMetadata({ sourceType: "repository", reasonCode: "DENIED" })).not.toThrow();
expect(() => assertSafeAuditMetadata({ details: { redirectCount: 2, elapsedMs: 15 } })).not.toThrow();
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/security/audit-metadata.test.ts
```

Expected: FAIL because the validator is not exported and current runtime matching does not cover all content-bearing keys.

- [ ] **Step 3: Commit RED**

```bash
git add tests/security/audit-metadata.test.ts
git commit -m "test: expand audit metadata safety contract [skip ci]"
```

- [ ] **Step 4: Harden the validator**

In `lib/audit/write-audit-event.ts`:

- export/rename the pure recursive validator to `assertSafeAuditMetadata`
- retain credential-like substring detection for token, secret, password, credential, authorization, cookie, API key, and private key
- add an exact normalized denylist for content fields:

```ts
const FORBIDDEN_CONTENT_KEYS = new Set([
  "requestbody",
  "responsebody",
  "source",
  "sourcecode",
  "stdout",
  "stderr",
  "environment",
  "headers",
]);
```

Normalize a key with lowercasing plus `_`/`-` removal only for the exact-set check. Do not reject benign keys such as `sourceType`.

- [ ] **Step 5: Verify focused and representative callers**

Run exactly:

```bash
npx vitest run \
  tests/security/audit-metadata.test.ts \
  tests/assets \
  tests/runtime-observations \
  tests/runtime-validator/service.test.ts \
  tests/runtime-workers/request.test.ts
```

Expected: PASS and no existing controlled audit metadata rejected.

- [ ] **Step 6: Commit implementation**

```bash
git add lib/audit/write-audit-event.ts tests/security/audit-metadata.test.ts
git commit -m "fix: harden audit metadata redaction boundary [skip ci]"
```

---

### Task 3: Central worker security classification

**Files:**
- Create: `tests/workers/worker-route-telemetry.test.ts`
- Modify: `lib/worker-control/http-response.ts`

**Interfaces:**
- Consumes `writeSecurityTelemetry` and `WorkerSecurityRoute`.
- Changes `workerRouteError(error: unknown): Response` to `workerRouteError(error: unknown, route: WorkerSecurityRoute): Response`.
- Response status, JSON body, and `cache-control: no-store` remain unchanged.

- [ ] **Step 1: Write failing classification tests**

Create `tests/workers/worker-route-telemetry.test.ts`. Use actual constructors `new WorkerBrokerAuthError()` and `new WorkerControlError(code)` and spy on console output.

Required cases:

```text
WorkerBrokerAuthError -> 401 + worker.authentication_rejected warning
RUNTIME_WORKER_ACCESS_DENIED -> 403 + worker.access_rejected warning
WORKER_DISABLED -> 403 + worker.access_rejected warning
WORKER_NOT_AVAILABLE -> 403 + worker.access_rejected warning
RUNTIME_WORKER_ACTIVE_LIMIT -> 429 + worker.rate_limited warning
representative 400/409 errors -> unchanged response + zero telemetry
unknown Error("must never be serialized") -> 500 + worker.request_failed error, raw message absent
```

Also parse the Response JSON and assert it remains `{ error: { code: ... } }`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/workers/worker-route-telemetry.test.ts
```

Expected: FAIL because route identity/telemetry do not exist on `workerRouteError` yet.

- [ ] **Step 3: Commit RED**

```bash
git add tests/workers/worker-route-telemetry.test.ts
git commit -m "test: define worker security telemetry classification [skip ci]"
```

- [ ] **Step 4: Implement classification in `http-response.ts`**

Keep existing status helper functions. Add a private classifier which receives only the bounded route, known code, and mapped status. Never pass an error message, request, or error object into `writeSecurityTelemetry`.

Classification:

```text
WorkerBrokerAuthError -> authentication_rejected / warning
WorkerControlError RUNTIME_WORKER_ACCESS_DENIED, WORKER_DISABLED, WORKER_NOT_AVAILABLE -> access_rejected / warning
WorkerControlError RUNTIME_WORKER_ACTIVE_LIMIT -> rate_limited / warning
unknown exception -> request_failed / error / WORKER_REQUEST_FAILED / 500
ordinary 400/409 domain and transport/state conflicts -> no security telemetry
```

Telemetry failure must not change the returned response.

- [ ] **Step 5: Verify worker boundary**

```bash
npx vitest run \
  tests/workers/worker-route-telemetry.test.ts \
  tests/workers/broker-routes.test.ts \
  tests/workers/broker-auth.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit implementation**

```bash
git add lib/worker-control/http-response.ts tests/workers/worker-route-telemetry.test.ts
git commit -m "feat: classify worker security failures centrally [skip ci]"
```

---

### Task 4: Fixed route identities for all worker endpoints

**Files:**
- Modify: `tests/workers/broker-routes.test.ts`
- Modify: `app/api/internal/workers/claim/route.ts`
- Modify: `app/api/internal/workers/heartbeat/route.ts`
- Modify: `app/api/internal/workers/finalize/route.ts`
- Modify: `app/api/internal/workers/repository-scans/artifact/route.ts`
- Modify: `app/api/internal/workers/repository-scans/finalize/route.ts`
- Modify: `app/api/internal/workers/runtime/prepare/route.ts`
- Modify: `app/api/internal/workers/runtime/finalize/route.ts`

**Interfaces:** Every catch block calls `workerRouteError(error, <fixed literal>)`. Route identity is never derived from request data.

- [ ] **Step 1: Extend route tests first**

Add all seven files to `routePaths` and require these exact literals:

```ts
const expectedRouteIds = {
  claim: "worker.claim",
  heartbeat: "worker.heartbeat",
  finalize: "worker.finalize",
  repositoryScanArtifact: "worker.repository_scan_artifact",
  repositoryScanFinalize: "worker.repository_scan_finalize",
  runtimePrepare: "worker.runtime_prepare",
  runtimeFinalize: "worker.runtime_finalize",
} as const;
```

Assert combined route sources do not derive telemetry identity from `request.url`, `new URL(request.url)`, query values, or headers.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/workers/broker-routes.test.ts
```

Expected: FAIL because current catch blocks call `workerRouteError(error)`.

- [ ] **Step 3: Commit RED**

```bash
git add tests/workers/broker-routes.test.ts
git commit -m "test: pin worker telemetry route identities [skip ci]"
```

- [ ] **Step 4: Update only the seven catch blocks**

Example:

```ts
} catch (error) {
  return workerRouteError(error, "worker.claim");
}
```

Apply the matching literal to each route. Make no other route behavior change.

- [ ] **Step 5: Verify route/telemetry tests**

```bash
npx vitest run tests/workers/broker-routes.test.ts tests/workers/worker-route-telemetry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit implementation**

```bash
git add app/api/internal/workers tests/workers/broker-routes.test.ts
git commit -m "feat: attach fixed worker telemetry route ids [skip ci]"
```

---

### Task 5: Browser-header regression guard and alert/CSP truth document

**Files:**
- Create: `tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts`
- Create: `docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`
- Read only: `next.config.ts`, `middleware.ts`, `components/AuthForm.tsx`, `components/auth/TurnstileChallenge.tsx`, landing/WebGL imports, Supabase client modules, `package.json`

**Interfaces:** No browser runtime interface changes and no CSP header.

- [ ] **Step 1: Write the failing architecture guard**

Require:

```text
telemetry module has schema + all five event names
telemetry public source has no generic metadata/details/message/headers/body/Record<string, unknown> escape hatch
next.config.ts retains nosniff
next.config.ts retains strict-origin-when-cross-origin
next.config.ts retains X-Frame-Options DENY
next.config.ts retains current restrictive Permissions-Policy
next.config.ts retains HSTS max-age=63072000; includeSubDomains; preload
poweredByHeader remains false
next.config.ts does not add Content-Security-Policy in this release
package.json contains no new logging/telemetry SDK package
operations document states CSP NOT ENFORCED and Vercel automated alerts NOT CLAIMED
operations document contains the four exact threshold contracts
Phase 9D sources do not reference hosted runtime capability variables
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts
```

Expected: FAIL because `docs/security/PHASE_9D_TELEMETRY_AND_CSP.md` is absent.

- [ ] **Step 3: Commit RED**

```bash
git add tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts
git commit -m "test: guard Phase 9D telemetry and browser boundaries [skip ci]"
```

- [ ] **Step 4: Inventory observed production resource/origin needs**

Inspect the exact branch source and record only observed requirements for:

```text
Next.js local framework scripts
current local/remote landing and WebGL resources
image/font origins referenced by source/CSS
Supabase browser HTTPS/WSS origin contract
Turnstile https://challenges.cloudflare.com script/frame behavior when configured
analytics/provider origins actually present in package/source
```

Do not add a generic origin merely because a dependency could use it.

- [ ] **Step 5: Write `docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`**

It must include:

```text
current executable/docs baseline
exact two-channel model
allowed operational fields + forbidden data
worker.authentication_rejected >= 10 in 5 minutes
worker.request_failed >= 3 in 5 minutes or sustained after deployment
worker.rate_limited >= 20 in 10 minutes per route/deployment context
security.control_misconfigured: any production occurrence actionable
response/rollback actions for each signal
Vercel automated alert state: NOT CLAIMED
CSP state: NOT ENFORCED
observed origin/resource inventory
target CSP properties from the approved spec
no wildcard, unsafe-eval, or broad unsafe-inline approval
CSP compatibility/enforcement prerequisites and rollback
```

- [ ] **Step 6: Verify Phase 9D focused suite**

```bash
npx vitest run \
  tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts \
  tests/security/security-telemetry.test.ts \
  tests/security/audit-metadata.test.ts \
  tests/workers/worker-route-telemetry.test.ts \
  tests/workers/broker-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit evidence**

```bash
git add tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts docs/security/PHASE_9D_TELEMETRY_AND_CSP.md
git commit -m "docs: record Phase 9D telemetry and CSP evidence [skip ci]"
```

---

### Task 6: Resumable checkpoint and exact-head preview

**Files:**
- Modify: `docs/development/PHASE_9_WORKING_STATE.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

- [ ] **Step 1: Refresh actual `main` and compare branch scope**

Require no unexpected overlap. If current `main` changed an overlapping file, merge/reconcile by retaining newest `main` content and reapplying only reviewed Phase 9D changes, then rerun focused tests/preview before proceeding.

- [ ] **Step 2: Require exact-head Vercel Preview**

Require metadata for the branch head and build logs proving compile/type validation/build success, deployment `READY`, and `aliasError=null`. Record the exact preview URL as `PHASE9D_PREVIEW_URL` for Task 7.

- [ ] **Step 3: Update working/handoff docs**

Record exact head/tree, changed files, test-first history, exact preview deployment/URL, CSP `NOT ENFORCED`, automated alerts `NOT CLAIMED`, and remaining Runtime Log/candidate CI gates.

- [ ] **Step 4: Commit checkpoint**

```bash
git add docs/development/PHASE_9_WORKING_STATE.md docs/development/SESSION_HANDOFF.md
git commit -m "docs: checkpoint Phase 9D security telemetry [skip ci]"
```

- [ ] **Step 5: Verify checkpoint**

Require zero GitHub Actions runs for the checkpoint SHA and an exact-head Vercel Preview `READY` with `aliasError=null`.

---

### Task 7: Real preview Runtime Log acceptance

**Files:** No production code change unless the acceptance uncovers a real defect; then use systematic debugging and a new test-first repair cycle.

**Interfaces:** Consumes the exact `PHASE9D_PREVIEW_URL` from Task 6. Intentionally unauthenticated POST to `/api/internal/workers/claim`; expected bounded 401 and one warning telemetry event.

- [ ] **Step 1: Issue one harmless preview POST**

Set the exact URL returned by Task 6 and issue:

```bash
export PHASE9D_PREVIEW_URL='https://the-exact-preview-host-returned-by-vercel'
curl -sS -i -X POST "$PHASE9D_PREVIEW_URL/api/internal/workers/claim"
```

The shell value must be replaced with the exact URL returned by the connected Vercel deployment metadata before execution. If deployment protection is active, use the connected Vercel access mechanism or an authenticated browser-capable execution surface to issue the same POST. Do not add a debug endpoint.

If no available execution surface can issue POST to the protected preview, stop release acceptance here and report that exact blocker. Do not substitute source inspection.

Expected: 401 bounded worker auth response and no persistent state mutation.

- [ ] **Step 2: Query exact-deployment Runtime Logs**

Filter connected Vercel Runtime Logs to the preview deployment and recent warning/error events; search for `scopeforge.security.v1`.

Require one event containing only allowed fields and no authorization value, cookie, raw headers, body, query string, IDs, secret, or raw error message.

- [ ] **Step 3: Record exact runtime evidence in working/handoff docs**

Record deployment ID, HTTP status, schema/event/route, and privacy verification only. Do not record any test credential.

- [ ] **Step 4: Commit evidence docs**

```bash
git add docs/development/PHASE_9_WORKING_STATE.md docs/development/SESSION_HANDOFF.md
git commit -m "docs: record Phase 9D runtime telemetry acceptance [skip ci]"
```

---

### Task 8: Freeze, PR, merge, post-merge verification, release checkpoint

**Files after successful release verification:**
- Create: `docs/development/PHASE_9D_RELEASE_STATE.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/PHASE_9_WORKING_STATE.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

- [ ] **Step 1: Final pre-freeze refresh**

Refresh `main`; reconcile any late overlapping UI drift first. Require a new exact-head preview after any reconciliation.

- [ ] **Step 2: Freeze the reviewed tree without modifying it**

Create a tree-identical commit:

```text
chore: freeze Phase 9D release candidate
```

- [ ] **Step 3: Verify exact frozen preview**

Require exact SHA metadata, `READY`, successful production build output, and `aliasError=null`.

- [ ] **Step 4: Open draft PR against actual current `main` and inspect the complete file list**

Scope must contain only approved Phase 9D implementation/tests/docs plus explicit reconciliation edits needed to preserve newer `main`.

- [ ] **Step 5: Mark ready and spend one substantive candidate CI run**

Require success for:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm audit --audit-level=info
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run benchmark:matrix
npm run build
```

Do not blindly rerun a failure; use systematic debugging first.

- [ ] **Step 6: Immutable pre-merge verification**

Require exact frozen head, CI-tested base, mergeable PR, no unresolved review/thread blocker, exact preview READY, recorded runtime-log acceptance, Supabase Security Advisor truth, CSP still not claimed enforced, and automated alerts still not claimed unless separately proven.

- [ ] **Step 7: Squash merge with `expected_head_sha` pinned**

If head/base moves, reconcile/revalidate instead of forcing.

- [ ] **Step 8: Independently verify merged `main`**

Require post-merge main CI success on the exact squash SHA and exact Vercel production deployment `READY`, `scopeforge.dev` alias present, `aliasError=null`, plus no new Supabase Security Advisor regression.

- [ ] **Step 9: Create one atomic five-file docs release checkpoint**

Record PR/candidate/tree/CI/preview, squash release identity, post-merge CI/production deployment, telemetry privacy contract, real preview runtime evidence, CSP `NOT ENFORCED`, automated alerts `NOT CLAIMED` unless directly proven, provider truth, and Phase 9E as next implementation boundary.

Commit:

```text
docs: record Phase 9D release and Phase 9E handoff [skip ci]
```

- [ ] **Step 10: Verify docs checkpoint**

Require exactly those five docs files, zero GitHub Actions runs for the docs SHA, and the normal docs production deployment `READY`. Keep executable Phase 9D release identity pinned separately to the squash merge SHA/tree.

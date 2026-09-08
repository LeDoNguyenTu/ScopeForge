# Phase 9D Security Telemetry and Browser Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add privacy-reduced, typed security telemetry to the centralized worker HTTP boundary, strengthen durable audit metadata safety, pin the released browser-header baseline, and publish evidence-driven alert/CSP guidance without adding a second telemetry store or enforcing an unproven CSP.

**Architecture:** Phase 9D keeps two distinct channels. Low-frequency workspace history continues through `public.audit_events`; high-frequency operational security signals use one server-only, closed-union logger whose JSON lines are captured by Vercel Runtime Logs. Worker classification happens only at `workerRouteError`, while browser hardening in this release is limited to regression tests and a production-origin/CSP inventory - CSP enforcement remains a separate future sub-gate.

**Tech Stack:** Next.js 15.5, TypeScript, Vitest, Supabase, Vercel Runtime Logs, Node.js console transport.

**Spec:** `docs/superpowers/specs/2026-09-09-phase-9d-security-telemetry-browser-hardening-design.md`

## Global Constraints

- Start from branch `feat/phase-9d-security-telemetry-browser-hardening-v1`, whose approved written-spec head is `f0466e3596f82f220a6bcc865b9c4c8313c54ef9`.
- Production baseline at branch creation is `2af9a92b68c224d290a9597ff1907e5f1098791e`.
- Use TDD ordering: commit the focused failing contract before its implementation.
- If this harness still has no executable repository checkout, explicitly record RED as structural only; do not claim a test ran. The frozen GitHub Actions candidate is the required executable proof.
- Use `[skip ci]` on every intermediate implementation/documentation commit. Reserve one substantive Actions run for the frozen candidate.
- Add no runtime or development package.
- Add no database migration or second telemetry/audit table.
- Do not modify `app/layout.tsx`, landing/dashboard visual files, PR #49, package files, Supabase Auth provider settings, Vercel WAF settings, or hosted worker capability flags.
- Preserve the exact worker HTTP status/body/cache behavior while adding telemetry.
- Do not log request objects, headers, cookies, authorization values, request/response bodies, raw `Error` objects, repository source, executor output, environment dumps, worker IDs, task IDs, workspace IDs, user IDs, asset IDs, IP addresses, or email addresses.
- Operational telemetry schema is `scopeforge.security.v1`, flat, allowlisted, and at most 1024 UTF-8 bytes per serialized event.
- Do not enforce Content Security Policy in this implementation plan. This release produces compatibility evidence and a target policy only; enforcement requires its own later approved sub-gate after browser proof.
- Keep these false/absent: `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`, `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`, `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`, `HOSTED_ACTIVE_CORS_WORKER_ENABLED`.
- Before freeze and before merge, re-read the exact current `main`. If concurrent UI work has moved it, preserve the newest `main` UI and reapply only the Phase 9D security delta where overlap exists.

---

### Task 1: Define the closed operational security telemetry contract

**Files:**
- Create: `tests/security/security-telemetry.test.ts`
- Create: `lib/security/telemetry.ts`

**Interfaces:**
- Produces:
  - `type WorkerSecurityRoute = "worker.claim" | "worker.heartbeat" | "worker.finalize" | "worker.repository_scan_artifact" | "worker.repository_scan_finalize" | "worker.runtime_prepare" | "worker.runtime_finalize"`
  - `type SecurityTelemetryEvent` as a closed flat discriminated union
  - `writeSecurityTelemetry(event: SecurityTelemetryEvent): void`
- `writeSecurityTelemetry` emits one JSON line through `console.warn` for warning events and `console.error` for error events.
- Invalid/oversized telemetry emits nothing and throws nothing.

- [ ] **Step 1: Write the failing telemetry contract test**

Create `tests/security/security-telemetry.test.ts` with focused cases equivalent to:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeSecurityTelemetry } from "@/lib/security/telemetry";

afterEach(() => vi.restoreAllMocks());

describe("security telemetry", () => {
  it("writes one bounded warning JSON object for worker authentication rejection", () => {
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

  it("uses error output for unexpected worker failures", () => {
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

  it("emits no secondary log when runtime validation rejects an invalid event", () => {
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

Also add compile-time/source-shape assertions in this test file or the architecture test later proving there is no `metadata`, `details`, `message`, `request`, `headers`, `body`, `error`, or generic `Record<string, unknown>` escape hatch in the public telemetry input.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/security/security-telemetry.test.ts
```

Expected: FAIL because `@/lib/security/telemetry` does not exist yet.

If no local checkout exists, verify instead that the test commit imports the absent module, record that RED is structural, and do not claim execution.

- [ ] **Step 3: Commit the RED contract alone**

```bash
git add tests/security/security-telemetry.test.ts
git commit -m "test: define Phase 9D security telemetry contract [skip ci]"
```

- [ ] **Step 4: Implement the minimum telemetry module**

Create `lib/security/telemetry.ts` with a closed type model. Use this shape:

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

Runtime validation must enforce:

- schema exactly `scopeforge.security.v1`
- event/severity combinations exactly as defined
- route from the fixed union
- worker `code` matches `^[A-Z0-9_]{1,80}$`
- worker `status` is an integer from 400 through 599
- control matches `^[a-z0-9_.-]{1,64}$`
- serialized event <= 1024 UTF-8 bytes

Build a fresh normalized object from allowlisted fields before serialization. Never serialize the caller object directly. Wrap validation/serialization/output in an internal `try/catch` that silently drops invalid telemetry without logging the rejected object or exception.

- [ ] **Step 5: Run the focused test and verify GREEN**

```bash
npx vitest run tests/security/security-telemetry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the telemetry implementation**

```bash
git add lib/security/telemetry.ts tests/security/security-telemetry.test.ts
git commit -m "feat: add bounded security telemetry logger [skip ci]"
```

---

### Task 2: Strengthen durable audit metadata safety without breaking valid callers

**Files:**
- Create: `tests/security/audit-metadata.test.ts`
- Modify: `lib/audit/write-audit-event.ts`

**Interfaces:**
- Produces: `assertSafeAuditMetadata(value: Json, path?: string): void`
- `writeAuditEvent` continues to use the same public input contract and existing 8 KiB size ceiling.
- Existing valid metadata such as `{ kind, hostname }`, `{ method, expires_at }`, `{ jobId, details }`, and controlled reason strings must remain accepted.

- [ ] **Step 1: Write failing audit-safety regression tests**

Create `tests/security/audit-metadata.test.ts` that imports `assertSafeAuditMetadata` and verifies rejection for nested variants of:

```ts
[
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
]
```

Example:

```ts
expect(() => assertSafeAuditMetadata({ nested: { requestBody: "payload" } })).toThrow(/Sensitive audit metadata key/);
```

Add positive cases proving these remain legal:

```ts
expect(() => assertSafeAuditMetadata({ sourceType: "repository", reasonCode: "DENIED" })).not.toThrow();
expect(() => assertSafeAuditMetadata({ details: { redirectCount: 2, elapsedMs: 15 } })).not.toThrow();
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run tests/security/audit-metadata.test.ts
```

Expected: FAIL because the pure validator is not exported and current matching does not cover the complete content-field denylist.

- [ ] **Step 3: Commit the RED audit contract**

```bash
git add tests/security/audit-metadata.test.ts
git commit -m "test: expand audit metadata safety contract [skip ci]"
```

- [ ] **Step 4: Harden the runtime validator minimally**

In `lib/audit/write-audit-event.ts`:

- rename/export the validator as `assertSafeAuditMetadata`
- retain credential-like substring matching for token/secret/password/credential/authorization/cookie/API-key/private-key concepts
- add a separate normalized exact-key denylist for content-bearing keys:

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

Normalize only key spelling for the exact-key check, for example lowercase and remove `_` / `-`. Do not reject `sourceType`, `resourceSource`, or other benign keys solely because they contain the substring `source`.

Keep recursive traversal and the existing 8 KiB limit unchanged.

- [ ] **Step 5: Run focused audit tests plus representative existing audit callers**

Run:

```bash
npx vitest run tests/security/audit-metadata.test.ts tests/assets tests/runtime-observations tests/active-validation
```

If one of the directory names does not exist, use the exact existing test paths discovered in the repo and record the substitution in the working-state checkpoint.

Expected: PASS with no valid caller rejected.

- [ ] **Step 6: Commit the audit hardening**

```bash
git add lib/audit/write-audit-event.ts tests/security/audit-metadata.test.ts
git commit -m "fix: harden audit metadata redaction boundary [skip ci]"
```

---

### Task 3: Classify worker failures centrally without changing responses

**Files:**
- Create: `tests/workers/worker-route-telemetry.test.ts`
- Modify: `lib/worker-control/http-response.ts`
- Consumes: `writeSecurityTelemetry`, `WorkerSecurityRoute`

**Interfaces:**
- Changes `workerRouteError` from:
  - `workerRouteError(error: unknown): Response`
- To:
  - `workerRouteError(error: unknown, route: WorkerSecurityRoute): Response`
- Returned status/body/cache headers remain byte/shape-compatible with existing behavior.

- [ ] **Step 1: Write the failing classification test**

Create `tests/workers/worker-route-telemetry.test.ts` using `vi.spyOn(console, "warn")` / `console.error` around direct `workerRouteError` calls.

Required cases:

- `new WorkerBrokerAuthError()` on `worker.claim` -> 401 response and one `worker.authentication_rejected` warning
- `new WorkerControlError("RUNTIME_WORKER_ACCESS_DENIED")` -> unchanged 403 and one `worker.access_rejected` warning
- `new WorkerControlError("RUNTIME_WORKER_ACTIVE_LIMIT")` -> unchanged 429 and one `worker.rate_limited` warning
- representative expected 400 and 409 domain errors -> unchanged response and zero telemetry output
- `new Error("must never be serialized")` -> unchanged `{ error: { code: "WORKER_REQUEST_FAILED" } }` 500 and one `worker.request_failed` error line that does not contain the raw message

Use the actual constructor signatures from `lib/worker-control/types.ts`; do not invent test-only production constructors.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run tests/workers/worker-route-telemetry.test.ts
```

Expected: FAIL because `workerRouteError` does not yet accept route identity or emit telemetry.

- [ ] **Step 3: Commit the RED worker-classification test**

```bash
git add tests/workers/worker-route-telemetry.test.ts
git commit -m "test: define worker security telemetry classification [skip ci]"
```

- [ ] **Step 4: Implement classification in the shared HTTP boundary**

In `lib/worker-control/http-response.ts`:

- import `writeSecurityTelemetry` and `WorkerSecurityRoute`
- keep all existing status helper functions
- add a small private `emitWorkerSecurityTelemetry(error, route, status, code)` classifier
- call it only after the response code/status are known
- never pass `error.message`, request data, or the error object into telemetry
- ensure telemetry cannot change the Response path

Classification rules:

```text
WorkerBrokerAuthError -> worker.authentication_rejected / warning / 401
WorkerControlError code RUNTIME_WORKER_ACCESS_DENIED, WORKER_DISABLED, WORKER_NOT_AVAILABLE -> worker.access_rejected / warning / mapped 403
WorkerControlError code RUNTIME_WORKER_ACTIVE_LIMIT -> worker.rate_limited / warning / 429
unknown exception -> worker.request_failed / error / 500
all ordinary 400/409 domain and transport/state conflicts -> no security telemetry
```

Do not classify malformed transport input as a security event in this first release unless it already maps to one of the explicit categories above.

- [ ] **Step 5: Run focused worker tests**

```bash
npx vitest run tests/workers/worker-route-telemetry.test.ts tests/workers/broker-routes.test.ts tests/workers/broker-auth.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the centralized integration**

```bash
git add lib/worker-control/http-response.ts tests/workers/worker-route-telemetry.test.ts
git commit -m "feat: classify worker security failures centrally [skip ci]"
```

---

### Task 4: Give every worker route a fixed compile-time telemetry identity

**Files:**
- Modify: `app/api/internal/workers/claim/route.ts`
- Modify: `app/api/internal/workers/heartbeat/route.ts`
- Modify: `app/api/internal/workers/finalize/route.ts`
- Modify: `app/api/internal/workers/repository-scans/artifact/route.ts`
- Modify: `app/api/internal/workers/repository-scans/finalize/route.ts`
- Modify: `app/api/internal/workers/runtime/prepare/route.ts`
- Modify: `app/api/internal/workers/runtime/finalize/route.ts`
- Modify: `tests/workers/broker-routes.test.ts`

**Interfaces:**
- Every route calls `workerRouteError(error, <literal WorkerSecurityRoute>)`.
- No route derives telemetry identity from `request.url`, pathname parsing, headers, query strings, or request body.

- [ ] **Step 1: Extend the route architecture test first**

Update `tests/workers/broker-routes.test.ts` to cover all seven current worker endpoints and assert each source contains its required literal:

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

Also assert the combined route source does not contain telemetry derivation from `request.url`, `new URL(request.url)`, `location`, or arbitrary route strings.

- [ ] **Step 2: Run route tests and verify RED**

```bash
npx vitest run tests/workers/broker-routes.test.ts
```

Expected: FAIL because current route catch blocks still call `workerRouteError(error)` without a route literal.

- [ ] **Step 3: Commit the RED route identity contract**

```bash
git add tests/workers/broker-routes.test.ts
git commit -m "test: pin worker telemetry route identities [skip ci]"
```

- [ ] **Step 4: Update all seven catch blocks**

Examples:

```ts
} catch (error) {
  return workerRouteError(error, "worker.claim");
}
```

and corresponding fixed literals for the other six endpoints. Do not make any other route behavior change.

- [ ] **Step 5: Run worker route and telemetry tests**

```bash
npx vitest run tests/workers/broker-routes.test.ts tests/workers/worker-route-telemetry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit fixed route identities**

```bash
git add app/api/internal/workers tests/workers/broker-routes.test.ts
git commit -m "feat: attach fixed worker telemetry route ids [skip ci]"
```

---

### Task 5: Pin the browser security baseline and publish alert/CSP evidence

**Files:**
- Create: `tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts`
- Create: `docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`
- Read only: `next.config.ts`, `middleware.ts`, `components/auth/TurnstileChallenge.tsx`, `components/AuthForm.tsx`, current landing/WebGL imports, Supabase client modules, `package.json`

**Interfaces:**
- No browser runtime interface changes.
- No CSP header is added in this task.
- Document is the operational truth source for alert thresholds, telemetry fields, current CSP state, target directives, preview verification, and rollback.

- [ ] **Step 1: Write the failing architecture contract first**

Create `tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts` that reads the relevant sources and requires:

1. `lib/security/telemetry.ts` contains the fixed schema and five event names and does not expose generic `metadata`, `details`, `message`, `headers`, `body`, or `Record<string, unknown>` event fields.
2. `next.config.ts` still contains:
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-Frame-Options: DENY`
   - current restrictive `Permissions-Policy`
   - current HSTS value
   - `poweredByHeader: false`
3. `next.config.ts` does not claim an enforced `Content-Security-Policy` in this initial plan.
4. `package.json` has no newly introduced logging/telemetry dependency pattern such as `sentry`, `datadog`, `pino`, `winston`, `opentelemetry`, or another log store SDK.
5. `docs/security/PHASE_9D_TELEMETRY_AND_CSP.md` records all four alert thresholds and states CSP enforcement is pending/not active.
6. Phase 9D code does not reference hosted worker capability environment variables.

- [ ] **Step 2: Run the architecture test and verify RED**

```bash
npx vitest run tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts
```

Expected: FAIL because the Phase 9D operational/CSP document does not exist yet.

- [ ] **Step 3: Commit the RED architecture guard**

```bash
git add tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts
git commit -m "test: guard Phase 9D telemetry and browser boundaries [skip ci]"
```

- [ ] **Step 4: Inventory the actual current production-origin requirements**

Before writing the document, inspect the exact branch source and record only observed requirements. At minimum establish:

- Next.js scripts are local framework assets
- current landing/WebGL resources and whether they are local or remote
- image/font origins actually referenced in source/CSS
- Supabase connection origin from `NEXT_PUBLIC_SUPABASE_URL` contract and whether browser code requires HTTPS and/or WSS
- Turnstile script/frame origin `https://challenges.cloudflare.com` when configured
- analytics/provider origins actually present in `package.json` or source

Do not invent an origin merely because a library might support it.

- [ ] **Step 5: Write the Phase 9D operational/CSP truth document**

Create `docs/security/PHASE_9D_TELEMETRY_AND_CSP.md` with these explicit sections:

- released/current baseline SHA
- two-channel telemetry model
- exact allowed event fields and forbidden data
- alert contracts:
  - auth rejection: >=10 in 5 minutes
  - unexpected worker failures: >=3 in 5 minutes or sustained after deploy
  - worker throttling: >=20 in 10 minutes per route/deployment context
  - security-control misconfiguration: any production event actionable
- responder/rollback actions for each alert
- current Vercel alert automation state: `NOT CLAIMED` unless directly configured and verified through a supported mutation surface
- current CSP state: `NOT ENFORCED`
- observed production origin/resource inventory
- target CSP properties from the spec
- explicit statement that no broad `unsafe-inline`, `unsafe-eval`, or wildcard policy is approved
- CSP enforcement prerequisites and rollback expectations

- [ ] **Step 6: Run the architecture test and focused Phase 9D tests**

```bash
npx vitest run \
  tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts \
  tests/security/security-telemetry.test.ts \
  tests/security/audit-metadata.test.ts \
  tests/workers/worker-route-telemetry.test.ts \
  tests/workers/broker-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit browser/operational evidence**

```bash
git add tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts docs/security/PHASE_9D_TELEMETRY_AND_CSP.md
git commit -m "docs: record Phase 9D telemetry and CSP evidence [skip ci]"
```

---

### Task 6: Build the resumable Phase 9D checkpoint and preflight the exact branch

**Files:**
- Modify: `docs/development/PHASE_9_WORKING_STATE.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

**Interfaces:**
- Checkpoint must distinguish local/structural test evidence from executed CI evidence.
- Checkpoint must not describe CSP, alerts, Turnstile provider enforcement, leaked-password protection, or WAF as active without direct proof.

- [ ] **Step 1: Re-read actual `main` and compare branch scope**

Use GitHub branch/compare APIs. Require:

- no unexpected `main` drift in files Phase 9D modifies
- if UI drift overlaps, preserve newest `main` and reapply only Phase 9D delta before proceeding
- no package, database migration, layout, landing/dashboard visual, Supabase provider config, WAF, or hosted-runtime change

- [ ] **Step 2: Run exact-head Vercel Preview build**

Require the branch head preview to reach `READY` with `aliasError=null` and build logs to show successful compile/type validation/static generation as applicable.

- [ ] **Step 3: Write the working checkpoint**

Record:

- exact branch/head/tree
- changed file list
- test-first commit history
- exact preview deployment
- CSP state `NOT ENFORCED`
- automated alert state `NOT CLAIMED`
- provider controls still separate
- remaining runtime-log acceptance and candidate CI gates

- [ ] **Step 4: Commit checkpoint docs only**

```bash
git add docs/development/PHASE_9_WORKING_STATE.md docs/development/SESSION_HANDOFF.md
git commit -m "docs: checkpoint Phase 9D security telemetry [skip ci]"
```

- [ ] **Step 5: Verify `[skip ci]` and preview**

Confirm zero Actions runs for the checkpoint SHA and a READY Vercel Preview for the exact checkpoint head.

---

### Task 7: Prove real preview telemetry without leaking request secrets

**Files:**
- No production code change unless this acceptance test reveals a real defect.
- Update checkpoint docs only after evidence is obtained.

**Interfaces:**
- Acceptance target: preview deployment only.
- Request: intentionally unauthenticated `POST` to `/api/internal/workers/claim` with no valid worker credential and no request body.
- Expected HTTP result: bounded worker authentication failure, normally 401.
- Expected Runtime Log: one `scopeforge.security.v1` `worker.authentication_rejected` event for route `worker.claim`.

- [ ] **Step 1: Execute one harmless POST against the exact preview**

Preferred command when container networking can reach the preview:

```bash
curl -sS -i -X POST 'https://<exact-preview-host>/api/internal/workers/claim'
```

If Vercel deployment protection requires authentication, use the connected Vercel access mechanism or an authenticated browser-capable tool to issue the POST. Do not add a production debug endpoint merely to manufacture evidence.

Expected response: 401 with the existing bounded error body and no persistent mutation.

If no available tool can issue an HTTP POST to the protected preview, treat this as a release acceptance blocker. Do not replace it with a source-only assertion or claim runtime-log verification occurred.

- [ ] **Step 2: Query Vercel Runtime Logs for the exact preview**

Filter by deployment ID, recent time window, warning/error severity, and/or query `scopeforge.security.v1`.

Verify the event contains only the allowlisted telemetry fields and specifically does not contain:

- authorization header values
- cookies
- raw headers
- request body
- raw URL query string
- worker IDs or secrets
- raw error messages

- [ ] **Step 3: Record preview runtime acceptance evidence**

Update the Phase 9D working checkpoint with exact preview deployment ID, response status, event name, route, and verification result. Do not paste secret values into docs even if testing used any.

- [ ] **Step 4: Commit evidence docs only**

```bash
git add docs/development/PHASE_9_WORKING_STATE.md docs/development/SESSION_HANDOFF.md
git commit -m "docs: record Phase 9D runtime telemetry acceptance [skip ci]"
```

---

### Task 8: Freeze, validate, merge, and independently verify the Phase 9D release

**Files:**
- No new executable scope after freeze.
- Final release docs after successful post-merge verification:
  - Create: `docs/development/PHASE_9D_RELEASE_STATE.md`
  - Modify: `docs/development/CURRENT_STATE.md`
  - Modify: `docs/development/NEXT_STEPS.md`
  - Modify: `docs/development/PHASE_9_WORKING_STATE.md`
  - Modify: `docs/development/SESSION_HANDOFF.md`

**Interfaces:**
- Frozen candidate tree must be identical to the reviewed implementation/checkpoint tree.
- Next engineering handoff after release is Phase 9E incident/release engineering, with CSP enforcement still separately pending unless later proven/approved.

- [ ] **Step 1: Perform final pre-freeze scope review**

Refresh `main` again. Compare base/head. If concurrent UI work changed overlapping files, reconcile it first, require a new exact-head preview, and only then freeze.

- [ ] **Step 2: Create a tree-identical freeze commit**

Commit message:

```text
chore: freeze Phase 9D release candidate
```

Do not alter the tree while freezing.

- [ ] **Step 3: Require exact-candidate Vercel Preview READY**

Confirm the preview metadata points to the exact frozen SHA and reaches READY with `aliasError=null`.

- [ ] **Step 4: Open draft PR against the actual current `main` and inspect scope**

The PR must contain only the reviewed Phase 9D telemetry/audit/worker-route/tests/docs files plus any explicit conflict-resolution edits needed to preserve newer `main`.

- [ ] **Step 5: Release the draft and run one substantive CI candidate**

Require the permanent workflow gates:

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

Every step must conclude success on the exact frozen candidate. No blind reruns.

- [ ] **Step 6: Perform immutable pre-merge verification**

Require:

- current PR head still equals frozen candidate SHA
- current `main` is still the CI-tested base or has been reconciled and revalidated
- PR mergeable
- review submissions/threads contain no unresolved blocker
- exact preview READY
- Runtime Log acceptance already recorded
- no CSP enforcement claim
- no automated Vercel alert claim
- Supabase Security Advisor checked and any unrelated existing warning reported truthfully

- [ ] **Step 7: Squash merge with expected head SHA pinned**

Use the GitHub merge API with `expected_head_sha=<frozen SHA>`. If GitHub rejects due to branch movement, stop and reconcile rather than forcing.

- [ ] **Step 8: Independently verify merged `main`**

Require:

- post-merge main CI success on exact squash SHA
- exact Vercel production deployment for the squash SHA READY
- production alias includes `scopeforge.dev`
- `aliasError=null`
- no new Supabase Security Advisor regression

- [ ] **Step 9: Write one atomic docs-only release checkpoint**

The five release docs must record:

- PR and frozen candidate identity
- candidate CI and preview
- squash merge and released tree
- post-merge CI and production deployment
- exact telemetry privacy contract
- real preview runtime-log acceptance evidence
- CSP `NOT ENFORCED`
- Vercel automated alerts `NOT CLAIMED` unless separately verified
- existing Phase 9B provider truth
- Phase 9E as next implementation boundary

Commit:

```bash
git commit -m "docs: record Phase 9D release and Phase 9E handoff [skip ci]"
```

- [ ] **Step 10: Verify the docs checkpoint itself**

Require exactly the intended documentation files, zero GitHub Actions runs for the docs SHA, and its normal Vercel production deployment READY. Keep executable Phase 9D release identity separately pinned to the squash merge SHA/tree.

# Phase 4C Bounded Active Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first explicitly authorized, narrowly active runtime validator to ScopeForge using one fixed CORS origin-policy request against an exact verified target, while preserving every Phase 4B passive-runtime safety invariant.

**Architecture:** Keep `packages/runtime-observer` passive. Extract the reviewed DNS, public-IP classification, IP pinning, TLS, deadline, abort, and body-discard behavior into `packages/runtime-network`, then add a separate `packages/runtime-validator` package for built-in active request plans, CORS observation normalization, deterministic rules, and security-domain mapping. Trusted application services own owner/admin authorization, immutable job snapshots, cancellation, persistence, audit events, and orchestration through the existing `scan_jobs` and `runtime_observations` tables.

**Tech Stack:** TypeScript 5.8, Node.js HTTPS/DNS/TLS APIs, Vitest 3.2, Next.js 15 server actions, React 19, Supabase/PostgreSQL migrations and RLS.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-4c-bounded-active-validation-design.md`

## Global Constraints

- Phase 4C-1 supports only verified `web_application` and `api` assets.
- Active enqueue is restricted to workspace `owner` and `admin`; passive Phase 4B role behavior remains unchanged.
- Built-in profile is exactly `cors-origin-policy@1`.
- Synthetic origin is exactly `https://scopeforge.invalid` and is never user supplied.
- Exactly one GET request is allowed; redirects followed are exactly zero; concurrency is one; retries are zero.
- HTTPS only, port 443 only, exact authorized hostname only, exact canonical path only, no credentials, no cookies, no Authorization header, no request body, no user headers, no JavaScript execution.
- Per-request timeout is at most 5,000 ms; total active execution is at most 10,000 ms; DNS time is inside the request deadline.
- Every connection performs fresh DNS resolution, rejects any non-public or invalid resolved address, and pins the socket to a validated public address while preserving original hostname/SNI/certificate verification.
- Response bodies are destroyed and never buffered or persisted.
- Active observation persistence is bounded to 32 KiB per job; evidence summary is bounded to 4 KiB per finding.
- Query strings, fragments, cookie values, Authorization values, raw exception text, and arbitrary response headers must never enter active persistence.
- Cancellation is checked before DNS, before connection, after response metadata, before rule evaluation, before persistence, and before success transition.
- Active findings reuse `deterministic-runtime-scanner` and use validation state `runtime_validated`.
- `runtime-observer` must not import `runtime-validator`; `runtime-network` must not import app/UI/Supabase/provider code; `network-safety` stays pure.
- No crawler, SQLi/XSS/SSRF probe, file discovery, preflight, fuzzing, credential testing, authenticated testing, destructive test, arbitrary URL, arbitrary method, arbitrary header map, or arbitrary payload API is introduced.
- Full merge gate remains: `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, `npm run typecheck`, `npm run build:cli`, compiled CLI `version`, `npm run benchmark:scanner`, `npm run build`.

---

### Task 1: Extract the reviewed outbound transport into `runtime-network` without behavior change

**Files:**
- Create: `packages/runtime-network/dns.ts`
- Create: `packages/runtime-network/https-transport.ts`
- Create: `packages/runtime-network/contracts.ts`
- Create: `packages/runtime-network/index.ts`
- Modify: `packages/runtime-observer/observe.ts`
- Modify: `packages/runtime-observer/index.ts`
- Delete after imports are migrated: `packages/runtime-observer/dns.ts`
- Delete after imports are migrated: `packages/runtime-observer/https-transport.ts`
- Create: `tests/runtime-network/dns.test.ts`
- Create: `tests/runtime-network/https-transport.test.ts`
- Modify: `tests/runtime-observer/observe.test.ts`

**Interfaces:**
- Consumes: `packages/network-safety` public-address classification.
- Produces:

```ts
export interface RuntimeTlsMetadata {
  protocol: string | null;
  validFrom: string | null;
  validTo: string | null;
  subjectAltName: string | null;
}

export interface RuntimeNetworkResponse {
  status: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  tls: RuntimeTlsMetadata;
}

export interface TrustedRuntimeRequestPlan {
  readonly method: "GET";
  readonly url: URL;
  readonly timeoutMs: number;
  readonly headers: Readonly<Record<"accept" | "user-agent" | "origin", string | undefined>>;
}

export interface RuntimeNetworkDependencies {
  resolver?: RuntimeResolver;
  requester?: RuntimeRequester;
  now?: () => number;
}

export async function requestPinnedHttps(
  plan: TrustedRuntimeRequestPlan,
  dependencies?: RuntimeNetworkDependencies,
): Promise<RuntimeNetworkResponse>;
```

The transport validates at runtime that `method === "GET"`, URL is HTTPS on port 443, header names are only the three typed names, `accept` is exactly `*/*`, `user-agent` is one of the two ScopeForge constants, and `origin`, when present, is exactly `https://scopeforge.invalid`.

- [ ] **Step 1: Add failing extraction tests before moving production code**

Create `tests/runtime-network/https-transport.test.ts` by porting the existing hardened transport cases and add an explicit trusted-header rejection case:

```ts
it("rejects request plans outside the trusted header contract", () => {
  const unsafe = {
    method: "GET",
    url: new URL("https://example.com/"),
    timeoutMs: 1000,
    headers: { accept: "*/*", "user-agent": "ScopeForge-RuntimeObserver/0.1", origin: "https://evil.example" },
  } as unknown as TrustedRuntimeRequestPlan;

  expect(() => buildPinnedHttpsRequestOptions({
    plan: unsafe,
    address: "93.184.216.34",
    family: 4,
  })).toThrow(/trusted origin/i);
});
```

Retain the existing regressions proving DNS is included in the deadline and HTTPS receives only the time remaining after DNS.

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
npx vitest run tests/runtime-network/dns.test.ts tests/runtime-network/https-transport.test.ts
```

Expected: FAIL because `@/packages/runtime-network` does not exist yet.

- [ ] **Step 3: Move DNS and transport code into the shared package**

Move behavior from `packages/runtime-observer/dns.ts` and `packages/runtime-observer/https-transport.ts`. Preserve fresh lookup, all-address validation, deterministic pin selection, hostname/SNI preservation, AbortController deadline, body destruction, and normalized headers. Add the trusted-plan validation at the `runtime-network` boundary rather than exposing raw `RequestOptions` to consumers.

Use these constants in `packages/runtime-network/contracts.ts`:

```ts
export const PASSIVE_RUNTIME_USER_AGENT = "ScopeForge-RuntimeObserver/0.1" as const;
export const ACTIVE_RUNTIME_USER_AGENT = "ScopeForge-RuntimeValidator/0.1" as const;
export const SCOPEFORGE_SYNTHETIC_ORIGIN = "https://scopeforge.invalid" as const;
```

- [ ] **Step 4: Make `runtime-observer` consume `runtime-network` with identical passive behavior**

In `observe.ts`, create the passive request plan internally:

```ts
const response = await requestPinnedHttps({
  method: "GET",
  url: current,
  timeoutMs: remainingRequestTimeoutMs,
  headers: {
    accept: "*/*",
    "user-agent": PASSIVE_RUNTIME_USER_AGENT,
    origin: undefined,
  },
}, dependencies.transport);
```

Do not add active profile imports or active branching to `runtime-observer`.

- [ ] **Step 5: Run the focused extraction and passive suites**

Run:

```bash
npx vitest run tests/runtime-network tests/runtime-observer
```

Expected: PASS, including the existing async cancellation, redirect, URL redaction, DNS, timeout, and observation-budget tests.

- [ ] **Step 6: Commit the behavior-preserving extraction**

```bash
git add packages/runtime-network packages/runtime-observer tests/runtime-network tests/runtime-observer
git commit -m "refactor: extract hardened runtime network boundary"
```

---

### Task 2: Add the pure active-validator contract and CORS observation normalization

**Files:**
- Create: `packages/runtime-validator/contracts.ts`
- Create: `packages/runtime-validator/budget.ts`
- Create: `packages/runtime-validator/cors-profile.ts`
- Create: `packages/runtime-validator/observations.ts`
- Create: `packages/runtime-validator/index.ts`
- Create: `tests/runtime-validator/budget.test.ts`
- Create: `tests/runtime-validator/cors-profile.test.ts`
- Create: `tests/runtime-validator/observations.test.ts`

**Interfaces:**
- Consumes: `TrustedRuntimeRequestPlan`, `SCOPEFORGE_SYNTHETIC_ORIGIN`, and active user-agent constant from `runtime-network`; `AssetRef` from `security-domain`.
- Produces:

```ts
export const CORS_ORIGIN_POLICY_PROFILE = Object.freeze({
  id: "cors-origin-policy" as const,
  version: "1" as const,
});

export interface ActiveValidationBudget {
  maxRequests: 1;
  maxRedirects: 0;
  perRequestTimeoutMs: number;
  totalTimeoutMs: number;
  maxObservationBytes: number;
}

export interface AuthorizedActiveTarget {
  assetRef: AssetRef;
  kind: "web_application" | "api";
  canonicalUrl: string;
  hostname: string;
}

export interface CorsPolicyObservation {
  kind: "cors-policy";
  profileId: "cors-origin-policy";
  profileVersion: "1";
  targetUrl: string;
  status: number;
  allowOriginPresent: boolean;
  allowOrigin: string | null;
  allowCredentialsPresent: boolean;
  credentialsAllowed: boolean;
  varyIncludesOrigin: boolean;
  redirected: boolean;
  redirectHostname: string | null;
}
```

- [ ] **Step 1: Write failing profile and budget tests**

Tests must prove the only plan emitted is:

```ts
expect(buildCorsOriginPolicyRequestPlan(target, 5000)).toMatchObject({
  method: "GET",
  url: new URL(target.canonicalUrl),
  timeoutMs: 5000,
  headers: {
    accept: "*/*",
    "user-agent": "ScopeForge-RuntimeValidator/0.1",
    origin: "https://scopeforge.invalid",
  },
});
```

Budget tests must reject `maxRequests !== 1`, `maxRedirects !== 0`, timeout above 5,000 ms, total above 10,000 ms, and observation bytes above 32,768.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npx vitest run tests/runtime-validator/budget.test.ts tests/runtime-validator/cors-profile.test.ts tests/runtime-validator/observations.test.ts
```

Expected: FAIL because validator modules do not exist.

- [ ] **Step 3: Implement target validation and fixed request-plan construction**

`buildCorsOriginPolicyRequestPlan` must parse the immutable canonical URL and reject protocol other than HTTPS, explicit port other than 443, credentials, fragment, hostname mismatch, and any caller attempt to provide request options because the function accepts only `(target, timeoutMs)`.

- [ ] **Step 4: Implement bounded CORS header normalization**

Normalize only `access-control-allow-origin`, `access-control-allow-credentials`, `vary`, and `location`. Cap individual retained values at 2,048 characters. Redact target query and fragment before `targetUrl` persistence. For 3xx responses, set `redirected: true`, parse only a bounded hostname from `Location` when safely parseable, and never return a destination URL.

- [ ] **Step 5: Run the validator suites and typecheck**

```bash
npx vitest run tests/runtime-validator
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the active contract**

```bash
git add packages/runtime-validator tests/runtime-validator
git commit -m "feat: add bounded CORS validator contract"
```

---

### Task 3: Add deterministic CORS rules and security-domain mapping

**Files:**
- Create: `packages/runtime-validator/rules/types.ts`
- Create: `packages/runtime-validator/rules/cors.ts`
- Create: `packages/runtime-validator/rules/index.ts`
- Create: `packages/runtime-validator/domain-mapper.ts`
- Modify: `packages/runtime-validator/index.ts`
- Create: `tests/runtime-validator/cors-rules.test.ts`
- Create: `tests/runtime-validator/domain-mapper.test.ts`

**Interfaces:**
- Produces `ActiveRuntimeRuleMatch` with stable fields: `ruleId`, `title`, `description`, `severity`, `confidence`, `observationKey`, `evidenceKind`, `evidenceSummary`, `classification`, `remediation`.
- Produces `evaluateCorsPolicyRules(observation): readonly ActiveRuntimeRuleMatch[]`.
- Produces `mapActiveRuntimeRuleMatchToEvidence` and `mapActiveRuntimeRuleMatchToSecurityFinding`.

- [ ] **Step 1: Write RED rule tests for the three specified outcomes**

Credentialed synthetic origin:

```ts
expect(evaluateCorsPolicyRules(observation({
  allowOrigin: "https://scopeforge.invalid",
  credentialsAllowed: true,
}))).toEqual([expect.objectContaining({
  ruleId: "runtime/cors/credentialed-untrusted-origin",
  severity: "high",
  confidence: "high",
})]);
```

Synthetic origin without credentials must produce only `runtime/cors/untrusted-origin-reflection` at low severity. Wildcard `*` must produce no vulnerability finding.

- [ ] **Step 2: Write RED mapping tests**

Require:

```ts
expect(finding.source).toEqual({
  kind: "deterministic-runtime-scanner",
  sourceId: "scopeforge:runtime-validator",
  sourceVersion: "0.1/cors-origin-policy@1",
});
expect(finding.validation).toBe("runtime_validated");
expect(evidence.summary.length).toBeLessThanOrEqual(4096);
```

The stable identity input must include asset ref, profile id/version, rule id, and normalized observation key.

- [ ] **Step 3: Implement the two rules with conservative wording**

The high finding must state that the server allowed the synthetic untrusted origin with credentialed CORS, but must not claim victim credentials or sensitive response exfiltration. The low finding must state origin reflection without claiming sensitive data exposure.

- [ ] **Step 4: Implement active security-domain mapping**

Mirror the passive mapper structure but use `sourceId: "scopeforge:runtime-validator"`, validation `runtime_validated`, and a separate `active-runtime:` stable identity prefix.

- [ ] **Step 5: Run rules/mapping tests**

```bash
npx vitest run tests/runtime-validator/cors-rules.test.ts tests/runtime-validator/domain-mapper.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit deterministic active findings**

```bash
git add packages/runtime-validator tests/runtime-validator
git commit -m "feat: map bounded CORS validation findings"
```

---

### Task 4: Extend the existing runtime job and observation persistence model for active jobs

**Files:**
- Create: `supabase/migrations/20260825043000_phase_4c_active_validation.sql`
- Modify: `lib/database.types.ts`
- Create: `lib/active-validations/types.ts`
- Create: `lib/active-validations/repository.ts`
- Create: `tests/active-validations/migration.test.ts`
- Create: `tests/active-validations/repository.test.ts`

**Interfaces:**
- `ScanJobKind` gains `"active_validation"`.
- `scan_jobs` gains nullable immutable fields `validator_profile_id text`, `validator_profile_version text`, `active_authorized_at timestamptz`.
- `runtime_observations.kind` gains `cors-policy`.
- Active repository exports `createActiveValidationRepository(admin)` with `enqueue`, `load`, `loadForWorkspace`, `markRunning`, `markBlocked`, `markSucceeded`, `markFailed`, `markCancelled`, `requestCancellation`, `persistObservation`, `listObservations`.

- [ ] **Step 1: Write RED migration contract tests**

Read the migration as text and assert it adds the enum value and constraints, makes the three authorization fields immutable through `private.guard_runtime_scan_job_update`, retains select-only authenticated access to `runtime_observations`, and never grants authenticated insert/update/delete on `scan_jobs` or `runtime_observations`.

- [ ] **Step 2: Write RED repository tests**

Require active inserts to include:

```ts
{
  job_kind: "active_validation",
  status: "queued",
  authorization_canonical_target: input.canonicalTarget,
  authorization_asset_kind: input.assetKind,
  authorization_verified_at: input.verifiedAt,
  validator_profile_id: "cors-origin-policy",
  validator_profile_version: "1",
  active_authorized_at: input.activeAuthorizedAt,
  budget: input.budget,
}
```

All active updates must filter `job_kind = "active_validation"` and workspace id where applicable.

- [ ] **Step 3: Implement the migration**

Use `alter type public.scan_job_kind add value if not exists 'active_validation';`. Replace the existing runtime snapshot/timestamp constraints with equivalents covering both passive and active jobs. Add active-only checks requiring profile id/version and authorization timestamp, plus length caps of 64 characters for profile id/version. Drop and recreate `runtime_observations_kind_check` with `cors-policy` included. Add a partial active status index.

- [ ] **Step 4: Extend `lib/database.types.ts` exactly to the migration**

Set:

```ts
export type ScanJobKind = "phase2_blocked" | "passive_runtime" | "active_validation";
```

Add all three new fields consistently to Row/Insert/Update.

- [ ] **Step 5: Implement the active repository without weakening the passive repository**

Reuse transition semantics, safe code/reason truncation, and persistence budget checking, but keep active repository methods scoped to `job_kind = "active_validation"`. `persistObservation` accepts exactly one `CorsPolicyObservation` and writes kind `cors-policy`.

- [ ] **Step 6: Run persistence tests and passive regressions**

```bash
npx vitest run tests/active-validations tests/runtime-observations
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit persistence evolution**

```bash
git add supabase/migrations lib/database.types.ts lib/active-validations tests/active-validations
git commit -m "feat: persist bounded active validation jobs"
```

---

### Task 5: Add explicit active authorization, execution reauthorization, cancellation, and orchestration

**Files:**
- Create: `lib/active-validations/authorization.ts`
- Create: `lib/active-validations/service.ts`
- Modify: `lib/active-validations/types.ts`
- Create: `tests/active-validations/authorization.test.ts`
- Create: `tests/active-validations/service.test.ts`
- Create: `tests/active-validations/async-cancellation-service.test.ts`

**Interfaces:**
- `authorizeActiveValidationEnqueue(input)` accepts actor, workspace, role, asset, exact profile id/version, and budget, and returns immutable enqueue input plus `AuthorizedActiveTarget`.
- `reauthorizeActiveValidationExecution({ job, asset })` reloads and compares job/asset snapshot before any DNS/network operation.
- `executeActiveValidation(jobId, dependencies)` calls a dependency `validate?: typeof validateCorsOriginPolicyTarget`.

- [ ] **Step 1: Write RED authorization tests**

Cover unauthenticated, viewer, member, cross-workspace asset, unsupported repository asset, unverified asset, stale `verified_at`, changed canonical target, changed kind/hostname, unknown profile, wrong version, invalid budget, cancellation-before-start, and executable-state checks. Explicitly assert owner and admin are accepted while member remains accepted for passive Phase 4B tests.

- [ ] **Step 2: Implement stable active authorization codes**

Use active-specific codes such as:

```ts
"ACTIVE_UNAUTHENTICATED"
"ACTIVE_WORKSPACE_DENIED"
"ACTIVE_ASSET_NOT_AVAILABLE"
"ACTIVE_ASSET_UNSUPPORTED"
"ACTIVE_ASSET_UNVERIFIED"
"ACTIVE_PROFILE_UNSUPPORTED"
"ACTIVE_AUTHORIZATION_CHANGED"
"ACTIVE_CANCELLATION_REQUESTED"
"ACTIVE_JOB_NOT_AVAILABLE"
"ACTIVE_JOB_NOT_EXECUTABLE"
"ACTIVE_BUDGET_INVALID"
```

Safe user-facing reasons must describe bounded active validation without exposing database/network exception text.

- [ ] **Step 3: Write RED service tests for zero-traffic blocked states and lifecycle**

Inject a spy validator and assert it is never called when execution reauthorization fails. Assert audit sequence includes `active_validation.authorized`, `active_validation.enqueued`, `active_validation.started`, and exactly one terminal event.

- [ ] **Step 4: Implement `validateCorsOriginPolicyTarget` inside `packages/runtime-validator`**

The validator checks cancellation before request-plan construction/DNS, calls `runtime-network` once, checks cancellation after response, normalizes one CORS observation, checks cancellation before rule evaluation, evaluates rules, and returns a result containing `requestCount` 0 or 1, `redirectCount: 0`, observation, findings, and evidence. 3xx responses end after one response and are never followed.

- [ ] **Step 5: Implement trusted service orchestration**

Before calling validator, mark running and audit. Inject database-backed cancellation using `repository.loadForWorkspace(runningJob.id, runningJob.workspace_id)`. After validator returns, reload cancellation state before persistence. If cancelled at any boundary, persist neither observation nor finding data and transition to `cancelled`. Map policy/DNS/timeout failures to bounded stable failure codes and never persist raw exception text.

- [ ] **Step 6: Prove cancellation after response but before persistence**

The regression test must have the injected validator return a valid observation, then have the repository reload show `cancel_requested_at`; expected persisted rows are zero and terminal status is `cancelled`.

- [ ] **Step 7: Run focused and passive service suites**

```bash
npx vitest run tests/active-validations tests/runtime-observations tests/runtime-validator
```

Expected: PASS.

- [ ] **Step 8: Commit active orchestration**

```bash
git add lib/active-validations packages/runtime-validator tests/active-validations tests/runtime-validator
git commit -m "feat: enforce explicit active validation authorization"
```

---

### Task 6: Add the dedicated server action and clearly separate active-validation UI

**Files:**
- Create: `components/assets/ActiveValidationPanel.tsx`
- Create: `tests/components/ActiveValidationPanel.test.tsx`
- Modify: `app/dashboard/assets/[assetId]/runtime-actions.ts`
- Modify: `app/dashboard/assets/[assetId]/page.tsx`
- Modify: `app/assets.css`

**Interfaces:**
- Server action: `runCorsOriginPolicyValidation(assetId: string)`.
- Server action accepts only asset id. It does not accept URL, method, headers, origin, path, body, cookies, credentials, profile settings, or budget settings.
- Panel receives asset id/kind/verification status/current role/latest active job/one normalized CORS observation.

- [ ] **Step 1: Write RED component tests**

Assert verified owner/admin sees `Bounded active validation`, exact disclosure of one GET with synthetic origin, and a button labelled `Run CORS policy validation`. Assert member/viewer cannot invoke the active action. Assert the panel does not render editable URL/header/method/origin/body fields.

- [ ] **Step 2: Add server action with fixed profile and fixed budget**

The action calls `enqueueActiveValidation` with `CORS_ORIGIN_POLICY_PROFILE` and `ACTIVE_VALIDATION_MAX_BUDGET`, then `executeActiveValidation`. Error fallback message is `The bounded active validation request could not be completed safely.`

- [ ] **Step 3: Load passive and active jobs separately on the asset page**

Keep existing passive query filtered to `passive_runtime`. Add a second query filtered to `active_validation` and load at most the latest active `cors-policy` observation. Never merge active job status into passive panel state.

- [ ] **Step 4: Update the security boundary copy**

Replace `Passive execution boundary` summary with wording that explicitly distinguishes `Passive observation` from `Bounded active validation`. State that active validation is one fixed CORS check and that crawling, fuzzing, credential replay, exploit payloads, arbitrary requests, and destructive behavior remain disabled.

- [ ] **Step 5: Run UI tests and typecheck**

```bash
npx vitest run tests/components/RuntimeObservationPanel.test.tsx tests/components/ActiveValidationPanel.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit UI boundary**

```bash
git add components/assets app/dashboard/assets app/assets.css tests/components
git commit -m "feat: expose bounded CORS validation control"
```

---

### Task 7: Add architecture guards and security regressions for active authority

**Files:**
- Modify: `tests/architecture/runtime-observer-dependencies.test.ts`
- Create: `tests/architecture/runtime-network-dependencies.test.ts`
- Create: `tests/architecture/runtime-validator-dependencies.test.ts`
- Create: `tests/runtime-validator/authority-boundary.test.ts`
- Create: `tests/runtime-validator/network-safety-regressions.test.ts`
- Modify as needed only when a failing test proves a production defect in Phase 4C files.

**Interfaces:** none new. This task locks the allowed dependency and network authority surface.

- [ ] **Step 1: Add RED architecture tests**

`runtime-network` must reject Next.js, React, Supabase, app, components, database modules, model/provider SDKs, runtime-observer rules, and runtime-validator rules. `runtime-validator` must reject Next.js, React, Supabase, app/components, database modules, and passive application services. `runtime-observer` must additionally reject imports from `runtime-validator`.

- [ ] **Step 2: Add authority tests that make generic requests impossible**

Use compile/runtime tests to prove public validator APIs expose no raw URL/path/method/header/body/cookie/credential parameters. Search `packages/runtime-validator` exports and assert only built-in profile construction/execution surfaces are exported.

- [ ] **Step 3: Add network-safety regression tests**

Cover:
- mixed public/private DNS response rejected
- empty DNS rejected
- fresh DNS lookup for each execution
- pinned address used while Host/SNI stays original hostname
- DNS time consumes request deadline
- HTTPS receives only remaining deadline
- outer timeout aborts active HTTPS
- non-443 and non-HTTPS rejected
- 3xx never triggers a second request
- response body is destroyed and never returned
- target persistence strips query/fragment
- arbitrary `Set-Cookie` and non-CORS headers never appear in observation

- [ ] **Step 4: Run the security-focused suites**

```bash
npx vitest run tests/architecture tests/network-safety tests/runtime-network tests/runtime-validator tests/active-validations tests/runtime-observer tests/runtime-observations
```

Expected: PASS.

- [ ] **Step 5: Commit architecture/security guards**

```bash
git add tests/architecture tests/runtime-validator packages/runtime-network packages/runtime-validator lib/active-validations
git commit -m "test: lock Phase 4C active validation boundaries"
```

---

### Task 8: Refresh permanent documentation and run the exact merge gate

**Files:**
- Modify: `docs/PHASES.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

**Interfaces:** none.

- [ ] **Step 1: Update roadmap/state docs with only implemented facts**

Record Phase 4B as merged. Mark Phase 4C-1 complete only after tests and CI are green. Document that worker isolation/dedicated egress/backpressure remain later Phase 6 work and that CORS v1 is the only active profile. Do not claim preflight, crawling, body analysis, authenticated checks, exploit validation, worker scale, or generalized DAST.

- [ ] **Step 2: Run the full local-equivalent gate**

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Expected: every command exits 0; compiled CLI reports ScopeForge `0.1.0`; scanner benchmark completes without regression failure.

- [ ] **Step 3: Run a security diff review before merge**

Review every Phase 4C changed file specifically for authorization bypass, target-transition widening, SSRF/DNS rebinding, arbitrary header/method/body surface, redirect propagation, timeout gaps, cancellation races, secret persistence, RLS/trusted-write regression, unbounded evidence, unsafe error disclosure, and passive/active dependency mixing. Any plausible finding receives a failing regression test before its production fix.

- [ ] **Step 4: Commit final docs after the gate reflects reality**

```bash
git add docs
git commit -m "docs: record Phase 4C bounded active validation"
```

- [ ] **Step 5: Verify exact PR head and CI**

Require the workflow run attached to the exact current head commit to complete successfully. Do not merge based on an older green commit. Confirm no unresolved review threads and no blocking review submissions.

- [ ] **Step 6: Squash merge only the exact green head**

Use expected-head protection and squash merge. After merge, verify `main` contains the merged runtime-network extraction, runtime-validator package, active migration, authorization/service layer, and docs. If a post-merge workflow exists, report its actual result; otherwise do not invent one.

## Self-Review Checklist

Before executing this plan, verify:

- Every spec requirement maps to at least one task above.
- No task widens Phase 4C-1 beyond one fixed CORS GET.
- No placeholder strings such as TBD/TODO/implement later remain in this plan.
- Active budget names and field names are consistent across validator, authorization, migration, repository, service, action, and UI tasks.
- Active profile id/version are consistently `cors-origin-policy` and `1`.
- Active job kind is consistently `active_validation`.
- Active observation kind is consistently `cors-policy`.
- Active validation state is consistently `runtime_validated`.
- Passive behavior and role authorization remain unchanged.

# Phase 4B Verified Passive Runtime Observations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authorized, bounded passive HTTPS and TLS observations for verified web and API assets while preserving the Phase 2 proof-of-control boundary and mapping rule-backed results into the Phase 4A `security-domain`.

**Architecture:** Extract pure reusable public-network classification into `packages/network-safety`, then build a separate `packages/runtime-observer` execution edge with strict budgets, manual redirect validation, DNS pinning, redaction, and deterministic domain mapping. Application services own workspace authorization, verified-asset continuity, Supabase persistence, cancellation, and audit records. The first implementation never crawls, fuzzes, authenticates, submits data, or follows cross-host redirects.

**Tech Stack:** TypeScript 5.8, Node HTTPS/DNS/TLS APIs, Vitest, Next.js 15 server actions, Supabase PostgreSQL/RLS.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-4b-passive-runtime-observations-design.md`

## Global Constraints

- HTTPS only.
- Port 443 only.
- Verified `web_application` and `api` assets only.
- GET only, no request body.
- Maximum 4 requests and 3 followed redirects per job.
- Maximum one concurrent request per job.
- Per-request timeout maximum 5000 ms.
- Total execution timeout maximum 15000 ms.
- No retries in the first slice.
- No captured or persisted response body bytes in the first slice.
- No cookie values, credentials, authorization material, or unbounded exception text may be persisted.
- Redirects may only be followed when scheme, hostname, and port remain inside the verified target boundary.
- Every connection must freshly resolve, classify, and pin its address.
- `packages/security-domain` remains free of networking, database, framework, and runtime-observer dependencies.
- Runtime findings reuse `security-domain`; do not create a second finding model.
- All network tests must use injected dependencies or explicitly test-only local fixtures, never public internet targets.

---

### Task 1: Extract shared network-safety primitives without changing Phase 2 behavior

**Files:**
- Create: `packages/network-safety/ip-policy.ts`
- Create: `packages/network-safety/resolution.ts`
- Create: `packages/network-safety/index.ts`
- Modify: `lib/assets/network-boundary.ts`
- Test: `tests/network-safety/ip-policy.test.ts`
- Test: `tests/network-safety/resolution.test.ts`
- Test: `tests/assets/normalize-target.test.ts`
- Test: `tests/assets/verification.test.ts`

**Interfaces:**
- Produces: `isBlockedNetworkAddress(input: string): boolean`
- Produces: `normalizePublicResolvedAddresses(addresses: readonly string[]): readonly { address: string; family: 4 | 6 }[]`
- Produces: `selectPinnedPublicAddress(addresses: readonly string[]): { address: string; family: 4 | 6 }`
- Phase 2 `lib/assets/network-boundary.ts` remains a compatibility re-export so existing imports do not change in the first commit.

- [ ] **Step 1: Write failing network classification tests**

Create `tests/network-safety/ip-policy.test.ts` with representative public and blocked ranges:

```ts
import { describe, expect, it } from "vitest";
import { isBlockedNetworkAddress } from "@/packages/network-safety";

describe("network safety IP policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks non-public address %s", (address) => {
    expect(isBlockedNetworkAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows representative public address %s",
    (address) => {
      expect(isBlockedNetworkAddress(address)).toBe(false);
    },
  );
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
npm test -- tests/network-safety/ip-policy.test.ts
```

Expected: FAIL because `packages/network-safety` does not exist.

- [ ] **Step 3: Implement the pure IP policy package**

Move the current `BlockList` policy from `lib/assets/network-boundary.ts` into `packages/network-safety/ip-policy.ts`. Preserve every currently blocked Phase 2 range and the IPv4-mapped IPv6 rejection.

`packages/network-safety/index.ts` must export:

```ts
export { isBlockedNetworkAddress } from "./ip-policy";
export {
  normalizePublicResolvedAddresses,
  selectPinnedPublicAddress,
} from "./resolution";
```

Keep `lib/assets/network-boundary.ts` as:

```ts
export { isBlockedNetworkAddress } from "@/packages/network-safety";
```

- [ ] **Step 4: Add failing resolution tests**

Create `tests/network-safety/resolution.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  normalizePublicResolvedAddresses,
  selectPinnedPublicAddress,
} from "@/packages/network-safety";

describe("resolved address safety", () => {
  it("normalizes, de-duplicates, and sorts public addresses deterministically", () => {
    expect(normalizePublicResolvedAddresses(["8.8.8.8", "1.1.1.1", "8.8.8.8"])).toEqual([
      { address: "1.1.1.1", family: 4 },
      { address: "8.8.8.8", family: 4 },
    ]);
  });

  it("rejects the entire resolution when any address is blocked", () => {
    expect(() => normalizePublicResolvedAddresses(["1.1.1.1", "127.0.0.1"])).toThrow(
      "Target resolves to a private, local, reserved, or otherwise blocked address.",
    );
  });

  it("rejects empty DNS results", () => {
    expect(() => selectPinnedPublicAddress([])).toThrow("Target hostname did not resolve.");
  });
});
```

- [ ] **Step 5: Implement deterministic resolved-address validation**

`packages/network-safety/resolution.ts` must use `node:net` `isIP`, reject invalid addresses, reject any blocked answer, de-duplicate lowercase normalized addresses, sort by address string, and return the first entry from `selectPinnedPublicAddress`.

- [ ] **Step 6: Run Phase 2 regressions and network-safety tests**

Run:

```bash
npm test -- tests/network-safety tests/assets/normalize-target.test.ts tests/assets/verification.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/network-safety lib/assets/network-boundary.ts tests/network-safety tests/assets
git commit -m "refactor: share network safety primitives"
```

---

### Task 2: Define runtime observer contracts, budgets, and target-transition policy

**Files:**
- Create: `packages/runtime-observer/contracts.ts`
- Create: `packages/runtime-observer/budget.ts`
- Create: `packages/runtime-observer/target-policy.ts`
- Create: `packages/runtime-observer/index.ts`
- Test: `tests/runtime-observer/budget.test.ts`
- Test: `tests/runtime-observer/target-policy.test.ts`

**Interfaces:**
- Consumes: `AssetRef` from `packages/security-domain`
- Produces: `RuntimeObservationBudget`
- Produces: `RUNTIME_OBSERVATION_MAX_BUDGET`
- Produces: `validateRuntimeObservationBudget(input)`
- Produces: `AuthorizedRuntimeTarget`
- Produces: `validateInitialRuntimeUrl(target)`
- Produces: `validateRedirectTarget(current, location, authorized)`

Define the core contracts:

```ts
import type { AssetRef } from "@/packages/security-domain";

export interface RuntimeObservationBudget {
  maxRequests: number;
  maxRedirects: number;
  perRequestTimeoutMs: number;
  totalTimeoutMs: number;
  maxObservationBytes: number;
}

export interface AuthorizedRuntimeTarget {
  assetRef: AssetRef;
  kind: "web_application" | "api";
  canonicalUrl: string;
  hostname: string;
}

export type RedirectDecision =
  | { allowed: true; url: URL }
  | { allowed: false; reason: "CROSS_HOST" | "SCHEME" | "PORT" | "CREDENTIALS" };
```

- [ ] **Step 1: Write failing budget tests**

Test exact maxima and rejection of negative, fractional, zero where prohibited, and over-maximum values. Confirm callers may tighten limits but never raise them.

- [ ] **Step 2: Verify budget tests fail**

Run:

```bash
npm test -- tests/runtime-observer/budget.test.ts
```

Expected: FAIL because the runtime observer package does not exist.

- [ ] **Step 3: Implement budget validation**

Use these immutable maxima:

```ts
export const RUNTIME_OBSERVATION_MAX_BUDGET = Object.freeze({
  maxRequests: 4,
  maxRedirects: 3,
  perRequestTimeoutMs: 5_000,
  totalTimeoutMs: 15_000,
  maxObservationBytes: 65_536,
});
```

`validateRuntimeObservationBudget` returns a frozen copy after validation.

- [ ] **Step 4: Write failing target-policy tests**

Cover:

- `https://example.com/path` accepted for hostname `example.com`
- `http://example.com` rejected
- `https://example.com:444` rejected
- embedded credentials rejected
- same-host relative redirect accepted
- redirect from `example.com` to `www.example.com` rejected as `CROSS_HOST`
- redirect to HTTP rejected as `SCHEME`
- redirect to another port rejected as `PORT`

- [ ] **Step 5: Implement target-transition policy**

Do not perform network I/O. Normalize hostnames to lowercase, strip fragments from followed URLs, preserve same-host path/query redirects, and never treat a redirect as proof of authorization for another hostname.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npm test -- tests/runtime-observer/budget.test.ts tests/runtime-observer/target-policy.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime-observer tests/runtime-observer
git commit -m "feat: define runtime observation safety contracts"
```

---

### Task 3: Add fresh DNS resolution and pinned HTTPS transport

**Files:**
- Create: `packages/runtime-observer/dns.ts`
- Create: `packages/runtime-observer/https-transport.ts`
- Test: `tests/runtime-observer/dns.test.ts`
- Test: `tests/runtime-observer/https-transport.test.ts`

**Interfaces:**
- Consumes: `selectPinnedPublicAddress`
- Produces: `RuntimeResolver`
- Produces: `resolvePinnedRuntimeAddress(hostname, resolver)`
- Produces: `RuntimeTransport`
- Produces: `requestPinnedHttps(input, dependencies)`

Use these contracts:

```ts
export interface RuntimeResolver {
  resolve(hostname: string): Promise<readonly string[]>;
}

export interface RuntimeTlsMetadata {
  protocol: string | null;
  validFrom: string | null;
  validTo: string | null;
  subjectAltName: string | null;
}

export interface RuntimeTransportResponse {
  status: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  tls: RuntimeTlsMetadata;
}
```

- [ ] **Step 1: Write failing DNS tests**

Prove the resolver is called once per connection attempt, mixed public/private results fail closed, and the selected public address is deterministic.

- [ ] **Step 2: Implement the default resolver**

Use `node:dns/promises.lookup(hostname, { all: true, verbatim: true })` and pass all returned addresses through `selectPinnedPublicAddress`.

- [ ] **Step 3: Write failing transport tests with an injected requester seam**

Tests must prove:

- method is always GET
- `agent: false`
- no request body is sent
- `servername` remains the original hostname for TLS SNI
- the socket lookup callback returns only the pinned address
- automatic redirects are not followed
- timeout uses the validated per-request budget
- no response body is collected

- [ ] **Step 4: Implement the pinned HTTPS transport**

Use `node:https.request`. Resolve and pin before each call. Set a fixed user agent such as `ScopeForge-RuntimeObserver/0.1`. Do not accept caller-provided headers. Collect only bounded normalized headers and TLS metadata from the socket/certificate. Destroy or drain the response without buffering the body.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
npm test -- tests/runtime-observer/dns.test.ts tests/runtime-observer/https-transport.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime-observer tests/runtime-observer
git commit -m "feat: add pinned HTTPS runtime transport"
```

---

### Task 4: Implement bounded passive HTTP and TLS observations with redaction

**Files:**
- Create: `packages/runtime-observer/observations.ts`
- Create: `packages/runtime-observer/redaction.ts`
- Create: `packages/runtime-observer/observe.ts`
- Test: `tests/runtime-observer/observations.test.ts`
- Test: `tests/runtime-observer/redaction.test.ts`
- Test: `tests/runtime-observer/observe.test.ts`

**Interfaces:**
- Consumes: target policy, budget, transport
- Produces: `RuntimeObservation`
- Produces: `RuntimeObservationResult`
- Produces: `observeRuntimeTarget(target, budget, dependencies)`

Use a discriminated observation union with bounded normalized data, for example:

```ts
export type RuntimeObservation =
  | { kind: "http-status"; url: string; status: number }
  | { kind: "redirect"; from: string; toHost: string; followed: boolean; reason?: string }
  | { kind: "header"; name: string; present: boolean; value?: string }
  | { kind: "cookie"; name: string; secure: boolean; httpOnly: boolean; sameSite: string | null }
  | { kind: "tls"; protocol: string | null; validFrom: string | null; validTo: string | null; sanCount: number };
```

- [ ] **Step 1: Write redaction tests first**

Prove raw `Set-Cookie` values never survive parsing. For input `session=super-secret; Secure; HttpOnly; SameSite=Lax`, the normalized observation may include `name: "session"`, but must not contain `super-secret` anywhere after JSON serialization.

- [ ] **Step 2: Implement bounded cookie and header normalization**

Only normalize the selected headers from the design. Bound individual normalized string values and the total serialized observation result. Reject or truncate safely before persistence.

- [ ] **Step 3: Write observer-loop tests**

Cover:

- one successful request
- same-host redirect followed once
- cross-host redirect recorded but not followed
- maximum redirect budget reached
- maximum request budget reached
- cancellation before DNS
- cancellation before redirect follow
- per-request timeout surfaced as a stable failure code
- total timeout surfaced as a stable failure code

- [ ] **Step 4: Implement the observation loop**

Disable library redirect following. Before every call check cancellation, total elapsed time, request count, redirect count, and target policy. Call the pinned transport once per allowed hop. Never maintain cookies between hops.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
npm test -- tests/runtime-observer
npm run typecheck
```

Expected: all runtime-observer tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime-observer tests/runtime-observer
git commit -m "feat: collect bounded passive runtime observations"
```

---

### Task 5: Map deterministic runtime rules into `security-domain`

**Files:**
- Create: `packages/runtime-observer/rules.ts`
- Create: `packages/runtime-observer/map-finding.ts`
- Modify: `packages/runtime-observer/index.ts`
- Test: `tests/runtime-observer/runtime-finding-mapping.test.ts`
- Test: `tests/architecture/security-domain-dependencies.test.ts`

**Interfaces:**
- Consumes: normalized `RuntimeObservation[]`
- Consumes: Phase 4A `SecurityFinding`, evidence, provenance, validation, remediation contracts
- Produces: `evaluateRuntimeRules(input): readonly RuntimeRuleMatch[]`
- Produces: `mapRuntimeRuleMatchToSecurityFinding(input): SecurityFinding`

- [ ] **Step 1: Write failing rule tests**

Cover at minimum:

- missing HSTS
- HSTS present
- missing `X-Content-Type-Options: nosniff`
- HTTPS cookie missing `Secure`
- session-like cookie missing `HttpOnly`
- expired certificate

Assert these are deterministic configuration findings and do not claim exploitability.

- [ ] **Step 2: Implement narrow deterministic rules**

Each rule must have a stable rule id, title, severity, confidence, evidence summary function, and remediation summary. No rule may inspect raw response bodies or secret values.

- [ ] **Step 3: Write failing domain-mapping tests**

Assert:

- source identifies runtime observer
- provenance is observed/scanner-derived, never inferred
- asset ref is preserved
- evidence classification is explicit
- validation reflects direct remote observation
- stable identity is deterministic for the same asset/rule/observation key
- evidence summary is bounded

- [ ] **Step 4: Implement the runtime-to-domain adapter**

Keep all runtime-specific transport data on the runtime side. Copy only normalized fields required by the product finding contract.

- [ ] **Step 5: Strengthen architecture dependency tests**

Extend architecture tests so `packages/security-domain` cannot import `runtime-observer` or `network-safety`, while `runtime-observer` may import `security-domain` and `network-safety`.

- [ ] **Step 6: Run tests and typecheck**

```bash
npm test -- tests/runtime-observer tests/architecture/security-domain-dependencies.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime-observer tests/runtime-observer tests/architecture
git commit -m "feat: map runtime observations into security domain"
```

---

### Task 6: Enable trusted passive runtime jobs and normalized observation persistence

**Files:**
- Create: `supabase/migrations/20260825_phase_4b_runtime_observations.sql`
- Modify: `lib/database.types.ts`
- Create: `lib/runtime-observations/types.ts`
- Create: `lib/runtime-observations/repository.ts`
- Test: `tests/runtime-observations/repository.test.ts`

**Interfaces:**
- Evolves existing `scan_jobs`
- Adds `runtime_observations`
- Produces trusted repository methods for enqueue/load/start/block/complete/fail/cancel and observation persistence

Migration requirements:

- add `passive_runtime` job kind
- allow statuses `queued`, `running`, `succeeded`, `failed`, `blocked`, `cancelled`
- preserve composite `(asset_id, workspace_id)` foreign-key enforcement
- add immutable authorization snapshot fields including canonical target and `verified_at`
- add bounded budget JSON with a database size check
- add `cancel_requested_at`, `started_at`, `finished_at`, `failure_code`
- add `runtime_observations` with workspace/job/asset composite integrity
- enable RLS and authenticated select only
- keep inserts/updates trusted-server-only
- add useful workspace/job indexes

- [ ] **Step 1: Write repository tests around trusted state transitions**

Test queued to running to succeeded, queued to blocked, queued/running to cancelled, and invalid transitions rejected by repository helpers.

- [ ] **Step 2: Write and apply the forward migration in the project migration workflow**

Do not edit historical Phase 2 migrations. Keep existing read-only authenticated access behavior.

- [ ] **Step 3: Regenerate/update database types**

Update `lib/database.types.ts` so TypeScript reflects the migration exactly.

- [ ] **Step 4: Implement the trusted repository adapter**

The repository must require the server-only admin client for writes and keep row-to-domain translation bounded.

- [ ] **Step 5: Run repository tests and typecheck**

```bash
npm test -- tests/runtime-observations/repository.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations lib/database.types.ts lib/runtime-observations tests/runtime-observations
git commit -m "feat: persist passive runtime observation jobs"
```

---

### Task 7: Add double authorization, execution, cancellation, and audit application services

**Files:**
- Create: `lib/runtime-observations/authorization.ts`
- Create: `lib/runtime-observations/service.ts`
- Modify: `lib/audit/write-audit-event.ts` only if a typed helper is required
- Test: `tests/runtime-observations/authorization.test.ts`
- Test: `tests/runtime-observations/service.test.ts`

**Interfaces:**
- Produces: `enqueueRuntimeObservation(input)`
- Produces: `executeRuntimeObservation(jobId, dependencies)`
- Produces: `requestRuntimeObservationCancellation(jobId)`

- [ ] **Step 1: Write enqueue authorization tests**

Cover unauthenticated, wrong workspace, unsupported role, repository asset, unverified asset, valid verified web asset, and valid verified API asset.

- [ ] **Step 2: Implement enqueue gate**

Store the exact workspace id, asset id, canonical target, kind, and `verified_at` snapshot used by the gate. Write `runtime_observation.enqueued` only after the queued job record exists.

- [ ] **Step 3: Write execution re-authorization tests**

Cover asset now unverified, changed verification timestamp, missing asset, workspace mismatch, cancellation already requested, and a valid unchanged authorization snapshot. Assert blocked cases perform zero resolver/transport calls.

- [ ] **Step 4: Implement execution gate and observer call**

Re-read job and asset through trusted adapters immediately before networking. Pass only a validated authorized target and validated budget into `observeRuntimeTarget`.

- [ ] **Step 5: Add cancellation and failure tests**

Ensure cancellation is a distinct terminal state and stable network/policy failure codes are persisted without raw exception text.

- [ ] **Step 6: Implement audit events**

Write the event names from the design with bounded metadata only. Do not write raw headers, cookie values, bodies, or credentials.

- [ ] **Step 7: Run focused tests and typecheck**

```bash
npm test -- tests/runtime-observations tests/runtime-observer
npm run typecheck
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/runtime-observations lib/audit tests/runtime-observations
git commit -m "feat: authorize and execute passive runtime jobs"
```

---

### Task 8: Add minimal asset-detail UI for passive observations

**Files:**
- Create: `app/dashboard/assets/[assetId]/runtime-actions.ts`
- Create: `components/assets/RuntimeObservationPanel.tsx`
- Modify: `app/dashboard/assets/[assetId]/page.tsx`
- Test: `tests/components/RuntimeObservationPanel.test.tsx`

**Interfaces:**
- UI calls server actions only
- UI displays verified eligibility, latest job status, bounded observation summary, and deterministic findings returned by application services

- [ ] **Step 1: Write component tests first**

Cover:

- unverified asset shows disabled explanation
- repository asset shows unsupported explanation
- verified web/API asset shows Run passive observation
- queued/running job shows status and Cancel action
- succeeded job shows request count, redirect count, TLS/header summary, and finding count
- failed/blocked job shows stable safe reason

- [ ] **Step 2: Implement server actions**

Actions must resolve authenticated workspace context and call the application service. Do not duplicate authorization or network policy in the action.

- [ ] **Step 3: Implement the panel**

Keep security language precise. Label the feature as passive observation and do not imply exploit validation.

- [ ] **Step 4: Run component and service tests**

```bash
npm test -- tests/components/RuntimeObservationPanel.test.tsx tests/runtime-observations
npm run typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/assets components/assets tests/components
git commit -m "feat: expose passive runtime observations in asset view"
```

---

### Task 9: Final architecture, documentation, and complete CI gate

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PHASES.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`
- Test: `tests/architecture/security-domain-dependencies.test.ts`
- Create or modify: `tests/architecture/runtime-observer-dependencies.test.ts`

**Interfaces:**
- Documents the exact shipped Phase 4B slice and remaining Phase 4B-3/Phase 4C boundaries.

- [ ] **Step 1: Add runtime dependency-direction guard**

Assert `packages/runtime-observer` does not import Next.js, React, Supabase, app/components, or provider SDKs. Assert `packages/network-safety` imports no DNS/HTTP/TLS/database/framework code.

- [ ] **Step 2: Update permanent project state**

Document exact supported runtime observations, budgets, authorization checks, persistence state, safety limitations, and the fact that crawling/fuzzing/exploit validation remain disabled.

- [ ] **Step 3: Run the complete repository gate**

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Expected: all commands succeed with zero test failures.

- [ ] **Step 4: Review the exact changed-file set for security regressions**

Check every network connection path for authorization, fresh DNS resolution, IP classification, pinning, timeout, redirect policy, cancellation, and redaction. Check every database write path is trusted-server-only and workspace-bound.

- [ ] **Step 5: Commit final state**

```bash
git add docs tests/architecture
git commit -m "docs: record Phase 4B passive runtime boundary"
```

- [ ] **Step 6: Require exact-head CI before merge**

Do not merge on an earlier green head. Squash merge using expected-head SHA protection, then verify merged `main` content and post-merge CI only when exposed by the available GitHub tooling.

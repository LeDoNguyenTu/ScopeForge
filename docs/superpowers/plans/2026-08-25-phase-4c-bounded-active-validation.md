# Phase 4C Bounded Active Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Approved for execution

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

## Tasks

The approved execution order is:

1. Extract the reviewed Phase 4B DNS/HTTPS transport into `packages/runtime-network` behind a typed trusted GET-only request plan. Start by adding/moving runtime-network tests and prove RED before production extraction. Preserve fresh all-address DNS validation, public-IP pinning, Host/SNI verification, DNS-inclusive deadlines, abort behavior, response-body destruction, and all passive Phase 4B tests.
2. Add `packages/runtime-validator` with `cors-origin-policy@1`, fixed origin `https://scopeforge.invalid`, exact one-request/zero-redirect budget, exact-target construction, bounded CORS observation normalization, and tests proving no caller-controlled request configuration.
3. Add deterministic CORS rules and security-domain mapping: credentialed synthetic origin is high/high, synthetic-origin reflection without credentials is low/high, wildcard and missing `Vary: Origin` are observation-only, source is `scopeforge:runtime-validator`, validation is `runtime_validated`, evidence is bounded and deterministic.
4. Extend existing runtime persistence with `active_validation`, immutable profile/authorization snapshot fields, `cors-policy` observations, active-only repository adapter, and migration tests proving authenticated users retain select-only access and trusted writes.
5. Add owner/admin-only active authorization, enqueue/execution reauthorization, database-backed cancellation, one-request validator execution, bounded audit/failure codes, and cancellation-before-persistence regressions. Passive member authorization remains unchanged.
6. Add dedicated asset server action `runCorsOriginPolicyValidation(assetId)` and a separate active-validation panel. The browser may submit only asset id. No URL/path/method/header/origin/body/credential controls are exposed.
7. Add architecture and security regressions proving runtime-network/runtime-validator dependency direction, no generic HTTP authority, DNS rebinding protection, deadline correctness, zero redirect following, body destruction, and privacy redaction.
8. Refresh permanent state/architecture/roadmap/test docs only after implementation is green, run the exact full gate, perform security diff review, require exact-head CI green and no blocking review threads, then squash merge with expected-head protection.

## Locked interfaces and persistence names

- Profile: `cors-origin-policy@1`
- Synthetic origin: `https://scopeforge.invalid`
- Job kind: `active_validation`
- Observation kind: `cors-policy`
- Active validation state: `runtime_validated`
- Active request count: exactly `1`
- Redirects followed: exactly `0`
- Per-request timeout maximum: `5_000` ms
- Total runtime maximum: `10_000` ms
- Observation persistence maximum: `32_768` bytes/job
- Evidence summary maximum: `4_096` characters/finding
- User agents: `ScopeForge-RuntimeObserver/0.1` and `ScopeForge-RuntimeValidator/0.1`

### `runtime-network`

```ts
export interface RuntimeResolvedAddress { address: string; family: 4 | 6 }
export type RuntimeResolver = (hostname: string) => Promise<readonly RuntimeResolvedAddress[]>;
export interface RuntimeTlsMetadata { protocol: string | null; validFrom: string | null; validTo: string | null; subjectAltName: string | null }
export interface RuntimeNetworkResponse { status: number; headers: Readonly<Record<string, string | readonly string[] | undefined>>; tls: RuntimeTlsMetadata }
export type RuntimeRequester = (options: import("node:https").RequestOptions) => Promise<RuntimeNetworkResponse>;
export interface TrustedRuntimeRequestPlan {
  readonly method: "GET";
  readonly url: URL;
  readonly timeoutMs: number;
  readonly headers: Readonly<Record<"accept" | "user-agent" | "origin", string | undefined>>;
}
export interface RuntimeNetworkDependencies { resolver?: RuntimeResolver; requester?: RuntimeRequester; now?: () => number }
```

The network boundary runtime-validates HTTPS, port 443, GET, `Accept: */*`, an approved ScopeForge user agent, and either no Origin or exactly the fixed synthetic Origin.

### `runtime-validator`

```ts
export interface ActiveValidationBudget {
  maxRequests: 1;
  maxRedirects: 0;
  perRequestTimeoutMs: number;
  totalTimeoutMs: number;
  maxObservationBytes: number;
}
export interface AuthorizedActiveTarget {
  assetRef: import("@/packages/security-domain").AssetRef;
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

Only selected CORS metadata and a bounded redirect hostname may enter the observation. Query, fragment, cookies, Authorization, body, raw arbitrary headers, and exception text never enter persistence.

## Required TDD verification points

Every production slice starts with a failing test. Required regressions include:

- runtime-network module missing before extraction, then all moved Phase 4B DNS/transport tests green
- unsafe synthetic Origin/request-plan rejection
- exact active budget validation
- exact canonical target and fixed header plan
- credentialed and non-credentialed CORS reflection semantics
- wildcard produces no finding
- active `runtime_validated` mapping and stable IDs
- active migration/RLS/trusted writes
- unauthenticated/member/viewer/cross-workspace/unverified/changed-snapshot/unknown-profile blocked before network
- owner/admin accepted
- cancellation after response but before persistence writes zero observations
- 3xx makes no second request
- DNS mixed public/private and empty response rejected
- DNS time counted inside deadline
- pinned address with original Host/SNI
- response body not surfaced
- Set-Cookie/arbitrary headers not persisted
- query/fragment redaction
- architecture dependency guards
- passive Phase 4B regressions remain green

## Exact merge gate

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Before merge, security-review every changed Phase 4C file for authorization bypass, target widening, SSRF/DNS rebinding, arbitrary request authority, redirect propagation, timeout gaps, cancellation races, secret persistence, RLS/trusted-write regression, unbounded evidence, unsafe error disclosure, and passive/active dependency mixing. Any plausible defect receives a failing regression before its fix.

Merge only the exact current PR head when its workflow is fully green, no blocking reviews or unresolved threads remain, and the head has not moved. Use squash merge with expected-head protection.

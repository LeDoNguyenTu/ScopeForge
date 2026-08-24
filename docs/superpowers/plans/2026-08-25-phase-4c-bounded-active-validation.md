# Phase 4C Bounded Active Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Status:** Approved for execution

**Goal:** Add the first explicitly authorized, narrowly active runtime validator to ScopeForge using one fixed CORS origin-policy request against an exact verified target, while preserving every Phase 4B passive-runtime safety invariant.

**Architecture:** Keep `packages/runtime-observer` passive. Extract reviewed low-level DNS/HTTPS/pinning/deadline/body-discard behavior into `packages/runtime-network`. Add `packages/runtime-validator` for built-in active profiles, CORS observations, deterministic rules, and security-domain mapping. Trusted application services own authorization, immutable snapshots, cancellation, persistence, audit, quotas, and orchestration.

**Locked Phase 4C-1 contract:**

- Profile `cors-origin-policy@1`
- Synthetic origin `https://scopeforge.invalid`
- Verified `web_application` and `api` assets only
- Owner/admin only for active enqueue; passive Phase 4B roles unchanged
- HTTPS and port 443 only
- Exact immutable canonical target only
- One GET request exactly
- Zero redirects followed
- Zero retries
- No request body, cookie, Authorization, user headers, browser state, JavaScript, or exploit payload
- Fresh DNS before connection, reject the whole request if any answer is not public, pin socket to validated public address, preserve original Host/SNI/certificate hostname
- DNS time included in request deadline
- Per-request maximum 5 seconds, total maximum 10 seconds
- Response body destroyed and never persisted
- Persist only one bounded `cors-policy` observation, maximum 32 KiB/job
- Evidence summary maximum 4 KiB/finding
- Query, fragment, Set-Cookie/cookie values, Authorization data, arbitrary headers, and raw exception text never enter active persistence
- Active findings use `runtime_validated`
- `runtime-observer` never imports `runtime-validator`
- `runtime-network` never imports app/UI/database/provider/rule layers
- `network-safety` remains pure

## Execution tasks

### 1. Extract `runtime-network` without passive behavior change

Create `packages/runtime-network/{contracts,dns,https-transport,index}.ts`. Move the hardened DNS and HTTPS behavior currently owned by `runtime-observer` behind a typed trusted request plan. Add `tests/runtime-network/` first and verify RED because the package is missing. Preserve all current DNS, pinning, timeout, AbortSignal, response-body destruction, async cancellation, redirect, redaction, and passive observation regressions. Then migrate `runtime-observer` imports and remove its duplicated DNS/transport implementation.

The public request plan is GET-only and runtime-validates HTTPS/443, `Accept: */*`, one of the two ScopeForge runtime user agents, and either no Origin or exactly the fixed synthetic Origin.

### 2. Add pure `runtime-validator` CORS contract

Create `packages/runtime-validator/{contracts,budget,cors-profile,observations,validate,index}.ts` and tests. Enforce exact request count 1, redirect count 0, max 5-second request timeout, 10-second total runtime, 32 KiB observations. `buildCorsOriginPolicyRequestPlan(target, timeout)` accepts no caller request configuration. Normalize only status, ACAO, ACAC, Vary, and bounded redirect hostname. Strip target query/fragment from persistence. Never follow 3xx.

### 3. Add deterministic CORS rules and security-domain mapping

Create `packages/runtime-validator/rules/` and `domain-mapper.ts` with tests first. Credentialed exact synthetic-origin allowance maps to `runtime/cors/credentialed-untrusted-origin`, high/high. Exact synthetic-origin reflection without credentials maps to `runtime/cors/untrusted-origin-reflection`, low/high. Wildcard ACAO and missing `Vary: Origin` remain observation-only. Source is `deterministic-runtime-scanner` / `scopeforge:runtime-validator`, source version identifies `cors-origin-policy@1`, validation is `runtime_validated`, and identities/evidence are deterministic and bounded.

### 4. Extend existing runtime persistence

Create migration `supabase/migrations/20260825043000_phase_4c_active_validation.sql`; update `lib/database.types.ts`; add `lib/active-validations/{types,repository}.ts` and tests. Add job kind `active_validation`, immutable active fields `validator_profile_id`, `validator_profile_version`, `active_authorized_at`, and observation kind `cors-policy`. Keep job/workspace/asset foreign keys, transition guards, payload budgets, RLS, and select-only authenticated access. All active repository mutations must be scoped to `job_kind = active_validation`.

### 5. Add explicit active authorization/service execution

Create `lib/active-validations/{authorization,service}.ts` and tests. Owner/admin only. Reauthorize immediately before network. Snapshot drift, revoked verification, unsupported profile/kind, invalid budget, cancellation, or wrong state must produce zero network traffic. Inject DB-backed async cancellation and recheck after validation before persistence. Cancellation after response must persist zero observations/findings. Use stable bounded active failure codes and audit events without raw infrastructure errors.

### 6. Add dedicated active UI/server action

Create `components/assets/ActiveValidationPanel.tsx`, tests, and extend asset server/page code. `runCorsOriginPolicyValidation(assetId: string)` accepts only asset id and binds the fixed profile/budget server-side. UI clearly separates Passive observation and Bounded active validation, displays the fixed behavior, and exposes no editable URL/path/method/header/origin/body/credential inputs.

### 7. Lock architecture/security boundaries

Add architecture tests for runtime-network/runtime-validator and strengthen runtime-observer guards. Add regressions for mixed public/private DNS, empty DNS, fresh DNS, pinning, original Host/SNI, DNS-inclusive timeout, remaining HTTPS deadline, timeout abort, HTTPS/443 policy, zero redirect following, body destruction, query/fragment redaction, no Set-Cookie/arbitrary header persistence, and no generic active request public API.

### 8. Refresh permanent docs and finish exact-head gate

Update `docs/PHASES.md`, `docs/ARCHITECTURE.md`, and development state/handoff/test docs with implemented facts only. Record Phase 4B merged. Mark Phase 4C-1 complete only after exact-head tests/CI pass. Keep worker isolation/dedicated egress/backpressure as later Phase 6 work.

Run:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Then security-review every Phase 4C changed file for authorization bypass, target widening, SSRF/DNS rebinding, arbitrary request authority, redirects, deadline gaps, cancellation races, secret persistence, RLS/trusted-write regression, unbounded evidence, unsafe errors, and passive/active dependency mixing. Any plausible defect gets a failing regression before its fix. Merge only an unchanged exact head with fully green CI, no blocking review threads/submissions, using expected-head squash protection.

## Non-goals

No crawling, endpoint discovery, OPTIONS preflight, user-supplied origins, SQLi/XSS/SSRF probes, file discovery, arbitrary methods/headers/bodies, cookie/credential replay, authenticated testing, browser automation, JavaScript, fuzzing, credential attacks, exploit confirmation, DoS, target persistence, cross-host redirects, generalized DAST, worker-fleet scale, dedicated egress infrastructure, automatic remediation, or AI/model calls are part of Phase 4C-1.

# Phase 4C Bounded Active Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Status:** Approved for execution

**Goal:** Add the first explicitly authorized, narrowly active runtime validator to ScopeForge using one fixed CORS origin-policy request against an exact verified target, while preserving every Phase 4B passive-runtime safety invariant.

**Architecture:** Keep `packages/runtime-observer` passive. Extract reviewed DNS/HTTPS/IP-pinning/deadline/body-discard behavior into `packages/runtime-network`. Add `packages/runtime-validator` for built-in active profiles, CORS observations, deterministic rules, and security-domain mapping. Trusted application services own owner/admin authorization, immutable job snapshots, cancellation, persistence, audit, quota, and orchestration.

## Locked Phase 4C-1 contract

- Profile `cors-origin-policy@1`
- Fixed Origin `https://scopeforge.invalid`
- Verified `web_application` and `api` assets only
- Owner/admin active authorization only; passive Phase 4B authorization unchanged
- HTTPS, port 443, exact immutable canonical target/path
- Exactly one GET, zero redirects followed, zero retries, concurrency one
- No request body, cookie, Authorization, arbitrary/user header, JavaScript, browser state, credential, or exploit payload
- Fresh DNS before connection; reject the request if any returned address is non-public/invalid; deterministic public IP pinning; preserve original Host/SNI/certificate hostname
- DNS included in request deadline; max 5 seconds/request and 10 seconds total
- Response body destroyed and never captured
- One bounded `cors-policy` observation, maximum 32 KiB/job
- Evidence summary maximum 4 KiB/finding
- Query/fragment, cookie/Set-Cookie, Authorization material, arbitrary headers, raw infrastructure exceptions never enter persistence
- Active findings use `runtime_validated`
- `runtime-observer` does not import `runtime-validator`
- `runtime-network` does not import application/UI/database/provider/rule layers
- `network-safety` remains pure

## Task 1 - Behavior-preserving runtime-network extraction

Create `packages/runtime-network/contracts.ts`, `dns.ts`, `https-transport.ts`, and `index.ts`. First add/move hardened DNS/transport tests into `tests/runtime-network/` and verify RED because the package does not exist. Add a regression rejecting any request plan whose Origin is not the fixed synthetic Origin. Move the existing Phase 4B DNS/HTTPS logic behind a typed GET-only trusted request plan. Preserve all-address validation, fresh resolution, deterministic pinning, original Host/SNI, DNS-inclusive deadline, outer abort, no body buffering, normalized headers, and passive behavior. Then migrate `runtime-observer` to the shared package, delete duplicated observer DNS/transport files, and require all runtime-network/runtime-observer tests green.

## Task 2 - Pure runtime-validator profile and observation contract

Create `packages/runtime-validator/contracts.ts`, `budget.ts`, `cors-profile.ts`, `observations.ts`, `validate.ts`, `index.ts` plus tests. Add RED tests before production. Enforce one request, zero redirects, maximum 5-second request timeout, 10-second total runtime, 32 KiB observation budget. `buildCorsOriginPolicyRequestPlan(target, timeoutMs)` accepts only immutable authorized target and timeout. Normalize only status, ACAO, ACAC, Vary, and bounded redirect hostname. Strip query/fragment before observation persistence. Never follow 3xx.

## Task 3 - Deterministic CORS rules and security-domain mapping

Add tests first, then `packages/runtime-validator/rules/*` and `domain-mapper.ts`. Exact synthetic origin + ACAC true => `runtime/cors/credentialed-untrusted-origin`, high/high. Exact synthetic origin without credential allowance => `runtime/cors/untrusted-origin-reflection`, low/high. Wildcard ACAO and missing Vary are observation-only. Map through existing security-domain with source kind `deterministic-runtime-scanner`, source id `scopeforge:runtime-validator`, profile-specific source version, `runtime_validated`, deterministic ids, observed evidence, scanner-derived findings, structured remediation, and <=4096-character evidence.

## Task 4 - Active job persistence

Create migration `supabase/migrations/20260825043000_phase_4c_active_validation.sql`, update `lib/database.types.ts`, and add `lib/active-validations/types.ts` and `repository.ts` with tests. Add job kind `active_validation`, immutable `validator_profile_id`, `validator_profile_version`, `active_authorized_at`, and observation kind `cors-policy`. Preserve legal transitions, workspace/job/asset foreign keys, payload limits, RLS, and authenticated select-only access. Active repository mutations always filter `job_kind = active_validation`.

## Task 5 - Authorization, execution, cancellation, audit

Create `lib/active-validations/authorization.ts`, `service.ts`, and tests. Owner/admin only. Reauthorize immediately before network and require zero traffic on auth/snapshot/profile/budget/cancel failures. Inject DB-backed async cancellation. Recheck cancellation after validation and before persistence/success. Cancellation after response writes no observation/finding. Use stable active failure/reason codes and bounded audit events without raw Node/DNS/TLS/Supabase/Postgres errors.

## Task 6 - Dedicated active UI action

Create `components/assets/ActiveValidationPanel.tsx` and tests, extend asset server actions/page/styles. The public server action is `runCorsOriginPolicyValidation(assetId: string)` and accepts only asset id. Fixed profile/budget bind server-side. Separate passive and active status/observations. UI explains one fixed unauthenticated CORS request, profile and synthetic Origin, and absence of body/credentials/cookies/arbitrary headers/redirect following. It exposes no arbitrary request inputs.

## Task 7 - Architecture and security regression guards

Add runtime-network/runtime-validator dependency tests and strengthen runtime-observer guards. Add regressions for mixed public/private and empty DNS, fresh DNS, IP pinning with original Host/SNI, DNS-inclusive deadline, remaining HTTPS deadline, outer timeout abort, HTTPS/443-only policy, zero redirect following, body destruction, query/fragment redaction, no Set-Cookie/arbitrary header persistence, and no generic active HTTP API surface. Any plausible security defect discovered receives a failing regression before its fix.

## Task 8 - Permanent docs, exact full gate, security review, merge

Update roadmap/architecture/current-state/next-steps/test-status/session-handoff with implemented facts only. Record Phase 4B merged. Mark 4C-1 complete only after exact-head verification. Keep isolated workers/dedicated egress/backpressure/fleet scale in later Phase 6.

Run exactly:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Security-review all changed Phase 4C files for authorization bypass, target widening, SSRF/DNS rebinding, arbitrary request authority, redirect propagation, timeout gaps, cancellation races, secret persistence, RLS/trusted-write regression, unbounded evidence, unsafe error disclosure, and passive/active dependency mixing. Merge only unchanged exact head with fully green CI, no blocking review or unresolved thread, via expected-head squash merge.

## Non-goals

No crawling, endpoint discovery, OPTIONS preflight, user-supplied origins, SQLi/XSS/SSRF probes, file discovery, arbitrary methods/headers/bodies, cookie/credential replay, authenticated testing, browser automation, JavaScript execution, fuzzing, credential attacks, exploit confirmation, DoS, persistence on targets, cross-host redirect following, generalized DAST, worker fleet, dedicated egress, automatic remediation, or AI/model calls.

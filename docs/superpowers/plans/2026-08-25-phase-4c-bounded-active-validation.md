# Phase 4C Bounded Active Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Status:** Approved for execution

**Goal:** Add the first explicitly authorized, narrowly active runtime validator to ScopeForge using one fixed CORS origin-policy request against an exact verified target, while preserving every Phase 4B passive-runtime safety invariant.

**Architecture:** Keep `packages/runtime-observer` passive. Extract reviewed DNS/HTTPS/IP-pinning/deadline/body-discard behavior into `packages/runtime-network`. Add `packages/runtime-validator` for built-in active profiles, CORS observations, deterministic rules, and security-domain mapping. Trusted application services own owner/admin authorization, immutable job snapshots, cancellation, persistence, audit, quota, and orchestration.

## Locked contract

Phase 4C-1 is `cors-origin-policy@1`, with fixed `Origin: https://scopeforge.invalid`, verified web/API assets only, owner/admin active authorization only, HTTPS/443 exact canonical target, exactly one GET, zero redirects/retries/body/cookies/Authorization/user headers, fresh all-address public DNS validation and IP pinning, original Host/SNI, DNS-inclusive 5-second request deadline, 10-second total bound, response-body destruction, max 32 KiB CORS observation, max 4 KiB evidence summary, `runtime_validated` active findings, trusted writes, and strict package dependency boundaries.

## Task 1 - Extract runtime-network under TDD

Add failing `tests/runtime-network` contracts first, including unsafe Origin rejection and all existing DNS/pinning/deadline regressions. Then create `packages/runtime-network/{contracts,dns,https-transport,index}.ts`, migrate passive observer imports, remove duplicated observer network files, and prove all runtime-network/runtime-observer tests green with no passive behavior change.

## Task 2 - Add pure CORS validator contract

Add RED tests, then `packages/runtime-validator/{contracts,budget,cors-profile,observations,validate,index}.ts`. Enforce fixed profile/origin, one request, zero redirects, exact target, fixed headers, maximum budgets, bounded CORS-only observation, query/fragment redaction, and no second request on 3xx.

## Task 3 - Deterministic active findings

Test then implement CORS rules and domain mapper. Credentialed exact synthetic-origin allowance is high/high; exact reflection without credentials is low/high; wildcard and missing Vary are observation-only. Reuse security-domain with `scopeforge:runtime-validator`, `runtime_validated`, deterministic identities, bounded evidence, conservative wording, and structured remediation.

## Task 4 - Persistence

Test then add migration `20260825043000_phase_4c_active_validation.sql`, `active_validation` job kind, immutable profile/version/authorization timestamp fields, `cors-policy` observation kind, updated database types, and an active-only repository adapter. Preserve transitions, workspace/job/asset foreign keys, payload caps, RLS, select-only authenticated access, and trusted writes.

## Task 5 - Authorization and execution service

Test then add owner/admin-only active authorization, execution-time snapshot reauthorization before DNS/network, stable bounded codes, DB-backed async cancellation, cancellation checks after validation/before persistence/success, and bounded audit lifecycle. Any blocked/revoked/mismatched/cancelled state before network produces zero outbound traffic. Cancellation after response persists zero active data.

## Task 6 - Dedicated server action/UI

Test then add `runCorsOriginPolicyValidation(assetId: string)` and separate active panel. Asset id is the only browser input; profile/budget bind server-side. UI clearly distinguishes passive observation from bounded active validation and exposes no arbitrary request configuration.

## Task 7 - Architecture/security guards

Add dependency and authority tests plus regressions for mixed private/public DNS, empty/fresh DNS, pinning, original Host/SNI, DNS-inclusive deadline, remaining HTTPS time, abort, HTTPS/443, zero redirect following, body destruction, query/fragment redaction, no Set-Cookie/arbitrary header persistence, and no generic active HTTP API. Security defects get RED regressions before fixes.

## Task 8 - Docs, exact gate, security review, merge

Refresh roadmap/architecture/development docs with implemented facts only, then run:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Review every Phase 4C diff for authorization bypass, target widening, SSRF/DNS rebinding, arbitrary request authority, redirect propagation, timeout gaps, cancellation races, secret persistence, RLS/trusted-write regression, unbounded evidence, unsafe error disclosure, and passive/active dependency mixing. Merge only unchanged exact head with fully green CI, no blockers/threads, using expected-head squash merge.

## Non-goals

No crawling, endpoint discovery, OPTIONS preflight, user origins, SQLi/XSS/SSRF probes, file discovery, arbitrary methods/headers/bodies, cookie/credential replay, authenticated testing, browser automation, JavaScript, fuzzing, credential attacks, exploit confirmation, DoS, target persistence, cross-host redirects, generalized DAST, worker fleet, dedicated egress, automatic remediation, or AI/model calls.

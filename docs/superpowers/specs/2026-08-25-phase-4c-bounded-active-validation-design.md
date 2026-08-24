# Phase 4C Bounded Active Validation Design

Date: 2026-08-25
Status: Approved for execution

## Purpose

Phase 4C introduces ScopeForge's first narrowly active remote validation while preserving Phase 4B authorization, target, DNS/IP, timeout, cancellation, privacy, persistence, audit, and architecture boundaries.

Phase 4C-1 is one built-in profile: `cors-origin-policy@1`. It sends one fixed unauthenticated GET to the exact verified HTTPS canonical target with `Origin: https://scopeforge.invalid`, inspects bounded CORS metadata, destroys the response body, and stops. It cannot be used as a generic request proxy.

## Architecture

Keep `packages/runtime-observer` passive-only. Extract hardened outbound DNS/HTTPS mechanics into `packages/runtime-network`. Add active-only `packages/runtime-validator` for profile construction, observations, deterministic rules, and security-domain mapping.

```text
trusted service -> runtime-observer  -> runtime-network -> network-safety
trusted service -> runtime-validator -> runtime-network -> network-safety
runtime-observer/runtime-validator -> security-domain
```

`network-safety` stays pure. `runtime-network` owns fresh DNS, all-address public validation, deterministic IP pinning, original Host/SNI/cert hostname, DNS-inclusive HTTPS deadlines, abort, no automatic redirects, and response-body destruction. It imports no UI/application/database/provider/rule code. `runtime-observer` never imports `runtime-validator`. `runtime-validator` imports no Next.js/React/Supabase/UI/passive application service.

Trusted application services alone bind execution to workspace, actor, asset, immutable job snapshot, cancellation, persistence, audit, and quota.

The current roadmap permits this tiny synchronous Phase 4C-1 before Phase 6 worker scale. Isolated workers, dedicated egress, backpressure, fleet concurrency, artifact isolation, and production abuse controls remain later work. Any active profile that materially widens authority requires another design/security review.

## Authorization

Only verified `web_application` and `api` assets are supported. Verification alone is insufficient. Workspace owner/admin must explicitly invoke the dedicated active action for one job; member/viewer cannot. Passive Phase 4B role behavior is unchanged.

Immutable active snapshot: workspace, asset id/ref/kind, canonical URL/hostname, exact `verified_at`, profile id/version, active authorization time, actor id, validated budget.

Enqueue rechecks actor/workspace/role, asset ownership/kind/verification, target/hostname policy, exact known profile/version, dedicated action surface, absence of caller request configuration, and budget/quota. Execution reauthorizes immediately before DNS and blocks with zero traffic if job state/cancellation/workspace/kind/verification/verified_at/target/hostname/profile/budget differ.

No public active API accepts arbitrary URL, path, method, header map, body, cookie, Authorization value, credential, or payload.

## CORS v1 request

- profile `cors-origin-policy@1`
- fixed Origin `https://scopeforge.invalid`
- HTTPS only, port 443 only
- exact immutable canonical target/path
- GET only
- fixed `Accept: */*` and ScopeForge validator User-Agent
- one request, zero redirects followed, zero retries, concurrency one
- no body, cookie, Authorization, user header, browser state, JavaScript, or exploit payload
- no OPTIONS preflight

A 3xx response is observed and terminates execution without requesting its destination.

Fresh DNS is required for every connection. Empty DNS fails. Any private/reserved/invalid/non-public answer rejects the whole request. A validated public address is socket-pinned while original hostname remains Host/SNI/certificate target. DNS time is inside the request deadline.

Response bodies are destroyed. Only bounded status, ACAO, ACAC, Vary, and safely parsed redirect-host metadata may cross into the CORS observation.

## Observation and findings

Observation kind `cors-policy` stores profile id/version, target URL stripped of query/fragment, status, bounded normalized ACAO/ACAC, `credentialsAllowed`, whether Vary contains Origin, redirect boolean, and bounded redirect hostname.

Never store body, cookie/Set-Cookie values, Authorization data, arbitrary response headers, query/fragment, or raw infrastructure exceptions.

Rules:

- ACAO equals fixed synthetic Origin and ACAC exactly true -> `runtime/cors/credentialed-untrusted-origin`, severity high, confidence high, `runtime_validated`.
- ACAO equals fixed synthetic Origin without credential allowance -> `runtime/cors/untrusted-origin-reflection`, severity low, confidence high, `runtime_validated`.
- ACAO wildcard and missing `Vary: Origin` -> observation only.

Use source kind `deterministic-runtime-scanner`, source id `scopeforge:runtime-validator`, profile-specific version, conservative wording, deterministic identities, structured remediation, and bounded evidence. Do not claim actual victim credentials or sensitive data exfiltration.

## Budgets, cancellation, failures

- requests exactly 1
- redirects 0
- per-request maximum 5 seconds
- total maximum 10 seconds
- request/captured response body 0 bytes
- normalized observation max 32 KiB/job
- evidence summary max 4 KiB/finding

Cancellation checks occur before DNS, before connection, after response, before rules, before persistence, and before success transition. Cancellation after response but before persistence writes no active observation/finding and ends as cancelled.

Use stable bounded failure categories for authorization/snapshot block, cancellation, DNS/public-IP safety, timeout, transport/TLS, and persistence/execution. Never expose raw Node/DNS/TLS/Supabase/Postgres/stack text in UI/audit.

## Persistence, audit, UI

Extend the existing runtime model: `scan_jobs` gains `active_validation` plus immutable `validator_profile_id`, `validator_profile_version`, `active_authorized_at`; `runtime_observations` gains `cors-policy`. Preserve legal transitions, composite workspace/job/asset foreign keys, payload caps, RLS, and authenticated select-only runtime state. Trusted adapters alone write.

Audit lifecycle uses `active_validation.authorized`, `.enqueued`, `.blocked`, `.started`, `.cancel_requested`, `.cancelled`, `.succeeded`, `.failed`, with only bounded stable metadata.

The asset UI separates Passive observation from Bounded active validation. It explains the one fixed request, profile, synthetic Origin, and disabled capabilities. The browser submits only asset id and exposes no arbitrary active-request controls.

## Testing and delivery

TDD must prove authorization and zero-traffic reauthorization failures, exact target/profile/request, no generic HTTP surface, DNS rebinding defenses/pinning/deadlines, body destruction/privacy redaction, CORS rule semantics, `runtime_validated` deterministic mapping, cancellation before persistence, package dependency direction, trusted writes/RLS, and unchanged passive Phase 4B behavior.

Delivery order: runtime-network extraction; validator contract; rules/mapping; migration/repository; authorization/service; server action/UI; security/architecture regressions; permanent docs/full exact-head gate/security review/merge.

Full merge gate:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

## Non-goals and acceptance

No crawling, discovery, preflight, user origins, SQLi/XSS/SSRF probes, arbitrary methods/headers/bodies, cookie/credential replay, authenticated testing, browser automation, JavaScript, fuzzing, credential attacks, exploit confirmation, DoS, target persistence, cross-host redirect following, generalized DAST, worker fleet, dedicated egress, auto-remediation, or model calls.

Complete only when the validator cannot become a generic HTTP client; owner/admin explicit authorization and execution reauthorization are enforced; network safety survives extraction; one request/no redirect/no body constraints are mechanically tested; only bounded CORS metadata persists; cancellation suppresses later persistence; active findings are conservative and `runtime_validated`; browser writes remain trusted-service-only; architecture guards and full exact-head CI pass; security review finds no known blocker; permanent docs distinguish this slice from later worker scale and broader active testing.

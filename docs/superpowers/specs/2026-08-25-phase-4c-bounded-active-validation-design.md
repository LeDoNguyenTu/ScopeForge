# Phase 4C Bounded Active Validation Design

Date: 2026-08-25
Status: Approved for execution

## Purpose and boundary

Phase 4C introduces ScopeForge's first narrowly active remote security validation capability while preserving Phase 4B authorization, target-transition, DNS/IP safety, timeout, cancellation, evidence, audit, persistence, and architecture guarantees.

Phase 4C-1 is exactly one built-in profile, `cors-origin-policy@1`. It sends one fixed unauthenticated GET to the exact verified HTTPS canonical target with `Origin: https://scopeforge.invalid`, inspects bounded CORS response metadata, destroys the response body, and stops. It does not accept user request configuration or perform crawling, fuzzing, exploit payloads, credential testing, redirects, or arbitrary internet requests.

## Architecture

`packages/runtime-observer` remains passive. The hardened DNS/HTTPS/pinning/deadline/body-discard behavior is extracted into `packages/runtime-network`. A separate `packages/runtime-validator` owns active profiles, trusted request-plan construction, bounded observations, deterministic rules, and security-domain mapping.

```text
trusted application service
  -> runtime-observer  -> runtime-network -> network-safety
  -> runtime-validator -> runtime-network -> network-safety

runtime-observer  -> security-domain
runtime-validator -> security-domain
```

`network-safety` stays pure. `runtime-network` may use Node network I/O but no UI/application/database/provider/rule code. `runtime-observer` must not import `runtime-validator`. `runtime-validator` must not import Next.js, React, Supabase, browser/UI, or passive application-service modules. Trusted application services alone bind execution to workspace, actor, asset, immutable job state, cancellation, persistence, audit, and quota.

An older Phase 4A design anticipated worker isolation before active validation. The current roadmap places this narrowly bounded slice before Phase 6 worker scale. Phase 4C-1 may use trusted synchronous control-plane orchestration because its network authority is one target and one request. Isolated workers, dedicated egress, queue backpressure, fleet concurrency, private artifacts, and production-scale abuse controls remain later Phase 6 work. A future validator that widens authority requires a separate design/security review.

## Authorization

Supported assets are verified `web_application` and `api` assets only. Proof of control is necessary but not sufficient for active validation.

Only workspace `owner` and `admin` roles may authorize an active job. `member` and `viewer` cannot. Existing Phase 4B passive authorization remains unchanged.

The dedicated active action creates one explicit authorization event and immutable snapshot containing workspace id, asset id/ref/kind, canonical URL/hostname, exact `verified_at`, validator profile id/version, active authorization timestamp, requesting actor id, and validated budget.

Enqueue rechecks authentication, workspace role, asset ownership/kind/verification, canonical target/hostname policy, known exact profile/version, dedicated action surface, absence of caller-controlled request configuration, and budget/quota limits.

Immediately before DNS/network work, execution reloads job and asset and rechecks job kind/status/cancellation, workspace, asset kind, verification, exact `verified_at`, canonical target, hostname, profile id/version, and stored budget. Any mismatch blocks with zero outbound traffic.

No server action, service API, or validator public contract may accept arbitrary URL, path, method, headers map, body, cookie, Authorization value, credential, or payload.

## CORS profile v1

The synthetic origin is fixed at `https://scopeforge.invalid` and cannot be supplied by a user.

Request behavior:

- HTTPS only
- port 443 only
- exact immutable canonical target/path
- GET only
- `Accept: */*`
- ScopeForge runtime-validator User-Agent
- fixed synthetic Origin
- no request body
- no cookies or Authorization
- no arbitrary headers
- no browser state or JavaScript
- no OPTIONS preflight
- no retry
- no redirect following

A 3xx response becomes bounded metadata and terminates the validator without requesting the destination.

Every connection performs fresh DNS resolution. Empty results fail. If any resolved address is private, reserved, invalid, or otherwise non-public, the whole request fails. A validated public address is pinned at socket lookup while original hostname remains the Host/SNI/certificate verification target. DNS time is part of the request deadline.

Response bodies are destroyed without analysis. Only bounded normalized values derived from status, `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Vary`, and a safely parsed redirect hostname may enter the active observation layer.

## Observation and privacy

The single active observation kind is `cors-policy`, containing profile id/version, sanitized target URL with no query/fragment, status, bounded normalized ACAO value/presence, ACAC presence/credentialsAllowed boolean, `Vary: Origin` token presence, redirect boolean, and a bounded redirect hostname when safely parseable.

It never contains body data, Set-Cookie/cookie values, Authorization material, arbitrary response headers, query strings, fragments, or raw infrastructure exception text.

## Deterministic findings

If ACAO exactly equals the synthetic Origin and ACAC is exactly `true`, emit `runtime/cors/credentialed-untrusted-origin` at high severity/high confidence with `runtime_validated`. Wording states only that the server permitted the known untrusted origin with credentialed CORS and does not claim actual credential or data exfiltration.

If ACAO exactly equals the synthetic Origin and ACAC is absent/not exactly `true`, emit `runtime/cors/untrusted-origin-reflection` at low severity/high confidence with `runtime_validated`, without claiming sensitive data exposure.

Wildcard ACAO `*` and missing `Vary: Origin` remain observation-only in Phase 4C-1.

Active findings reuse `deterministic-runtime-scanner`, source id `scopeforge:runtime-validator`, bounded observed evidence, scanner-derived finding provenance, structured remediation, and deterministic identity derived from asset + profile/version + rule + normalized observation key.

## Budgets and cancellation

Maxima:

- requests exactly 1
- redirects followed 0
- concurrency 1
- per-request timeout 5 seconds
- total execution 10 seconds
- retries 0
- request body bytes 0
- captured response body bytes 0
- persisted normalized observation 32 KiB/job
- evidence summary 4 KiB/finding

Budget is validated before DNS. DNS plus HTTPS share the request deadline; total execution is an outer bound.

Cancellation is checked before DNS, before connection, after response metadata, before rule evaluation, before persistence, and before successful terminal transition. Cancellation after response but before persistence writes no active observation/finding and terminates as `cancelled`.

Stable bounded failure categories cover authorization changes, cancellation, network safety, timeout, transport/TLS, and persistence/execution. Raw Node/DNS/TLS/Supabase/Postgres/stack text never becomes browser or audit metadata.

## Persistence and audit

Extend the existing runtime job system instead of creating a parallel queue.

`scan_jobs` gains job kind `active_validation` plus immutable active-only fields `validator_profile_id`, `validator_profile_version`, and `active_authorized_at`. `runtime_observations` gains `cors-policy`. Existing workspace/job/asset foreign-key constraints and legal transitions remain. Authenticated browser roles retain select-only runtime state; trusted adapters alone write job/observation state.

Bounded audit lifecycle:

- `active_validation.authorized`
- `active_validation.enqueued`
- `active_validation.blocked`
- `active_validation.started`
- `active_validation.cancel_requested`
- `active_validation.cancelled`
- `active_validation.succeeded`
- `active_validation.failed`

Audit metadata contains only stable ids/profile/status/count/reason data, never bodies, raw headers, cookies, Authorization data, query secrets, or raw exception text.

## UI

The asset page separates `Passive observation` and `Bounded active validation`. The active panel appears only for supported verified assets, explains the single fixed request and synthetic Origin, identifies profile `cors-origin-policy@1`, states that no body/credentials/cookies/arbitrary headers/redirects are used, and permits owner/admin authorization. The browser submits only asset id and exposes no arbitrary request configuration.

## Testing and delivery

Implementation is TDD-first. Required regressions cover owner/admin authorization, zero-traffic snapshot blocking, exact target/profile, no generic request API, one GET/zero redirect/body/credentials, DNS rebinding defenses and pinning, DNS-inclusive deadlines, body destruction, privacy redaction, CORS rule semantics, `runtime_validated` mapping, deterministic bounded evidence, cancellation before persistence, dependency boundaries, and unchanged passive Phase 4B regressions.

Delivery order:

1. behavior-preserving `runtime-network` extraction
2. pure `runtime-validator` profile/observation contract
3. deterministic CORS rules and security-domain mapping
4. active migration/repository
5. active authorization/service/cancellation
6. dedicated server action/UI panel
7. architecture/security guards
8. permanent docs, full exact-head gate, security diff review, squash merge

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

## Non-goals

Phase 4C-1 excludes crawling, endpoint discovery, OPTIONS preflight, user-supplied origins, SQLi/XSS/SSRF probes, file discovery, arbitrary methods/headers/bodies, cookie or credential replay, authenticated testing, browser automation, JavaScript, fuzzing, credential attacks, exploit confirmation, DoS behavior, persistence on targets, cross-host redirect following, generalized DAST, worker-fleet scale, dedicated egress infrastructure, automatic remediation, and AI/model calls.

## Acceptance

Phase 4C-1 is complete only when the validator cannot act as a generic HTTP client; active authorization is explicit owner/admin-only; execution reauthorization precedes network; snapshots are immutable; Phase 4B network safety survives extraction; DNS/HTTPS deadlines are bounded; only one request occurs; no redirects/bodies are followed/captured; only bounded CORS metadata persists; cancellation suppresses persistence; findings use conservative `runtime_validated` semantics; browser/database writes remain trusted-service-only; architecture guards pass; the exact implementation head passes the full gate and security review; and permanent docs clearly separate completed 4C-1 from later broader active testing and Phase 6 worker scale.

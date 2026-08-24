# Phase 4C Bounded Active Validation Design

Date: 2026-08-25
Status: Approved for execution

## 1. Purpose

Phase 4C introduces ScopeForge's first narrowly active remote security validation capability while preserving the authorization, target-transition, DNS/IP safety, timeout, cancellation, evidence, audit, persistence, and architecture guarantees established by Phase 4B.

The first active slice is deliberately small: `cors-origin-policy@1` sends one fixed unauthenticated GET to the exact verified HTTPS canonical target with `Origin: https://scopeforge.invalid`, then evaluates bounded CORS response metadata. It sends no request body, cookies, credentials, arbitrary headers, exploit payloads, discovered paths, or redirects.

Phase 4C is an active-validation architecture boundary. It does not turn the passive observer or application control plane into a general-purpose request proxy, crawler, fuzzer, exploit engine, credential tester, or arbitrary internet scanner.

## 2. Selected architecture

Keep `packages/runtime-observer` passive-only. Extract the already hardened low-level outbound mechanics into `packages/runtime-network`, and add a separate active-only `packages/runtime-validator`.

```text
trusted application service
  -> runtime-observer  -> runtime-network -> network-safety
  -> runtime-validator -> runtime-network -> network-safety

runtime-observer  -> security-domain
runtime-validator -> security-domain
```

`runtime-network` owns fresh DNS resolution, all-address public-IP validation, deterministic IP pinning, original-host Host/SNI/certificate verification, HTTPS deadlines including DNS time, abort handling, no automatic redirects, and response-body destruction. It must not import UI, application, database, provider, observer-rule, or validator-rule code.

`runtime-validator` owns versioned built-in active profiles, trusted request-plan construction, bounded observations, deterministic rules, and security-domain mapping. It must not import Next.js, React, Supabase, browser/UI, or passive application-service code.

`runtime-observer` remains passive and must not import `runtime-validator`.

`network-safety` remains pure and performs no DNS, HTTP, TLS, database, filesystem, environment, process, or framework I/O.

Trusted application services own workspace/role authorization, explicit active consent, immutable job snapshots, cancellation, persistence, audit, quotas, and orchestration.

## 3. Roadmap resolution

An older Phase 4A design anticipated worker isolation before active validation. The current permanent roadmap and completed Phase 4B architecture place narrowly bounded Phase 4C before later worker scale.

Phase 4C-1 may use the existing trusted synchronous control-plane orchestration because its authority is limited to one exact verified target, one fixed request variation, one sequential request, strict deadlines, no redirect following, no body, no credentials, and bounded metadata only.

This does not complete worker hardening. Isolated workers, dedicated egress, queue backpressure, fleet concurrency, private artifacts, abuse controls, and production-scale orchestration remain Phase 6. Any later active profile that materially widens authority or workload scale requires a separate design/security review.

## 4. Active target and authorization

Phase 4C-1 supports only verified `web_application` and `api` assets. Repository assets remain on the local scanner path.

Verification proves control but does not itself authorize active validation. A workspace owner or admin must invoke the dedicated bounded active-validation action for one verified asset. Member and viewer roles cannot enqueue active jobs; Phase 4B passive authorization remains unchanged.

The immutable active job snapshot contains:

- workspace id
- asset id/ref/kind
- canonical URL and hostname
- `verified_at`
- validator profile id/version
- active authorization timestamp
- requesting actor id
- validated budget

Enqueue authorization rechecks authentication, workspace membership/role, asset ownership, supported kind, current verification, canonical target/hostname policy, exact known profile/version, dedicated action surface, absence of caller-controlled request configuration, and budget/quota limits.

Immediately before DNS/network activity, execution reloads the job and asset and rechecks job kind/status/cancellation, workspace, kind, verification, exact `verified_at`, canonical target, hostname, profile id/version, and stored budget. Any mismatch blocks with zero outbound traffic.

No public server action, service API, or validator package contract may accept arbitrary URL, path, method, headers map, body, cookie, Authorization value, credential, or payload. The caller selects a built-in profile; the profile constructs the complete request plan from constants and the immutable authorized target.

## 5. CORS profile v1

Profile:

```text
cors-origin-policy@1
```

Synthetic origin:

```text
https://scopeforge.invalid
```

The profile sends exactly one request:

- HTTPS only
- port 443 only
- exact authorized canonical target and path
- method GET
- `Accept: */*`
- ScopeForge runtime-validator User-Agent
- `Origin: https://scopeforge.invalid`
- no request body
- no cookie
- no Authorization
- no user headers
- no browser state or JavaScript

Phase 4C-1 does not send OPTIONS preflight.

It follows zero redirects. A 3xx response is represented as bounded metadata and validation ends without evaluating or requesting the destination. This prevents the synthetic active input from being propagated to another target.

Response bodies are destroyed without analysis.

Only bounded normalized values derived from HTTP status, `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Vary`, and a safely parsed redirect hostname may cross into the active observation layer.

## 6. CORS observation

The single observation kind is `cors-policy`. It stores:

- profile id/version
- sanitized target URL containing no query or fragment
- HTTP status
- ACAO presence and bounded normalized value
- ACAC presence and `credentialsAllowed` boolean when normalized value is exactly `true`
- whether `Vary` contains token `Origin`
- whether the response is a redirect
- bounded redirect hostname if safely parseable

It never stores a response body, Set-Cookie/cookie values, Authorization material, arbitrary response headers, query strings, fragments, or raw exception text.

## 7. Deterministic rules

### Credentialed untrusted origin

When ACAO exactly equals `https://scopeforge.invalid` and ACAC is exactly `true`:

- rule `runtime/cors/credentialed-untrusted-origin`
- severity high
- confidence high
- validation `runtime_validated`

Wording states only that the server allowed a known untrusted origin with credentialed CORS. It does not claim victim credentials exist or that sensitive response data was exfiltrated.

### Untrusted origin reflection without credentials

When ACAO exactly equals the synthetic origin and ACAC is absent or not exactly `true`:

- rule `runtime/cors/untrusted-origin-reflection`
- severity low
- confidence high
- validation `runtime_validated`

Wording does not claim sensitive data exposure.

### Wildcard and Vary

ACAO `*` is observation-only in Phase 4C-1. Missing `Vary: Origin` is also observation-only. Neither alone is treated as proven vulnerability evidence.

Active findings reuse source kind `deterministic-runtime-scanner`, source id `scopeforge:runtime-validator`, observed evidence provenance, scanner-derived finding provenance, structured remediation, bounded evidence summaries, and deterministic identity derived from asset, profile/version, rule, and normalized observation key.

## 8. Budgets

System maxima for Phase 4C-1:

- request count: exactly 1
- redirects followed: 0
- concurrency: 1
- per-request timeout: 5 seconds
- total execution time: 10 seconds
- retries: 0
- request body bytes: 0
- captured response body bytes: 0
- persisted normalized observation: 32 KiB/job
- evidence summary: 4 KiB/finding

Budget validation occurs before DNS. DNS plus HTTPS share the request deadline, and total execution time is an outer bound.

Every connection performs fresh DNS resolution. Empty results fail. If any returned address is private, reserved, invalid, or otherwise non-public, the whole request fails. The selected public address is pinned at socket lookup while the original hostname remains the Host/SNI/certificate verification target.

## 9. Cancellation and failures

Cancellation is checked before DNS, before connection, after response metadata, before rule evaluation, before persistence, and before success transition.

If cancellation occurs after a response is received but before persistence, no active observation or finding is persisted and the terminal state is `cancelled`.

Stable bounded failure categories distinguish authorization change/blocking, cancellation, DNS/public-IP safety, timeout, transport/TLS, and persistence/execution failure. Raw Node, DNS, TLS, Supabase, Postgres, and stack-trace text never becomes browser or audit metadata.

## 10. Persistence and trusted writes

Phase 4C extends the existing runtime model rather than introducing a second queue.

`scan_jobs` gains `active_validation` and active-only immutable snapshot fields:

- `validator_profile_id`
- `validator_profile_version`
- `active_authorized_at`

`runtime_observations` gains `cors-policy`.

Existing composite workspace/job/asset foreign-key constraints and legal job transitions remain. Authenticated browser roles retain select-only access to runtime job/observation state; job state and observations are written only through trusted server-side adapters.

## 11. Audit lifecycle

Bounded audit events are:

- `active_validation.authorized`
- `active_validation.enqueued`
- `active_validation.blocked`
- `active_validation.started`
- `active_validation.cancel_requested`
- `active_validation.cancelled`
- `active_validation.succeeded`
- `active_validation.failed`

Audit metadata may include stable ids, profile version, status, counts, and stable reason/failure codes. It may not include bodies, raw headers, cookies, Authorization data, query secrets, or raw exception text.

## 12. UI contract

The asset page clearly separates `Passive observation` from `Bounded active validation`.

The active panel appears only for supported verified assets, describes the single fixed request and synthetic Origin, identifies `cors-origin-policy@1`, states that no body/credentials/cookies/arbitrary headers/redirects are used, permits owner/admin to authorize a job, and displays only bounded job status/evidence.

The browser submits only the asset identifier. It has no arbitrary active request controls.

## 13. Required tests

Implementation is TDD-first and must prove:

- owner/admin-only active authorization while passive Phase 4B role behavior remains unchanged
- all execution snapshot changes block before network
- exact target/profile and fixed synthetic Origin
- no arbitrary request API
- one GET, zero redirects, zero body/credentials/cookies
- fresh all-address DNS validation and IP pinning
- original Host/SNI/certificate hostname
- DNS-inclusive request deadline and outer timeout abort
- response body destruction
- bounded CORS-only metadata, query/fragment redaction, no Set-Cookie/arbitrary headers
- high credentialed-origin and low non-credentialed-reflection rules
- wildcard and missing Vary produce no finding
- `runtime_validated` active mapping, deterministic ids, bounded evidence
- cancellation at all required boundaries, including after response before persistence
- runtime-network/runtime-validator/runtime-observer/network-safety dependency directions
- existing passive runtime regressions remain green

The full repository gate is:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

## 14. Delivery order

1. behavior-preserving `runtime-network` extraction
2. pure active-validator contract and CORS profile
3. deterministic rules and security-domain mapping
4. database migration and active repository
5. authorization, reauthorization, cancellation, and service orchestration
6. dedicated server action and UI panel
7. architecture/security regression guards
8. permanent docs, full exact-head gate, security diff review, and merge

Every production slice begins with a failing test. Any plausible security defect found during final review also receives a failing regression before its production fix.

## 15. Non-goals

Phase 4C-1 excludes crawling, endpoint discovery, OPTIONS preflight, user-supplied origins, SQLi/XSS/SSRF probes, file discovery, arbitrary methods/headers/bodies, cookies or credential replay, authenticated testing, browser automation, JavaScript execution, fuzzing, credential attacks, exploit confirmation, DoS behavior, persistence on targets, cross-host redirect following, generalized DAST, worker-fleet scale, dedicated egress infrastructure, automatic remediation, and AI/model calls.

Any later validator that widens this list requires its own design and security review.

## 16. Acceptance criteria

Phase 4C-1 is complete only when the CORS validator cannot act as a generic HTTP client, active authorization is explicit owner/admin-only, reauthorization occurs before network, target/profile snapshots are immutable, network safety survives extraction, DNS and HTTPS share deadlines, only one request occurs, no redirects or bodies are followed/captured, only bounded CORS metadata persists, cancellation suppresses persistence, active findings use conservative `runtime_validated` semantics, browser/database writes remain trusted-service-only, dependency boundaries are tested, the full repository gate passes on the exact PR head, security review finds no known blocker, and permanent docs distinguish completed 4C-1 from later worker-scale/broader active work.

# Phase 4C Bounded Active Validation Design

Date: 2026-08-25
Status: Approved design direction, self-reviewed

## 1. Purpose

Phase 4C introduces the first narrowly active remote security validation capability in ScopeForge.

The phase preserves the authorization, target-transition, DNS/IP safety, timeout, cancellation, evidence, audit, persistence, and architecture guarantees established by Phase 4B. It must not turn the control plane into a general-purpose request proxy, crawler, exploit engine, fuzzing platform, credential tester, or arbitrary internet scanner.

The first active slice is intentionally small: a deterministic CORS origin-policy validator for a verified web or API asset. ScopeForge sends one fixed synthetic Origin header to the exact authorized HTTPS canonical target and evaluates only bounded response metadata. It sends no request body, no cookies, no credentials, no user-controlled headers, no exploit payloads, and no arbitrary paths.

Phase 4C is an active-validation architecture boundary, not an excuse to widen the passive observer. Passive and active execution remain separate capabilities with separate contracts and authorization semantics.

## 2. Roadmap resolution

An older Phase 4A design anticipated worker isolation before active validation. The current permanent roadmap in `docs/PHASES.md`, the Phase 4B design, and the completed Phase 4B architecture now place narrow Phase 4C active validation before the later worker-scale phase.

This design follows the current roadmap.

Phase 4C-1 may run through the existing trusted synchronous control-plane orchestration only because its authority is deliberately tiny: one exact verified target, one fixed request variation, one sequential request, strict deadlines, no redirects, no body, no credentials, and bounded metadata only.

This does not declare worker hardening complete. Isolated workers, dedicated egress controls, queue backpressure, fleet-level concurrency, private artifacts, abuse controls, and production-scale orchestration remain Phase 6 concerns. Any later active validator that materially widens network authority or workload scale must be re-evaluated against that boundary before implementation.

## 3. Design principles

Phase 4C follows these rules:

1. Active authority is explicit and separate from proof-of-control verification.
2. Active execution is limited to built-in, versioned validator profiles.
3. User input cannot become arbitrary method, URL, path, header, body, credential, or payload input.
4. The exact verified asset hostname and canonical target remain the authorization boundary.
5. Every outbound connection performs fresh DNS resolution, public-IP validation, and IP pinning.
6. DNS time is part of the request deadline and total execution budget.
7. Cancellation is observable between network operations and before persistence.
8. Response bodies remain uncaptured and unpersisted in Phase 4C-1.
9. Active results map into the existing Phase 4A security-domain instead of creating a second finding model.
10. Passive runtime behavior remains structurally independent from active validators.
11. The browser never receives arbitrary active-request primitives.
12. Finding severity and wording must match what the validator actually demonstrated.

## 4. Architecture decision

Three approaches were considered.

### Option A - Add active checks directly to packages/runtime-observer

Rejected.

`packages/runtime-observer` has a deliberately passive contract. Adding active request profiles there would mix authorities and make later review harder. Passive refactors could accidentally widen active behavior, while active work could weaken passive guarantees.

### Option B - Separate runtime-validator and shared runtime-network packages

Selected.

A new framework-independent `packages/runtime-validator` package owns:

- active validator contracts
- versioned built-in profile registry
- active request-plan construction
- active observation types
- deterministic rule evaluation
- security-domain mapping

A new `packages/runtime-network` package owns the reusable outbound network primitive extracted from the already hardened Phase 4B transport path. It owns:

- fresh DNS resolution
- public-IP classification
- deterministic address selection
- DNS-pinned HTTPS requests
- TLS hostname/SNI preservation
- end-to-end DNS plus HTTPS deadlines
- abort handling
- bounded selected response-header normalization
- no automatic redirects
- no response-body buffering

`packages/runtime-observer` remains passive and consumes `runtime-network` for transport.

Trusted application services remain outside these packages and own workspace authorization, explicit active consent, job state, persistence, cancellation, audit records, quotas, and orchestration.

### Option C - Build isolated worker infrastructure first

Deferred.

Workers remain important for scale and stronger production isolation, but they do not define what active behavior ScopeForge is allowed to perform. Phase 4C first stabilizes a deterministic active-validator contract that a later worker can call without widening authority.

## 5. Dependency direction

```text
Next.js UI / server actions / future worker
                  |
                  v
       active-validation service
          |                 |
          v                 v
 runtime-validator     persistence/audit
          |
          v
    runtime-network
          |
          v
     network-safety

 runtime-observer
          |
          v
    runtime-network
          |
          v
     network-safety

 runtime-validator ---> security-domain
 runtime-observer  ---> security-domain
 Phase 2 verification ---> network-safety
```

Rules:

- `packages/security-domain` remains pure and never imports runtime packages.
- `packages/network-safety` remains pure and performs no DNS, HTTP, TLS, database, filesystem, environment, process, or framework I/O.
- `packages/runtime-network` may use Node DNS/HTTPS/TLS APIs but must not import Next.js, React, Supabase, application actions, components, provider SDKs, runtime-validator rules, or runtime-observer rules.
- `packages/runtime-observer` remains passive and must not import `runtime-validator`.
- `packages/runtime-validator` must not import Next.js, React, Supabase, application actions, components, provider SDKs, or passive application-service modules.
- Application services are the only layer allowed to bind validator execution to workspace, asset, user, job, persistence, and audit state.
- UI code never decides that a target or active action is authorized.

## 6. Shared runtime-network boundary

Phase 4C begins by extracting the already reviewed network behavior from `packages/runtime-observer` into `packages/runtime-network` without widening it.

The shared package owns only low-level outbound mechanics:

- HTTPS only
- port 443 only
- GET only for Phase 4C-1 and current Phase 4B consumers
- no request body
- caller-supplied URL must already be policy-approved
- caller-supplied headers must come from a typed trusted request plan, not raw browser input
- fresh DNS resolution before every connection
- reject empty DNS results
- normalize and de-duplicate resolved addresses
- reject the request if any resolved address is invalid or non-public
- deterministic public address selection
- pin socket lookup to the selected address
- preserve original hostname for Host, SNI, and certificate verification
- automatic redirects disabled
- enforce one end-to-end deadline covering DNS plus HTTPS
- support AbortSignal so the request can be destroyed on cancellation or timeout
- expose only bounded normalized response metadata requested by a trusted caller contract
- never buffer or persist response bodies

The extraction is behavior-preserving. Existing Phase 4B tests must remain green before any active-validator code is added.

## 7. Active target contract

Phase 4C-1 supports verified `web_application` and `api` assets only.

Repository assets remain on the local Phase 3 path.

The immutable active authorization snapshot contains:

- workspace id
- asset id
- asset ref
- asset kind
- canonical URL
- canonical hostname
- verification timestamp
- validator profile id
- validator profile version
- active authorization timestamp
- requesting actor id
- validated budget

The canonical URL is the only request target in Phase 4C-1. The CORS validator cannot discover, append, substitute, or probe additional paths.

Every outbound URL must satisfy:

- `https:` scheme
- port absent or `443`
- exact verified hostname match
- no username or password
- no fragment
- path exactly from the immutable canonical target
- query exactly from the immutable canonical target, if any historical row contains one

Current asset normalization rejects query strings, so normal Phase 4C-1 targets contain no query. The runtime layer still redacts query and fragment data defensively before persistence.

Cross-host redirects are never authorization to validate another host.

## 8. Explicit active authorization

Proof of control is necessary but insufficient for active validation.

### 8.1 Allowed roles

Phase 4C-1 active validation is restricted to workspace `owner` and `admin` roles.

`member` and `viewer` roles cannot enqueue active validation jobs in the first slice. Passive Phase 4B role behavior remains unchanged.

### 8.2 Consent event

There is no standing global active-scanning consent in Phase 4C-1.

The user must invoke the dedicated bounded active-validation action for a specific verified asset. That dedicated action is the explicit active authorization event for one job. The trusted service records `active_authorized_at` and `requested_by` in the immutable job snapshot and emits an `active_validation.authorized` audit event.

The UI must clearly explain the exact fixed behavior before the action is submitted.

### 8.3 Enqueue authorization

Before queueing, the trusted application service verifies:

1. caller is authenticated
2. caller belongs to the target workspace
3. caller role is `owner` or `admin`
4. asset belongs to the workspace
5. asset kind is supported
6. asset remains verified
7. `verified_at` is present
8. canonical target and hostname satisfy runtime target policy
9. requested validator profile is exactly a known built-in profile and version
10. request originated from the dedicated active-validation action
11. no caller-controlled request configuration exists
12. budget is valid and no greater than system maxima
13. quota and active-job conflict rules permit the job

The job stores the immutable authorization snapshot.

### 8.4 Execution authorization

Immediately before DNS or network work, the trusted executor reloads the job and asset and verifies:

- job kind is `active_validation`
- job status is executable
- cancellation has not been requested
- asset still exists in the same workspace
- asset kind remains supported
- asset remains verified
- current `verified_at` exactly matches the enqueue snapshot
- canonical target exactly matches the snapshot
- hostname exactly matches the snapshot
- validator profile id/version exactly matches the snapshot
- stored budget remains valid under current maxima

Any mismatch produces a blocked terminal state and zero outbound traffic.

### 8.5 No generic active request API

No server action, service API, or package contract may accept raw arbitrary fields equivalent to:

- URL
- path
- method
- headers map
- request body
- cookie
- Authorization value
- payload string

The caller selects a known validator profile. The validator constructs the complete request plan from constants and the immutable authorized target.

## 9. Phase 4C-1 profile

The first validator profile is:

```text
cors-origin-policy@1
```

It tests whether the target explicitly permits a fixed synthetic untrusted origin.

The origin constant is:

```text
https://scopeforge.invalid
```

`.invalid` is reserved for names that must not resolve. The value is compiled into the validator profile and cannot be supplied by a user.

### 9.1 Request behavior

Exactly one request is permitted:

- method: GET
- URL: exact authorized canonical target
- fixed headers only:
  - `Accept: */*`
  - ScopeForge User-Agent
  - `Origin: https://scopeforge.invalid`
- no body
- no cookies
- no Authorization
- no proxy credentials
- no user-supplied headers
- no browser state
- no JavaScript execution

Phase 4C-1 does not send an OPTIONS preflight. A later profile may add one only after a separate design review.

### 9.2 Redirect handling

CORS v1 follows zero redirects.

A 3xx response is recorded as bounded metadata and ends the validator without evaluating the destination.

This is intentionally stricter than Phase 4B so the active synthetic Origin is never propagated through a redirect chain.

### 9.3 Response handling

Only these response properties may cross the validator boundary:

- HTTP status
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Credentials`
- `Vary`
- bounded redirect host metadata if present

TLS metadata remains available to the lower runtime-network layer for transport correctness but is not persisted as an active CORS observation unless a later design explicitly requires it.

Response bodies are destroyed without analysis.

Arbitrary response headers are not retained.

Selected header values are normalized and bounded before an active observation object is created.

## 10. Active observation contract

CORS v1 creates one normalized `cors-policy` observation containing:

- profile id: `cors-origin-policy`
- profile version: `1`
- sanitized target URL containing scheme, host, port if explicit, and path only
- response status
- ACAO presence
- bounded normalized ACAO value if present
- ACAC presence
- boolean `credentialsAllowed` only when normalized value is exactly `true`
- whether `Vary` contains the token `Origin`
- redirect returned boolean
- bounded redirect hostname when safely parseable

The observation never contains:

- response body
- Set-Cookie values
- cookie values
- Authorization values
- arbitrary headers
- query strings
- fragments
- unbounded exception text

## 11. Deterministic CORS rules

### CORS-1 - Credentialed untrusted origin allowed

Condition:

- request Origin is the fixed ScopeForge synthetic origin
- ACAO exactly equals `https://scopeforge.invalid`
- ACAC normalized value is exactly `true`

Finding:

- rule id: `runtime/cors/credentialed-untrusted-origin`
- severity: `high`
- confidence: `high`
- validation: `runtime_validated`
- source kind: existing `deterministic-runtime-scanner`
- source id: `scopeforge:runtime-validator`
- source version: validator package/profile version

Interpretation:

The server actively allowed a known untrusted origin while advertising credentialed cross-origin access. ScopeForge does not claim that useful victim credentials exist or that a specific sensitive response was exfiltrated because Phase 4C-1 does not capture response bodies or victim state.

### CORS-2 - Untrusted origin reflected without credential allowance

Condition:

- ACAO exactly equals the synthetic origin
- ACAC is absent or not exactly `true`

Finding:

- rule id: `runtime/cors/untrusted-origin-reflection`
- severity: `low`
- confidence: `high`
- validation: `runtime_validated`
- source kind: `deterministic-runtime-scanner`
- source id: `scopeforge:runtime-validator`

Interpretation:

The server allowed a known untrusted origin. The first slice does not inspect response content and therefore does not claim sensitive data exposure.

### CORS-3 - Wildcard origin

Condition:

- ACAO is `*`

Result:

Observation only. No vulnerability finding in Phase 4C-1.

Wildcard CORS is commonly intentional for public APIs and is not sufficient evidence of a vulnerability by itself.

### Vary behavior

Missing `Vary: Origin` is observation only in Phase 4C-1. Proving cache-mediated cross-user impact would require a separate validator and threat review.

## 12. Security-domain mapping

Active rule matches map directly into the existing Phase 4A security-domain.

The active mapper uses:

- source kind `deterministic-runtime-scanner`
- source id `scopeforge:runtime-validator`
- `runtime_validated` validation state
- scanner-derived provenance for the finding
- observed provenance for evidence
- bounded public-classified evidence summaries containing only normalized CORS metadata
- stable deterministic identity derived from asset ref, validator profile/version, rule id, and normalized observation key
- structured remediation

Phase 4C does not add a new source-kind enum unless later requirements prove that source id/version is insufficient to distinguish passive and active runtime sources.

## 13. Resource budgets

Phase 4C-1 system maxima are:

- requests: exactly 1
- redirects followed: 0
- concurrent requests: 1
- per-request timeout: 5 seconds
- total active execution time: 10 seconds
- retries: 0
- request body bytes: 0
- captured response body bytes: 0
- persisted normalized active observation payload: 32 KiB per job
- persisted evidence summary: 4 KiB per generated finding

Callers may tighten time and persistence limits if the shared budget contract supports tightening, but no caller can increase request count, redirect count, body allowance, or profile authority.

Budget validation occurs before DNS resolution.

DNS plus HTTPS share the request deadline. The service total deadline remains an outer bound.

## 14. Cancellation semantics

The trusted service injects a database-backed cancellation callback and, where useful, an AbortSignal into the runtime network operation.

Required cancellation boundaries:

- before first DNS resolution
- before opening the pinned HTTPS request
- after the request returns
- before deterministic rule evaluation
- before persistence
- before successful terminal transition

If cancellation becomes true after response metadata is received but before persistence, the job becomes `cancelled` and active observations/findings are not persisted.

Cancellation is never classified as generic failure.

## 15. Failure semantics

Failure codes remain stable and machine-readable.

Categories:

- authorization changed: blocked
- verification revoked: blocked
- unsupported or mismatched validator profile: blocked
- invalid stored budget: blocked
- cancellation: cancelled
- DNS/public-IP safety rejection: failed with the existing safe network classification used by runtime transport
- request timeout: failed
- total timeout: failed
- TLS/network error: failed
- observation budget exceeded: failed
- persistence conflict: failed with safe generic browser text

Raw resolver, socket, TLS, database, or framework exception text must not be persisted to audits or returned to the browser.

## 16. Persistence decision

Phase 4C extends the existing runtime job and observation model rather than adding a parallel active-job platform.

### 16.1 scan_jobs

Extend `scan_job_kind` with:

```text
active_validation
```

Add nullable columns guarded by a conditional check for active jobs:

- `validator_profile_id`
- `validator_profile_version`
- `active_authorized_at`

For `active_validation` rows these fields are required and immutable. For historical Phase 2 and Phase 4B rows they remain null.

Existing authorization snapshot fields continue to store canonical target, asset kind, verified timestamp, workspace, asset, requester, and budget.

The migration must preserve existing rows and existing Phase 4B state-transition guarantees.

### 16.2 runtime_observations

Reuse `runtime_observations` because it already provides composite workspace/job/asset integrity, bounded JSON payloads, authenticated select-only RLS, and trusted-server writes.

Extend the allowed `kind` constraint with:

```text
cors-policy
```

CORS v1 persists at most one `cors-policy` row for a successful active job.

The application repository validates that active jobs persist only active observation kinds and passive jobs persist only passive observation kinds. Tests must cover this service boundary.

No new durable finding table is introduced in Phase 4C. Findings remain deterministic in-memory outputs until the later hosted finding lifecycle provides the canonical durable repository.

## 17. Audit requirements

Required event types:

- `active_validation.authorized`
- `active_validation.enqueued`
- `active_validation.blocked`
- `active_validation.started`
- `active_validation.cancel_requested`
- `active_validation.cancelled`
- `active_validation.succeeded`
- `active_validation.failed`

Allowed bounded metadata:

- job id
- asset id
- validator profile id/version
- stable reason/failure code
- request count
- elapsed milliseconds
- finding count

Forbidden audit content:

- response bodies
- cookie values
- Authorization values
- raw Set-Cookie values
- arbitrary response headers
- query strings
- fragments
- unbounded exception text
- private resolver internals

## 18. Application and UI behavior

Passive observation and bounded active validation are visibly distinct operations.

For a verified supported asset, the asset page may expose:

- Passive observation
- Bounded active validation

The active section explains that ScopeForge sends exactly one GET request to the verified canonical target with a fixed synthetic `Origin: https://scopeforge.invalid` header and sends no credentials, cookies, request body, exploit payload, or user-defined input.

Only owner/admin users see an enabled active action.

The server action accepts only:

- asset id
- a known profile identifier if the UI supports more than one profile later

For Phase 4C-1 the profile may be server-fixed so the browser needs to submit only the asset id.

The browser never sends target URL, HTTP method, raw headers, body, cookie, credential, or payload configuration.

The result view may display:

- validator profile/version
- job status
- request count
- safe block/failure reason
- bounded CORS observation summary
- deterministic finding summaries

The UI does not perform target networking, DNS checks, authorization, or rule evaluation.

## 19. Architecture guards

CI must enforce:

### packages/runtime-validator must not import

- Next.js
- React
- Supabase
- `app/`
- `components/`
- provider SDKs
- runtime-observation application services

### packages/runtime-observer must not import

- runtime-validator
- Next.js
- React
- Supabase
- `app/`
- `components/`
- provider SDKs

### packages/runtime-network must not import

- security-domain
- runtime-validator rules
- runtime-observer rules
- Next.js
- React
- Supabase
- `app/`
- `components/`
- provider SDKs

### packages/network-safety

Retains the existing no-I/O constraint.

## 20. Test architecture

No active-validator test depends on a public internet target.

Dependency injection must model:

- allowed public DNS
- mixed public/private DNS
- empty DNS
- rebinding attempts
- DNS deadline exhaustion
- TLS/network timeout
- cancellation
- reflected synthetic origin
- credentialed reflected origin
- wildcard origin
- absent CORS headers
- malformed or oversized CORS headers
- redirects
- observation-size limits
- database cancellation during execution

Required suites:

### 20.1 runtime-network extraction

- every existing Phase 4B transport regression remains green
- fresh DNS per connection
- reject any non-public address in a resolution set
- deterministic pinning
- preserve SNI/hostname verification
- DNS included in request timeout
- abort destroys live request
- no automatic redirects

### 20.2 validator contract

- only `cors-origin-policy@1` accepted
- fixed synthetic origin only
- exact canonical target only
- GET only
- one request only
- zero redirects followed
- zero body bytes
- zero cookies/credentials
- no arbitrary header API
- response body ignored
- only bounded selected CORS metadata emitted

### 20.3 authorization service

- verified asset alone is insufficient for member/viewer roles
- owner/admin active action authorizes one job
- workspace mismatch blocks before DNS
- stale verification blocks before DNS
- changed canonical target blocks before DNS
- profile/version mismatch blocks before DNS
- pre-start cancellation prevents network
- cancellation during execution prevents persistence

### 20.4 CORS rules and mapping

- credentialed untrusted-origin reflection produces high-confidence high-severity `runtime_validated` finding
- non-credentialed reflection produces low-severity `runtime_validated` finding
- wildcard alone produces no finding
- missing Vary alone produces no finding
- stable identities
- bounded evidence summaries
- no body or secret-bearing text in evidence

### 20.5 persistence and RLS

- `active_validation` job snapshot fields required and immutable
- historical rows remain valid
- valid job transitions only
- composite workspace/asset/job integrity
- authenticated clients remain read-only
- `cors-policy` payload bounded
- active jobs cannot persist passive-only observation kinds through the trusted repository API
- passive jobs cannot persist active-only kinds through the trusted repository API

### 20.6 UI

- unverified assets cannot run active validation
- repository assets unsupported
- member/viewer active action disabled or absent
- owner/admin see the explicit bounded active action
- passive and active actions are visually distinct
- browser cannot supply arbitrary request primitives
- cancellation and terminal states render safely

### 20.7 architecture

- runtime-validator dependency guard
- runtime-network dependency guard
- existing runtime-observer guard remains green
- existing security-domain and network-safety guards remain green

## 21. Security review checklist

No implementation PR may merge until the full changed-file set is reviewed for:

- explicit active authorization separate from verification
- owner/admin role restriction
- authorization before every network path
- immutable enqueue snapshot
- execution-time reauthorization
- exact canonical target and hostname boundary
- HTTPS only
- port 443 only
- fixed validator-generated input only
- no arbitrary request API
- fresh DNS resolution
- reject mixed public/private DNS results
- DNS rebinding protection
- IP pinning
- SNI/certificate hostname preservation
- DNS included in request deadline
- total runtime budget
- exactly one request for CORS v1
- zero redirects followed
- cancellation between operations
- no request body
- no cookies or credentials
- no response-body persistence
- bounded selected-header handling
- no query/fragment persistence
- stable failure codes
- bounded audit metadata
- trusted-server-only writes
- workspace-bound persistence
- no UI-side networking or authorization duplication
- passive runtime behavior unchanged
- dependency guards passing

## 22. Non-goals

Phase 4C-1 does not add:

- arbitrary URL probing
- user-defined paths
- user-defined headers
- request bodies
- POST, PUT, PATCH, or DELETE
- browser automation
- JavaScript execution
- broad crawling
- sitemap traversal
- endpoint discovery
- generalized fuzzing
- SQL injection payloads
- XSS payloads
- command injection payloads
- SSRF payloads
- file inclusion payloads
- path traversal payloads
- file uploads
- CSRF exploitation
- authentication replay
- credential stuffing
- password spraying
- token replay
- authenticated API scanning
- GraphQL attack probing
- WebSocket active testing
- denial-of-service behavior
- persistence on targets
- exploit frameworks
- autonomous agents
- model-generated payloads
- arbitrary executable community validators

Each later active validator requires its own bounded profile, explicit authorization semantics, resource budget, deterministic tests, and threat review.

## 23. Delivery slices

### Phase 4C-0 - Design and transport factoring

- land this design through a design-only PR
- write the implementation plan after design review
- extract behavior-preserving `packages/runtime-network`
- migrate Phase 4B observer transport to the shared package
- keep every Phase 4B test green
- add dependency guards before active behavior

### Phase 4C-1 - Active validator core

- add active validator contracts and profile registry
- implement `cors-origin-policy@1`
- add deterministic observation and CORS rules
- add security-domain mapping
- prove no arbitrary request construction path exists

### Phase 4C-2 - Trusted active job orchestration

- extend `scan_job_kind` with `active_validation`
- add immutable validator profile snapshot fields
- extend runtime observations with `cors-policy`
- add owner/admin explicit active authorization
- add execution-time reauthorization
- add cancellation, audit, stable failure handling, and bounded persistence

### Phase 4C-3 - Minimal asset UI

- add bounded active-validation action for verified web/API assets
- display profile, safe status, observations, and deterministic findings
- keep passive observation UI and semantics separate

### Later profiles

Only after CORS v1 is merged and reviewed should ScopeForge select another active profile. Selection should optimize security value per unit of additional authority, not feature count.

## 24. Completion criteria

Phase 4C-1 architecture is complete only when:

- runtime-network extraction preserves Phase 4B behavior
- passive runtime package remains passive
- active validator accepts only known versioned profiles
- active authorization is distinct from proof-of-control verification
- only owner/admin can authorize CORS v1 jobs
- CORS v1 uses the fixed synthetic origin and exact canonical target
- exactly one GET request is sent
- redirects are never followed
- every connection is freshly DNS-classified and pinned
- DNS and HTTPS share one enforced deadline
- cancellation can stop execution before persistence
- no request body, cookie, credential, arbitrary header, or response body enters the active path
- persisted active observations are bounded and contain no query/fragment data
- deterministic findings use the existing security-domain with `runtime_validated`
- browser clients remain read-only for runtime state
- application service owns workspace authorization and persistence
- new dependency guards pass
- all existing Phase 2, Phase 3, Phase 4A, and Phase 4B tests remain green
- the exact final implementation PR head passes the complete repository gate
- final security diff review finds no blocking issue

## 25. Required repository gate

Every implementation PR must pass on its exact final head:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

No earlier green checkpoint may substitute for the final exact-head gate.

## 26. Later worker boundary

Phase 4C does not declare worker-scale hardening complete.

Phase 6 must place runtime execution behind production-grade isolated workers with dedicated egress controls, concurrency/backpressure, operational telemetry, private artifact boundaries, and abuse controls.

That move must reuse the versioned active validator profiles and shared runtime-network safety primitives without widening target policy or introducing arbitrary request authority.

# Phase 4C Bounded Active Validation Design

Date: 2026-08-25
Status: Approved for implementation

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
- DNS/public-IP safety rejection: failed with the bounded runtime safety code
- timeout: failed with the bounded timeout code
- transport/TLS failure: failed with the bounded transport code
- persistence failure: failed with a stable persistence/execution code

Raw Node, DNS, TLS, Supabase, Postgres, or stack-trace text is not browser or audit metadata.

## 16. Persistence design

Phase 4C extends the existing runtime job model instead of creating a disconnected queue.

`scan_jobs` gains job kind:

```text
active_validation
```

Active jobs reuse the existing authorization snapshot fields and add:

- `validator_profile_id`
- `validator_profile_version`
- `active_authorized_at`

The database migration enforces:

- active profile fields are present for active jobs
- authorization fields are immutable after insert
- legal status transitions remain enforced
- count fields remain non-negative
- budget JSON remains bounded
- browser roles cannot write job state directly

`runtime_observations` gains observation kind:

```text
cors-policy
```

Its existing composite job/workspace/asset foreign-key boundary and select-only authenticated access remain intact.

Active CORS observations retain the same per-row database payload cap and additionally obey the stricter 32 KiB job-level budget.

No response body or private artifact storage is introduced.

## 17. Service and audit lifecycle

The active-validation service emits bounded audit events:

- `active_validation.authorized`
- `active_validation.enqueued`
- `active_validation.blocked`
- `active_validation.started`
- `active_validation.cancel_requested`
- `active_validation.cancelled`
- `active_validation.succeeded`
- `active_validation.failed`

Audit metadata may include:

- job id
- asset id/kind
- profile id/version
- status
- request count
- finding count
- stable failure/reason code

Audit metadata must not include:

- raw response headers
- cookies
- Authorization material
- query secrets
- response bodies
- raw exception text

## 18. UI contract

The asset page separates two capabilities:

### Passive observation

Existing Phase 4B behavior remains available to the same roles allowed in Phase 4B.

### Bounded active validation

The active panel:

- appears only for supported verified assets
- explains that the action sends one fixed unauthenticated CORS request
- displays profile `cors-origin-policy@1`
- displays the exact fixed synthetic Origin value
- shows that no body, credentials, cookies, arbitrary headers, or redirects are used
- permits owner/admin to authorize one job
- does not expose arbitrary request fields
- displays job status, stable failure reason, request count, finding count, and normalized CORS evidence
- supports cancellation through trusted server actions when a job is mutable

The browser action sends only the asset identifier necessary to select the server-side asset and built-in profile.

## 19. Testing strategy

Implementation is TDD-first.

### Active authorization tests

Prove:

- unauthenticated denied
- viewer denied
- member denied for active jobs
- owner/admin accepted
- cross-workspace asset denied
- repository asset denied
- unverified asset denied
- changed target/hostname/kind/verified_at blocks before network
- unknown profile/version blocks before network
- invalid stored budget blocks before network
- cancellation requested before start produces zero network traffic

### Request authority tests

Prove:

- only exact canonical target is used
- method is GET
- only fixed request headers are emitted
- arbitrary URL/path/header/method/body cannot be supplied through exported public APIs
- synthetic Origin is constant
- zero redirects are followed
- zero request bodies are sent
- zero credentials/cookies are sent

### Network-safety tests

Prove:

- HTTPS/443 only
- fresh DNS per connection
- empty DNS rejected
- any private/reserved/invalid DNS answer rejects the whole request
- pinning uses the selected public IP
- original hostname remains Host/SNI/certificate target
- DNS time consumes request timeout
- HTTPS sees only remaining timeout
- outer deadline aborts active HTTPS

### Observation and privacy tests

Prove:

- response body is not returned or persisted
- only selected CORS headers affect active observation
- query and fragment are removed from persisted target URL
- Set-Cookie and arbitrary headers are not retained
- header values are bounded
- observation budget is enforced

### Rule and mapping tests

Prove:

- credentialed synthetic-origin allowance -> high finding
- synthetic-origin reflection without credentials -> low finding
- wildcard ACAO -> no finding
- missing Vary -> no finding
- active finding validation is `runtime_validated`
- source id/version distinguishes active validator
- evidence summary is bounded
- identities are deterministic

### Cancellation tests

Prove cancellation:

- before DNS
- after response before rule evaluation
- after validation before persistence
- before terminal success

No observation/finding is persisted after cancellation.

### Architecture tests

Prove:

- network-safety remains pure
- runtime-network owns Node network I/O but no application/framework/database dependencies
- runtime-observer remains independent of runtime-validator
- runtime-validator has no Next.js/React/Supabase/application imports
- UI never imports low-level runtime-network transport

### Regression gate

Run:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

## 20. Delivery sequence

Implementation should remain reviewable in this order:

1. behavior-preserving `runtime-network` extraction
2. pure active-validator contracts and CORS profile
3. deterministic CORS rules and security-domain mapping
4. database migration and trusted repository adapter
5. active authorization and execution service
6. dedicated server action and UI panel
7. architecture/security regression guards
8. permanent documentation and exact-head CI/security review

Every production change begins with a failing regression or contract test. The transport extraction itself starts with moved/duplicated contract tests proving behavior parity before the old implementation is removed.

## 21. Non-goals

Phase 4C-1 does not include:

- crawling
- site maps
- endpoint discovery
- OPTIONS preflight
- user-supplied origins
- SQL injection probes
- XSS probes
- SSRF probes
- file/path discovery
- arbitrary request methods
- arbitrary request headers
- request bodies
- cookie replay
- credential use
- authenticated testing
- browser automation
- JavaScript execution
- fuzzing
- credential attacks
- exploit confirmation
- denial-of-service behavior
- persistence on targets
- cross-host redirect following
- generalized DAST
- worker fleet scale
- dedicated egress infrastructure
- automatic remediation
- AI/model calls

A later validator must receive its own design/security review before widening this list.

## 22. Acceptance criteria

Phase 4C-1 is complete only when:

1. the CORS validator cannot be used as a generic HTTP client
2. active authorization is explicit and owner/admin-only
3. execution reauthorization occurs before network activity
4. exact target and profile snapshots are immutable
5. network safety survives extraction with Phase 4B tests green
6. DNS and HTTPS share the deadline and all DNS results must be public
7. only one request can occur and no redirects are followed
8. no request or response body is buffered
9. only bounded CORS metadata is persisted
10. cancellation suppresses later persistence
11. findings use conservative deterministic semantics and `runtime_validated`
12. browser/database write boundaries remain trusted-service-only
13. passive and active package dependency boundaries are enforced by tests
14. full repository tests, typecheck, CLI build/version smoke, scanner benchmark, and Next.js build pass
15. permanent docs accurately distinguish completed 4C-1 from later worker-scale and broader active testing

Only after these criteria are satisfied may the implementation PR merge.

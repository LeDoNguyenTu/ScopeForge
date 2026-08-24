# Phase 4C Bounded Active Validation Design

Date: 2026-08-25
Status: Approved design direction

## 1. Purpose

Phase 4C introduces the first narrowly active remote security validation capability in ScopeForge.

The phase must preserve the authorization, target-transition, DNS/IP safety, timeout, cancellation, evidence, audit, and persistence guarantees established by Phase 4B. It must not turn the control plane into a general-purpose request proxy, crawler, exploit engine, fuzzing platform, credential tester, or arbitrary internet scanner.

The first active slice is intentionally small: a deterministic CORS origin-policy validator for a verified web or API asset. ScopeForge sends a fixed synthetic Origin header to the exact authorized HTTPS target and evaluates only bounded response metadata. It sends no request body, no cookies, no credentials, no user-controlled headers, no exploit payloads, and no arbitrary paths.

Phase 4C is an active-validation architecture boundary, not an excuse to widen the passive observer. Passive and active execution remain separate capabilities with separate contracts and authorization semantics.

## 2. Design principles

Phase 4C follows these principles:

1. Active authority is explicit and separate from proof-of-control verification.
2. Every active request is deterministic and generated from a versioned validator profile.
3. User input cannot become arbitrary method, URL, path, header, body, credential, or payload input.
4. The exact verified asset hostname remains the authorization boundary.
5. Every outbound connection repeats fresh DNS resolution, public-IP classification, and IP pinning.
6. DNS time is part of the request and total execution deadline.
7. Cancellation is observable between network operations and before persistence.
8. Response bodies remain uncaptured and unpersisted in the first active slice.
9. Active observations map into the existing Phase 4A security-domain instead of creating a competing finding model.
10. Passive runtime behavior remains structurally independent from active validators.
11. Worker fleet, queue scale, dedicated egress infrastructure, and backpressure remain later delivery concerns unless a Phase 4C implementation proves they are required for correctness.
12. A successful policy probe is not automatically proof of practical data exfiltration or exploitability. Finding language and severity must match what was actually demonstrated.

## 3. Architecture decision

Three approaches were considered.

### Option A - Add active checks directly to packages/runtime-observer

This would reuse the Phase 4B package by allowing additional methods or headers inside the passive observer.

Rejected.

`packages/runtime-observer` has a deliberately passive security contract. Adding active request profiles there would mix two authorities and make later review harder. A passive refactor could accidentally widen active behavior, or an active feature could silently broaden the passive package.

### Option B - Separate runtime-validator and shared runtime-network packages

Selected.

A new framework-independent `packages/runtime-validator` package owns active validator contracts, versioned profiles, active observation types, deterministic evaluation, and security-domain mapping.

A new `packages/runtime-network` package owns the reusable outbound network primitive extracted from the already hardened Phase 4B transport path. It performs DNS resolution, public-IP validation, deterministic address selection, IP-pinned HTTPS requests, TLS identity preservation, end-to-end request deadlines, and bounded response metadata extraction needed by its callers.

`packages/runtime-observer` remains passive and depends on `runtime-network` for transport rather than owning the transport internals itself.

Trusted application services remain outside both packages and own workspace authorization, explicit active consent, job state, persistence, cancellation state, audit records, quotas, and orchestration.

### Option C - Build isolated worker infrastructure before active validation

Deferred.

Isolated workers and dedicated egress policy remain important production-scale controls, but they do not define what active behavior ScopeForge is allowed to perform. Building the worker fleet first would enlarge the delivery surface before the active capability contract is stable and testable.

The active validator interface must be deterministic enough that a later worker can invoke it without widening authority.

## 4. Layering and dependency direction

The intended dependency direction is:

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

- `packages/security-domain` stays pure and must never import runtime packages.
- `packages/network-safety` stays pure and performs no DNS, HTTP, TLS, database, filesystem, environment, process, or framework I/O.
- `packages/runtime-network` may use Node DNS/HTTPS/TLS APIs, but it must not import Next.js, React, Supabase, application actions, components, or model-provider SDKs.
- `packages/runtime-observer` remains passive and must not import `runtime-validator`.
- `packages/runtime-validator` must not import Next.js, React, Supabase, application actions, components, provider SDKs, or passive UI code.
- Application services are the only layer allowed to bind validator execution to workspace, asset, user, job, persistence, and audit state.
- UI code never decides that a target or active action is authorized.

## 5. Shared runtime-network boundary

Phase 4C should extract the already reviewed transport logic from `packages/runtime-observer` into `packages/runtime-network` with no behavioral widening.

The shared network package owns only low-level outbound safety mechanics:

- HTTPS only
- port 443 only
- GET-only support for the first extraction unless a later approved validator explicitly needs another safe method
- no request body support in Phase 4C-1
- caller-supplied URL must already be policy-approved by the caller
- fresh DNS resolution before every connection
- reject empty DNS answers
- normalize and de-duplicate resolved addresses
- reject the request if any resolved address is non-public or invalid
- deterministic public address selection
- socket lookup pinned to the selected address
- original hostname preserved for Host/SNI/certificate verification
- automatic redirects disabled
- end-to-end deadline covering DNS plus HTTPS request
- AbortSignal support so the underlying request can be destroyed on cancellation or deadline
- bounded normalized response headers only
- no response-body buffering or persistence

The extraction must be proven behavior-preserving through existing Phase 4B tests plus new architecture guards. Phase 4C must not weaken or rewrite the successful Phase 4B security semantics as a side effect of code reuse.

## 6. Active target contract

Phase 4C-1 supports only assets already verified through the Phase 2 proof-of-control flow and already eligible for Phase 4B runtime observation:

- `web_application`
- `api`

Repository assets remain on the local Phase 3 scanner path.

The authorized active target contains:

- workspace id
- asset id
- asset ref
- asset kind
- canonical URL snapshot
- canonical hostname
- verification timestamp snapshot
- active validation profile id
- active validation profile version
- explicit active authorization timestamp
- requesting actor id

The canonical URL remains the only request target in Phase 4C-1. The CORS validator must not discover or derive additional paths.

Every outbound URL must satisfy:

- scheme `https:`
- port absent or `443`
- exact verified hostname match
- no username/password
- no fragment
- path derived only from the immutable canonical target
- query derived only from the immutable canonical target, never validator or user input

Cross-host redirects are never authorization to validate another host.

## 7. Explicit active authorization

Proof of control is necessary but insufficient for active validation.

A verified asset proves that the workspace controls or is authorized to manage the asset. Phase 4C additionally requires an explicit active-validation consent action because active requests intentionally vary request metadata.

### 7.1 Enqueue authorization

Before a job can be queued, the trusted application service must verify:

1. caller is authenticated
2. caller belongs to the target workspace
3. caller role is allowed to request active validation
4. asset belongs to the workspace
5. asset kind is supported
6. asset remains verified
7. `verified_at` is present
8. canonical target and hostname are valid under existing runtime policy
9. requested validator profile is a known built-in profile and version
10. caller explicitly requested active validation rather than passive observation
11. no caller-controlled request configuration is present
12. budget is valid and no greater than system maxima
13. quota and active-job conflict rules permit the job

The job stores an immutable authorization snapshot.

### 7.2 Execution authorization

Immediately before DNS or network work, the trusted executor reloads the job and asset and verifies:

- job is the expected active-validation job kind
- status is executable
- cancellation has not been requested
- asset still exists in the same workspace
- asset kind remains supported
- asset remains verified
- current `verified_at` exactly equals the enqueue snapshot
- canonical target exactly equals the enqueue snapshot
- hostname exactly equals the enqueue snapshot
- active validator profile id/version exactly equals the snapshot
- stored budget is still valid under current system maxima

Any mismatch produces a blocked terminal state and zero outbound traffic.

### 7.3 No generic active request API

No application action or package contract may accept a structure equivalent to:

- arbitrary URL
- arbitrary path
- arbitrary HTTP method
- arbitrary headers
- arbitrary request body
- arbitrary cookie
- arbitrary Authorization value
- arbitrary payload string

The caller selects a known validator profile. The validator itself constructs the complete active request variation from constants and the authorized target.

## 8. Phase 4C-1 validator profile

The first validator is:

`cors-origin-policy@1`

Its purpose is to determine whether the target reflects or explicitly allows a fixed untrusted origin in a security-relevant CORS configuration.

The fixed synthetic origin is:

```text
https://scopeforge.invalid
```

`.invalid` is reserved for names that must not resolve and therefore cannot identify a real external site.

The value is compiled into the validator profile and cannot be supplied by the user.

### 8.1 Request behavior

The first request is:

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

A second request is permitted only if required by the final approved deterministic CORS algorithm. Phase 4C-1 should avoid preflight unless the rule cannot be evaluated safely without it.

The default design is one GET request because a simple-origin request is sufficient to observe the most important credentialed reflection patterns without introducing OPTIONS-specific policy ambiguity.

### 8.2 Redirect handling

For Phase 4C-1, the CORS validator does not follow redirects.

A redirect response is recorded as bounded metadata and terminates the validator successfully without evaluating the destination.

This is stricter than Phase 4B and avoids creating an active-input propagation chain through redirect hops. A later validator may explicitly support same-host redirects only after a separate design review.

### 8.3 Response handling

Only the following metadata may cross the validator boundary:

- HTTP status
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Credentials`
- `Vary`
- bounded redirect metadata if present
- TLS metadata already available through runtime-network when useful for audit/debugging

Response body bytes are neither buffered for analysis nor persisted.

Arbitrary response headers are not retained.

Header values are normalized and bounded before creating an observation object.

## 9. CORS observations

The validator produces normalized observations rather than findings directly.

Initial observation shape should capture:

- profile id/version
- target path identifier without query/fragment secrets
- response status
- whether ACAO is present
- normalized ACAO value if present and bounded
- whether ACAC is present
- normalized boolean interpretation of ACAC
- whether `Vary` includes `Origin`
- whether a redirect was returned
- bounded redirect host metadata without query or fragment

No response body, Set-Cookie value, cookie value, Authorization value, arbitrary header, or unbounded text is stored.

## 10. Deterministic CORS rules

The first rule set should be conservative.

### Rule CORS-1 - Untrusted origin explicitly allowed with credentials

Condition:

- request Origin is the fixed ScopeForge synthetic origin
- response `Access-Control-Allow-Origin` exactly equals that synthetic origin
- response `Access-Control-Allow-Credentials` is `true`

Interpretation:

The server actively allowed a known untrusted origin while advertising credentialed cross-origin access.

This is a strong policy weakness, but ScopeForge still has not proved that a victim possesses useful credentials, that sensitive data is returned, or that a browser can successfully exfiltrate a particular response. The finding must state exactly what was observed.

Suggested initial severity: high
Suggested confidence: high
Validation: active_observed or the closest approved security-domain validation vocabulary available after design review

### Rule CORS-2 - Untrusted origin explicitly reflected without credential allowance

Condition:

- ACAO exactly equals the synthetic origin
- ACAC is absent or not true

Interpretation:

The server reflects or allows an untrusted origin. This may expose non-credentialed cross-origin data depending on endpoint behavior, but the first slice does not inspect response bodies.

Suggested initial severity: low or medium depending on existing domain conventions
Suggested confidence: high

The implementation plan must choose one severity deterministically before code is written.

### Rule CORS-3 - Wildcard origin

Condition:

- ACAO is `*`

Interpretation:

Wildcard CORS is not automatically a vulnerability. Many public APIs intentionally permit it.

Default behavior: observation only, no security finding in Phase 4C-1.

### Vary behavior

Missing `Vary: Origin` may be security relevant for dynamically reflected origins behind shared caches, but proving cache poisoning or cross-user exposure requires more context than Phase 4C-1 collects.

Default behavior: observation only, not a finding.

## 11. Resource budgets

Active validation starts with a stricter maximum than passive observation.

System maxima for Phase 4C-1:

- validator requests: 1 by default, hard maximum 2
- redirects followed: 0
- concurrent requests: 1
- per-request timeout: 5 seconds
- total validator execution time: 10 seconds
- retries: 0
- request body bytes: 0
- captured response body bytes: 0
- persisted normalized observation payload: 32 KiB per active job
- persisted evidence summary: 4 KiB per generated finding

Callers may tighten budgets but cannot widen them beyond these maxima.

Budget validation occurs before DNS resolution.

DNS resolution and HTTPS request time are both included in the request deadline and total execution deadline.

## 12. Cancellation semantics

Cancellation remains cooperative but must be checked at every safe boundary.

The trusted service injects a database-backed cancellation callback or signal.

Required cancellation boundaries:

- before first DNS resolution
- after DNS resolution and before socket creation if the architecture exposes that boundary
- after the request completes
- before any optional second network operation
- before rule evaluation if expensive processing is ever introduced
- before persistence
- before successful terminal transition

If cancellation becomes true after a response is received but before persistence, the job becomes `cancelled` and active observations/findings are not persisted.

Cancellation is never stored as a generic failure.

## 13. Failure semantics

Failure codes remain stable and machine-readable.

Phase 4C should reuse shared runtime-network failure classification where it accurately describes the failure and introduce active-specific codes only where necessary.

Categories include:

- authorization changed or revoked: blocked
- cancellation requested: cancelled
- invalid validator profile: blocked
- invalid stored budget: blocked
- DNS/public-IP policy denial: failed or blocked according to the existing runtime convention selected by the implementation plan
- request timeout: failed
- total timeout: failed
- TLS/network error: failed
- observation budget exceeded: failed
- persistence conflict: failed with safe generic browser-facing text

Raw resolver, socket, TLS, database, or framework exception text must not be persisted to audit metadata or returned to the browser.

## 14. Persistence model

Phase 4C should evolve the existing runtime job system instead of creating a disconnected active-job platform.

The implementation plan should prefer one of these compatible approaches:

- extend `scan_job_kind` with a bounded active-validation job kind and add immutable validator profile fields, or
- introduce a narrowly typed runtime security job discriminator if enum evolution shows material migration risk

The selected migration must preserve existing Phase 2 and Phase 4B rows and constraints.

The immutable snapshot for an active job includes at minimum:

- workspace id
- asset id
- requested actor
- canonical target
- hostname
- asset kind
- verification timestamp
- validator profile id
- validator profile version
- active authorization timestamp
- budget

Active observations may use the existing normalized runtime observation table only if the schema can distinguish passive and active observation contracts unambiguously and all constraints remain safe. Otherwise a dedicated `active_runtime_observations` table is acceptable.

The implementation plan must choose one persistence route explicitly before coding.

Authenticated browser clients remain read-only for runtime job and observation state. Trusted server adapters own writes.

Durable product findings should continue to wait for the hosted finding lifecycle unless that lifecycle already exists when Phase 4C implementation begins. Phase 4C must not create a competing permanent finding table.

## 15. Audit requirements

Active execution requires explicit auditability.

Events should include:

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
- asset id
- validator profile id/version
- stable reason/failure code
- request count
- elapsed milliseconds
- finding count

Audit metadata must not include:

- response bodies
- cookie values
- Authorization values
- raw Set-Cookie values
- arbitrary response headers
- DNS resolver internals beyond deliberately bounded public diagnostic metadata
- query secrets
- fragments
- unbounded exception strings

## 16. Application and UI behavior

Passive observation and bounded active validation must be visibly distinct operations.

For a verified supported asset, the UI may expose:

- Passive observation
- Bounded active validation

The active action explains that ScopeForge will send a fixed synthetic cross-origin request to the verified canonical target and will not send credentials, cookies, request bodies, exploit payloads, or user-defined input.

The user selects the active-validation action, not a request configuration form.

The server action receives only the asset identifier and known profile identifier needed for the approved workflow. It must not accept arbitrary URL/method/header/body parameters from the browser.

The result view may show:

- validator profile and version
- job status
- request count
- safe failure/block reason
- bounded CORS policy observations
- deterministic finding summaries

The UI does not perform DNS, fetch target data directly, authorize execution, construct custom security payloads, or duplicate rule logic.

## 17. Architecture guards

CI must make the active/passive separation executable.

Required guard rules:

`packages/runtime-validator` must not import:

- Next.js
- React
- Supabase
- app/
- components/
- provider SDKs
- runtime-observation application service modules

`packages/runtime-observer` must not import:

- runtime-validator
- Next.js
- React
- Supabase
- app/
- components/
- provider SDKs

`packages/runtime-network` must not import:

- security-domain
- runtime-validator
- runtime-observer policy/rules
- Next.js
- React
- Supabase
- app/
- components/
- provider SDKs

`packages/network-safety` retains its existing no-I/O constraint.

## 18. Test architecture

No active-validator test may depend on a public internet target.

Dependency injection must allow deterministic fixtures for:

- allowed public DNS
- mixed public/private DNS
- empty DNS
- DNS rebinding attempts
- DNS deadline exhaustion
- TLS/network timeout
- request cancellation
- reflected synthetic origin
- credentialed reflected origin
- wildcard origin
- absent CORS headers
- malformed or oversized CORS header values
- redirect responses
- observation-size limits
- database cancellation during execution

Required test families:

### 18.1 Shared runtime-network regression

- all existing Phase 4B transport behavior remains green after extraction
- fresh DNS for every connection
- reject any non-public address in a resolution set
- deterministic pinning
- preserve SNI/hostname verification
- DNS included in request timeout
- cancellation destroys the live request
- no automatic redirect following

### 18.2 Validator contract

- exact known profile only
- fixed synthetic origin only
- no arbitrary method/header/body/url input
- one exact canonical target
- redirect not followed
- zero cookies/credentials
- response body ignored
- normalized bounded CORS metadata only

### 18.3 Authorization service

- verification alone is insufficient without active action authorization
- workspace mismatch blocks before network
- stale verification blocks before network
- changed canonical target blocks before network
- profile/version mismatch blocks before network
- cancellation before start prevents network
- cancellation during execution prevents persistence

### 18.4 Finding mapping

- credentialed untrusted-origin reflection maps deterministically
- non-credentialed reflection maps conservatively
- wildcard alone does not generate a vulnerability finding
- evidence and finding identifiers are stable
- evidence summaries are bounded
- no response body or secret-bearing text enters evidence

### 18.5 Database and RLS

- immutable active authorization snapshot
- valid state transitions only
- composite workspace/asset/job integrity
- authenticated clients remain read-only
- bounded payload constraints

### 18.6 UI

- active validation unavailable for unverified assets
- repository assets unsupported
- active action clearly distinct from passive observation
- browser cannot supply arbitrary target or request parameters
- cancellation and safe terminal states render correctly

### 18.7 Architecture

- active/passive/network package dependency guards
- existing security-domain and network-safety guards remain green

## 19. Security review checklist

A Phase 4C implementation must not merge until the complete changed-file set has been reviewed for:

- explicit active authorization separate from verification
- authorization before every network path
- immutable enqueue snapshot
- execution-time reauthorization
- exact canonical hostname boundary
- HTTPS-only and port-443-only behavior
- fixed validator-generated input only
- no arbitrary request API
- fresh DNS resolution
- rejection of mixed public/private resolution sets
- DNS rebinding protection
- IP pinning
- SNI/certificate hostname preservation
- DNS included in request deadline
- total runtime deadline
- zero redirects followed for CORS v1
- cancellation between operations
- no request body
- no cookies or credentials
- no response-body persistence
- bounded selected-header handling
- no query/fragment secret persistence
- stable failure codes
- bounded audit metadata
- trusted-server-only writes
- workspace-bound persistence
- no UI-side networking or authorization duplication
- passive runtime observer behavior unchanged
- architecture guards passing

## 20. Non-goals

Phase 4C-1 does not add:

- arbitrary URL probing
- user-defined request paths
- user-defined headers
- request bodies
- POST/PUT/PATCH/DELETE requests
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
- file upload tests
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
- arbitrary community executable validators

Each later active validator requires its own bounded profile, explicit authorization semantics, resource budget, deterministic tests, and threat review.

## 21. Delivery slices

### Phase 4C-0 - Design and transport factoring

- commit this approved design
- write implementation plan after spec review
- extract behavior-preserving `packages/runtime-network`
- migrate Phase 4B observer transport to the shared package
- keep all Phase 4B tests green
- add architecture guards before active behavior

### Phase 4C-1 - Active validator core

- add active validator contracts and profile registry
- implement `cors-origin-policy@1`
- add deterministic observations and CORS rules
- add security-domain mapping
- prove no arbitrary request construction path exists

### Phase 4C-2 - Trusted active job orchestration

- evolve job persistence for active profile snapshots
- add explicit active authorization service
- add execution-time reauthorization
- add cancellation, audit, stable failure handling, and bounded persistence

### Phase 4C-3 - Minimal asset UI

- add bounded active-validation action for verified web/API assets
- display profile, safe status, observations, and deterministic finding summaries
- keep passive observation UI and semantics separate

### Later active profiles

Only after CORS v1 is merged and reviewed should ScopeForge consider another narrow active validator. The next validator must be selected for high security value and minimal authority, not simply because it is easy to implement.

## 22. Completion criteria

Phase 4C-1 architecture is complete only when:

- `runtime-network` extraction preserves Phase 4B behavior
- passive runtime package remains passive
- active validator accepts only known versioned profiles
- active authorization is distinct from proof-of-control verification
- CORS v1 uses the fixed synthetic origin and exact authorized target
- redirects are not followed
- every connection is freshly DNS-classified and pinned
- DNS and HTTPS share one enforced deadline
- cancellation can stop execution between network boundaries and before persistence
- no request body, cookie, credential, arbitrary header, or response body enters the active path
- persisted observations are bounded and redact query/fragment secrets
- deterministic findings use the existing security-domain
- browser clients remain read-only for runtime state
- application service owns workspace authorization and persistence
- all new dependency guards pass
- all existing Phase 2, Phase 3, Phase 4A, and Phase 4B tests remain green
- the exact final implementation PR head passes the complete repository CI gate
- final security diff review finds no blocking issue

## 23. Required repository gate

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

## 24. Later worker boundary

Phase 4C does not declare worker-scale hardening complete.

A later phase must place runtime execution behind production-grade isolated workers with dedicated egress controls, concurrency/backpressure, operational telemetry, private artifact boundaries, and abuse controls.

That later move must reuse the active validator profile contracts and the shared runtime-network safety primitives without widening target policy or introducing arbitrary request authority.

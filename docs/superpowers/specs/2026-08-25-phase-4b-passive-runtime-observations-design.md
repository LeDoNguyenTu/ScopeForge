# Phase 4B Verified Passive Runtime Observations Design

Date: 2026-08-25
Status: Approved continuation from the Phase 4 roadmap

## 1. Purpose

Phase 4B adds the first authorized runtime and API observations to ScopeForge without turning the product into a crawler, exploit engine, or unrestricted request proxy.

The phase must reuse the Phase 4A `security-domain` contracts and the Phase 2 proof-of-control boundary. Runtime execution is an edge concern. It must not move network access, database access, or framework dependencies into `packages/security-domain`.

The first implementation is intentionally narrow. It observes directly reachable HTTPS response and TLS properties for a verified web or API asset, applies deterministic safety and resource limits, records auditable execution decisions, and maps rule-backed runtime findings into the existing product security domain.

## 2. Architecture decision

Three implementation directions were considered.

### Option A - Generalize the Phase 2 verification fetcher into the runtime scanner

This would reuse the existing DNS pinning and HTTPS code directly from `lib/assets/verification.ts`.

Rejected because proof-of-control verification and runtime observation have different responsibilities, response handling, budgets, redirect semantics, and audit requirements. Expanding the verification helper would make Phase 2 identity control logic own Phase 4 execution behavior.

### Option B - Add a dedicated runtime observer package and extract only reusable network safety primitives

This is the selected design.

A framework-independent `packages/network-safety` package owns pure public-network classification and deterministic resolved-address validation. Phase 2 verification and the new runtime observer both depend on it.

A separate `packages/runtime-observer` package owns runtime execution contracts, budgets, target-transition policy, DNS-pinned HTTPS transport, passive observation extraction, redaction, and deterministic mapping into `security-domain`.

Application services remain outside these packages and own workspace authorization, verified-asset checks, persistence, audit records, cancellation state, and orchestration.

### Option C - Build a production queue and isolated worker first

Deferred. A worker and queue are important later, but adding infrastructure before the safety contract would create a larger attack surface and make the execution semantics harder to review. Phase 4B first makes the worker-facing execution interface deterministic and testable. A later worker can call the same application service without changing the domain model.

## 3. Layering

The dependency direction is:

```text
Next.js UI / server actions / future worker
                  |
                  v
     runtime application services
        |                    |
        v                    v
runtime-observer        persistence/audit adapters
        |
        +-----> network-safety
        |
        +-----> security-domain

Phase 2 verification -----> network-safety
```

Rules:

- `packages/security-domain` remains pure and never imports runtime packages.
- `packages/network-safety` performs no DNS, socket, HTTP, filesystem, environment, database, or framework work.
- `packages/runtime-observer` may use Node networking APIs but does not import Next.js, React, Supabase, application actions, or UI code.
- Supabase rows are persistence records, not security-domain objects.
- Application services perform authorization before enqueue and again immediately before execution.
- UI code never decides whether a target is authorized or network-safe.

## 4. Scope

Phase 4B supports verified `web_application` and `api` assets only.

The first runtime observation slice supports:

- HTTPS only
- port 443 only
- one canonical asset target
- sequential connections only
- same-host redirects only
- a maximum of 3 followed redirects
- GET requests only
- no request body
- no authentication material
- no cookie jar
- no user-supplied headers
- no link discovery
- no endpoint crawling
- no form submission
- no JavaScript execution
- no fuzzing
- no exploit payloads
- no credential testing
- no destructive behavior

Repository assets remain on the Phase 3 local scanner path.

## 5. Authorization lifecycle

Authorization is checked twice because enqueue authorization can become stale before execution.

### 5.1 Enqueue gate

The server-side enqueue use case must verify:

1. the caller is authenticated
2. the caller belongs to the asset workspace
3. the caller has a role allowed to request security observations
4. the asset belongs to that workspace
5. the asset kind is `web_application` or `api`
6. `verification_status` is `verified`
7. `verified_at` is present
8. the canonical target is still the immutable Phase 2 target
9. workspace and asset job quotas allow a new job
10. no conflicting active job exists when the initial concurrency policy is one active job per asset

The job stores an authorization snapshot containing the asset id, workspace id, canonical target, asset kind, and `verified_at` value used at enqueue time.

### 5.2 Execution gate

Immediately before any DNS lookup or outbound connection, execution must reload the job and asset through a trusted server adapter and verify:

- the job is still queued and not cancelled
- the asset still exists in the same workspace
- the asset kind is still supported
- the asset remains `verified`
- current `verified_at` exactly matches the enqueue snapshot
- current canonical target exactly matches the enqueue snapshot
- the execution budget is valid and within system maxima

Any mismatch blocks the job without sending network traffic.

Creating a new verification challenge already clears the current verified state, so the execution recheck preserves proof-of-control continuity without inventing a separate ownership concept.

## 6. Target and transition policy

The initial allowed target is the stored immutable canonical target.

Every outbound URL must satisfy all of the following:

- scheme is `https:`
- port is absent or `443`
- no username or password is present
- hostname exactly matches the verified asset hostname
- no fragment is sent
- method is `GET`

Redirects are not delegated to the HTTP library. Automatic redirect following is disabled.

For each 3xx response, ScopeForge parses `Location` relative to the current URL and validates the next URL before following it. A redirect to a different hostname, scheme, or port is recorded as an observation but is not followed in Phase 4B.

A later phase may add explicitly verified associated hosts, but a normal redirect is not itself authorization to scan another host.

## 7. DNS, IP, and rebinding safety

Every outbound connection performs a fresh DNS resolution for its hostname.

The resolver must:

1. reject hostnames that are syntactically local or blocked
2. resolve all A and AAAA records
3. reject an empty result
4. normalize and de-duplicate returned addresses
5. reject the complete connection if any returned address is invalid or non-public
6. select a deterministic allowed address from the normalized set
7. pin the socket lookup callback to that selected address
8. retain the original hostname for TLS SNI and certificate validation

This prevents a second uncontrolled DNS lookup inside the HTTP client and prevents mixed public/private DNS answers from being treated as safe.

The shared network policy must conservatively block loopback, private, link-local, carrier-grade NAT, documentation, benchmark, multicast, unspecified, reserved, IPv4-mapped IPv6, and other non-public ranges already covered by the Phase 2 boundary. Regression tests must prove Phase 2 verification still rejects the same blocked targets after extraction.

The same resolution and pinning sequence repeats for each allowed redirect hop.

## 8. Resource budgets

The runtime observer accepts a validated `RuntimeObservationBudget`, but callers may only tighten system maxima.

Initial system maxima:

- requests: 4 total
- redirects followed: 3
- concurrent requests: 1
- per-request timeout: 5 seconds
- total execution time: 15 seconds
- retries: 0
- request body bytes: 0
- captured response body bytes: 0 in the first slice
- persisted normalized observation payload: 64 KiB per job
- persisted evidence summary: 4 KiB per generated finding

The HTTP transport may receive response bytes from the remote peer, but the first slice does not buffer or persist response bodies. It extracts status, selected headers, TLS metadata, and bounded normalized values only.

Invalid, negative, non-integer, or over-maximum budgets fail before DNS resolution.

## 9. Timeout, cancellation, and failure semantics

Cancellation is cooperative and deterministic.

The application service owns a cancellation token or `AbortSignal` that is checked:

- before DNS resolution
- before opening each connection
- after receiving response headers
- before following a redirect
- before persistence

A user cancellation produces `cancelled`, not `failed`.

A policy denial produces `blocked` with a stable machine-readable reason.

Network errors, TLS failures, DNS failures, and timeouts produce `failed` with a stable failure code. Error messages persisted to the database must be bounded and must not include secrets or raw response bodies.

The first slice performs no automatic retries.

## 10. Passive observations

`packages/runtime-observer` produces normalized observations, not a second finding model.

Initial observation kinds:

- final HTTP status
- redirect chain metadata
- response content type
- selected security-header presence and bounded normalized values
- HSTS policy presence and directives
- CSP presence and bounded policy metadata
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy` presence
- response `Server` header presence with bounded value classification
- `Set-Cookie` attribute analysis without persisting cookie values
- TLS protocol version
- certificate validity window
- certificate subject alternative name count and hostname match result

Raw `Set-Cookie` values, authentication material, response bodies, and arbitrary headers are never persisted.

Cookie observations may retain a bounded cookie name and boolean attributes such as `Secure`, `HttpOnly`, and `SameSite`. Cookie values are discarded before the observation object is created.

## 11. Deterministic findings and evidence

Only rule-backed observations become `SecurityFinding` records.

The runtime adapter maps findings directly into Phase 4A `security-domain` with:

- source kind identifying the runtime observer
- observed or scanner-derived provenance, never inferred provenance
- asset reference populated from the authorized asset
- validation state reflecting direct remote observation
- evidence classified as `public`, `internal`, `sensitive`, or `secret` using existing domain vocabulary
- bounded evidence summaries only
- structured remediation
- stable deterministic identities derived from asset ref, rule id, and normalized observation key

Initial rule candidates are deliberately narrow:

- missing HSTS on an HTTPS response
- HSTS missing `includeSubDomains` where the rule semantics are applicable
- missing `X-Content-Type-Options: nosniff`
- cookies lacking `Secure` when received over HTTPS
- session-like cookies lacking `HttpOnly`
- certificate already expired or inside a bounded expiry warning window
- TLS protocol below the allowed policy floor if the Node TLS stack successfully negotiated it

The phase must not label a header absence as exploitable when the evidence supports only configuration hardening.

## 12. Persistence model

The existing `scan_jobs` table becomes usable for the `passive_runtime` job kind through a forward migration rather than introducing a parallel job system.

The migration should add or evolve:

- job kind
- running, succeeded, and failed states
- authorization snapshot fields
- validated budget fields or bounded JSON budget
- cancellation request timestamp
- started and finished timestamps
- stable blocked/failure code
- bounded summary metadata

A separate runtime observation table may store normalized observation records keyed to a scan job and asset. It must use a composite workspace foreign key and RLS select policy consistent with Phase 2. Authenticated clients remain read-only; trusted server adapters perform writes.

Product findings may remain in-memory during the earliest task until the later hosted finding lifecycle adds its durable repository. Phase 4B must not create a second durable finding schema that competes with `security-domain`.

## 13. Audit requirements

Audit records are mandatory for security-sensitive decisions.

Events include:

- `runtime_observation.enqueued`
- `runtime_observation.blocked`
- `runtime_observation.started`
- `runtime_observation.cancel_requested`
- `runtime_observation.cancelled`
- `runtime_observation.succeeded`
- `runtime_observation.failed`

Audit metadata may include job id, asset id, job kind, stable reason code, request count, redirect count, and elapsed milliseconds.

Audit metadata must not include response bodies, cookie values, authorization tokens, DNS resolver internals beyond bounded public addresses when required for diagnostics, or unbounded exception text.

## 14. Test architecture

No automated test may depend on a public internet target.

The runtime observer must use dependency injection around resolution and transport so tests can model:

- public DNS results
- mixed public/private DNS answers
- rebinding attempts
- redirect chains
- cross-host redirects
- timeouts
- cancellation
- TLS metadata
- oversized headers or normalized values
- cookie redaction

Local fixtures may bind only to loopback when testing the raw transport in an explicitly test-only path. Production policy must still reject loopback targets before connection.

Required test families:

- network-safety regression tests
- target-transition tests
- budget tests
- DNS pinning tests
- redirect safety tests
- cancellation and timeout tests
- observation redaction tests
- deterministic mapping tests
- application authorization tests
- database/RLS migration checks where repository tooling supports them
- architecture dependency-direction tests

## 15. Delivery slices

### Phase 4B-1 - Safety and observer core

- extract shared pure network safety primitives
- add runtime execution contracts and budgets
- add DNS-pinned HTTPS transport
- add target-transition rules
- add passive HTTP/TLS observation extraction
- add redaction and deterministic security-domain mapping
- keep public tests fully local and deterministic

### Phase 4B-2 - Authorized job orchestration

- migrate `scan_jobs` for passive runtime jobs
- add normalized runtime observation persistence
- add enqueue, execute, cancel, and audit application services
- enforce authorization at enqueue and execution
- add a minimal asset-detail UI for starting and viewing a passive observation job

### Phase 4B-3 - Hosted execution hardening

- place the already-defined executor behind the selected hosted worker boundary
- add operational concurrency and backpressure controls
- add production telemetry without sensitive payload logging
- verify Vercel/Supabase deployment behavior

Phase 4B-3 may overlap with the later isolated-worker roadmap, but it must not weaken the contracts established in 4B-1 and 4B-2.

## 16. Non-goals

Phase 4B does not add:

- broad crawling
- sitemap traversal
- spidering links
- JavaScript browser execution
- API fuzzing
- GraphQL introspection attacks
- form submission
- credential attacks
- authentication replay
- CSRF exploitation
- SQL injection payloads
- command injection payloads
- SSRF payloads
- denial-of-service behavior
- file upload tests
- cloud posture connectors
- persistence on targets
- exploit frameworks
- autonomous agents
- model-provider calls

Those require separate threat models and later authorization boundaries.

## 17. Completion criteria

Phase 4B-1 is complete only when:

- Phase 2 verification network-boundary regression tests remain green
- every outbound connection is DNS-classified and pinned
- redirects cannot expand the authorized hostname boundary
- invalid budgets fail before network work
- cancellation and timeout behavior are deterministic
- no response body or cookie value is retained
- normalized observations are bounded
- runtime findings use `security-domain`
- runtime packages have an executable dependency-direction guard
- the complete repository CI gate is green on the exact PR head

Phase 4B-2 is complete only when enqueue and execution authorization are independently tested, database writes remain trusted-server-only, audit coverage is present, and a verified asset can run and display a bounded passive observation job without enabling active validation behavior.

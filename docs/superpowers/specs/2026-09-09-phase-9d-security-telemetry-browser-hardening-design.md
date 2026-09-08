# ScopeForge Phase 9D Security Telemetry and Browser Hardening Design

Date: 2026-09-09
Status: Design approved, written spec awaiting review
Repository: `LeDoNguyenTu/ScopeForge`
Branch: `feat/phase-9d-security-telemetry-browser-hardening-v1`
Base `main`: `2af9a92b68c224d290a9597ff1907e5f1098791e`

## 1. Purpose

Phase 9D adds security visibility and browser-hardening evidence to the released ScopeForge production system without creating a second durable audit database, weakening existing authorization boundaries, or destabilizing the current landing/dashboard/WebGL UI.

The phase has two coordinated but distinct telemetry channels:

1. durable workspace security history through the existing `public.audit_events` boundary
2. privacy-reduced operational security telemetry through bounded server logs captured by Vercel Runtime Logs

Phase 9D also preserves the existing browser security-header baseline and defines the target Content Security Policy architecture. Full CSP enforcement is not part of the initial Phase 9D release unless compatibility with the actual production Next.js/WebGL/Turnstile application is proven before candidate freeze.

A control is described as active only when its enforcement surface has been directly verified.

## 2. Released baseline

Implementation starts from production docs checkpoint:

`2af9a92b68c224d290a9597ff1907e5f1098791e`

Its executable Phase 9B parent is:

- merge `f203168e6ae25455743849f08511e371d3964153`
- tree `9980aa5a58014998fd26ae7084bd97c992bc1a82`
- candidate CI #773 success
- post-merge CI #774 success
- production deployment `dpl_AM7VULiVFxKW1imXGiWpfs4Sx62z` READY on `scopeforge.dev`

Released Phase 9 controls that Phase 9D must preserve:

- Phase 9A same-origin post-auth redirect validation
- Phase 9A bounded browser-visible auth errors
- Phase 9B configuration-gated Turnstile-capable auth flow
- Phase 9C database/RPC privilege hardening
- service-role-only worker/control RPC authority
- private worker-table isolation
- current production UI composition

Provider truth remains separate from code truth:

- leaked-password protection is still not enabled
- production Turnstile enforcement is not claimed without provider configuration evidence
- Vercel WAF custom rule state is not claimed

## 3. Existing telemetry and browser-hardening baseline

### 3.1 Durable audit boundary

`lib/audit/write-audit-event.ts` already provides:

- one central insert path into `public.audit_events`
- recursive rejection of metadata keys matching token, secret, password, credential, authorization, cookie, and API-key patterns
- an 8 KiB serialized metadata ceiling
- workspace-scoped event records

The database independently requires audit metadata to be a JSON object and caps the stored value at 8192 bytes.

`audit_events` is readable through workspace-scoped RLS for authenticated members.

Existing callers already use the audit writer for asset lifecycle, runtime-observation, active-validation, and runtime-worker security-significant transitions.

### 3.2 Worker request boundary

Worker routes use centralized error translation through `lib/worker-control/http-response.ts`.

The current response behavior exposes bounded error codes rather than raw worker credentials, authorization headers, or provider errors.

`lib/worker-control/auth.ts` validates a bounded worker ID and strict bearer-secret format and converts authentication failures into `WORKER_AUTHENTICATION_FAILED` without returning secret material.

This centralized HTTP boundary is the preferred Phase 9D operational telemetry interception point because it has enough semantic context to classify failures without serializing requests.

### 3.3 Runtime logging baseline

ScopeForge has no general application logging abstraction today.

Vercel Runtime Logs are available for server-side output and can be filtered or grouped by severity, route, status code, deployment, and time range.

Phase 9D uses that transport rather than introducing another database, queue, monitoring SaaS dependency, or telemetry runtime package.

### 3.4 Browser security baseline

`next.config.ts` currently sets:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- restrictive `Permissions-Policy`
- HSTS with preload
- `poweredByHeader: false`

Root middleware remains intentionally thin and delegates session handling to `lib/supabase/middleware.ts`.

There is no enforced CSP today.

## 4. Threat model

Phase 9D focuses on the following remaining risks.

### 4.1 Invisible security failures

Examples:

- repeated worker authentication failures
- worker access-denied bursts
- sustained worker throttling
- unexpected worker request failures
- security-control misconfiguration

A secure rejection still needs enough operational visibility to distinguish abuse, rollout mistakes, and application regressions.

### 4.2 Sensitive-data leakage through observability

Phase 9D must prevent logging of:

- passwords
- Supabase access or refresh tokens
- CAPTCHA tokens
- service-role/API credentials
- worker bearer secrets
- worker lease tokens
- cookies or authorization headers
- repository source/source code
- raw request or response bodies
- raw executor stdout or stderr
- environment dumps
- arbitrary headers
- arbitrary exception serialization

### 4.3 Audit flooding

High-frequency authentication failures, malformed worker requests, heartbeats, or retry noise must not flood `audit_events` or be attached to a workspace when no trusted workspace identity exists.

### 4.4 Browser injection and policy drift

A rushed CSP could either create a false security claim or break Next.js bootstrap behavior, the current WebGL landing experience, styles/assets, Supabase connectivity, or Cloudflare Turnstile.

Phase 9D therefore inventories and proves browser requirements before enforcement.

## 5. Design decision - typed dual-channel telemetry

### Channel A - durable workspace audit

Continue using `public.audit_events` only for low-frequency, durable, workspace-associated security history.

Examples include authorization-affecting configuration changes, privileged membership changes when such flows exist, security-sensitive asset lifecycle transitions, and explicit administrative worker/node actions tied to a trusted actor/workspace.

Do not use `audit_events` for anonymous or high-frequency rejection noise.

### Channel B - operational security logs

Add one small server-only typed security logger whose output is captured by Vercel Runtime Logs.

No additional database, queue, telemetry SDK, or runtime dependency is added.

## 6. Operational security event contract

### 6.1 Module and API

Preferred module:

`lib/security/telemetry.ts`

Public API:

`writeSecurityTelemetry(event): void`

The module must be server-only in usage and protected by architecture tests against client-component imports.

The input is a flat discriminated union. `Record<string, unknown>`, arbitrary metadata bags, raw request objects, and raw `Error` objects are forbidden.

### 6.2 Shared schema

Every event serializes as one JSON object containing only:

- `schema`: exactly `scopeforge.security.v1`
- `event`: one value from the closed event union
- `severity`: `warning` or `error`
- `route`: one value from the closed worker-route union, when applicable
- `code`: one bounded ScopeForge application error code from existing literal error-code unions, when applicable
- `status`: integer HTTP status, when applicable
- `control`: one value from a closed security-control union, when applicable

No `message`, `details`, `metadata`, `context`, `request`, `error`, or arbitrary string payload field is allowed.

Serialized UTF-8 size must not exceed 1024 bytes. Invalid or oversized events are dropped by the telemetry boundary without serializing the rejected input into another log.

### 6.3 Initial event union

Required events:

- `worker.authentication_rejected`
- `worker.access_rejected`
- `worker.rate_limited`
- `worker.request_failed`
- `security.control_misconfigured`

No generic `security.event` escape hatch is allowed.

### 6.4 Worker route union

Initial fixed route identifiers:

- `worker.claim`
- `worker.heartbeat`
- `worker.finalize`
- `worker.repository_scan_artifact`
- `worker.repository_scan_finalize`
- `worker.runtime_prepare`
- `worker.runtime_finalize`

A route identifier must never be derived from `request.url`, a query string, or another untrusted string.

### 6.5 Security-control union

The first release may use only these control identifiers:

- `turnstile`
- `supabase_auth`
- `worker_runtime_flags`
- `security_headers`

Adding a new control identifier requires a code change and test update.

### 6.6 Sensitive-value boundary

Because all free-form metadata/message fields are forbidden, callers have no supported field in which to place tokens, cookies, bodies, raw headers, source, stdout/stderr, or exception text.

Architecture tests must additionally reject new telemetry keys whose names imply sensitive data, including token, secret, password, credential, authorization, cookie, API key, request/response body, source code, stdout, stderr, environment, or headers.

## 7. Worker HTTP integration

### 7.1 Central interception

Instrument the existing `workerRouteError` boundary rather than scattering security logging through worker business services.

The boundary may accept a fixed route identifier in addition to the error, or use an equivalent typed wrapper, but returned HTTP semantics must remain unchanged.

### 7.2 Classification

Required mapping:

- worker broker authentication failure -> warning, `worker.authentication_rejected`
- explicit worker/runtime access-denied response -> warning, `worker.access_rejected`
- existing 429 worker/runtime limit response -> warning, `worker.rate_limited`
- unexpected uncaught worker failure -> error, `worker.request_failed`

Expected protocol/state-machine 400 and 409 responses must not automatically emit security telemetry.

### 7.3 Response invariance

Telemetry must not alter:

- HTTP status mapping
- JSON response shape
- cache-control behavior
- worker authentication semantics
- task/lease state transitions

Telemetry is non-authoritative. If logging itself fails, a safe 401/403/429 response must not become a 500.

## 8. Durable audit hardening

### 8.1 Preserve storage model

No new audit/security-events table is introduced.

No database migration is planned for the first Phase 9D release. Discovery of a genuine database-contract requirement upgrades scope and requires separate review before mutation.

### 8.2 Expand the runtime metadata policy

Phase 9D must strengthen the actual `writeAuditEvent` metadata safety boundary, not only its tests.

The runtime policy must reject the already-blocked token/secret/password/credential/authorization/cookie/API-key categories plus metadata that attempts to carry:

- CAPTCHA tokens
- worker lease credentials
- raw request/response bodies
- repository source or source code
- raw executor stdout/stderr
- environment dumps
- arbitrary header collections
- serialized error/provider objects

Before changing the matcher or validator, implementation must inventory current production audit metadata keys so legitimate bounded fields are preserved. The control should reject dangerous semantic categories without blindly banning an ordinary safe word used by existing domain metadata.

### 8.3 Regression coverage

Tests must prove both sides:

- all forbidden sensitive metadata categories are rejected
- all existing safe audit payload shapes remain accepted

No caller may populate audit metadata by spreading or serializing an arbitrary `Error`, provider response, request, or worker result.

## 9. Alert contracts

Phase 9D defines actionable alert semantics but does not claim automated alert enforcement unless a supported mutation surface is later verified.

### 9.1 Worker authentication rejection burst

Signal: `worker.authentication_rejected`

Threshold: 10 or more production events in 5 minutes.

Response: inspect route/deployment distribution, verify no credential rollout is in progress, and use the approved containment procedure if malicious or unexplained.

False-positive risks: stale worker credential rollout or accidentally duplicated worker process.

### 9.2 Unexpected worker failures

Signal: `worker.request_failed`

Threshold: 3 or more production events in 5 minutes, or sustained recurrence immediately after deployment.

Response: correlate with deployment SHA and worker route. Roll back the application deployment if the failures begin with the release and affect valid workers.

### 9.3 Sustained worker throttling

Signal: `worker.rate_limited`

Threshold: 20 or more production events in 10 minutes for one route/deployment context.

Response: distinguish legitimate abuse protection from a scheduler/worker retry defect. Do not raise limits until cause is understood.

### 9.4 Security-control misconfiguration

Signal: `security.control_misconfigured`

Threshold: any production occurrence.

Response: identify the closed-union control, restore last known-good configuration using its documented rollback path, and do not log configuration values.

## 10. Vercel transport and acceptance

Use severity-appropriate structured server output so each security event becomes one bounded JSON event in Vercel Runtime Logs.

Candidate acceptance must prove a harmless preview request creates the expected structured event. Preferred probe: an intentionally unauthenticated request to a preview worker endpoint, because it exercises the real authentication rejection path without granting worker authority or modifying persistent worker state.

The runtime-log result must be inspected and must not contain:

- the supplied Authorization value
- cookies
- request body
- raw headers
- query-string contents
- credentials or tokens

The connected Vercel surface can inspect runtime logs but currently has no verified alert-rule mutation action. Automated Vercel alert creation is therefore not part of the initial release claim.

## 11. Browser hardening

### 11.1 Preserve and pin current headers

The existing `next.config.ts` security-header baseline stays in place.

Add architecture/regression tests that pin:

- nosniff
- strict-origin referrer policy
- frame denial
- restrictive permissions policy
- HSTS
- `poweredByHeader: false`

### 11.2 CSP inventory first

Before any enforcement, inventory the actual production requirements for:

- Next.js framework scripts
- styles
- local and external images/assets/fonts actually used
- WebGL/Three.js resources
- Supabase HTTPS/WebSocket connections
- Cloudflare Turnstile script/frame origins when configured
- manifest/service metadata
- any analytics/provider resources actually present in the current tree

Do not copy a generic policy template.

### 11.3 Target policy properties

The target policy should aim for:

- `default-src 'self'`
- narrowly scoped script execution
- evidence-based style/font/image/connect origins
- `object-src 'none'`
- `base-uri 'self'`
- `frame-ancestors 'none'`
- narrowly scoped Turnstile script/frame access when Turnstile is actively configured
- no broad wildcard origins
- no `unsafe-eval`
- no broad `unsafe-inline` concession merely to make the UI render

Exact source directives remain evidence-driven until the inventory is complete.

### 11.4 CSP enforcement sub-gate

CSP enforcement may join the Phase 9D release only if every condition below is satisfied before candidate freeze:

1. current production UI/WebGL behavior is stable on the branch baseline
2. origin/directive inventory is complete
3. preview browser verification proves no functional regression
4. no broad `unsafe-inline` or `unsafe-eval` concession is required
5. Turnstile-capable authentication remains functional under the policy
6. implementation does not overwrite newer UI work

If any condition fails, Phase 9D releases telemetry, audit hardening, header tests, and the documented CSP inventory/target only. CSP remains explicitly pending.

Static CSP string tests alone are never sufficient evidence of browser compatibility.

## 12. UI and branch isolation

Use the actual current production `main` as the integration baseline. Do not use PR #49 as a security baseline.

The initial implementation should avoid:

- `app/layout.tsx`
- landing/dashboard visual files
- package dependency changes

unless CSP compatibility work proves one is genuinely necessary and the current UI state is re-read first.

If `main` advances from another UI task:

1. re-read exact current `main`
2. compare changed file sets
3. preserve the newest production UI file as authoritative
4. reapply only the reviewed Phase 9D security delta where overlap exists
5. require a fresh exact-head Preview after reconciliation
6. invalidate any CI candidate created before reconciliation

## 13. Runtime and authority boundaries

Phase 9D authorizes no hosted scanner/worker capability change.

Keep false/absent unless separately accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Telemetry must not introduce browser service-role access, direct browser writes to worker state, new worker RPC authority, arbitrary networking, or new execution classes.

## 14. Test strategy

Implementation is test-first.

### 14.1 Telemetry tests

Prove:

- each closed-union event serializes to the exact schema
- unsupported event names/fields cannot be accepted
- severity mapping is fixed
- serialized output is at most 1024 UTF-8 bytes
- no supported field accepts arbitrary messages/metadata/errors
- sensitive-field architecture guards cover the categories in Section 6.6

### 14.2 Worker HTTP tests

Prove:

- authentication failure emits the expected warning event
- access denial emits the expected warning event
- 429 limit response emits the expected warning event
- unexpected failure emits the expected error event
- ordinary expected 400/409 conflicts emit no security telemetry
- response status/body/cache semantics remain compatible with the released contract

### 14.3 Audit tests

Prove the strengthened runtime metadata validator rejects every required sensitive category while preserving every existing safe production audit payload shape.

### 14.4 Header and CSP tests

Pin the current header baseline.

If CSP enforcement is attempted, add policy tests plus real preview browser verification. Static tests alone cannot satisfy the CSP release gate.

### 14.5 Architecture guards

Prevent:

- a second audit/security-event database table in this phase
- raw request/error/header/body serialization in telemetry
- client imports of `lib/security/telemetry.ts`
- new runtime package dependencies without separate justification
- accidental enablement of the four hosted runtime flags

## 15. Release acceptance

The initial Phase 9D release is accepted only when:

1. typed operational security telemetry is implemented
2. worker integration preserves existing HTTP behavior
3. `writeAuditEvent` runtime metadata protection and tests are strengthened
4. existing security headers are pinned by tests
5. CSP required-origin/directive inventory and target policy are documented
6. no CSP enforcement claim is made unless Section 11.4 is directly proven
7. a harmless preview worker rejection is observed as the expected structured Vercel Runtime Log event
8. that runtime event contains no supplied bearer value or other forbidden sensitive material
9. exact-head Vercel Preview is READY
10. frozen-candidate CI passes npm audit, full tests, typecheck, CLI build/version, historical benchmark, Phase 8B matrix, and production Next.js build
11. current `main` and concurrent UI drift are rechecked before merge
12. PR diff, reviews, and threads are clean
13. squash merge is pinned to the verified head
14. post-merge main CI independently passes
15. exact production Vercel deployment for the merge SHA is READY
16. Supabase Security Advisor is rerun and provider-state warnings are recorded accurately
17. a docs-only release checkpoint records exact evidence without redundant CI

## 16. Non-goals

The first Phase 9D release does not automatically include:

- a new audit/security-event database
- log drains
- a third-party telemetry SDK
- a metrics warehouse
- IP fingerprinting
- user/session tracking
- raw request capture
- automated Vercel alert mutation without a verified supported tool
- WAF changes
- leaked-password provider activation
- Turnstile provider activation
- CSP enforcement without compatibility proof
- UI redesign
- worker/runtime enablement

## 17. Rollback

Application rollback:

- promote or restore the last known-good Vercel production deployment if Phase 9D causes request or UI regression

Telemetry containment:

- telemetry remains non-authoritative
- if logging creates unexpected runtime noise/cost, rollback the application release rather than weakening worker authorization

CSP rollback if later enforced:

- restore the last known-good header configuration immediately if valid application/auth/WebGL traffic is blocked
- CSP cannot be described as complete until its rollback action is documented against the exact deployment mechanism

Database rollback:

- none expected because the initial Phase 9D design contains no database migration

## 18. Implementation decomposition

After written-spec approval, create one Phase 9D implementation plan with this order:

1. typed telemetry contract and tests
2. worker HTTP integration tests and implementation
3. audit runtime validator hardening and regression expansion
4. existing header architecture tests
5. CSP origin/directive inventory and target-policy document
6. preview runtime-log acceptance
7. resumable working-state checkpoint
8. current-main/UI reconciliation
9. frozen candidate, PR, CI, merge, and post-merge verification
10. docs-only Phase 9D release checkpoint and Phase 9E handoff

CSP enforcement is conditional. It becomes a separate implementation-plan task only if evidence gathered under item 5 satisfies Section 11.4. It must not delay the core telemetry release merely to obtain a CSP checkbox.

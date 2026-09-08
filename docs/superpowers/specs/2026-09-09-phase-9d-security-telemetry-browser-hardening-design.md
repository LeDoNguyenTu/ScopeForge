# ScopeForge Phase 9D Security Telemetry and Browser Hardening Design

Date: 2026-09-09
Status: Approved design, implementation not started
Repository: `LeDoNguyenTu/ScopeForge`
Branch: `feat/phase-9d-security-telemetry-browser-hardening-v1`
Base `main`: `2af9a92b68c224d290a9597ff1907e5f1098791e`

## 1. Purpose

Phase 9D adds security visibility and browser-hardening evidence to the released ScopeForge production system without creating a second durable audit database, weakening existing authorization boundaries, or destabilizing the current landing/dashboard/WebGL UI.

The phase has two coordinated but distinct channels:

1. durable workspace security history through the existing `public.audit_events` boundary
2. privacy-reduced operational security telemetry through bounded server logs captured by Vercel Runtime Logs

Phase 9D also preserves the existing browser security header baseline and defines the target Content Security Policy architecture. Full CSP enforcement is not part of the initial Phase 9D release unless compatibility with the actual production Next.js/WebGL/Turnstile application is proven and the required integration can be made without UI-stream regression.

Phase 9D must not create security theater. A control is described as active only when the enforcement surface has been directly verified.

## 2. Released baseline

The implementation starts from production docs checkpoint:

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

The database independently requires audit metadata to be a JSON object and limits its stored size to 8192 bytes.

`audit_events` is readable only through workspace-scoped RLS for authenticated members.

Existing callers already use the audit writer for asset lifecycle, runtime-observation, active-validation, and runtime-worker security-significant transitions.

### 3.2 Worker request boundary

Worker routes use centralized error translation through `lib/worker-control/http-response.ts`.

The current response behavior intentionally exposes only bounded error codes. Raw worker credentials, authorization headers, secrets, and provider errors are not returned to clients.

`lib/worker-control/auth.ts` validates a bounded worker ID and a strict bearer-secret format and converts authentication failures into `WORKER_AUTHENTICATION_FAILED` without returning secret material.

This centralized HTTP boundary is the preferred Phase 9D operational telemetry interception point because it has enough semantic context to classify failures without serializing full requests.

### 3.3 Runtime logging baseline

ScopeForge does not currently have a general application logging abstraction.

Vercel Runtime Logs are available for server-side output and can be filtered or grouped by attributes such as severity, route, status code, deployment, and time range.

Phase 9D will use that existing transport rather than introducing another database, monitoring SaaS dependency, or runtime package.

### 3.4 Browser security baseline

`next.config.ts` currently sets:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- restrictive `Permissions-Policy`
- HSTS with preload
- `poweredByHeader: false`

Current root middleware remains intentionally thin and delegates session handling to `lib/supabase/middleware.ts`.

There is no enforced CSP today.

## 4. Threat model

Phase 9D focuses on visibility and browser-layer risks that remain after Phases 9A, 9B, and 9C.

### 4.1 Security-relevant failures becoming invisible

Examples:

- repeated worker authentication failures
- worker access-denied bursts
- sustained worker request throttling
- unexpected worker request failures
- security-control misconfiguration
- provider integration failures that change effective protection

Risk:

A secure failure mode can still be operationally unsafe if abuse or control degradation cannot be distinguished from ordinary traffic.

### 4.2 Sensitive data leakage through observability

Risks include logging:

- passwords
- Supabase access tokens
- Supabase refresh tokens
- service-role credentials
- worker bearer secrets
- worker lease tokens
- cookies or authorization headers
- repository source
- raw request bodies
- raw executor stdout or stderr
- environment dumps
- arbitrary exception serialization

The Phase 9D logger must make these values structurally difficult to pass rather than relying on developer discipline alone.

### 4.3 Audit flooding

High-frequency authentication failures, heartbeats, malformed worker requests, or retry noise could flood `audit_events`, increasing storage, obscuring meaningful workspace history, and attaching events to a workspace when no trusted workspace identity exists.

Operational security telemetry must therefore remain separate from durable workspace audit events.

### 4.4 Browser injection and policy drift

The application has no enforced CSP. A rushed permissive policy could create a false security claim or break:

- Next.js framework bootstrap behavior
- the current WebGL landing experience
- styles
- images/assets
- Supabase connectivity
- Cloudflare Turnstile script/frame behavior when enabled

Phase 9D must first define and prove compatibility requirements before enforcement.

## 5. Design decision

Phase 9D uses typed dual-channel telemetry.

### Channel A - durable workspace audit

Continue using `public.audit_events` only for low-frequency, durable, workspace-associated security history.

Examples:

- authorization-affecting configuration changes
- privileged workspace/member changes when such flows exist
- security-sensitive asset lifecycle transitions
- explicit administrative worker/node actions when tied to a trusted actor/workspace

Do not use `audit_events` for anonymous or high-frequency rejection noise.

### Channel B - operational security logs

Add one small server-only typed security logger.

Its output is transported through Vercel Runtime Logs.

The logger accepts only a closed event union and bounded allowlisted fields. Callers cannot pass arbitrary metadata, request objects, raw errors, headers, cookies, bodies, environment objects, or credentials.

No additional database, queue, telemetry SDK, or runtime dependency is added.

## 6. Operational security event contract

### 6.1 Module boundary

Preferred module:

`lib/security/telemetry.ts`

It must be server-only by construction and must not be imported into client components.

The public interface should expose one function such as:

`writeSecurityTelemetry(event)`

The exact TypeScript signature is finalized in the implementation plan, but the event input must be a discriminated union rather than `Record<string, unknown>`.

### 6.2 Initial event set

The initial Phase 9D release should remain intentionally small.

Required categories:

- `worker.authentication_rejected`
- `worker.access_rejected`
- `worker.rate_limited`
- `worker.request_failed`
- `security.control_misconfigured`

No generic `security.event` escape hatch is allowed.

### 6.3 Allowed fields

Operational events may contain only fields that are operationally necessary and low sensitivity, for example:

- schema/version identifier
- event name
- severity
- fixed route identifier
- bounded application error code
- HTTP status
- fixed control identifier for configuration failures

Optional correlation identifiers must be added only if they can be proven non-secret, bounded, and necessary. User IDs, workspace IDs, worker IDs, task IDs, asset IDs, raw IP addresses, email addresses, and arbitrary provider identifiers are excluded from the first release unless a concrete incident-response requirement proves they are needed.

Vercel already supplies deployment/request context around server execution, so ScopeForge does not need to duplicate identity-heavy fields.

### 6.4 Forbidden values

The typed event contract and architecture tests must prevent or reject:

- `password`
- `token`
- `accessToken`
- `refreshToken`
- `captchaToken`
- `secret`
- `serviceRoleKey`
- `leaseToken`
- `credential`
- `authorization`
- `cookie`
- `requestBody`
- `responseBody`
- `source`
- `sourceCode`
- `stdout`
- `stderr`
- `environment`
- `headers`
- raw `Error` objects

Forbidden-key detection must be recursive if the chosen event representation permits nested data. Prefer a flat event representation so recursive arbitrary metadata is unnecessary.

### 6.5 Bounded serialization

One event must have a small deterministic maximum serialized size. The implementation plan will select the exact ceiling after inspecting expected event shapes. The target should be substantially smaller than the durable audit 8 KiB limit because operational security events require only a few fields.

Oversized or structurally invalid telemetry must fail closed at the logger boundary without leaking rejected input into another error log.

## 7. Worker HTTP integration

### 7.1 Central interception

Instrument the existing centralized worker error path rather than adding logging independently to each business service.

`workerRouteError` already maps domain errors to bounded status/code responses. Phase 9D should extend the boundary so it can emit an operational security event without changing the returned response contract.

### 7.2 Route identity

Each worker route supplies a fixed compile-time route identifier, for example:

- `worker.claim`
- `worker.heartbeat`
- `worker.finalize`
- `worker.repository_scan_artifact`
- `worker.repository_scan_finalize`
- `worker.runtime_prepare`
- `worker.runtime_finalize`

Do not derive route identifiers from `request.url` or arbitrary request strings.

### 7.3 Classification

Initial classification:

- worker broker authentication failure -> warning, `worker.authentication_rejected`
- explicit worker/runtime access denied -> warning, `worker.access_rejected`
- active-limit/rate-limit response -> warning, `worker.rate_limited`
- unexpected uncaught worker failure -> error, `worker.request_failed`

Expected domain/state-machine conflicts that resolve to ordinary 400 or 409 responses must not automatically create security telemetry. They can be normal protocol behavior and would create noise.

### 7.4 Response invariance

Telemetry must not alter:

- HTTP status mapping
- response body shape
- cache-control behavior
- worker authentication semantics
- task/lease state transitions

If telemetry output itself fails, worker request behavior must remain controlled. The logger must not convert a safe 401/403/429 into a 500 merely because observability failed.

## 8. Durable audit hardening

### 8.1 Preserve current storage model

No new audit table is introduced.

No migration is required for the first Phase 9D release unless implementation discovers an unavoidable database contract problem. Such a discovery upgrades scope and requires separate review before mutation.

### 8.2 Strengthen metadata safety coverage

Add regression tests around `writeAuditEvent` proving rejection of metadata containing or semantically representing:

- access/refresh tokens
- CAPTCHA tokens
- service-role/API keys
- worker credentials
- lease tokens
- passwords
- cookies
- authorization data
- raw request/response bodies
- repository source/source code
- raw executor stdout/stderr
- environment dumps

Preserve valid existing audit metadata used by production callers.

### 8.3 No arbitrary error serialization

Audit metadata must never be populated by spreading or serializing an arbitrary `Error`, provider response, request, or worker result.

Existing callers that record bounded domain reason strings remain acceptable only when those values are already generated by controlled application logic and do not contain raw provider output or credentials.

## 9. Alert contracts

Phase 9D defines actionable alert semantics but does not claim automated alert enforcement unless the connected platform exposes a supported mutation surface and the resulting rule is directly verified.

### 9.1 Worker authentication rejection burst

Signal:

`worker.authentication_rejected`

Initial threshold target:

- 10 or more events in 5 minutes on production

Responder action:

- inspect route/deployment distribution
- verify no credential rotation or worker rollout is in progress
- if malicious or unexplained, restrict affected worker ingress/credentials using the approved containment procedure

False-positive considerations:

- stale worker credential rollout
- accidentally duplicated worker process

### 9.2 Unexpected worker failures

Signal:

`worker.request_failed`

Initial threshold target:

- 3 or more events in 5 minutes, or any sustained recurrence after a deployment

Responder action:

- inspect deployment runtime logs
- correlate with release SHA and worker endpoint
- rollback application deployment if the failures begin immediately after release and affect valid workers

### 9.3 Sustained worker throttling

Signal:

`worker.rate_limited`

Initial threshold target:

- 20 or more events in 10 minutes for one route/deployment context

Responder action:

- determine whether the event is legitimate load protection or a scheduler/worker retry defect
- do not raise limits until the cause is understood

### 9.4 Security-control misconfiguration

Signal:

`security.control_misconfigured`

Threshold:

- any production occurrence is actionable

Responder action:

- identify the named control
- fail closed when the control contract requires it and account-lockout risk is understood
- otherwise restore last known-good configuration using its documented rollback path

## 10. Vercel transport and verification

Use standard structured server output so events appear in Vercel Runtime Logs.

The exact serialization method must produce one bounded JSON object per event and use severity-appropriate output.

Candidate acceptance must prove at least one harmless preview request generates the expected structured event in Vercel Runtime Logs. Prefer an intentionally unauthenticated worker request against a preview deployment because it exercises the real telemetry path without granting worker authority or modifying persistent state.

Verification must confirm the logged event does not contain:

- the supplied Authorization value
- cookies
- request body
- raw headers
- secrets
- full URL query strings

The connected Vercel surface can inspect runtime logs but does not currently expose a confirmed alert-rule mutation action. Therefore automated Vercel alert creation is not part of the initial release claim.

## 11. Browser-hardening design

### 11.1 Preserve current headers

The existing `next.config.ts` header baseline stays in place.

Phase 9D may add tests that pin these headers so later UI/security work cannot silently remove them.

### 11.2 CSP inventory first

Before any CSP enforcement, inventory the actual production application's required execution/origin behavior.

At minimum inspect:

- Next.js framework script behavior
- current styles
- local images/assets/fonts if present
- WebGL/Three.js resources
- Supabase HTTPS/WebSocket connections used by the application
- Cloudflare Turnstile script/frame origins when configured
- manifest/service metadata
- any production analytics or provider resources actually present in the current tree

Do not copy a generic CSP template.

### 11.3 Target policy properties

The target CSP should aim for:

- `default-src 'self'`
- narrowly scoped script execution
- narrowly scoped style/font/image/connect sources based on evidence
- `object-src 'none'`
- `base-uri 'self'`
- `frame-ancestors 'none'` as the CSP equivalent of the existing frame denial
- narrowly scoped Turnstile frame/script access when the feature is actively configured
- no broad wildcard origins
- no `unsafe-eval`
- no broad `unsafe-inline` policy merely to make the application render

Exact directives are evidence-driven and are not frozen in this design before compatibility inspection.

### 11.4 Enforcement boundary

Full CSP enforcement is a separate Phase 9D sub-gate.

It may ship in the same Phase 9D PR only if all of the following become true before the candidate is frozen:

- current production UI/WebGL behavior is stable on the branch baseline
- required directive/origin inventory is complete
- preview browser verification proves no functional regressions
- no broad `unsafe-inline` or `unsafe-eval` concession is needed
- Turnstile-capable auth remains functional under the policy
- the implementation does not require overwriting newer UI work

If any condition fails, the initial Phase 9D release ships telemetry, header regression tests, and the documented CSP target/inventory only. CSP enforcement remains pending without being described as active.

## 12. UI and branch isolation

Phase 9D must use the actual current production `main` as its integration baseline.

Do not use PR #49 as a security baseline.

Initial Phase 9D implementation should avoid:

- `app/layout.tsx`
- landing/dashboard visual files
- package dependency changes

unless CSP compatibility work later proves one of them is genuinely required and the current UI state is re-read first.

If `main` advances from a separate UI task during Phase 9D:

1. re-read exact current `main`
2. compare changed file sets
3. preserve the newest production UI file as authoritative
4. reapply only the reviewed Phase 9D security delta where overlap exists
5. require a new exact-head Preview after reconciliation
6. invalidate any CI candidate created before the reconciliation

## 13. Runtime and authority boundaries

Phase 9D authorizes no hosted scanner/worker capability change.

Keep false/absent unless separately accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Telemetry must not introduce:

- browser access to service-role credentials
- direct browser writes to worker state
- new worker RPC authority
- arbitrary networking
- new runtime execution classes

## 14. Test strategy

Implementation is test-first.

Required focused coverage:

### 14.1 Security telemetry unit tests

Prove:

- each supported event serializes to the expected bounded schema
- disallowed extra fields are not accepted
- secret-like fields/values cannot be serialized through the public logger API
- output is one structured event
- severity matches event type
- serialization size is bounded
- logger failure does not throw into protected request flows if the selected implementation can fail

### 14.2 Worker HTTP regression tests

Prove:

- authentication failures log the expected warning event
- access-denied failures log the expected warning event
- rate-limit failures log the expected warning event
- unexpected failures log the expected error event
- ordinary expected 400/409 conflicts do not generate security telemetry
- response status/body/cache semantics remain byte/shape compatible with the previous contract

### 14.3 Audit safety tests

Prove sensitive metadata rejection across all required categories while preserving valid existing audit payloads.

### 14.4 Header architecture tests

Pin the existing security headers and `poweredByHeader: false`.

If CSP enforcement is attempted, add focused policy tests plus actual preview browser compatibility verification. Static string tests alone are insufficient evidence that CSP works.

### 14.5 Architecture guards

Add regression checks preventing:

- a second security/audit database table in this phase
- arbitrary `console.log(request)` or `console.error(error)` usage in the new telemetry boundary
- client imports of the security telemetry module
- new runtime package dependencies unless separately justified
- accidental enabling of the four hosted runtime flags

## 15. Release acceptance

The initial Phase 9D release is accepted only when:

1. typed operational security telemetry is implemented
2. worker rejection/failure integration preserves existing HTTP behavior
3. audit sensitive-metadata coverage is strengthened
4. existing security header baseline is pinned by tests
5. CSP required-origin/directive inventory and target policy are documented
6. no CSP enforcement claim is made unless browser compatibility is directly proven
7. one harmless preview worker rejection is observed as the expected structured Vercel Runtime Log event
8. the runtime event contains no supplied bearer value or other forbidden sensitive material
9. exact-head Vercel Preview is READY
10. frozen-candidate CI passes npm audit, full tests, typecheck, CLI build/version, historical benchmark, Phase 8B matrix, and production Next.js build
11. current `main` and concurrent UI drift are rechecked before merge
12. PR reviews/threads and diff scope are clean
13. squash merge is pinned to the verified head
14. post-merge main CI independently passes
15. exact production Vercel deployment for the merge SHA is READY
16. Supabase Security Advisor is rerun and provider-state warnings are recorded accurately
17. a docs-only release checkpoint records the exact release evidence without redundant CI

## 16. Non-goals

The first Phase 9D release does not automatically include:

- a new audit/security-event database
- log drains
- a third-party telemetry SDK
- a metrics warehouse
- IP fingerprinting
- user/session tracking
- raw request capture
- automated Vercel alert mutation when no supported mutation tool has been verified
- WAF changes
- leaked-password provider activation
- Turnstile provider activation
- CSP enforcement without compatibility proof
- UI redesign
- worker/runtime enablement

## 17. Rollback

Application rollback:

- revert/promote the last known-good Vercel production deployment if the Phase 9D application release causes request or UI regression

Telemetry-specific containment:

- operational logging is non-authoritative and must never be required for worker response correctness
- if logging behavior causes unexpected runtime noise or cost, rollback the application release rather than weakening worker authorization

CSP rollback if later enforced:

- immediately restore the last known-good header configuration if valid application/auth/WebGL traffic is blocked
- CSP enforcement cannot be considered complete until this rollback has been exercised or its exact deployment action is documented

Database rollback:

- none expected for the first Phase 9D release because no database migration is planned

## 18. Implementation decomposition

After written-spec approval, create one Phase 9D implementation plan with these ordered tasks:

1. typed telemetry contract and tests
2. worker HTTP integration tests and implementation
3. audit sensitive-metadata regression expansion
4. existing header architecture tests
5. CSP origin/directive inventory and target-policy document
6. preview runtime-log acceptance
7. resumable working-state checkpoint
8. current-main/UI reconciliation
9. frozen candidate, PR, CI, merge, post-merge verification
10. docs-only release checkpoint and Phase 9E handoff

CSP enforcement is conditional and must be represented as a separate plan task only if compatibility evidence during implementation satisfies Section 11.4. It must not delay the core telemetry release merely to obtain a CSP checkbox.

# ScopeForge Phase 9D Telemetry and CSP Evidence

Date: 2026-09-09

## Status

Phase 9D code is in implementation on `feat/phase-9d-security-telemetry-browser-hardening-v1`.

Current production docs baseline at branch creation:

`2af9a92b68c224d290a9597ff1907e5f1098791e`

Its executable Phase 9B parent is:

`f203168e6ae25455743849f08511e371d3964153`

Provider/runtime truth remains separate from code truth:

- production Turnstile enforcement: NOT CLAIMED
- Supabase leaked-password protection: NOT ENABLED
- Vercel WAF custom rule state: NOT CLAIMED
- Vercel automated alert state: NOT CLAIMED
- CSP state: NOT ENFORCED

## Telemetry model

Phase 9D keeps two distinct channels.

### Durable workspace audit

`public.audit_events` remains the only durable workspace security-history store.

Use it only for low-frequency events tied to a trusted workspace and actor context, such as security-sensitive lifecycle or administrative transitions. Do not write anonymous worker authentication noise, heartbeat-scale events, or repeated malformed requests to this table.

The application writer retains the existing 8 KiB metadata ceiling and recursively rejects sensitive metadata keys before insertion.

### Operational security telemetry

Operational security signals use bounded server logs captured by Vercel Runtime Logs. No new database, queue, telemetry SDK, or log-store dependency is introduced.

Schema:

`scopeforge.security.v1`

Allowed worker-event fields are exactly:

- `schema`
- `event`
- `severity`
- `route`
- `code`
- `status`

The security-control-misconfiguration event uses exactly:

- `schema`
- `event`
- `severity`
- `route`
- `control`

The logger reconstructs a normalized allowlisted object rather than serializing its caller input. One serialized event may not exceed 1024 UTF-8 bytes.

Initial event names:

- `worker.authentication_rejected`
- `worker.access_rejected`
- `worker.rate_limited`
- `worker.request_failed`
- `security.control_misconfigured`

## Data that must never enter operational telemetry

The first Phase 9D telemetry contract does not permit:

- passwords
- access or refresh tokens
- CAPTCHA tokens
- Supabase service-role keys
- worker bearer credentials
- lease tokens
- cookies
- authorization headers
- request or response bodies
- arbitrary headers
- complete URLs or query strings
- user IDs
- workspace IDs
- worker IDs
- task or attempt IDs
- asset IDs
- IP addresses
- email addresses
- repository source or source code
- executor stdout or stderr
- environment dumps
- raw `Error` objects or exception messages

Vercel supplies deployment/request execution context around the log entry; ScopeForge does not duplicate identity-heavy request context into the event payload.

## Worker event classification

The centralized worker HTTP response boundary owns classification.

- broker authentication failure -> `worker.authentication_rejected`, warning, 401
- explicit worker/runtime access denial -> `worker.access_rejected`, warning, mapped 403
- runtime worker active-limit protection -> `worker.rate_limited`, warning, 429
- unexpected uncaught worker failure -> `worker.request_failed`, error, 500

Normal protocol/state errors returning 400 or 409 are not security telemetry by default.

Telemetry must never change worker HTTP status, response body, cache behavior, authentication, task state, or lease state.

## Alert contracts

These are responder contracts. They are not claims that a Vercel alert rule is currently installed.

### `worker.authentication_rejected`

Threshold: 10 or more events in 5 minutes on production.

Response:

1. inspect route and deployment distribution
2. confirm whether a credential rotation or worker rollout is active
3. identify stale or duplicated worker processes
4. if unexplained or malicious, contain affected worker ingress/credentials using the approved incident procedure

False-positive sources include stale worker credentials and duplicate worker processes.

### `worker.request_failed`

Threshold: 3 or more events in 5 minutes, or sustained recurrence immediately after a deployment.

Response:

1. correlate with exact release SHA and worker route
2. inspect bounded Runtime Log context
3. determine whether valid workers are affected
4. roll back the application deployment if failures began with the release and the rollback is safer than continued operation

### `worker.rate_limited`

Threshold: 20 or more events in 10 minutes for one route/deployment context.

Response:

1. determine whether load protection is correctly rejecting excess work
2. check scheduler/worker retry behavior for a retry storm
3. do not increase limits until the cause is understood
4. contain the faulty producer or roll back a regression before relaxing protection

### `security.control_misconfigured`

Threshold: any production occurrence is actionable.

Response:

1. identify the fixed control identifier
2. confirm the intended provider/application state
3. fail closed where the control contract permits it without creating an unrecoverable account-lockout path
4. otherwise restore the last known-good configuration using the control's documented rollback procedure

## Vercel alert state

Vercel automated alert state: NOT CLAIMED

The connected Vercel surface can inspect deployments and Runtime Logs, but this Phase 9D work has not directly configured and verified an automated alert rule. The threshold definitions above are operational contracts only until a supported alert-mutation surface is used and the resulting rule is independently verified.

## Current browser security header baseline

`next.config.ts` currently provides:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `poweredByHeader: false`

Phase 9D adds regression coverage for this baseline. It does not replace these controls.

## CSP state

CSP state: NOT ENFORCED

There is no `Content-Security-Policy` response header in the current production application. Phase 9D does not add one merely to claim CSP coverage.

## Observed production resource and origin inventory

This inventory records only behavior observed in the current repository source.

### Same-origin application resources

The root layout imports local CSS files only. No runtime web-font provider is configured in `app/layout.tsx`.

Current landing/dashboard/WebGL visuals are implemented with application components, CSS, SVG primitives, gradients, and local application assets rather than remote rendering resources.

External GitHub links in public navigation/footer are navigation targets, not script/style/image execution origins and therefore do not justify widening CSP resource directives.

### Supabase browser connectivity

The browser Supabase client obtains its endpoint from:

`NEXT_PUBLIC_SUPABASE_URL`

The future `connect-src` policy therefore needs the exact configured production Supabase HTTPS origin in addition to `'self'`.

No application-source use of Supabase Realtime channels is currently present. A WebSocket origin must not be added merely because `@supabase/realtime-js` exists transitively. If Realtime becomes an actual browser feature later, its required secure WebSocket origin must be separately observed and added deliberately.

### Cloudflare Turnstile

When a public Turnstile site key is configured, the current client loads the official explicit-render script from:

`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`

A future CSP that supports active Turnstile must narrowly allow `https://challenges.cloudflare.com` in the provider-required script/frame directives and must be validated against a configured preview before enforcement.

### Inline style compatibility blocker

The current production component tree contains legitimate React inline style attributes, including dynamic positioning and progress/gradient rendering in landing/dashboard components and the Turnstile container.

Examples include:

- dynamic node positions in `LivingAttackSurface`
- dynamic labels in `CinematicSurface`
- metric/progress rendering in dashboard/landing components
- the Turnstile container layout

A strict `style-src` policy that rejects style attributes would therefore break the current UI. Phase 9D does not approve broad `style-src 'unsafe-inline'` simply to make an enforced CSP pass. The UI/style architecture or a narrowly proven CSP mechanism must be addressed in the later CSP sub-gate.

### Next.js script compatibility blocker

Next.js framework bootstrap/hydration behavior must be tested with the exact production build before a strict `script-src` is enforced. If nonce-based support is required, it must be integrated with the current routing/layout/middleware architecture and validated in preview. Phase 9D does not modify `app/layout.tsx` or middleware to force this prematurely.

## Target CSP properties

The eventual enforced policy should start from evidence rather than a copied template. Target properties are:

- `default-src 'self'`
- `object-src 'none'`
- `base-uri 'self'`
- `frame-ancestors 'none'`
- `script-src` restricted to same-origin/nonce or hash-based Next.js execution plus the exact Turnstile origin only when configured
- `style-src` restricted without a broad permanent `unsafe-inline` concession after current inline-style compatibility is resolved
- `img-src` limited to observed same-origin/data/blob needs only if those schemes are actually required by the final browser verification
- `font-src` limited to observed local resources
- `connect-src 'self'` plus the exact configured production Supabase HTTPS origin and no speculative provider origins
- Turnstile frame access limited to `https://challenges.cloudflare.com` only when the feature is configured

Not approved:

- wildcard third-party origins
- `unsafe-eval`
- a broad permanent `unsafe-inline` policy used only to silence compatibility failures
- unobserved WebSocket/provider origins

## CSP enforcement prerequisites

CSP enforcement remains a separate Phase 9D follow-up gate. It requires all of the following:

1. refresh the actual production UI baseline immediately before implementation
2. resolve current inline-style compatibility without a broad security concession
3. determine the exact Next.js script nonce/hash integration required by the deployed version
4. inventory exact production Supabase and Turnstile origins from configured preview behavior
5. test the full landing/dashboard/auth/WebGL application in preview
6. verify no browser CSP violations break required behavior
7. verify configured Turnstile auth still works
8. document exact rollback to the last known-good header configuration
9. run full candidate CI and production deployment verification on the exact policy tree

Until those conditions are met and separately approved, ScopeForge must continue to state that CSP is not enforced.

## Rollback model

Operational telemetry is non-authoritative. If the telemetry path itself causes a request regression, remove the telemetry integration while preserving the existing worker response/authentication behavior.

Audit metadata hardening can be rolled back only by a reviewed application-code rollback; the database schema is unchanged by Phase 9D.

Browser header regression tests pin the current known-good headers. This release makes no CSP header mutation, so there is no CSP production rollback action to perform.

## Release acceptance still required

Before Phase 9D is released, the branch must still prove:

- focused and full test execution on the frozen candidate
- exact-head Vercel Preview READY
- one harmless unauthenticated preview worker request produces the expected structured Runtime Log event
- that event contains only the allowlisted telemetry fields
- candidate CI and post-merge main CI are fully green
- exact production Vercel deployment is READY
- Supabase Security Advisor has no new regression
- all hosted runtime flags remain false/absent

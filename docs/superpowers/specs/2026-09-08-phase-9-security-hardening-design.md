# ScopeForge Phase 9 Security Hardening Design

Date: 2026-09-08
Status: Approved design, implementation not started
Repository: `LeDoNguyenTu/ScopeForge`
Branch: `feat/phase-9-security-hardening-v1`
Base `main`: `d4f37b85738fc08ba3483bf98bb0e5e900184449`

## 1. Purpose

Phase 9 hardens ScopeForge for public-launch readiness without weakening the authorization, isolation, reproducibility, or UI-stream boundaries established by earlier phases.

The phase is intentionally layered. Security controls should live at the layer with the strongest context:

- application code for application-specific validation and redirect safety
- Supabase Auth for password, authentication-rate-limit, and CAPTCHA enforcement
- Supabase Postgres for RLS, schema, function, and RPC privilege boundaries
- Vercel edge security for broad HTTP abuse controls
- application telemetry plus provider logs for security-significant operational visibility
- documented incident and rollback procedures for recovery

Phase 9 must not create a parallel authentication system, a second worker-authority model, or a second durable audit database.

## 2. Existing security baseline

The released baseline already provides important controls that Phase 9 must preserve.

### 2.1 Authentication/session baseline

- Supabase SSR is the authentication system.
- Server-side session refresh validates the user through `supabase.auth.getUser()`.
- Browser-facing Supabase access uses a publishable key.
- Privileged Supabase access is server-only.

### 2.2 Database baseline

- Every exposed `public` table has RLS enabled.
- User-facing row access is scoped through ownership or workspace-membership predicates.
- Worker tables are located in `private`.
- Worker-control RPCs are service-role restricted.
- Privileged database functions use `set search_path = ''`.
- Earlier phases intentionally preserve RPC-only worker authority.

### 2.3 Runtime baseline

The following hosted capability flags remain false or absent unless separately operationally accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

A Phase 9 code merge must not enable these flags.

### 2.4 HTTP baseline

`next.config.ts` currently sets:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- a restrictive `Permissions-Policy`
- HSTS with preload
- `poweredByHeader: false`

These controls remain in place unless a replacement is demonstrably stronger and fully tested.

## 3. Threat model

Phase 9 focuses on realistic public-launch threats that remain after the existing authorization work.

### 3.1 Authentication abuse

Threats:

- credential stuffing
- signup automation
- password spraying
- compromised-password reuse
- auth endpoint flooding
- replay or misuse of auth redirect parameters

Primary controls:

- Supabase leaked-password protection
- Supabase Auth rate limits
- Cloudflare Turnstile through Supabase Auth
- safe local-only return-path validation
- non-enumerating error behavior where practical

### 3.2 Application-layer abuse

Threats:

- high-rate API requests
- automated resource exhaustion
- repeated expensive operations from one source
- malformed requests intended to trigger expensive code paths

Primary controls:

- Vercel WAF/rate limiting for broad source-level abuse
- application-level workspace/user quotas only for operations whose semantics cannot be expressed at the edge
- existing task budgets and worker execution limits

### 3.3 Authorization bypass

Threats:

- BOLA/IDOR across workspaces
- direct access to private worker tables
- unintended invocation of privileged RPCs
- accidental broadening of private-schema/function privileges
- future RLS regressions

Primary controls:

- existing RLS model
- explicit privilege regression tests
- Supabase Security Advisor
- forward-only privilege-hardening migration where justified
- continued service-role-only worker RPCs

### 3.4 Redirect and navigation abuse

Current concrete finding:

- `/auth/callback` and `/auth/confirm` read `next` from the query string and pass it to `new URL(next, url.origin)` after successful auth/verification.
- Absolute URLs or protocol-relative destinations can therefore create an external post-auth redirect.

Required control:

- one shared parser that accepts only safe local application paths
- unsafe input falls back to `/dashboard`
- parser is used by both auth routes

### 3.5 Security-control drift

Current concrete finding:

- the authentication UI states that Cloudflare Turnstile will be enabled before public trial access
- there is currently no Turnstile implementation

Required control:

- either implement and operationally enable the control before public trial, or remove claims that imply an enabled control
- Phase 9 targets implementation and verified enablement

### 3.6 Sensitive-data leakage through telemetry

Threats:

- passwords or access tokens in logs
- refresh tokens in errors
- worker credentials or lease tokens in telemetry
- repository source or raw executor output appearing in logs
- unbounded exception serialization

Primary controls:

- structured allowlisted security events
- explicit secret/redaction tests
- bounded metadata
- provider logging used as transport, not as an excuse to log raw request state

## 4. Design principles

### 4.1 Layered enforcement

Do not reimplement controls that the platform already provides better.

- Supabase owns auth-native throttling, compromised-password checks, and auth CAPTCHA verification.
- Vercel owns broad edge traffic controls.
- ScopeForge owns business-semantic authorization and quotas.

### 4.2 Deny by default

Unknown redirect destinations, unexpected RPC privilege changes, malformed security-control configuration, and missing required production protection should fail closed where that does not create an account-lockout recovery hazard.

### 4.3 No security theater

Do not add a weak CSP, cosmetic CAPTCHA text, dummy rate limiter, or documentation-only control and call the system hardened.

A control counts only when it is:

1. implemented or configured at the enforcement layer
2. tested where testable
3. verified against the relevant production/staging state
4. documented with a rollback path

### 4.4 Preserve authority boundaries

Phase 9 must not introduce:

- client-held service-role credentials
- direct client writes to private worker state
- new browser authority over worker execution
- arbitrary hosted networking
- bypasses around the existing worker RPC model

## 5. Phase 9A - Authentication and redirect boundary

### 5.1 Shared safe return-path parser

Add one pure helper for post-auth navigation.

Input:

- nullable/untrusted query-string value

Output:

- a local application path beginning with `/`
- otherwise `/dashboard`

Reject at minimum:

- `https://attacker.example/...`
- `http://attacker.example/...`
- `//attacker.example/...`
- backslash-based host confusion
- control characters
- malformed URL-like input
- paths that normalize to an external origin

Preserve legitimate local query strings and fragments where safe.

Both `/auth/callback` and `/auth/confirm` must use the same helper.

### 5.2 Authentication errors

User-visible auth failures should remain useful without creating account-existence or policy-detail leaks beyond what Supabase already exposes.

Phase 9 should normalize messages at the UI boundary where appropriate rather than blindly returning raw provider error strings.

### 5.3 Leaked-password protection

Current live Supabase Security Advisor result contains one warning:

- `auth_leaked_password_protection`

Phase 9 release acceptance requires this warning to be cleared or an explicit documented reason why the account tier makes the control impossible.

If enabling the setting is supported by the current project plan, enable it only after the implementation branch has auth regression coverage and rollback notes.

### 5.4 Acceptance

Phase 9A is complete only when:

- hostile return-path tests pass
- both auth routes use the shared parser
- safe local redirects still work
- auth error behavior is reviewed for unnecessary leakage
- no Dashboard V5 files are changed

## 6. Phase 9B - Bot and abuse protection

### 6.1 Supabase Auth CAPTCHA

Use Supabase Auth's native CAPTCHA integration with Cloudflare Turnstile.

The browser obtains a Turnstile token and passes it through Supabase Auth's supported `captchaToken` option. Supabase remains the verification authority for auth CAPTCHA.

Do not create an independent custom `/siteverify` authentication path unless Supabase's current supported integration proves insufficient.

### 6.2 Dependency isolation

PR #49 currently changes `package.json` and `app/layout.tsx`.

Therefore, while PR #49 remains active:

- avoid introducing a new Turnstile React package if a dependency-free supported integration can meet the requirements
- if a package is genuinely required, sequence that change after PR #49 or rebase only after the UI stream is stable
- do not modify `app/layout.tsx` from the Phase 9 branch while PR #49 remains active

### 6.3 Auth rate limits

Use Supabase Auth's current configurable rate limits as the primary authentication throttle.

Do not add an application in-memory limiter for authentication because serverless instance-local counters are not a reliable global control.

### 6.4 Vercel edge abuse controls

Use Vercel WAF/rate limiting for broad application/API traffic where the current plan supports the needed rule semantics.

Rules must be designed to avoid challenging or blocking trusted worker-machine traffic solely because it is non-browser traffic.

Any edge rule change requires:

- documented match criteria
- expected allow/block/challenge behavior
- rollback instructions
- verification against production or an equivalent staging target

### 6.5 Business-semantic quotas

Only introduce application-level quotas where identity/workspace semantics are necessary, for example an expensive operation whose abuse cannot be represented safely with an IP-only WAF rule.

Reuse existing usage/task-budget concepts where practical.

Do not create a generic quota subsystem unless multiple real callers require it.

## 7. Phase 9C - Database and RPC defense-in-depth

### 7.1 Preserve current RLS model

All exposed `public` tables must remain RLS-enabled.

Tests should explicitly cover:

- no cross-workspace read access
- self-only profile access
- admin/owner workspace mutation boundaries
- read-only tables remaining read-only to ordinary authenticated users

### 7.2 Private schema

Current live state:

- private worker tables have no direct ordinary-client table grants
- `authenticated` currently has `USAGE` on schema `private`
- several RLS policies intentionally call `private.is_workspace_member` or `private.has_workspace_role`

Therefore, Phase 9 must not blindly execute `REVOKE USAGE ON SCHEMA private FROM authenticated`.

Instead:

1. inventory every ordinary-user dependency on private helper functions
2. verify exact function execute grants
3. remove unnecessary execute privileges from private functions
4. preserve only the minimum schema/function access required by RLS evaluation and intended user flows

### 7.3 Function privileges

Security-definer functions must continue to:

- use pinned/empty search paths
- avoid relying on user-controlled metadata for authorization
- be executable only by roles that genuinely require them

Trigger-only or internal helpers should not retain broad direct execute access merely because Postgres default privileges granted it historically.

### 7.4 Worker RPC regression suite

Add database/security regression evidence proving:

- `anon` cannot invoke worker-control RPCs
- ordinary `authenticated` users cannot invoke service-role worker-control RPCs
- ordinary clients cannot directly mutate private worker tables
- worker RPC service-role access remains functional after privilege tightening

### 7.5 Migration rules

All schema/privilege changes are forward-only.

Never rewrite an already-deployed migration.

Before a production migration is accepted:

- inspect the generated migration exactly
- verify affected grants/policies/functions
- run the relevant test query/regression suite
- run Supabase Security Advisor after the change

## 8. Phase 9D - Security telemetry and browser hardening

### 8.1 Durable audit events

Reuse `public.audit_events` for low-frequency, security-significant durable events that belong to a workspace security history.

Examples may include:

- privileged workspace membership changes
- security-sensitive lifecycle transitions
- explicit worker/node administrative actions
- authorization-affecting configuration changes

Do not write heartbeat-scale events to `audit_events`.

### 8.2 Operational security logs

Use bounded structured logs for operational events such as:

- repeated authorization failures
- rejected malformed trusted-worker requests
- rate-limit decisions
- security-control misconfiguration
- provider integration failures relevant to security posture

Do not log:

- passwords
- Supabase access tokens
- Supabase refresh tokens
- service-role keys
- worker credentials
- lease tokens
- repository source
- raw executor stdout/stderr
- complete environment dumps
- arbitrary request bodies

### 8.3 Alerts

Define actionable thresholds rather than alerting on every failure.

Each alert definition needs:

- signal
- threshold/window
- expected responder action
- false-positive considerations
- rollback/containment action where applicable

### 8.4 CSP staging

Do not add a permissive CSP simply to claim coverage.

Because the active Dashboard V5 stream modifies `app/layout.tsx`, CSP work that requires per-request nonces or layout integration is deferred until that stream is stable.

Phase 9 may still:

- inventory required script/style/connect/image/frame origins
- define the target policy
- add CSP reporting in a non-conflicting way only if it is technically sound

Full nonce-based enforcement is a later Phase 9 sub-gate once the UI stream no longer conflicts.

## 9. Phase 9E - Incident readiness and launch gate

### 9.1 Security policy

Expand the current minimal disclosure text into an operational policy covering:

- private vulnerability reporting route
- expected acknowledgement process
- scope boundaries
- coordinated disclosure expectations
- prohibited public disclosure of active exploit details before remediation

Do not publish sensitive operational contact data that is not intended to be public.

### 9.2 Incident runbook

Document at minimum:

1. detection and severity classification
2. initial containment
3. worker/runtime flag disablement where relevant
4. credential/key rotation order
5. Supabase containment/recovery actions
6. Vercel rollback/traffic-control actions
7. data-impact assessment
8. evidence preservation without collecting secrets
9. recovery validation
10. post-incident review

### 9.3 Release security checklist

The final Phase 9 release gate must include evidence for the exact release SHA:

- focused/full tests as appropriate
- typecheck
- CLI build/version
- scanner and benchmark regressions required by permanent CI
- production build
- npm audit
- Supabase Security Advisor
- database privilege/RLS regression evidence
- exact production Vercel deployment READY
- edge-security configuration verified
- auth abuse controls verified
- no unauthorized runtime capability flag enablement
- no Dashboard V5 contamination
- rollback steps documented

## 10. Implementation sequencing

Recommended order:

1. Phase 9A safe auth redirect and auth error hardening
2. Phase 9C database privilege regression coverage and minimum-privilege migration design
3. Phase 9B Turnstile and abuse-control implementation
4. Phase 9D telemetry and alert contracts
5. Phase 9E incident/release engineering
6. CSP enforcement only after Dashboard V5 no longer conflicts

Reasoning:

- close the concrete open redirect first
- establish database regression evidence before tightening privileges
- add provider-level abuse controls after application auth semantics are stable
- observability should describe stable controls, not moving targets
- launch documentation should record the final system rather than assumptions

## 11. Branch and UI isolation

Phase 9 uses `feat/phase-9-security-hardening-v1`.

While PR #49 is active, Phase 9 must not edit, merge, retarget, replace, or deploy the Dashboard V5 branch.

Current PR #49 overlap that must be treated carefully:

- `app/layout.tsx`
- `package.json`

Phase 9 should avoid these files until sequencing makes the conflict unnecessary or the UI branch is stable.

The following Phase 9 surfaces currently have no PR #49 overlap and are preferred for early work:

- `app/auth/callback/route.ts`
- `app/auth/confirm/route.ts`
- `components/AuthForm.tsx`
- `lib/supabase/*`
- `middleware.ts`
- `next.config.ts`
- new security-focused helpers/tests
- forward-only Supabase migrations
- security/incident documentation

## 12. Testing strategy

Use test-driven development for executable changes.

### Unit tests

- safe return-path parser
- auth error normalization helpers
- log-redaction/allowlist helpers if introduced
- configuration parsers if introduced

### Route/component tests

- auth callback and confirmation redirects
- sign-in/sign-up CAPTCHA token flow
- missing/expired CAPTCHA behavior
- safe fallback behavior when protection configuration is absent in local/test environments

### Database tests

- RLS cross-workspace isolation
- private-table direct access denial
- worker RPC role denial
- intended service-role worker RPC success
- helper-function privilege behavior after migration

### Integration/preflight

- build/typecheck
- permanent scanner benchmarks
- npm audit
- Supabase advisor checks
- exact-head Vercel preview/deployment verification

Do not use GitHub Actions as the first debugging loop. Intermediate implementation commits should use `[skip ci]` where Actions adds no new executable evidence. Reserve full CI for a frozen candidate.

## 13. Operational-change safety

Production configuration changes are not implied by code approval.

Any irreversible or availability-sensitive change needs its own verified preconditions and rollback path.

Examples:

- enabling CAPTCHA before the client supplies valid tokens can lock out auth
- tightening schema/function grants without proving RLS helper behavior can break legitimate access
- aggressive WAF rules can block real users or trusted workers
- CSP enforcement can break the active application if source requirements are incomplete

Therefore, implementation and production enablement remain separate gates.

## 14. Explicit non-goals

Phase 9 does not:

- redesign Dashboard V5
- add new scanner families
- expand active scanning authority
- enable hosted workers merely because hardening is complete
- create a new identity provider
- replace Supabase Auth
- replace the existing audit data model
- create a generic distributed rate-limit service without demonstrated need
- claim compliance certification
- claim penetration-test completion unless an actual accepted penetration test is performed

## 15. Completion criteria

Phase 9 is complete only when all applicable sub-gates have evidence and the release candidate remains within the approved authority boundary.

Minimum release outcome:

- post-auth open redirect eliminated
- leaked-password protection warning resolved where supported
- Turnstile/auth abuse protection implemented and verified before public trial
- broad edge abuse controls documented and verified
- private-schema/RPC privilege surface minimized without breaking RLS or worker authority
- security-sensitive operational telemetry is bounded and secret-safe
- incident and rollback procedures are usable
- exact release SHA passes the final validation gate
- exact production deployment is READY
- Dashboard V5 remains isolated
- runtime enablement flags remain unchanged unless separately accepted

# Phase 9B Provider and Edge Abuse Hardening Design

Date: 2026-09-08

Status: approved Phase 9 subdesign, adapted to the current production UI baseline

## Goal

Strengthen ScopeForge's public authentication and HTTP abuse boundary using native provider/edge controls while preserving the production UI and existing Phase 9A authentication behavior.

Phase 9B must not introduce a parallel authentication service, a custom rate-limit datastore, a UI redesign, database privilege changes, CSP changes, telemetry changes, or hosted worker authorization.

## Authoritative baseline

Start from production `main` checkpoint:

`fc7c4369c7075d22c3ad918bea3e17b1e1df5c2b`

The executable production release immediately below that docs checkpoint is:

- merge: `0869767401011cd32dcd3e3b2976201461655e02`
- tree: `ca68a0559af93fc3b2143fdec387b84e418bb141`
- production deployment: `dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N`, READY on `scopeforge.dev`
- main CI #771: success

The current production UI on `main` is authoritative. PR #49 remains an open draft legacy UI branch and is out of scope.

## Live provider constraints discovered before design freeze

### Supabase

ScopeForge project:

`tdgpibrepzcvdivztkta`

Organization plan:

`free`

Live Security Advisor currently reports:

`auth_leaked_password_protection`

Supabase's current documentation states leaked-password protection is available on paid plans. Therefore Phase 9B cannot truthfully close that advisor warning on the current Free plan without a billing-tier change. No automatic upgrade is authorized by this design.

The connected Supabase control surface exposes database/project operations and documentation but does not expose hosted Auth configuration read/write operations. Therefore this session cannot safely claim to have enabled CAPTCHA provider configuration or changed Auth rate limits unless a separate supported management surface becomes available.

Current Supabase documentation confirms:

- Cloudflare Turnstile is supported by Supabase Auth for sign-in and sign-up
- the browser passes the verified challenge token as `options.captchaToken`
- native Supabase Auth rate limits already protect auth endpoints
- rate-limit settings are managed through Auth configuration / Management API where supported

### Vercel

The connected Vercel surface can inspect deployments/logs/docs but does not expose live firewall configuration read/write operations in this session.

Current Vercel documentation confirms custom firewall rules and rate-limiting controls exist, but Phase 9B must not claim any WAF rule is active unless the live project firewall is actually inspected and mutated through a supported authenticated surface.

## Architecture choice

Use three layers, each doing only the job it is already designed for:

1. Supabase Auth remains the authentication authority and native auth-endpoint rate limiter.
2. Cloudflare Turnstile provides a browser bot challenge whose token is passed directly to Supabase Auth.
3. Vercel Firewall remains the broad HTTP/IP abuse layer when live configuration access is available.

No custom server endpoint proxies credentials to Supabase. No new rate-limit database, Redis instance, Edge Config counter, or application middleware limiter is introduced in Phase 9B.

## Turnstile client integration

### Dependency policy

Do not add `@marsidev/react-turnstile` or another runtime dependency unless the native integration proves materially inadequate.

Implement a small local React component around Cloudflare's official explicit-render script:

`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`

Use Next.js `Script` so script loading is deduplicated by the framework.

### Component boundary

Create:

`components/auth/TurnstileChallenge.tsx`

Responsibilities:

- render the Cloudflare widget into one owned container
- emit a token on successful challenge completion
- clear the token on expiry or widget error
- clean up/remove the widget on unmount where the API supports it
- contain all `window.turnstile` typing and script lifecycle behavior

It must not know about Supabase, passwords, email addresses, redirects, sessions, or AuthForm messages.

### AuthForm integration

Preserve the current production AuthForm hierarchy, labels, buttons, messages, links, icons, and classes.

Add only a compact challenge slot within the existing form flow.

AuthForm accepts the site key from:

`NEXT_PUBLIC_TURNSTILE_SITE_KEY`

The site key is intentionally public. No secret is stored in the repository or a `NEXT_PUBLIC_` variable.

Behavior:

- if the site key is absent/blank, AuthForm behaves exactly as it does today
- if the site key is present, the challenge becomes required before form submission
- while required and unsolved, the existing submit button is disabled
- on success, AuthForm stores the token only in component memory
- sign-up passes `options: { data, captchaToken }`
- sign-in passes `options: { captchaToken }`
- challenge tokens are cleared/remounted after a failed auth attempt and after successful sign-up that requires email confirmation
- no token is persisted in localStorage, cookies, URL parameters, logs, audit metadata, or Supabase user metadata

This configuration-gated behavior is deliberate. The code can be safely deployed before production provider activation. The real production site key should be added only in coordination with the matching Cloudflare secret being enabled in Supabase Auth, avoiding a partial rollout that either locks out users or falsely displays an unenforced challenge.

## Styling and current UI compatibility

Do not redesign AuthForm.

Add at most one small `.authCaptcha`/equivalent wrapper rule in the current auth stylesheet if needed for centering/spacing. It must inherit the existing card width/responsive behavior and must not modify landing, dashboard, WebGL, navigation, typography, or global layout composition.

The widget must fit the current mobile auth card. If Cloudflare's normal widget width is too large for the smallest supported viewport, use the provider's responsive/flexible sizing capability rather than expanding the auth card.

## Provider activation gate

Production CAPTCHA enforcement requires both sides to be configured together:

1. Cloudflare Turnstile widget created for `scopeforge.dev` and intended preview/local hosts as appropriate.
2. Real site key stored in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for the intended environment(s).
3. Matching Turnstile secret configured in Supabase Auth Bot and Abuse Protection with provider set to Cloudflare Turnstile.
4. Production sign-in and sign-up canary proves valid tokens succeed and missing/invalid tokens fail.
5. Rollback is documented: remove/disable Supabase CAPTCHA enforcement first, then remove the public site-key environment variable if needed.

Because no connected Cloudflare plugin or Supabase Auth-config write action is available in this session, Phase 9B code may be released in dormant mode while the provider activation remains an explicit operational gate. That must be reported honestly.

## Leaked-password protection gate

The live organization is on Supabase Free. The current advisor warning cannot be closed without a paid-plan capability.

Phase 9B therefore records:

- current warning remains open
- no billing upgrade is performed automatically
- if/when the organization is moved to a plan that supports leaked-password protection, enabling it and rerunning Security Advisor becomes a launch-security gate

Do not weaken local password rules or invent an application-side HaveIBeenPwned proxy as a substitute.

## Auth rate limits

Keep Supabase native Auth rate limiting as the primary auth-endpoint protection.

Do not introduce a custom Next.js auth limiter in Phase 9B.

When live Auth configuration read access becomes available, record the exact configured limits before changing any value. Adjust only with evidence of a concrete abuse/availability problem. Defaults and provider-managed email limits remain preferable to speculative tuning.

## Vercel WAF boundary

Recommended operational intent when a live authenticated firewall-management surface is available:

- keep Vercel managed DDoS/firewall protections enabled
- use rate limiting or challenge rules for clearly browser-facing abusive traffic patterns
- do not put generic interactive challenges in front of worker/control endpoints
- do not challenge Next.js static/image assets
- avoid broad rules that can break Supabase callbacks, email confirmation, or normal authenticated navigation
- start new custom rules in log/disabled/staged form where supported, inspect impact, then enforce

Any actual rule must be documented by exact rule ID/name/conditions/action and have an explicit rollback operation.

No WAF state is considered accepted merely because code or docs describe a desired rule.

## Testing strategy

Use TDD.

### Turnstile component tests

Test the local wrapper for:

- explicit widget render after script availability
- successful token callback
- expired token clearing
- error token clearing
- cleanup/removal
- no duplicate widget render on ordinary React rerender

Mock only the external `window.turnstile` browser API. Assertions must cover the real local component behavior.

### AuthForm tests

Extend the existing `tests/components/AuthForm.test.tsx` coverage to prove:

- existing no-site-key sign-in behavior remains unchanged
- when configured, submit is disabled until a Turnstile token is received
- sign-in passes `options.captchaToken`
- sign-up passes both user data and `options.captchaToken`
- challenge resets after provider failure
- Phase 9A bounded error messages remain unchanged
- no raw provider message or challenge token is rendered

### Architecture guard

Add a focused Phase 9B architecture test that rejects:

- Turnstile secret names under `NEXT_PUBLIC_`
- credential/token persistence in browser storage or URLs
- a new custom auth-rate-limit datastore/package introduced by this phase
- edits to hosted runtime flags
- edits to Phase 9C database migration authority

## Release verification

Before Phase 9B code release:

- focused tests green
- full Vitest suite green
- typecheck green
- CLI build/version green
- npm audit green
- historical benchmark green
- Phase 8B matrix green
- production Next.js build green
- exact-head Vercel Preview READY
- production UI visual/auth route remains functional
- frozen PR candidate CI green
- exact merge SHA independently verified in production

Provider activation is a separate acceptance dimension. If the real Turnstile provider configuration cannot be changed through available tools, the release record must distinguish:

- Turnstile-capable application code: released
- production CAPTCHA enforcement: pending operational configuration

## Explicit non-goals

Phase 9B does not:

- change database/RLS/function ACLs
- add CSP
- add security telemetry/log pipelines
- rewrite incident response docs
- enable hosted workers
- merge or modify PR #49
- add passkeys/MFA/social login
- upgrade Supabase billing
- add custom SMTP
- add an application-side password breach-check service

## Acceptance boundary

Phase 9B is complete only when its code and platform-state claims are separated precisely.

A code release can complete even if production Turnstile enforcement remains pending because external provider credentials/configuration are unavailable through the connected surface. In that case the handoff must name the exact remaining provider steps and must not describe CAPTCHA, leaked-password protection, or Vercel WAF rules as enabled.

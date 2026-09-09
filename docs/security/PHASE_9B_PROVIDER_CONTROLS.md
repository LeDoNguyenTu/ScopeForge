# Phase 9B Provider Controls

Last reconciled: 2026-09-08 (Asia/Singapore)

This document separates released application capability from hosted provider state. No provider control is described as enabled without direct evidence from the corresponding control surface.

## Current state

- Supabase project: `tdgpibrepzcvdivztkta`
- Supabase leaked-password protection: NOT ENABLED - current organization plan is Free.
- Supabase native Auth rate limits: provider-native protection retained; exact hosted configuration is not readable through the connected Supabase surface used for this phase.
- Turnstile-capable application code: configuration-gated. It is releaseable only after repository validation passes.
- Production Turnstile enforcement: PENDING until the real Cloudflare site key and secret, Supabase Auth provider configuration, and Vercel public site-key environment variable are configured together and canaried.
- Vercel WAF custom rule state: NOT CLAIMED - the connected surface can inspect deployments, logs, and documentation but does not expose live firewall rule mutation for this phase.
- Hosted scanner and worker runtime authority: unchanged and not authorized by Phase 9B.

## Turnstile application boundary

ScopeForge reads only the public site key from:

`NEXT_PUBLIC_TURNSTILE_SITE_KEY`

The browser-side Turnstile wrapper emits a one-time challenge token to `AuthForm`. The token is kept only in React component memory and is passed directly to Supabase Auth as `options.captchaToken` for configured sign-in and sign-up attempts.

The challenge token must not be written to localStorage, sessionStorage, cookies, URL parameters, logs, audit metadata, or user metadata.

If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is absent or blank, the production sign-in and sign-up call shapes remain unchanged and no challenge is rendered.

## Production activation order

Production CAPTCHA enforcement is accepted only after all of the following are completed together:

1. Create or confirm the Cloudflare Turnstile widget for `scopeforge.dev` and any intentionally supported preview/local hosts.
2. Store the public site key in the intended Vercel environment as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Configure the matching Turnstile secret in Supabase Auth Bot and Abuse Protection and select Cloudflare Turnstile as the CAPTCHA provider.
4. Verify production sign-in with a valid challenge token succeeds.
5. Verify production sign-up with a valid challenge token succeeds subject to normal account policy.
6. Verify missing or invalid challenge tokens are rejected by Supabase Auth when enforcement is enabled.
7. Confirm ordinary auth navigation and email-confirmation flows remain functional.

Do not enable only one side of the integration and describe the system as protected. A public site key without matching Supabase enforcement is only UI capability, while provider enforcement without a working public challenge can lock out users.

## Rollback order

If CAPTCHA activation causes authentication failures, disable Supabase CAPTCHA enforcement first. This restores provider acceptance of normal authentication requests. After provider enforcement is disabled, remove the public site-key environment variable from the affected Vercel environment if the challenge UI also needs to be withdrawn.

Do not remove the public site key first while Supabase still requires CAPTCHA tokens.

## Leaked-password protection

The live Supabase Security Advisor warning remains open because leaked-password protection is not available on the current Free organization plan.

No billing upgrade is authorized by Phase 9B. Do not replace the provider feature with an application-side password-breach proxy. If the organization later moves to a plan that supports leaked-password protection, enable the provider control through an authorized management surface and rerun Security Advisor before claiming the warning is closed.

## Auth rate limits

Supabase remains the authentication authority and its native Auth rate limits remain the primary auth-endpoint abuse control.

Phase 9B introduces no custom Next.js rate limiter, Redis counter, Edge Config counter, database rate-limit table, or new rate-limit package. Hosted limits should be changed only after their exact current configuration is readable and there is evidence of a concrete abuse or availability issue.

## Vercel firewall boundary

Vercel remains the intended broad HTTP/IP abuse layer. No custom WAF rule is considered active or accepted in this phase without direct live rule evidence.

When a supported firewall-management surface is available, new rules should be staged narrowly around browser-facing abusive patterns. Do not place generic interactive challenges in front of worker/control endpoints, static assets, Supabase auth callbacks, or normal authenticated navigation without explicit testing.

Every enforced custom rule must be recorded by exact rule identity, conditions, action, deployment environment, canary evidence, and rollback operation.

## Runtime boundary

Phase 9B does not enable hosted repository acquisition, repository scanning, passive runtime workers, or active CORS workers. Their independent capability flags remain false or absent until their own operational acceptance gates complete.

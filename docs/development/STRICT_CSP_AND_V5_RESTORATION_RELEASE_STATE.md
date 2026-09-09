# Strict CSP and V5 Restoration Release State

Last reconciled: 2026-09-10 (Asia/Singapore)

## Status

Released and verified on production `main`.

This record closes two consecutive compatibility boundaries:

1. strict nonce-based Content Security Policy enforcement through PR #66
2. restoration of the previously accepted Command Center V5 presentation through PR #67 without weakening that CSP

## Strict CSP release

PR #66: `Strict CSP compatibility gate`

- frozen head: `98ca45e46c83cafcacef4d87971907196724f40f`
- frozen tree: `deb308794e93b05ed6f20366dcf6156b93bb000a`
- candidate CI: #794, run `34382364401`, success
- candidate Vercel Preview: `dpl_697F2soQBLYSQkMsdkMXKtiF3jtd`, READY
- squash merge: `191a7ee1c93f179adad51f108d4ad1fade2e78f2`
- production deployment for the CSP merge: `dpl_2nNgDZDkMMem67h1drBaVJtMsYpN`, READY

The production policy is nonce-based and intentionally narrow. It does not add permanent production `unsafe-inline` or `unsafe-eval` allowances. The application carries the nonce into framework scripts/styles, retains the existing security-header baseline, limits browser connections to the exact configured ScopeForge Supabase HTTPS origin, and keeps third-party framing closed when Turnstile is not configured.

The repository CI includes real Chrome/ChromeDriver browser acceptance covering CSP execution, hydration, navigation, auth forms, application-owned 404 behavior, the unauthenticated dashboard boundary, console failures, and the public V5 WebGL path.

## V5 restoration release

PR #67: `Restore approved V5 UI`

The strict CSP rollout exposed a presentation regression in the previously approved V5 authenticated dashboard. Restoration work preserved the security baseline rather than relaxing CSP.

Final frozen candidate:

- head: `e66b6fc4b8693deb052fa89ae9d82647d51c3a94`
- candidate CI: #802, run `34395508634`, success
- exact-head Vercel Preview: `dpl_AoyDGZEcsMZ1BYkqhn33MyugUtTH`, READY, `aliasError=null`
- corrected visual acceptance artifact: GitHub Actions artifact `10121486960`
- artifact contains `landing-v5-desktop.png` and `dashboard-v5-desktop.png`
- both corrected screenshots were inspected before merge

The visual acceptance gate now rejects presentation regressions rather than checking only DOM presence. At the desktop acceptance viewport it verifies the public V5 hero/metric/scene scale and the authenticated immersive dashboard shell, headline scale, topology geometry, metric scale, lower-panel width/layout, and absence of the superseding SaaS/workspace-shell composition.

The authenticated topology uses a CSP-safe SVG presentation path. The final CSS cascade explicitly preserves the accepted immersive V5 dashboard after the older refinement layers.

Release merge:

- squash merge / current executable release: `a84478dfe1d361f6d9fa3d67f0e26ea9b2088e54`
- release tree: `f2a39880347444967f2f2b0e2eb78d63342afbef`
- post-merge `main` CI: #803, run `34396470298`, success
- every validation step passed, including audit, full tests, typecheck, CLI build/version, both benchmark gates, production Next.js build, real-browser CSP/V5 restoration smoke, and screenshot publication

## Production evidence

Exact production deployment:

- deployment: `dpl_3F4rnzhWQ93RoPKqdTe4U96TPSKb`
- Git SHA: `a84478dfe1d361f6d9fa3d67f0e26ea9b2088e54`
- target: production
- state: READY
- `aliasError=null`
- `scopeforge.dev` is an active alias

Fresh production checks after deployment confirmed:

- `https://scopeforge.dev/` returns HTTP 200
- desktop V5 marker is present
- mobile V5 marker is present
- desktop and mobile V5 poster assets are present
- framework scripts/styles receive per-request nonces
- enforced CSP is present
- production CSP contains no `unsafe-inline` or `unsafe-eval`
- HSTS remains present
- `X-Content-Type-Options: nosniff` remains present
- `X-Frame-Options: DENY` remains present
- `Referrer-Policy: strict-origin-when-cross-origin` remains present
- restrictive `Permissions-Policy` remains present
- `/auth/sign-in` returns HTTP 200 and renders the email/password form under the same nonce CSP
- no error/fatal runtime logs were observed for the exact production deployment in the post-release inspection window

## Supabase and provider truth

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Fresh Security Advisor inspection after the release reports only the known `auth_leaked_password_protection` warning. Leaked-password protection is therefore still verified disabled. This release made no database migration or Auth-provider mutation.

Conservative provider state remains:

- production Turnstile provider enforcement: `NOT VERIFIED`
- Vercel custom WAF/rate-limit rule state: `NOT VERIFIED`
- Supabase leaked-password protection: `VERIFIED DISABLED`
- strict CSP: `ENFORCED`

The current Vercel connector does not expose project environment-variable values, so a fresh direct read of the four hosted runtime flags is `NOT VERIFIED BY CURRENT CONNECTOR`. No Vercel environment mutation or hosted-runtime activation was performed by PR #66 or PR #67. The operational requirement remains that these flags stay false/absent until their independent acceptance gates authorize them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Branch hygiene

A fresh branch audit still shows historical `diag/*`, `preview/*`, reconciliation, completed feature/docs branches, and temporary V5 restoration branches.

The connected GitHub write surface still has no genuine delete-ref operation. These refs must not be disguised as deleted by force-moving them to `main`. Physical cleanup remains pending a true branch-deletion surface.

## Release boundary

The executable production baseline is now `a84478dfe1d361f6d9fa3d67f0e26ea9b2088e54`.

Future work must preserve both properties of this baseline:

- the accepted Command Center V5 public and authenticated presentation
- the enforced strict nonce CSP and existing authorization/runtime safety boundaries

Provider activation and hosted-runtime canaries remain independent operational decisions and are not authorized by this release record.

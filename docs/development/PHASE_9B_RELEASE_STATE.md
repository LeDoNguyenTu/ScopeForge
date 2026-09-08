# ScopeForge Phase 9B Release State

Released: 2026-09-08 (Asia/Singapore)

## Release identity

- PR: #60 - `Phase 9B provider and edge hardening`
- frozen candidate: `3d9d3c3aef3faef8f6706c53673fb0fcaad802bb`
- frozen candidate tree: `9980aa5a58014998fd26ae7084bd97c992bc1a82`
- candidate Vercel Preview: `dpl_FcFdrKhr31kgQHWjS723yZ4D49AT`, READY, `aliasError=null`
- candidate CI: #773, run `34236014666`, success
- squash merge: `f203168e6ae25455743849f08511e371d3964153`
- released tree: `9980aa5a58014998fd26ae7084bd97c992bc1a82`
- post-merge main CI: #774, run `34236559722`, success
- exact production deployment: `dpl_AM7VULiVFxKW1imXGiWpfs4Sx62z`
- deployment target: production
- deployment Git SHA: `f203168e6ae25455743849f08511e371d3964153`
- deployment state: READY
- production alias includes `scopeforge.dev`
- `aliasError=null`

The squash merge preserved the exact frozen candidate tree.

## Released authentication hardening

Phase 9B adds a dependency-free Cloudflare Turnstile integration boundary to the existing production authentication UI.

Released behavior:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` absent or blank preserves the existing sign-in/sign-up behavior and Supabase call shapes
- when a site key is configured, auth submit remains disabled until a challenge token exists
- sign-in passes the one-time token as `options.captchaToken`
- sign-up preserves display-name metadata and adds `captchaToken`
- CAPTCHA tokens stay in React component memory only
- failed or non-redirecting configured attempts invalidate the token and remount the challenge
- expiry and provider errors clear the token
- widget cleanup removes the rendered Turnstile instance
- narrow auth cards use compact sizing while wider cards use flexible sizing
- Phase 9A bounded browser-visible auth errors remain intact

Phase 9B did not add a runtime package dependency, database migration, dashboard change, landing-page change, CSP change, telemetry subsystem, or hosted worker authority.

## Merge and UI reconciliation

The user requested that concurrent UI-stream changes on `main` be preserved before release.

Before freeze and before merge, the exact current `main` SHA was repeatedly re-read and PR #60 remained `mergeable=true`. The Phase 9B executable file set did not overlap the current production landing/dashboard UI changes. No real Git conflict surfaced, so no artificial conflict-resolution commit was created.

The merge was pinned to expected head `3d9d3c3aef3faef8f6706c53673fb0fcaad802bb`; GitHub accepted it against the unchanged tested base. The current production UI is therefore preserved in the released tree.

PR #49 remains an open draft legacy UI branch and is not the Phase 9 hardening baseline.

## Verification

Both the frozen candidate and merged production tree passed:

- npm dependency installation
- `npm audit --audit-level=info`
- full Vitest suite
- TypeScript typecheck
- CLI build and version check
- historical scanner benchmark
- Phase 8B benchmark matrix
- production Next.js build

The exact production deployment independently compiled successfully, completed type validation, generated all static pages, and reached READY with `aliasError=null`.

## Provider operational truth

Fresh post-release Supabase Security Advisor still reports exactly one warning:

`auth_leaked_password_protection`

This means leaked-password protection is still not enabled.

Code support for Turnstile is released, but production Turnstile enforcement is not claimed until external provider configuration and the browser-visible site-key configuration are directly verified.

Vercel WAF custom-rule state is also not claimed because no supported inspected mutation/evidence surface has proved an active project-specific rule set.

Supabase native Auth rate limiting remains the primary auth-endpoint rate-limiting layer.

Provider activation and rollback guidance remains in:

`docs/security/PHASE_9B_PROVIDER_CONTROLS.md`

Do not describe Turnstile, leaked-password protection, or project-specific WAF rules as actively enforced without fresh provider evidence.

## Next boundary

Phase 9D is next: security telemetry and browser hardening.

Its approved direction is to reuse the existing durable audit path for security-significant events, use privacy-reduced structured server logs for high-frequency operational signals, preserve the existing security-header baseline, and stage CSP only after compatibility proof against the actual production Next.js/WebGL UI.

Phase 9E follows with incident response, disclosure, credential rotation, rollback, recovery validation, and final public-launch security procedures.

## Runtime boundary

Phase 9B authorizes no hosted scanner or worker runtime. Keep all four hosted capability flags false/absent until their independent operational gates pass:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

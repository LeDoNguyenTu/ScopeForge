# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-08 (Asia/Singapore)

## Phase status

- Phase 9 architecture: approved
- Phase 9A authentication boundary: complete and released
- Phase 9B provider/edge abuse controls: next implementation boundary
- Phase 9C database/RPC defense-in-depth: complete and released
- Phase 9D security telemetry/browser hardening: pending after 9B
- Phase 9E incident/release hardening: pending after 9D

## Authoritative integration baseline

Current production `main`:

`0869767401011cd32dcd3e3b2976201461655e02`

Current production tree:

`ca68a0559af93fc3b2143fdec387b84e418bb141`

Current production deployment:

`dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N`

It is READY on `scopeforge.dev` with `aliasError=null`.

The current production UI is part of this baseline and must be preserved by Phase 9B/9D/9E. PR #49 remains an open draft legacy UI branch and is not the implementation baseline.

## Phase 9A release

Phase 9A remains released via PR #58. It provides safe local-only post-auth navigation, same-origin callback/confirmation redirects, hostile return-target rejection, and bounded browser-visible authentication errors.

## Phase 9C release

Dedicated release state:

`docs/development/PHASE_9C_RELEASE_STATE.md`

Release identity:

- PR #59
- frozen candidate `421dcb3b1a7a6243fdaac546f362653937254878`
- candidate tree `780be0767723abdaf4b7f67012050c836f15d736`
- candidate CI #770 success
- squash merge `0869767401011cd32dcd3e3b2976201461655e02`
- merge tree `ca68a0559af93fc3b2143fdec387b84e418bb141`
- post-merge main CI #771 success
- production deployment `dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N` READY

Live migration history:

`20260908084554_phase_9c_function_acl_hardening`

Live acceptance remains:

- 17 target trigger-only functions have no direct execution for broad application roles
- two authenticated RLS helper functions remain operational
- private worker tables remain closed to ordinary browser roles
- privileged public worker/control RPCs remain closed to `anon` and `authenticated`
- target triggers remain enabled
- relevant `SECURITY DEFINER` functions retain pinned empty search paths
- authenticated RLS membership/role evaluation passed

The permanent future-function guard is repository-level explicit revocation in each later application-function migration. Do not apply a global `postgres` default-function revoke and do not change `supabase_admin` defaults.

## Phase 9B starting state

Current live Supabase Security Advisor still reports:

`auth_leaked_password_protection`

Current production `components/AuthForm.tsx`:

- uses current production visual structure/classes
- uses direct Supabase `signUp` / `signInWithPassword`
- uses Phase 9A normalized browser-visible errors
- has no Turnstile integration yet

Phase 9B must preserve the current AuthForm design while adding provider/edge protection.

Approved direction:

- Supabase native Auth rate limits remain primary auth endpoint rate limiting
- leaked-password protection becomes an explicit provider acceptance gate
- Cloudflare Turnstile protects sign-in/sign-up before public trial access
- browser gets only the Turnstile site key; secret remains server/provider-side
- Vercel WAF/rate limiting handles broad HTTP/IP abuse when supported
- worker/control endpoints remain outside generic interactive browser challenge rules
- no new application limiter datastore/package without demonstrated need

Do not change CSP, telemetry, database grants, or hosted runtime flags in Phase 9B unless a reviewed dependency proves it necessary.

## Phase 9D direction

The current `lib/audit/write-audit-event.ts` already blocks sensitive metadata-key categories and caps metadata at 8 KiB. Reuse this durable audit path rather than adding another audit database.

High-frequency operational security signals should use structured, privacy-reduced server logs instead of flooding `audit_events`.

Current browser-hardening baseline in `next.config.ts` already includes:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- restrictive Permissions Policy
- HSTS
- `poweredByHeader: false`

CSP is not enabled. Any Phase 9D CSP enforcement must first prove compatibility with the actual current Next.js/UI/WebGL runtime. Do not add a permissive fake CSP or risk breaking production rendering.

## Phase 9E direction

Complete incident response, disclosure, credential rotation, rollback, impact assessment, recovery validation, and final release-security/public-launch procedures.

## Runtime authority boundary

Keep false/absent unless separately authorized by their own operational gates:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

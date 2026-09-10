# ScopeForge Current State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Repository and production baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `f203168e6ae25455743849f08511e371d3964153`
- current released tree: `9980aa5a58014998fd26ae7084bd97c992bc1a82`
- latest merged hardening PR: #60, Phase 9B provider/auth hardening
- frozen candidate CI: #773, success
- post-merge main CI: #774, success
- exact production deployment: `dpl_AM7VULiVFxKW1imXGiWpfs4Sx62z`, READY, `aliasError=null`
- production domain: `scopeforge.dev`

The actual production `main` tree is the integration baseline for all remaining hardening work. It contains the current production landing/dashboard UI plus the released Phase 9A, 9B, and 9C security changes.

PR #49 remains an open draft legacy UI branch. Do not merge, rebase, retarget, replace, or use it as the baseline for Phase 9D/9E unless the user separately requests that work.

## Completed product/security phases

Completed and released:

- Phases 1-5C
- Phase 6A foundation
- Phase 6B repository acquisition code
- Phase 6C isolated scanning code
- Phase 6D dedicated network-worker implementation/release acceptance
- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B deterministic scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B Turnstile-capable provider/auth hardening code
- Phase 9C database/RPC defense-in-depth

Code release does not authorize hosted worker execution or prove external provider enforcement.

## Phase 9A released boundary

Phase 9A provides:

- local-only validation for post-auth return paths
- same-origin auth callback/confirmation redirects
- rejection of unsafe absolute/protocol-relative/backslash/control-character/malformed return targets
- bounded browser-visible authentication failures
- bounded retry guidance without raw provider detail

Released via PR #58 and independently CI/production verified.

## Phase 9B released boundary

Phase 9B released via PR #60.

- frozen candidate: `3d9d3c3aef3faef8f6706c53673fb0fcaad802bb`
- candidate tree: `9980aa5a58014998fd26ae7084bd97c992bc1a82`
- candidate preview `dpl_FcFdrKhr31kgQHWjS723yZ4D49AT`: READY
- candidate CI #773: success
- squash merge: `f203168e6ae25455743849f08511e371d3964153`
- main CI #774: success
- production deployment `dpl_AM7VULiVFxKW1imXGiWpfs4Sx62z`: READY
- dedicated release state: `docs/development/PHASE_9B_RELEASE_STATE.md`

Released code provides a dependency-free Turnstile challenge wrapper and configuration-gated CAPTCHA token forwarding to Supabase Auth while preserving existing behavior when no site key is configured.

The release did not modify package dependencies, database ACLs, dashboard/landing composition, CSP, telemetry, or hosted worker authority.

Provider truth remains separate from code release:

- production Turnstile enforcement is not claimed until external provider configuration is directly verified
- leaked-password protection remains disabled according to the current Supabase Security Advisor
- Vercel project-specific WAF custom-rule enforcement is not claimed without direct evidence
- Supabase native Auth rate limiting remains the auth-endpoint limiter

## Phase 9C released boundary

Phase 9C released via PR #59.

- final candidate: `421dcb3b1a7a6243fdaac546f362653937254878`
- candidate CI #770: success
- squash merge: `0869767401011cd32dcd3e3b2976201461655e02`
- main CI #771: success
- production deployment `dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N`: READY
- dedicated release state: `docs/development/PHASE_9C_RELEASE_STATE.md`

Live ScopeForge Supabase migration history includes:

`20260908084554_phase_9c_function_acl_hardening`

The 17 reviewed private trigger-only functions no longer expose direct execution to broad application roles. The authenticated RLS helper boundary remains operational. Private worker tables and privileged public worker/control RPCs remain closed to ordinary browser roles.

Future application function ACLs are protected by a repository migration architecture guard requiring explicit same-migration revocation instead of a risky global PostgreSQL default-privilege mutation.

## Production UI baseline

The current production UI is part of tree `9980aa5a58014998fd26ae7084bd97c992bc1a82` and is authoritative for all remaining Phase 9 work.

Current UI-relevant facts:

- `app/layout.tsx` is the live global CSS integration point for the landing/dashboard system
- current `next.config.ts` already sets nosniff, strict-origin referrer policy, `X-Frame-Options: DENY`, restrictive Permissions Policy, HSTS, and disables the powered-by header
- middleware remains intentionally thin and delegates session handling to `lib/supabase/middleware`
- `components/AuthForm.tsx` includes Phase 9A bounded errors plus the Phase 9B configuration-gated Turnstile boundary
- CSP is not enabled yet

Remaining security changes must preserve current landing/dashboard/auth behavior and be verified against the actual production tree.

## Phase 8 validation claim boundary

The committed `scopeforge-offline-v1@1.0.0` corpus remains 32 reviewed cases with TP 16 / FN 0 / FP 0 / TN 16 across 8 represented rules. Those measurements describe only the committed reviewed corpus and are not global or real-world ScopeForge accuracy.

Phase 8B catastrophic benchmark ceilings are regression guards, not product SLOs. RSS delta remains observational rather than peak-memory measurement.

## Remaining Phase 9 boundaries

Next implementation order:

1. Phase 9D security telemetry and browser hardening
2. Phase 9E incident/release/public-launch hardening

Phase 9B operational provider activation remains a tracked launch prerequisite but is not evidence of active enforcement until directly verified.

Pending Phase 9D items include:

- privacy-reduced structured security telemetry
- durable security-significant audit coverage
- event-shape and metadata-safety tests
- alert/rollback signals
- preservation of the existing security-header baseline
- staged CSP hardening proven compatible with the current Next.js/WebGL UI before enforcement

Pending Phase 9E includes incident response, disclosure, credential rotation, rollback and release-security procedures.

Fresh Supabase Security Advisor still reports exactly `auth_leaked_password_protection`.

## Production runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Production services

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel project: `scopeforge`
- production: `scopeforge.dev`

Never confuse the ScopeForge Supabase project with the separate Job Command Center project.

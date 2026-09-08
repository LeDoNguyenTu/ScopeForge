# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-08 (Asia/Singapore)

## Phase status

- Phase 9 architecture: approved
- Phase 9A authentication boundary: complete and released
- Phase 9B provider/edge abuse controls: implementation complete through checkpoint, release validation pending
- Phase 9C database/RPC defense-in-depth: complete and released
- Phase 9D security telemetry/browser hardening: pending after 9B
- Phase 9E incident/release hardening: pending after 9D

## Authoritative production baseline

Current production docs checkpoint:

`fc7c4369c7075d22c3ad918bea3e17b1e1df5c2b`

Its parent is the Phase 9C executable release:

- merge `0869767401011cd32dcd3e3b2976201461655e02`
- tree `ca68a0559af93fc3b2143fdec387b84e418bb141`
- main CI #771 success
- production deployment `dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N` READY on `scopeforge.dev`

The current production UI is authoritative. PR #49 remains an open draft legacy UI branch and is out of scope.

## Phase 9B current branch

Branch:

`feat/phase-9b-provider-edge-hardening-v1`

Checkpoint head before this document update:

`7824fa7834a0b9756e639c9c9a28e8a687451f63`

Checkpoint Vercel Preview:

- deployment `dpl_EUkCryrKh4ge5nKszriLm2Ua98Dv`
- Git SHA `7824fa7834a0b9756e639c9c9a28e8a687451f63`
- READY
- `aliasError=null`

Branch scope from production checkpoint is exactly eight Phase 9B files:

- `components/AuthForm.tsx`
- `components/auth/TurnstileChallenge.tsx`
- `tests/components/AuthForm.test.tsx`
- `tests/components/TurnstileChallenge.test.tsx`
- `tests/architecture/phase-9b-provider-edge-hardening.test.ts`
- `docs/security/PHASE_9B_PROVIDER_CONTROLS.md`
- Phase 9B design spec
- Phase 9B implementation plan

No package dependency, dashboard, landing, database, runtime, CSP, telemetry, or PR #49 file changed.

## Phase 9B implemented behavior

The application now has a dependency-free local Cloudflare Turnstile wrapper using the official explicit-render script.

Auth behavior is configuration-gated:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` absent/blank: existing sign-in/sign-up behavior and Supabase call shapes remain unchanged
- site key present: submit stays disabled until a challenge token is available
- sign-in passes `options.captchaToken`
- sign-up passes display metadata plus `captchaToken`
- CAPTCHA token stays only in React component memory
- configured failed/non-redirecting attempts invalidate the token and remount the challenge
- the wrapper clears tokens on expiry/error and removes its widget on cleanup
- narrow auth cards use compact Turnstile sizing; wider cards use flexible sizing

Phase 9A bounded auth error behavior remains intact by design.

## Test-first history

The branch preserves test-first ordering:

- `6ff038465a521fc3043ff5d3733b569b71570ecd` - Turnstile component contract
- `573621cbe134261f203ea6dc9597c6766a4b49fc` - Turnstile wrapper implementation
- `9393ce7c77e9ff516b3ab2830cd7d2430c6b21a5` - AuthForm CAPTCHA contract before AuthForm implementation
- `de2399a1db6ef39292f5a6e0da2547a790c0d324` - narrow-screen sizing regression contract
- `59c9544bd81fddc76cecf246ec249bbbe3cd9cff` - narrow-screen wrapper fix
- `27b3e248f1ad1765e7852f547db96867861ca9ca` - AuthForm CAPTCHA integration
- `cda7e6a5af7177f7e5dbe9d3f3407d7d1b61b7d8` - provider-boundary architecture guard before operational-state document
- `7824fa7834a0b9756e639c9c9a28e8a687451f63` - provider operational truth document

This harness has no executable repository checkout, so focused Vitest RED/GREEN was structural rather than locally executed. The frozen GitHub Actions candidate is the required executable proof.

## Live provider preflight

ScopeForge Supabase:

- project `tdgpibrepzcvdivztkta`
- status `ACTIVE_HEALTHY`
- PostgreSQL `17.6.1.155`
- organization plan `free`
- Security Advisor still reports exactly `auth_leaked_password_protection`

Provider truth:

- leaked-password protection is NOT ENABLED on the current Free plan
- Supabase native Auth rate limiting remains the auth-endpoint protection
- production Turnstile enforcement is PENDING external provider configuration
- Vercel WAF custom rule state is NOT CLAIMED
- no billing upgrade is authorized

Operational activation and rollback order is recorded in `docs/security/PHASE_9B_PROVIDER_CONTROLS.md`.

## Remaining Phase 9B release gates

1. create a tree-identical freeze commit
2. require exact-head Vercel Preview READY
3. open draft PR against the actual current `main`
4. run one substantive candidate CI and require audit, full tests, typecheck, CLI build/version, historical benchmark, Phase 8B matrix, and production Next build success
5. review exact PR head/base/scope/reviews/threads
6. squash merge only the verified head
7. independently verify post-merge main CI and exact production Vercel deployment
8. write a docs-only Phase 9B release checkpoint with no redundant Actions run

Production CAPTCHA enforcement may remain pending after code release. Do not describe Turnstile, leaked-password protection, or WAF as enforced without direct provider evidence.

## Phase 9C release

Dedicated release state:

`docs/development/PHASE_9C_RELEASE_STATE.md`

Do not rewrite the deployed Phase 9C migration and do not apply a global `postgres` default-function revoke.

## Phase 9D direction

Reuse existing durable audit infrastructure for security-significant events and privacy-reduced structured server logs for high-frequency operational signals. Preserve current headers. Stage CSP only after compatibility proof with the actual production UI/WebGL runtime.

## Phase 9E direction

Complete vulnerability disclosure, incident response, credential rotation, rollback, impact assessment, recovery validation, and final public-launch security procedures.

## Runtime authority boundary

Keep false/absent unless separately authorized by their own operational gates:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

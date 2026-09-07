# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-08 (Asia/Singapore)

## Branch and baseline

- repository: `LeDoNguyenTu/ScopeForge`
- branch: `feat/phase-9-security-hardening-v1`
- released `main` baseline: `d4f37b85738fc08ba3483bf98bb0e5e900184449`
- Phase 9 design: `docs/superpowers/specs/2026-09-08-phase-9-security-hardening-design.md`
- Phase 9A plan: `docs/superpowers/plans/2026-09-08-phase-9a-auth-boundary.md`
- current executable/test checkpoint before this document: `0fb9db1a72e4bb66bc049594fbee2c47a5b7a038`

Dashboard V5/UI PR #49 remains a separate workstream and has not been modified by Phase 9.

## Phase 9A - implemented, final CI pending

Phase 9A closes the authentication redirect boundary and removes raw provider-error rendering from the browser UI.

Implemented:

- `lib/auth/return-path.ts`
  - accepts only local application paths beginning with `/`
  - rejects absolute URLs, protocol-relative URLs, backslashes, encoded backslashes, control characters, malformed percent encoding, and decoded host-confusion forms
  - unsafe values fall back to `/dashboard`
  - safe local query strings and fragments are retained
- `app/auth/callback/route.ts`
  - successful OAuth/PKCE callback navigation now uses the shared safe return-path parser
- `app/auth/confirm/route.ts`
  - successful OTP/email confirmation navigation now uses the same parser
- `lib/auth/error-message.ts`
  - provider details are not echoed to browser users
  - sign-in and sign-up use bounded generic messages
  - rate-limit errors map to bounded retry guidance
- `components/AuthForm.tsx`
  - no longer renders `error.message` directly
- focused tests and architecture guards cover the above boundaries

## Test-first history

Executable changes were committed test-first with `[skip ci]`:

1. `f1c07d5f86fb04147a0de7b1163cddc48da44dde` - return-path behavior test before helper implementation
2. `be0bbe94fbd376c6e104f01eab7bdc49883eddc2` - return-path helper
3. `5fffa4822e2c9473ad2bc25ce4f9b4337b3e3588` - auth route regression tests before route fixes
4. `0d66d7ae3c4a4b4241c8b9092c66288f876b67f0` - callback fix
5. `44e325b7c607f3ae17cc7e6e9fc3bfeb3ae83d50` - confirmation fix
6. `6a9eca57ec629ca70b362cd761bf2044b5459b08` - auth error-message tests before helper implementation
7. `fd5623609f6e074ab68ff48741a2e2ea1c7e83e5` - bounded auth-error helper
8. `47fdd9441c5942b8444a8bdffe97fbdff04bfae6` - AuthForm leakage regressions before UI integration
9. `e4a92536c17f37e5d4ae6dda7b68c93db40426aa` - AuthForm integration
10. `0fb9db1a72e4bb66bc049594fbee2c47a5b7a038` - static Phase 9A architecture guard

The current harness has no local repository checkout and its container cannot resolve github.com, so RED/GREEN tests could not be executed locally without spending GitHub Actions. The test-first commit ordering is preserved, while real test execution is reserved for the frozen candidate as required by the CI discipline.

## Verification already completed

For exact executable/test head `0fb9db1a72e4bb66bc049594fbee2c47a5b7a038`:

- Vercel Preview: `dpl_C14uBw9rw2N8XLRGMMNqKFHYM5v1`
- preview state: READY
- alias error: null
- Next.js production compile: success
- TypeScript validity check: success
- static generation: 9/9 pages
- branch is based on unchanged `main` `d4f37b85738fc08ba3483bf98bb0e5e900184449`
- base-to-head diff contains only Phase 9 auth code/tests/docs
- no `package.json`, `package-lock.json`, migration, worker/runtime, `app/layout.tsx`, or Dashboard V5 file changes

## Verification still required before Phase 9A release

A frozen candidate must still execute:

- Phase 9A focused tests
- full Vitest suite
- typecheck
- CLI build/version smoke
- historical scanner benchmark
- Phase 8B matrix
- npm audit
- production Next.js build
- exact-head Vercel Preview READY
- exact base/head recheck immediately before merge

Do not claim Phase 9A release completion until those gates execute successfully on the exact candidate.

## Production settings deliberately unchanged

Phase 9A has not changed:

- Supabase Auth settings
- leaked-password protection setting
- Supabase schema, grants, policies, or migrations
- Cloudflare Turnstile
- Vercel WAF/rate-limit configuration
- CSP
- worker/runtime authority

The live Supabase Security Advisor warning `auth_leaked_password_protection` therefore remains an explicit later Phase 9 operational acceptance item.

## Runtime authority boundary

Keep false/absent unless separately authorized:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 9A does not authorize any hosted worker capability.

## Next boundary after Phase 9A

After the Phase 9A release is independently verified and merged, the next non-UI hardening boundary is Phase 9C database/RPC defense-in-depth.

Phase 9C begins with regression evidence and privilege inventory, not a blind migration. In particular, `authenticated` currently requires access to private helper functions used by RLS, so `USAGE ON SCHEMA private` must not be revoked without proving the replacement access model.

Do not start Phase 9B production Turnstile/WAF changes merely because Phase 9A is complete.

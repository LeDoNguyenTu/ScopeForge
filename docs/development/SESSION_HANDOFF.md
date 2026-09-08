# ScopeForge Session Handoff

Last refreshed: 2026-09-08 (Asia/Singapore)

Use this as the fastest resume point for ScopeForge Phase 9 hardening.

## Hard execution rules

- production `main` is always the authoritative integration baseline
- before freezing or merging a Phase 9 branch, re-read `main` and resolve any UI-stream drift first
- preserve the newest production UI when resolving overlaps; reapply only the reviewed security change
- preflight before CI; do not use GitHub Actions as a debugging loop
- use `[skip ci]` for intermediate and docs-only commits
- reserve substantive CI for frozen release candidates
- never rewrite deployed Supabase migrations
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim tests, provider state, WAF state, or production enforcement without exact evidence
- do not enable hosted worker/runtime capability flags as part of Phase 9 hardening
- PR #49 remains a legacy draft UI branch and is not the hardening baseline

## Released Phase 9C baseline

Production docs checkpoint before Phase 9B:

`fc7c4369c7075d22c3ad918bea3e17b1e1df5c2b`

Its parent is the Phase 9C executable release:

- PR #59
- squash merge `0869767401011cd32dcd3e3b2976201461655e02`
- tree `ca68a0559af93fc3b2143fdec387b84e418bb141`
- post-merge CI #771 success
- exact production deployment `dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N` READY on `scopeforge.dev`

The docs checkpoint itself deployed as `dpl_2bHVe72K97rMmfdGkfPmavPaBZQ9`, READY, with no redundant GitHub Actions run.

Phase 9C live migration history includes:

`20260908084554_phase_9c_function_acl_hardening`

Do not rewrite that migration or apply a global `postgres` default-function revoke.

## Active Phase 9B branch

Branch:

`feat/phase-9b-provider-edge-hardening-v1`

Implementation checkpoint before handoff-doc commit:

`7824fa7834a0b9756e639c9c9a28e8a687451f63`

Exact preview:

- `dpl_EUkCryrKh4ge5nKszriLm2Ua98Dv`
- Git SHA `7824fa7834a0b9756e639c9c9a28e8a687451f63`
- READY
- `aliasError=null`

Phase 9B currently changes only:

- `components/AuthForm.tsx`
- `components/auth/TurnstileChallenge.tsx`
- focused component and architecture tests
- Phase 9B design/plan/provider-state docs

No package dependency, database, runtime, dashboard, landing, CSP, or telemetry file is part of the Phase 9B implementation checkpoint.

## Implemented Phase 9B code

- dependency-free Cloudflare Turnstile wrapper using explicit rendering
- public key boundary is `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- no configured site key means existing production auth behavior remains unchanged
- configured challenge disables auth submit until a token exists
- sign-in passes `options.captchaToken`
- sign-up passes display metadata plus `captchaToken`
- challenge tokens stay in React component memory only
- failed/non-redirecting configured attempts invalidate the token and remount the challenge
- expiry and widget errors clear the token
- narrow auth cards use compact provider sizing; wider cards use flexible sizing
- Phase 9A bounded auth errors remain in place

Test-first history is preserved. This harness has no local executable checkout, so focused RED/GREEN was structural. The frozen GitHub Actions candidate must be the first executable proof of the complete focused tests.

## Live provider truth

ScopeForge Supabase project:

`tdgpibrepzcvdivztkta`

Current live facts at checkpoint:

- status `ACTIVE_HEALTHY`
- PostgreSQL `17.6.1.155`
- organization plan `free`
- Security Advisor reports only `auth_leaked_password_protection`

Claims:

- leaked-password protection: NOT ENABLED
- production Turnstile enforcement: PENDING
- Supabase native Auth rate limiting: retained
- Vercel WAF custom rule state: NOT CLAIMED
- no automatic billing upgrade authorized

Activation and rollback order is documented in `docs/security/PHASE_9B_PROVIDER_CONTROLS.md`.

## Merge-conflict rule for current UI work

The user has an independent UI task that may advance `main` while Phase 9B is active.

Before freeze/PR release:

1. re-read the exact current `main` SHA
2. compare `main` to the Phase 9B branch
3. if files overlap, use the newest `main` UI file as the base and reapply only the reviewed Phase 9B auth/security delta
4. never resolve by taking the older Phase 9B UI wholesale
5. preserve all new UI tests/styles unless they directly contradict the approved auth security contract
6. create an explicit merge/reconciliation commit on the Phase 9B branch
7. require a fresh exact-head Vercel Preview after reconciliation
8. freeze and run CI only after conflicts are fully resolved

The release candidate is not frozen while the concurrent UI update is unresolved or not yet visible through GitHub.

## Remaining Phase 9B release work

- reconcile the newest `main` UI update when it becomes visible
- update the Phase 9B branch without losing either UI or security behavior
- verify exact merged diff scope
- create a tree-identical freeze commit
- exact-head Vercel Preview READY
- open draft PR against actual current `main`
- one substantive full CI run
- review exact head/base/scope/reviews/threads
- squash merge only the verified head
- independent post-merge main CI
- exact production deployment verification
- docs-only Phase 9B release checkpoint

Production provider activation can remain pending after code release if no supported provider-management surface is available. Never claim enforcement is active without direct evidence.

## Then Phase 9D

- reuse existing audit infrastructure for durable security-significant events
- use privacy-reduced structured server logs for high-frequency security signals
- preserve current header baseline
- stage CSP only after compatibility proof with the actual production UI/WebGL runtime

## Then Phase 9E

Complete disclosure, incident response, credential rotation, rollback, impact assessment, recovery validation, and final public-launch security procedures.

## Hosted runtime flags

Keep all four false/absent until their independent operational acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

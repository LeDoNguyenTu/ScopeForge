# Phase 10A3 Working State

Date: 2026-09-12
Branch: `feat/phase-10a3-github-webhook-reconciliation`
Base: `feat/phase-10a2-private-repository-acquisition` at validated head `e812a236f3782059e72a5fd2793d4f9b2641e81f`

## Current checkpoint

Phase 10A3 design and implementation plan are approved and committed.

Task 1 RED evidence is captured in CI #914 / run `34631217021`. Final Task 1 CI #916 / run `34632551953` passed every release gate: dependency install, 0-vulnerability audit, all tests, typecheck, CLI build/version, scanner and matrix benchmarks, production build, CSP browser smoke, production diagnostics, and artifact handling.

Tasks 2 and 3 RED evidence is captured in CI #918 / run `34637569190`. Final Tasks 2 and 3 CI #922 / run `34639416412` passed every release gate on exact head `d5a71c0504a6531ea94cf5ebd2477c40b6e741f6`: dependency install, 0-vulnerability audit, 396 test files / 1,763 tests, typecheck, CLI build/version, both scanner benchmarks, production build, CSP browser acceptance, production diagnostics, and four UI acceptance artifacts.

Task 4 service RED evidence is captured in CI #923 / run `34645026763`. Final service CI #925 / run `34646073036` passed every release gate on exact head `27154ade5a0cbfe5a3b7f28ecb6ca25da9b0257b` after two test-only typecheck fixes.

Task 4 route RED evidence is captured in CI #926 / run `34646601886`: all 397 existing test files / 1,782 existing tests remained green and only the intentionally missing route suite failed import. Final route CI #927 / run `34649158445` passed every release gate on exact head `c6d6b20a1f654539b2218994c48c8b3d7dac3edf`.

Task 5 lifecycle RED coverage is committed in `tests/github-app/webhook-lifecycle.test.ts` plus an atomic repository-asset reconciliation guard in `tests/github-app/webhook-migration.test.ts`. The lifecycle fixtures use GitHub's current installation action names `suspend` and `unsuspend`. CI #928 was started before that fixture correction and is obsolete.

Corrected Task 5 RED CI #929 / run `34649891292` proved the contract cleanly on exact head `b3a9940e95ff7503c65916215ff4edb4c9892df8`:

- dependency install succeeded and `npm audit --audit-level=info` reported 0 vulnerabilities
- all 397 pre-existing test files remained green
- all 15 lifecycle tests failed only because lifecycle dispatch was still missing
- one migration assertion failed only because repository identity reconciliation did not yet lock/update the linked repository asset
- total result was 399 files: 397 passed / 2 expected failing suites, and 1,796 passed / 16 expected failing tests
- no unrelated regression was observed

Task 5 GREEN implementation now exists:

- installation `suspend` and `deleted` fail closed from stable installation identity without requiring provider objects that may already be unavailable
- installation `unsuspend` requires authoritative GitHub App installation revalidation before returning to active state
- `installation_repositories.removed` marks only already-connected stored repository links inaccessible without minting provider authority
- `installation_repositories.added` never auto-imports; an already-connected repository can reactivate only after a repository-restricted installation token and authoritative repository re-fetch
- repository rename/transfer/privacy/archive/unarchive events use only stable numeric IDs from the signed payload and provider-authoritative repository metadata
- repository deletion retains historical stored identity while marking access removed
- unknown lifecycle actions are ignored before delivery persistence/provider work and exact delivery UUID replays stop before provider work
- lifecycle handlers never enqueue scans or mutate existing queued task execution classes
- corrective migration `20260912021000_phase_10a3_repository_asset_identity_reconciliation.sql` preserves the original service-role RPC contract while locking the linked repository asset, validating repository kind/current canonical identity, and updating its canonical target atomically with the repository link

This exact head is the Task 5 GREEN validation candidate. Task 6 automatic scan completion/no-lost-head follow-up has not started yet and will begin only after this candidate passes the complete release gate.

The Phase 10A3 migrations remain source-only and have not been applied to any Supabase environment. No webhook has been registered. No production secret/runtime flag has been changed.
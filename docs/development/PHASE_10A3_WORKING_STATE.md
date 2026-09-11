# Phase 10A3 Working State

Date: 2026-09-12
Branch: `feat/phase-10a3-github-webhook-reconciliation`
Base: `feat/phase-10a2-private-repository-acquisition` at validated head `e812a236f3782059e72a5fd2793d4f9b2641e81f`

## Current checkpoint

Phase 10A3 design and implementation plan are approved and committed.

Task 1 RED evidence is captured in CI #914 / run `34631217021`:

- dependency install and audit passed with 0 vulnerabilities
- 392 existing test files / 1,729 existing tests remained green
- the new webhook suite failed because `lib/github-app/webhook.ts` did not exist
- exactly four new config assertions failed because `GITHUB_APP_WEBHOOK_SECRET` / `webhookSecret` were not implemented

Task 1 first GREEN candidate CI #915 / run `34631875292` proved the behavior contract. Final Task 1 CI #916 / run `34632551953` passed every gate: dependency install, 0-vulnerability audit, all tests, typecheck, CLI build/version, scanner and matrix benchmarks, production build, CSP browser smoke, production diagnostics, and artifact handling.

Tasks 2 and 3 RED evidence is captured in CI #918 / run `34637569190`:

- dependency install and audit passed with 0 vulnerabilities
- all 1,745 pre-existing tests remained green
- 18 new assertions failed only for the intentionally missing authoritative archived-state/provider reads, webhook persistence migration, and Phase 10A3 database type overlay
- no unrelated regression was observed

Tasks 2 and 3 GREEN implementation includes:

- fail-closed authoritative GitHub repository archived-state parsing and downstream preservation
- exact default-branch head resolution through the fixed GitHub commits endpoint
- exact GitHub App installation metadata reads
- private delivery replay metadata and per-link latest-head coalescing state
- explicit `manual` versus `github_webhook` project-scan provenance
- service-role-only reconciliation, enqueue, completion, and delivery-result RPCs
- automatic public/private snapshot routing through the existing isolated worker execution classes
- a Phase 10A3 database type overlay composed on the validated Phase 10A2 surface

Final Tasks 2 and 3 CI #922 / run `34639416412` passed every release gate on exact head `d5a71c0504a6531ea94cf5ebd2477c40b6e741f6`: dependency install, 0-vulnerability audit, 396 test files / 1,763 tests, typecheck, CLI build/version, both scanner benchmarks, production build, CSP browser acceptance, production diagnostics, and four UI acceptance artifacts.

Task 4 service RED evidence is captured in CI #923 / run `34645026763`; all 396 existing test files / 1,763 existing tests remained green and only the intentionally missing service suite failed import. Final service CI #925 / run `34646073036` passed every release gate on exact head `27154ade5a0cbfe5a3b7f28ecb6ca25da9b0257b` after two test-only typecheck fixes.

Task 4 route RED evidence is captured in CI #926 / run `34646601886`: all 397 existing test files / 1,782 existing tests remained green and only the intentionally missing route suite failed import. Final route CI #927 / run `34649158445` passed every release gate on exact head `c6d6b20a1f654539b2218994c48c8b3d7dac3edf`.

Task 5 lifecycle RED coverage is committed in `tests/github-app/webhook-lifecycle.test.ts` plus an atomic repository-asset reconciliation guard in `tests/github-app/webhook-migration.test.ts`. The contract requires installation suspend/remove/unsuspend behavior, repository-selection removal and safe reactivation, no webhook auto-import, authoritative repository re-fetch for rename/transfer/privacy/archive transitions, historical identity retention on deletion, unknown-action rejection, exact-delivery replay protection, no lifecycle-triggered scan enqueue, and atomic repository-link plus asset canonical-target reconciliation.

The lifecycle fixtures use GitHub's current installation action names `suspend` and `unsuspend`. CI #928 was started before that fixture correction and is intentionally obsolete. This exact head is the corrected Task 5 RED validation candidate. Production lifecycle dispatch and the asset canonical-target migration repair have not been implemented yet, so the new tests are expected to fail only on those missing behaviors before GREEN implementation begins.

The Phase 10A3 migration remains source-only and has not been applied to any Supabase environment. No webhook has been registered. No production secret/runtime flag has been changed.
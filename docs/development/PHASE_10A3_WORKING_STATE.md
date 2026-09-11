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

Final Tasks 2 and 3 CI #922 / run `34639416412` passed every release gate on exact head `d5a71c0504a6531ea94cf5ebd2477c40b6e741f6`:

- dependency install succeeded
- `npm audit --audit-level=info` reported 0 vulnerabilities
- 396 test files / 1,763 tests passed
- typecheck passed
- CLI build and `ScopeForge 0.1.0` version smoke passed
- scanner-medium and full benchmark matrix remained within their budgets
- Next.js production build passed
- CSP browser acceptance passed
- production ScopeForge/Turnstile diagnostic passed
- four UI acceptance artifacts uploaded successfully

Task 4 service RED evidence is captured in CI #923 / run `34645026763`:

- dependency install and audit passed with 0 vulnerabilities
- all 396 existing test files / 1,763 existing tests remained green
- exactly one new suite failed during import because `lib/github-app/webhook-service.ts` did not exist
- no unrelated regression was observed

The Task 4 webhook service GREEN implementation keeps raw webhook bytes and payload repository metadata out of scheduling authority, admits exact delivery UUIDs, loads only stored stable context, mints repository-restricted installation authority, re-fetches authoritative repository/default-head state, reconciles safe provider metadata, coalesces latest-head state through the Phase 10A3 RPCs, respects independent public/private snapshot runtime gates, and maps enqueue races to bounded pending state without starting a second chain.

Task 4 service CI #924 / run `34645582197` proved all 19 new service behaviors and the full repository test suite: 397 test files / 1,782 tests passed. Typecheck then identified only two test-fixture typing issues. Those diagnostics were repaired without changing service behavior. Final service CI #925 / run `34646073036` then passed every release gate on exact head `27154ade5a0cbfe5a3b7f28ecb6ca25da9b0257b`: install, 0-vulnerability audit, all tests, typecheck, CLI build/version, both benchmark stages, production build, CSP browser smoke, production diagnostics, and artifact handling.

Task 4 route RED evidence is captured in CI #926 / run `34646601886`:

- dependency install and audit passed with 0 vulnerabilities
- all 397 existing test files / 1,782 existing tests remained green
- exactly one new suite failed during import because `app/api/integrations/github/webhook/route.ts` did not exist
- no unrelated regression was observed

The Task 4 route GREEN implementation now exists. The route is POST-only, pinned to the Node runtime and force-dynamic execution, maps bounded webhook input errors to 400/401/413 before service invocation, passes only the verified webhook envelope into reconciliation, returns bounded 200/202 success states, and collapses all provider/persistence/internal failures to a generic retryable 503 without reflecting raw body, signatures, or provider error details.

This exact head is the Task 4 route GREEN validation candidate. Task 5 lifecycle reconciliation has not started yet and will begin only after this route candidate passes the complete release gate.

The Phase 10A3 migration remains source-only and has not been applied to any Supabase environment. No webhook has been registered. No production secret/runtime flag has been changed.
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

Task 4 RED contract is now committed in `tests/github-app/webhook-service.test.ts`. It pins signed ping/unsupported-event handling, strict push candidate parsing, exact delivery replay, disconnected/inactive/auto-scan-disabled no-op behavior, authoritative provider metadata, default-branch supersession, archived repository handling, semantic SHA replay, active-chain coalescing, independent public/private source runtime gates, and enqueue-race replay behavior.

This exact head is intentionally a Task 4 RED validation candidate. `lib/github-app/webhook-service.ts` has not been created yet, so the new service suite is expected to fail specifically for the missing implementation before GREEN work begins.

The Phase 10A3 migration remains source-only and has not been applied to any Supabase environment. No webhook has been registered. No production secret/runtime flag has been changed.
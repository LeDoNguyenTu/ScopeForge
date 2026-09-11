# Phase 10A3 Working State

Date: 2026-09-12
Branch: `feat/phase-10a3-github-webhook-reconciliation`
Base: `feat/phase-10a2-private-repository-acquisition` at validated head `e812a236f3782059e72a5fd2793d4f9b2641e81f`

## Current checkpoint

Phase 10A3 design and implementation plan are approved and committed.

Task 1 is intentionally at RED:

- `tests/github-app/config.test.ts` now requires the seventh server-only GitHub App setting `GITHUB_APP_WEBHOOK_SECRET` and `GitHubAppConfig.webhookSecret`.
- `tests/github-app/webhook.test.ts` defines exact-byte HMAC-SHA256 verification, constant-time-safe malformed-signature behavior, signature-before-JSON ordering, bounded headers, UUID delivery IDs, JSON content type, and the 10 MiB declared/actual raw-body ceiling.
- Production config/webhook implementation has not yet been changed.

The next action is one controlled stacked-PR CI run to capture RED evidence, followed by the minimal Task 1 implementation and targeted/full validation.

No Phase 10A3 migration has been applied to production. No webhook has been registered. No production secret/runtime flag has been changed.
# Phase 10A3 Working State

Last reconciled: 2026-09-16, Asia/Singapore

Phase 10A3 remains implemented, DRAFT, and stacked behind Phase 10A2 PR #76. It is not authorized for production migration or webhook activation yet.

## Current live checkpoint

- PR #77: OPEN / DRAFT
- branch: `feat/phase-10a3-github-webhook-reconciliation`
- current documentation head before this file refresh: `b2c3f31786ab5c36561309a8f8e0ddb05e41ec5d`
- latest executable integration: PR #122 merge `801ba7c7c76b3026f60ab7973315583a46e8d653`
- issue #79: CLOSED; no longer an upstream blocker
- Phase 10A2 PR #76 live head observed at this reconciliation: `e811538e63784a4ad2501999779378d8beb30f16`
- Phase 10A2 remains DRAFT for Priority 0 Linux worker/private-repository acceptance
- Phase 10A2 production migrations are already applied
- Phase 10A3 production migrations: NONE applied as of this reconciliation

Do not release or migrate Phase 10A3 until Phase 10A2 is released and production-verified, then reconcile this branch onto released `main` and run fresh exact-candidate validation.

## Latest hardening — PR #122 unsupported event transport status

### Defect

The approved webhook design requires a correctly signed unsupported GitHub event to be accepted at the transport boundary, ignored semantically, and returned as HTTP 202. The public route instead mapped every `ignored` result to HTTP 200.

### TDD RED

- test-only head: `162b6cbe61a1c0206162bdba896fdecae65dd701`
- CI run: `35108555834`
- install: PASS
- audit: 0 vulnerabilities
- test files: 414 / 415 passed
- tests: 1,902 / 1,903 passed
- sole failure: `tests/github-app/webhook-route.test.ts > returns 202 for a correctly signed unsupported event`
- exact assertion: expected 202, received 200
- production code unchanged at RED head

### GREEN

- exact implementation head: `69fc6634f0ab57cadbf96526d9e3a84c6b181b4a`
- CI run: `35109054701` — SUCCESS
- passed: install, audit, full tests, typecheck, CLI build/version, scanner benchmark, benchmark matrix, optimized Next build, CSP browser smoke, production diagnostic, artifact step
- exact-head Vercel: `dpl_7H1Luv4gsbzjf5GMRBygWkyFvyJV` — READY
- merged only into Phase 10A3 as `801ba7c7c76b3026f60ab7973315583a46e8d653`

Minimal behavior change:

- `ignored / EVENT_UNSUPPORTED` -> HTTP 202
- `queued` / `pending` remain HTTP 202
- permanent supported-event ignores such as archived repositories remain HTTP 200

No migration, webhook secret, provider credential, runtime gate, Phase 10A2 state, or production configuration changed.

## Webhook semantics amendment

Read:

`docs/superpowers/specs/2026-09-16-phase-10a3-webhook-semantics-amendment.md`

It is authoritative where the original 2026-09-12 design conflicts with later accepted hardening.

### #85 authoritative-head recovery

Do not restore the obsolete rule that terminates a valid signed `push` solely because `payload.after` differs from GitHub's freshly revalidated default-branch head.

Accepted behavior:

- webhook payload is a trigger, not repository truth
- provider identity/default branch/current head are revalidated
- stale payload SHA is never persisted/enqueued
- freshly revalidated authoritative head proceeds through the existing replay/coalescing/runtime-gate path
- downstream exact `latest_delivery_id` checks remain intact

Permanent regression:

`tests/github-app/webhook-superseded-head-recovery.test.ts`

## Completed hardening that must not be repeated

- #78 bounded unknown-length webhook streaming
- #80 same-head pending no-lost-enqueue recovery
- #85 stale-trigger authoritative-head recovery
- #104 terminal repository-scan watermark correction
- #106 bounded webhook-delivery retention
- #122 unsupported-event HTTP 202 correction
- Node 24 runtime alignment
- explicit ESM Vitest config
- `actions/upload-artifact@v7` maintenance

## Existing security/architecture boundaries

### Authenticated webhook edge

- dedicated `/api/integrations/github/webhook`
- independent server-only `GITHUB_APP_WEBHOOK_SECRET`
- exact raw-byte HMAC-SHA256 verification before JSON parsing
- strict signature/header/content-type validation
- bounded 10 MiB body handling, including unknown-length streams
- replay protection keyed by `X-GitHub-Delivery`
- bounded delivery metadata only; no raw payload/signature/credential/source persistence

### Provider-authoritative reconciliation

- webhook payloads are triggers only
- installation/repository/default branch/current head are re-fetched from GitHub
- public/private repository paths and runtime gates remain distinct
- stale payload heads recover through the authoritative provider head after #85
- same-head pending work can recover if no active intent owns the chain after #80

### Latest-head-wins scanning

- rapid pushes coalesce
- manual and automatic scans retain no-lost-head follow-up behavior
- successful watermark advances only after exact repository-scan success
- retry/failure/cancellation do not incorrectly advance success state
- automatic continuation remains bound to exact immutable snapshot authority

## Production state

At this reconciliation:

- Phase 10A3 production migrations: none applied
- no production webhook registration is authorized by this branch
- no Phase 10A3 webhook secret creation/rotation was performed here
- no Phase 10A3 runtime/provider gate was enabled

Phase 10A2 production migrations being applied does not authorize Phase 10A3 migration or webhook activation.

## Upstream Priority 0 blocker

Phase 10A2 PR #76 is waiting on real Linux worker/private-repository acceptance. Codex must prioritize:

`docs/development/CODEX_PRIORITY_0_HOST_ACCEPTANCE.md`

when an authorized OCI/SSH terminal is available.

Do not use Phase 10A3 work to bypass or distract from that release gate.

## Release order

1. complete Phase 10A2 Priority 0 worker/private-repository acceptance
2. merge/release #76 with expected live head and verify production
3. fetch released `main` and exact #77 head
4. reconcile #77 onto released Phase 10A2/main
5. rerun fresh full exact-candidate validation
6. inspect production migration history and apply only reviewed absent Phase 10A3 migrations
7. configure the independent webhook secret/endpoint securely
8. canary signed delivery, unsupported-event 202, invalid signature, oversize rejection, replay, lifecycle, latest-head coalescing, same-head recovery, stale-trigger authoritative-head recovery, terminal settlement, public/private separation, privacy boundaries, and full automatic scan
9. merge/release #77 only after all operational acceptance passes
10. verify exact production deployment and database state after release

## Resume point

If #76 is still unreleased, keep #77 draft. Safe independent TDD hardening may continue on isolated branches, but no Phase 10A3 production migration or webhook activation should occur.

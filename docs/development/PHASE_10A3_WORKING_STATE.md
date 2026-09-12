# Phase 10A3 Working State

## Current checkpoint - 2026-09-12

Phase 10A3 remains implementation-complete but operationally release-gated behind issue #79 and Phase 10A2 acceptance.

- Phase 10A1 released main: `33d21de652f3c04aa88ebd4f122348803e59b153`
- Phase 10A2 PR #76 current head: `709ef8af4ce4befae12ba910d3bca15599b5cab1`
- Phase 10A3 PR #77 remains draft and stacked on #76
- latest verified executable Phase 10A3 head: `9c40e89bb9433d8b4ce268302e1a9e5b04f29151`
- synthetic merge validated by CI: `333711dfa8490fc137999dfb98d25ad9f248c5bd`
- CI #962 / run `34687506721`: SUCCESS
- audit: 0 vulnerabilities
- Vitest: 412 / 412 files, 1,896 / 1,896 tests
- typecheck: PASS
- CLI build/version: PASS, `ScopeForge 0.1.0`
- scanner benchmark: PASS, 700 files, zero errors, 622 ms wall time against 20,000 ms budget
- dependency-lockfile, IaC and source-AST benchmark matrix: PASS
- optimized Next.js production build: PASS
- strict CSP browser acceptance: PASS
- production ScopeForge/Turnstile diagnostic: PASS
- visual acceptance artifact: `10296117940`

No Phase 10A2/10A3 production migration was applied, no production webhook was registered, no provider secret was created/exposed, and no hosted worker runtime flag was enabled during this continuation.

Documentation-only commits after executable head `9c40e89bb9433d8b4ce268302e1a9e5b04f29151` do not replace CI #962 as exact executable-tree evidence. Any later executable change requires fresh validation.

## Hardening #78 - bounded webhook request streaming

Issue #78 is closed as completed.

### Defect

Unknown-length webhook requests used `request.arrayBuffer()` before checking actual size. Oversized chunked bodies were rejected eventually, but the application-level 10 MiB ceiling did not itself bound buffering.

### TDD evidence

RED:

- tests-only head `5de02284a16e79d03c2f275b990ae793a70687f9`
- CI #958 / run `34681195661`
- all pre-existing tests passed and exactly the new overflow-boundary regression failed

GREEN:

- implementation head `eb3dc7d35bf334b51b93ebdeb8011277028ae504`
- CI #959 / run `34681343582`: SUCCESS
- 411 / 411 files, 1,895 / 1,895 tests
- visual artifact `10293699844`

### Correction

The reader now:

- consumes `request.body` incrementally
- enforces the actual 10 MiB ceiling while reading
- attempts cancellation on overflow/read failure
- assembles only accepted bytes
- preserves exact raw bytes for HMAC-SHA256
- verifies HMAC before JSON parsing
- preserves existing 400/401/413 semantics

## Hardening #80 - same-head pending no-lost-enqueue recovery

Issue #80 is closed as completed.

### Defect

`record_github_webhook_push_head` and `enqueue_github_webhook_project_snapshot` intentionally run as separate service RPC transactions.

Before the correction, `record_github_webhook_push_head` treated:

`desired_commit_sha = target_commit_sha AND pending = true`

as a semantic replay before checking whether `private.github_project_scan_intents` actually contained an active intent.

A real race therefore existed:

1. Follow-up reconciliation records provider-authoritative head C and receives `shouldEnqueue=true`.
2. Before it enqueues, another valid webhook for C records a newer `latest_delivery_id`.
3. The newer same-head webhook sees `pending=true` and semantic-replays without enqueueing.
4. The older enqueue correctly fails stale because its delivery id is no longer latest.
5. State can remain `pending=true` with no active intent/task and no guaranteed trigger to recover the scan.

### TDD evidence

RED:

- tests-only head `d4582236a45d746c6dba47f6810624b50bd1dd50`
- CI #961 / run `34687272810`
- synthetic merge `e4776ec80b841c5908fe6855c495dae3f9ccb554`
- audit: 0 vulnerabilities
- 411 / 412 test files passed
- 1,895 / 1,896 tests passed
- only `webhook-same-head-pending-recovery.test.ts` failed because the required recovery migration did not yet exist

GREEN:

- implementation head `9c40e89bb9433d8b4ce268302e1a9e5b04f29151`
- synthetic merge `333711dfa8490fc137999dfb98d25ad9f248c5bd`
- CI #962 / run `34687506721`: SUCCESS
- 412 / 412 files and 1,896 / 1,896 tests
- full audit/typecheck/CLI/benchmark/build/browser gates passed
- visual artifact `10296117940`

### Forward-only correction

Migration:

`supabase/migrations/20260912024000_phase_10a3_same_head_pending_recovery.sql`

The overlay replaces only `public.record_github_webhook_push_head` and preserves:

- input validation
- service-role-only execution boundary
- per-link transaction advisory lock
- authoritative link/connection checks
- provider archived behavior
- successful-head semantic replay
- downstream exact `latest_delivery_id` stale enqueue protection
- latest-head coalescing for active work

The function now locks the per-link intent before same-head pending replay classification.

- desired SHA matches + pending + active intent -> semantic replay, `shouldEnqueue=false`
- desired SHA matches + pending + no active intent -> newest delivery becomes recovery owner, `shouldEnqueue=true`
- older racing enqueue remains stale and fails closed if a newer delivery has replaced `latest_delivery_id`

This removes the stranded `pending=true` / no-task state without weakening replay or stale-delivery controls.

The migration is not applied to production yet. It belongs in the reviewed Phase 10A3 migration set after Phase 10A2 release and provider acceptance.

## Existing Phase 10A3 boundaries

### Authenticated webhook edge

- dedicated `/api/integrations/github/webhook` endpoint
- independent server-only `GITHUB_APP_WEBHOOK_SECRET`
- exact raw-byte HMAC-SHA256 verification before JSON parsing
- strict signature/header/content-type validation
- declared and incrementally enforced 10 MiB payload ceiling
- unknown-length body cancellation on overflow/read failure
- `X-GitHub-Delivery` replay protection
- bounded stored delivery/event metadata only; no raw payload/signature/credential/source persistence

### Provider-authoritative lifecycle reconciliation

- signed webhook payloads are triggers only; repository/install/default-head truth is re-fetched from GitHub
- supported push, installation, installation-repositories and selected repository lifecycle reconciliation
- default-branch automatic scanning only
- fail-closed handling for installation/access/visibility/default-branch/archive drift
- repository-scoped installation credentials remain confined to the trusted control plane

### Latest-head-wins automatic scanning

- rapid pushes coalesce instead of creating unbounded fan-out
- public/private acquisition classes and runtime gates remain distinct
- automatic completion is bound to exact persisted webhook intent and immutable snapshot authority
- successful watermark advances only from `repository_source_snapshots.resolved_commit_sha`
- provider head is revalidated before follow-up enqueue
- same-head pending state is recoverable if no active intent owns the chain

### Manual/automatic no-lost-head correction

The prior forward-only migration `20260912023000_phase_10a3_manual_scan_auto_followup.sql` already fixes the independent edge where a webhook coalesced behind a manual connected-project scan could otherwise remain stranded after that manual scan terminated.

It binds settlement by exact persisted repository `scan_task_id`, accepts only trusted terminal task/job pairs, preserves queued/leased/retry work, and schedules at most one provider-authoritative newest-head follow-up.

## Validation history - latest hardening sequence

- manual/automatic follow-up RED: CI #940 / run `34654759881`
- manual/automatic follow-up GREEN: CI #947 / run `34655979305`
- final prior docs-inclusive GREEN: CI #948 / run `34656348562`
- bounded-stream RED: CI #958 / run `34681195661`
- bounded-stream GREEN: CI #959 / run `34681343582`
- same-head recovery RED: CI #961 / run `34687272810`
- same-head recovery GREEN: CI #962 / run `34687506721`

Earlier Phase 10A3 task-by-task TDD history remains available in Git history and prior versions of this file.

## Production safety

No Phase 10A2 or Phase 10A3 migration has been applied to production during this continuation. No production webhook has been registered. No production webhook secret or hosted runtime flag has been changed.

The released Phase 10A1 provider integration remains dark-gated pending issue #79. Code/schema presence and CI success do not authorize provider or runtime activation.

Independent checks also established:

- production password-sign-in rejects missing CAPTCHA tokens with HTTP 400 / `captcha_failed`
- leaked-password protection remains plan-gated on the current Supabase Free organization
- current connected Vercel access does not expose production environment management or live custom firewall/rate-limit configuration
- current CI has two non-blocking maintenance warnings: Vite config module-format future compatibility and the Node runtime used by `actions/upload-artifact@v4`

## Release order

1. Complete issue #79 live GitHub App owner/admin connection/import canary while all hosted worker flags remain disabled.
2. Apply/canary Phase 10A2 private acquisition in the correct Supabase project and dedicated worker environment, then merge/release PR #76.
3. Reconcile PR #77 onto released Phase 10A2/main and run fresh exact-candidate validation.
4. Apply only reviewed absent Phase 10A3 migrations, including `20260912024000_phase_10a3_same_head_pending_recovery.sql`.
5. Configure the independent webhook secret/endpoint and run signed delivery, invalid-signature/oversize, replay, lifecycle, coalescing, same-head recovery, public/private separation, leak-check and full automatic-scan canaries.
6. Merge/release PR #77 only after operational acceptance is complete.

Never skip stack order or infer operational acceptance from code/CI alone.

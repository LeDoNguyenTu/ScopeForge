# Phase 10A3 Working State

## Current checkpoint - 2026-09-13

Phase 10A3 remains implementation-complete but operationally release-gated behind issue #79 and Phase 10A2 acceptance.

- Phase 10A1 released main: `33d21de652f3c04aa88ebd4f122348803e59b153`
- Phase 10A2 PR #76 last verified branch head: `709ef8af4ce4befae12ba910d3bca15599b5cab1`
- Phase 10A3 PR #77 remains draft and stacked on #76
- latest verified executable Phase 10A3 head: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- synthetic merge validated by CI: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS
- Node `v24.20.0`, npm `11.19.0`
- audit: 0 vulnerabilities
- Vitest: 415 / 415 files, 1,900 / 1,900 tests
- typecheck: PASS
- CommonJS CLI build/version: PASS, `ScopeForge 0.1.0`
- scanner benchmark: PASS, 700 files, 0 errors, 697 ms wall time / 20,000 ms budget
- dependency-lockfile-heavy median: 1,823 ms / 20,000 ms
- IaC-heavy median: 425 ms / 30,000 ms
- source-AST-heavy median: 1,220 ms / 30,000 ms
- optimized Next.js 15.5.24 production build: PASS
- strict CSP browser acceptance: PASS
- production ScopeForge/Turnstile diagnostic: PASS
- `actions/upload-artifact@v7`: PASS
- visual acceptance artifact: `10303292695`

No Phase 10A2/10A3 production migration was applied, no production webhook was registered, no provider/webhook secret was created/exposed, and no hosted worker runtime flag was enabled during this continuation.

Documentation-only `[skip ci]` commits after executable head `5f05ed964c8ab43f38a420b1b77317bae630cc1e` do not replace CI #981 as executable-tree evidence. Any later executable change requires fresh exact validation.

## Hardening #78 - bounded webhook request streaming

Issue #78 is closed as completed.

### Defect

Unknown-length webhook requests previously used an unbounded `request.arrayBuffer()` path before applying the application-level 10 MiB ceiling.

### Correction

The edge now:

- consumes `request.body` incrementally
- enforces the actual 10 MiB ceiling while reading
- attempts reader cancellation on overflow/read failure
- assembles only accepted bytes
- preserves exact raw bytes for HMAC-SHA256
- verifies HMAC before JSON parsing
- preserves the existing 400/401/413 response semantics

### TDD evidence

- RED: tests-only head `5de02284a16e79d03c2f275b990ae793a70687f9`, CI #958 / run `34681195661`
- GREEN: implementation head `eb3dc7d35bf334b51b93ebdeb8011277028ae504`, CI #959 / run `34681343582`
- GREEN suite: 411 / 411 files, 1,895 / 1,895 tests

## Hardening #80 - same-head pending no-lost-enqueue recovery

Issue #80 is closed as completed.

### Defect

`record_github_webhook_push_head` and `enqueue_github_webhook_project_snapshot` intentionally execute as separate service RPC transactions. Before the correction, a newer same-head delivery could advance `latest_delivery_id`, semantic-replay solely because `pending=true`, and decline to enqueue even when no active intent owned the queue chain. An older in-flight enqueue would then correctly fail stale, leaving `pending=true` with no task and no guaranteed recovery trigger.

### Correction

Forward-only migration:

`supabase/migrations/20260912024000_phase_10a3_same_head_pending_recovery.sql`

The replacement RPC preserves input validation, service-role-only authority, the per-link advisory lock, authoritative link/connection checks, archived handling, successful-head replay semantics, latest-head coalescing and downstream exact `latest_delivery_id` stale protection.

It now locks the current intent before same-head pending replay classification:

- same desired SHA + pending + active intent -> semantic replay/coalescing remains unchanged
- same desired SHA + pending + no active intent -> newest delivery becomes recovery owner and returns `shouldEnqueue=true`
- older racing enqueue still fails the downstream exact `latest_delivery_id` stale check

The migration remains unapplied to production pending Phase 10A3 operational acceptance.

### TDD evidence

- RED: tests-only head `d4582236a45d746c6dba47f6810624b50bd1dd50`, synthetic merge `e4776ec80b841c5908fe6855c495dae3f9ccb554`, CI #961 / run `34687272810`
- exactly the new missing-recovery-overlay regression failed; all pre-existing tests passed
- GREEN: implementation head `9c40e89bb9433d8b4ce268302e1a9e5b04f29151`, CI #962 / run `34687506721`

## Hardening #85 - superseded push authoritative-head recovery

Issue #85 is closed as completed. PR #86 was squash-merged into the Phase 10A3 branch as executable commit `5f05ed964c8ab43f38a420b1b77317bae630cc1e`.

### Defect

A valid signed default-branch push can arrive after GitHub's current default-branch head has already advanced. The service correctly re-fetched repository/default-head truth from GitHub, but then returned `AUTHORITATIVE_HEAD_ADVANCED` when `payload.after !== authoritativeHead`.

That meant ScopeForge had already obtained the trustworthy newer provider head but deliberately stopped before `recordPushHead` and the existing coalescing/enqueue path. Because webhook delivery is not a durable queue guarantee, this could violate the no-lost-head objective if the newer push delivery never became the recovery trigger.

### Correction

The correction removes only that premature terminal branch.

The signed delivery remains a trigger, not repository truth:

- repository/install identity, default branch, archive state and visibility still come from provider revalidation
- the stale payload SHA is never passed to `recordPushHead` or enqueue
- the freshly fetched GitHub head enters the existing semantic replay/coalescing/runtime-gate machinery
- exact downstream `latest_delivery_id` stale checks remain unchanged
- public/private execution-class separation remains unchanged
- no new migration, permission, provider secret or runtime flag was introduced

### TDD evidence

RED:

- tests-only head `1501b723f394938b8c2af501d50204bcd0db14f0`
- CI #976 / run `34710448050`
- 414 / 415 test files passed
- 1,899 / 1,900 tests passed
- all 1,899 pre-existing tests passed
- only `webhook-superseded-head-recovery.test.ts` failed, receiving exactly `superseded / AUTHORITATIVE_HEAD_ADVANCED`

Feature GREEN:

- feature head `312495c5e4aef9e5a42d5e06d9e2f2471b0d2ced`
- synthetic merge `af288a2d532d98ae8d23bd4a16e642082fef578e`
- CI #979 / run `34710886639`: SUCCESS
- 415 / 415 files, 1,900 / 1,900 tests

Integrated GREEN:

- Phase 10A3 executable head `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- synthetic merge `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS
- exact validation evidence is recorded in the current-checkpoint section above

## CI/tooling maintenance now complete

### Node 24 baseline

The repository and CI runtime are aligned to Node 24 LTS:

- root engine contract: `>=24 <25`
- CI uses `actions/setup-node@v7` with Node 24
- latest exact validation used Node `v24.20.0`
- Vercel project configuration is already Node `24.x`
- `tests/architecture/node-runtime-alignment.test.ts` guards the contract

### Vitest config module format

`vitest.config.mts` now gives Vitest an explicit ESM config surface without setting the whole package to `type: module` and without changing the CommonJS CLI contract. The previous future native-loader warning is gone and `tests/architecture/vitest-config-module-format.test.ts` guards the shape.

### GitHub artifact action runtime

Issue #81 is closed. CI now uses `actions/upload-artifact@v7`; the prior Node 20 action-runtime deprecation warning is gone. CI #981 uploaded artifact `10303292695` successfully.

### Architecture audit

Issue #82 is closed. The current architecture remains a modular monolith with strong package/domain boundaries. Deterministic scanner extensibility, runtime authority boundaries and the provider-neutral AI advisory seam remain intact. A neutral SCM-provider abstraction and real package workspaces are deferred until concrete second-provider/independent-deployment requirements justify them.

## Existing Phase 10A3 boundaries

### Authenticated webhook edge

- dedicated `/api/integrations/github/webhook` endpoint
- independent server-only `GITHUB_APP_WEBHOOK_SECRET`
- exact raw-byte HMAC-SHA256 verification before JSON parsing
- strict signature/header/content-type validation
- declared and incrementally enforced 10 MiB payload ceiling
- unknown-length-body cancellation on overflow/read failure
- `X-GitHub-Delivery` replay protection
- bounded stored delivery/event metadata only; no raw payload/signature/credential/source persistence

### Provider-authoritative lifecycle reconciliation

- signed webhook payloads are triggers only
- repository/install/default-branch/default-head truth is re-fetched from GitHub
- stale payload heads now recover through the provider-authoritative current head after #85
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
- stale signed payloads can recover the provider-authoritative newest head without scanning the stale payload SHA

### Manual/automatic no-lost-head correction

Migration `20260912023000_phase_10a3_manual_scan_auto_followup.sql` handles the independent edge where a webhook coalesces behind a manual connected-project scan. It binds settlement to exact persisted repository `scan_task_id`, accepts only trusted terminal task/job pairs, preserves queued/leased/retry work and schedules at most one provider-authoritative newest-head follow-up.

## Validation history - latest hardening sequence

- manual/automatic follow-up RED: CI #940 / run `34654759881`
- manual/automatic follow-up GREEN: CI #947 / run `34655979305`
- final prior docs-inclusive GREEN: CI #948 / run `34656348562`
- bounded-stream RED: CI #958 / run `34681195661`
- bounded-stream GREEN: CI #959 / run `34681343582`
- same-head pending recovery RED: CI #961 / run `34687272810`
- same-head pending recovery GREEN: CI #962 / run `34687506721`
- artifact-action maintenance GREEN: CI #965 / run `34687989048`
- Node/Vitest maintenance sequence completed before #85 and is covered by later full validation
- superseded-head recovery RED: CI #976 / run `34710448050`
- superseded-head feature GREEN: CI #979 / run `34710886639`
- final integrated executable GREEN: CI #981 / run `34711218370`

Earlier Phase 10A3 task-by-task TDD history remains available in Git history and earlier versions of this file.

## Production safety

No Phase 10A2 or Phase 10A3 migration has been applied to production during this continuation. No production webhook has been registered. No production webhook secret, GitHub provider secret or hosted runtime gate has been changed.

The released Phase 10A1 provider integration remains dark-gated pending issue #79. Code/schema presence and CI success do not authorize provider or runtime activation.

Independent checks also established:

- production password sign-in rejects missing CAPTCHA tokens with HTTP 400 / `captcha_failed`
- leaked-password protection remains plan-gated on the current Supabase Free organization
- current connected Vercel access does not expose production environment management or live custom firewall/rate-limit configuration
- recent production runtime-log inspection during hardening showed no current warning/error/fatal cluster

## Release order

1. Complete issue #79 live GitHub App owner/admin connection/import canary while all hosted worker flags remain disabled.
2. Re-read the actual PR #76 head and production migration history.
3. Apply/canary Phase 10A2 private acquisition in ScopeForge Supabase project `tdgpibrepzcvdivztkta` and the dedicated worker environment, then merge/release #76 only after provider/schema/runtime acceptance.
4. Reconcile PR #77 onto released Phase 10A2/main and run fresh exact-candidate validation.
5. Apply only reviewed absent Phase 10A3 migrations, including `20260912024000_phase_10a3_same_head_pending_recovery.sql`.
6. Configure the independent webhook secret/endpoint and run signed-delivery, invalid-signature/oversize, replay, lifecycle, latest-head coalescing, #80 same-head recovery, #85 stale-trigger authoritative-head recovery, public/private separation, leak-check and full automatic-scan canaries.
7. Merge/release PR #77 only after operational acceptance is complete.

## Resume point

Start with issue #79 plus `CURRENT_STATE.md`, `NEXT_STEPS.md`, this file, `PHASE_10A1_GITHUB_APP_SETUP.md`, PR #76 and PR #77. Inspect actual branch heads first.

Never skip stack order or infer operational acceptance from code/CI alone.

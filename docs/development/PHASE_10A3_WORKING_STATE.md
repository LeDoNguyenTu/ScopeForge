# Phase 10A3 Working State

## Bounded webhook streaming hardening checkpoint - 2026-09-12

This checkpoint supersedes the older Phase 10A3 implementation status below.

- Phase 10A1 remains released as `33d21de652f3c04aa88ebd4f122348803e59b153` with the live GitHub integration release gate disabled pending the provider canary tracked in issue #79.
- Phase 10A2 PR #76 remains draft. Its current head is `709ef8af4ce4befae12ba910d3bca15599b5cab1`; the latest change is documentation-only branch-cleanup reconciliation.
- Phase 10A3 PR #77 remains draft and stacked on Phase 10A2.
- Static security review found one pre-release webhook edge gap: unknown-length request bodies used `request.arrayBuffer()` and therefore could be fully buffered before the application-level 10 MiB actual-body limit rejected them.
- Issue #78 recorded the required TDD hardening and is now closed as completed.
- RED checkpoint: tests-only head `5de02284a16e79d03c2f275b990ae793a70687f9`, CI #958 / run `34681195661`. 411 files / 1,895 tests executed and exactly the new bounded-stream regression failed because the old reader consumed beyond the overflow boundary.
- GREEN implementation: `eb3dc7d35bf334b51b93ebdeb8011277028ae504`. The reader now consumes the request stream incrementally, rejects immediately after accumulated bytes exceed 10 MiB, attempts reader cancellation on overflow/read failure, then assembles the exact accepted bytes for HMAC-SHA256 verification before JSON parsing.
- GREEN validation: CI #959 / run `34681343582` against synthetic merge `4b5d2d287f6d747c69c769a70d63e1671f4ad3a2` passed. `npm audit` reported zero vulnerabilities; Vitest passed 411 / 411 files and 1,895 / 1,895 tests; typecheck, CLI build/version, scanner benchmark, benchmark matrix, optimized production build, CSP browser smoke and production UI/Turnstile diagnostics all passed. Visual acceptance artifact: `10293699844`.
- The successful scanner benchmark processed 700 files with zero errors in 880 ms wall time against the 20,000 ms budget. All dependency-lockfile, IaC and source-AST benchmark profiles passed their budgets.
- Fresh Vercel runtime-error inspection after the hardening found no current production runtime-error cluster in the last hour. The earlier one-off platform-availability error belonged to an older deployment and is not currently reproducing.
- Static Phase 10A2 private acquisition review did not identify another actionable defect in this pass. The control plane binds authoritative repository/commit identity, the private worker independently validates the exact codeload host/path/commit, and the snapshot parser independently enforces streamed archive bounds.
- The authoritative branch-cleanup manifest was refreshed on PR #76 so Phase 10A1 is no longer incorrectly retained as active and the current Phase 10A2/10A3 branches are protected from cleanup.
- No Phase 10A2/10A3 production migration was applied, no webhook was registered, no provider secret was created/exposed, and no hosted worker runtime flag was enabled during this continuation.
- Remaining operational sequence: resolve issue #79 through a supported authenticated Vercel/GitHub provider configuration surface; complete the Phase 10A1 connection/import canary; complete and release Phase 10A2 private acquisition acceptance; then reconcile/revalidate Phase 10A3 and execute its migration, signed delivery, replay, lifecycle, coalescing, leak-check and end-to-end automatic-scan canaries.

Documentation-only commits after implementation head `eb3dc7d35bf334b51b93ebdeb8011277028ae504` do not replace CI #959 as the exact executable-tree validation evidence. Any later executable change requires fresh validation.

## Webhook reconciliation checkpoint - 2026-09-12

This checkpoint is historical and is retained for traceability.

- Phase 10A1 is released as `33d21de652f3c04aa88ebd4f122348803e59b153`; Vercel production is READY and live connect/callback probes confirm the integration is disabled.
- Phase 10A2 PR #76 targeted main at `47b5360cbf2a6b6388d77557cd9fcc14e2d618ff` at this older checkpoint and contained released main with no missing base commits.
- The Phase 10A3 reconciliation merged that Phase 10A2 head. Environment documentation retained webhook configuration, private archive secrecy, and the separate GitHub integration gate.
- Local integrated validation at this older checkpoint passed 411 files / 1,894 tests, typecheck and production build with documented CI-only placeholders.
- No hosted browser/runtime canary or production Phase 10A2/10A3 migration was performed at that checkpoint.

Date: 2026-09-12
Branch: `feat/phase-10a3-github-webhook-reconciliation`

## TDD / validation history

- Task 1 RED: CI #914 / run `34631217021`; GREEN: CI #916 / run `34632551953`.
- Tasks 2-3 RED: CI #918 / run `34637569190`; GREEN: CI #922 / run `34639416412`, exact head `d5a71c0504a6531ea94cf5ebd2477c40b6e741f6`.
- Task 4 service RED: CI #923 / run `34645026763`; GREEN: CI #925 / run `34646073036`.
- Task 4 route RED: CI #926 / run `34646601886`; GREEN: CI #927 / run `34649158445`, exact head `c6d6b20a1f654539b2218994c48c8b3d7dac3edf`.
- Corrected Task 5 RED: CI #929 / run `34649891292`; GREEN: CI #930 / run `34650537947`, exact head `0e5584436bfb72189071c9e681a2ed0ef65e408e`.
- Task 6 RED: CI #931 / run `34651520973`; first GREEN candidate #933 exposed one replay-normalization failure; final GREEN: CI #935 / run `34652736967`, exact head `d6cb9126191dd2476171ac3ed35835d773a59720`.
- Task 7 RED: CI #937 / run `34653167208`; GREEN: CI #938 / run `34653612240`, exact head `2a99c0fb91d1b28c309cf145f1367cbffa3410c3`.
- Release-hardening manual/automatic follow-up RED: CI #940 / run `34654759881`, with all 401 pre-existing files / 1,831 tests green and exactly eight new regression assertions failing.
- Release-hardening GREEN: CI #947 / run `34655979305`, exact implementation head `94957dc229b96a56f5ce4e392e756358babeac25`.
- Final docs-inclusive GREEN: CI #948 / run `34656348562`, exact documented head `3cf6dc800eafeb7967b231063afb2e4177acf64f`, synthetic merge `87e11f9e22bb79e6f9810860ed182a85cc868fd2`.
- Bounded-stream RED: CI #958 / run `34681195661`, exact tests-only head `5de02284a16e79d03c2f275b990ae793a70687f9`.
- Bounded-stream GREEN: CI #959 / run `34681343582`, exact implementation head `eb3dc7d35bf334b51b93ebdeb8011277028ae504`, synthetic merge `4b5d2d287f6d747c69c769a70d63e1671f4ad3a2`.

## Implemented Phase 10A3 boundaries

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
- supported push, installation, installation-repositories, and selected repository lifecycle reconciliation
- default-branch automatic scanning only in Phase 10A3
- fail-closed handling for installation/access/visibility/default-branch/archive drift
- repository-scoped installation credentials remain confined to the trusted control plane

### Latest-head-wins automatic scanning

- rapid pushes coalesce instead of creating unbounded scan fan-out
- public/private repository acquisition classes and runtime gates remain distinct
- automatic completion is bound to exact persisted webhook intent + immutable snapshot authority
- successful watermark advances only from `repository_source_snapshots.resolved_commit_sha`
- provider head is revalidated before any follow-up enqueue

### Manual/automatic no-lost-head release hardening

A webhook arriving while a manual connected-project scan owned the per-link intent could previously be coalesced but remain stranded after the manual scan terminated.

The forward-only correction `20260912023000_phase_10a3_manual_scan_auto_followup.sql`:

- binds settlement by exact persisted repository `scan_task_id`
- accepts only manual intents in `scan_queued`
- preserves queued, leased, and `retry_wait` tasks
- accepts only terminal task/job pairs: `completed/succeeded`, `cancelled/cancelled`, or `dead_letter/failed`
- lets a successful manual scan satisfy the automatic watermark only when its immutable scanned snapshot SHA equals the pending desired SHA
- otherwise releases only the exact terminal manual chain and schedules at most one provider-authoritative newest-head follow-up
- invokes settlement after trusted successful publication and trusted failed/cancelled repository-scan finalization
- exposes the settlement RPC to service role only

## Production safety

No Phase 10A2 or Phase 10A3 migration has been applied to production in this continuation. No production webhook has been registered. No production webhook secret or hosted runtime flag has been changed.

The released Phase 10A1 provider integration remains dark-gated pending issue #79. Supplying code/schema or obtaining CI success does not authorize provider or runtime activation.

Independent hardening checks on 2026-09-12 also established:

- the ScopeForge Supabase organization is on the `free` plan, while leaked-password protection is plan-gated
- production password-sign-in CAPTCHA enforcement is independently verified by a no-token request returning HTTP 400 / `captcha_failed`
- the connected Vercel surface does not expose live custom firewall/rate-limit configuration or production environment management, so custom WAF posture and GitHub provider secrets must remain unclaimed from this session

## Release order

1. Complete the live GitHub App owner/admin connection/import canary tracked in #79 while keeping hosted worker flags disabled.
2. Apply/canary Phase 10A2 private acquisition in the correct project and dedicated worker environment, then merge/release PR #76.
3. Reconcile PR #77 onto released Phase 10A2/main and perform fresh exact-candidate validation.
4. Apply reviewed Phase 10A3 migrations, configure the independent webhook secret/endpoint, run signed-delivery, replay, lifecycle, coalescing, public/private separation, leak-check and end-to-end automatic-scan canaries, then merge/release Phase 10A3.

Never skip stack order or infer operational acceptance from code/CI alone.

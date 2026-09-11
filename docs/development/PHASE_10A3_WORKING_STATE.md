# Phase 10A3 Working State

Date: 2026-09-12
Branch: `feat/phase-10a3-github-webhook-reconciliation`
Base: `feat/phase-10a2-private-repository-acquisition` at validated head `e812a236f3782059e72a5fd2793d4f9b2641e81f`

## Current checkpoint

Phase 10A3 design, implementation, Task 8 documentation, and release-hardening correction are complete on the current stacked branch. The PR remains draft because release order is gated by Phase 10A1 and Phase 10A2 production acceptance, not by remaining Phase 10A3 implementation work.

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

## Implemented Phase 10A3 boundaries

### Authenticated webhook edge

- dedicated `/api/integrations/github/webhook` endpoint
- independent server-only `GITHUB_APP_WEBHOOK_SECRET`
- exact raw-byte HMAC-SHA256 verification before JSON parsing
- strict signature/header/content-type validation
- declared and streamed 10 MiB payload ceiling
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

Changed-file security review found a real lifecycle edge case before merge: a webhook arriving while a manual connected-project scan owned the per-link intent could be coalesced but remain stranded after the manual scan terminated.

The forward-only correction `20260912023000_phase_10a3_manual_scan_auto_followup.sql` now:

- binds settlement by exact persisted repository `scan_task_id`
- accepts only manual intents in `scan_queued`
- preserves queued, leased, and `retry_wait` tasks
- accepts only terminal task/job pairs: `completed/succeeded`, `cancelled/cancelled`, or `dead_letter/failed`
- lets a successful manual scan satisfy the automatic watermark only when its immutable scanned snapshot SHA equals the pending desired SHA
- otherwise releases only the exact terminal manual chain and schedules at most one provider-authoritative newest-head follow-up
- invokes settlement after trusted successful publication and trusted failed/cancelled repository-scan finalization
- exposes the settlement RPC to service role only

## Final validated evidence before this documentation reconciliation

CI #948 / run `34656348562`: SUCCESS.

- `npm audit --audit-level=info`: 0 vulnerabilities
- Vitest: 402 / 402 files and 1,839 / 1,839 tests
- all eight manual/automatic terminal-reconciliation regression tests: PASS
- TypeScript typecheck: PASS
- CLI build/version: PASS (`ScopeForge 0.1.0`)
- scanner benchmark: PASS
- dependency-lockfile / IaC / source-AST benchmark matrix: PASS
- optimized Next.js 15.5.24 production build: PASS
- `/api/integrations/github/webhook` and both repository-scan finalization routes present in the production route table
- strict-CSP browser smoke: PASS
- production `scopeforge.dev` V5/Turnstile diagnostic: PASS
- four-file visual acceptance artifact upload: PASS, artifact `10286501039`

## Production safety

No Phase 10A3 migration has been applied to production. No production webhook has been registered. No production webhook secret or hosted runtime flag has been changed.

Production ScopeForge Supabase still stops after the five Phase 10A1 migrations and has zero GitHub connection/repository-link rows. The Phase 10A1 live provider canary remains the first release gate.

Fresh independent hardening checks on 2026-09-12 also established:

- the ScopeForge Supabase organization is on the `free` plan, while current Supabase documentation places leaked-password protection on Pro and above; the existing advisor warning is therefore plan-gated rather than a missing database migration
- the released browser auth path visibly uses Turnstile and forwards `captchaToken` to Supabase Auth, but server-side CAPTCHA enforcement still needs an independent hosted Auth configuration read or password-endpoint POST probe
- the current connected Vercel surface does not expose live custom firewall/rate-limit configuration, and the execution container has no authenticated Vercel CLI; custom WAF posture must therefore remain unclaimed until a supported authenticated surface is available

## Release order

1. complete the Phase 10A1 live GitHub App owner/admin connection/import canary and release Phase 10A1
2. reconcile Phase 10A2 onto released `main`, apply/canary its private acquisition schema/runtime, then release Phase 10A2
3. reconcile Phase 10A3 onto released `main`, apply its reviewed migrations, configure the webhook secret/endpoint, run signed delivery + replay/lifecycle/coalescing/public-private/end-to-end canaries, then merge/release Phase 10A3

This documentation reconciliation changes release evidence/state only. It does not authorize any production schema, provider, webhook, firewall, Auth-plan, or runtime change.

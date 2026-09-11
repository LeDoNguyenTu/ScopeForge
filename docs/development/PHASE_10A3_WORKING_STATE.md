# Phase 10A3 Working State

Date: 2026-09-12
Branch: `feat/phase-10a3-github-webhook-reconciliation`
Base: `feat/phase-10a2-private-repository-acquisition` at validated head `e812a236f3782059e72a5fd2793d4f9b2641e81f`

## Current checkpoint

Phase 10A3 design and implementation plan are approved and committed. The complete Phase 10A3 implementation, Task 8 documentation refresh, and the release-hardening correction discovered during changed-file review are now GREEN against the exact Phase 10A2 base.

Task 1 RED evidence is captured in CI #914 / run `34631217021`. Final Task 1 CI #916 / run `34632551953` passed every release gate.

Tasks 2 and 3 RED evidence is captured in CI #918 / run `34637569190`. Final Tasks 2 and 3 CI #922 / run `34639416412` passed every release gate on exact head `d5a71c0504a6531ea94cf5ebd2477c40b6e741f6`.

Task 4 service RED evidence is captured in CI #923 / run `34645026763`; final service CI #925 / run `34646073036` passed every release gate. Task 4 route RED evidence is captured in CI #926 / run `34646601886`; final route CI #927 / run `34649158445` passed every release gate on exact head `c6d6b20a1f654539b2218994c48c8b3d7dac3edf`.

Corrected Task 5 RED CI #929 / run `34649891292` proved the lifecycle contract cleanly. Final Task 5 CI #930 / run `34650537947` passed every release gate on exact head `0e5584436bfb72189071c9e681a2ed0ef65e408e`.

Task 6 RED CI #931 / run `34651520973` proved the completion/no-lost-head contract cleanly with all 399 pre-existing test files / 1,812 pre-existing tests green and exactly 10 new Task 6 assertions failing as intended. First GREEN CI #933 / run `34652326280` had one remaining replay-normalization failure while 399 files / 1,821 tests passed. The boundary was corrected so every completion result, including injected/replayed results, passes through the same strict parser.

Final Task 6 CI #935 / run `34652736967` passed every release gate on exact head `d6cb9126191dd2476171ac3ed35835d773a59720`: dependency install, zero-vulnerability audit, full tests, typecheck, CLI build/version, scanner and matrix benchmarks, production build, CSP browser smoke, production diagnostics, and artifact handling.

Task 6 implementation includes:

- immutable-snapshot completion authority from exact webhook intent + snapshot task + snapshot ID + `repository_source_snapshots.resolved_commit_sha`
- replay-safe successful watermark advancement
- provider-authoritative fresh-head revalidation and latest-head-wins follow-up scheduling
- public/private runtime gate preservation
- repository-restricted installation credentials confined to the trusted control plane
- worker finalize integration only after successful snapshot publication and exact-snapshot scan continuation

Task 7 RED CI #937 / run `34653167208` proved the browser/read-model contract cleanly: dependency install and zero-vulnerability audit passed, all 399 pre-existing files remained green, the new security architecture suite passed all four assertions, and only the new browser read-model/panel assertions failed as intended.

Final Task 7 CI #938 / run `34653612240` passed every release gate on exact head `2a99c0fb91d1b28c309cf145f1367cbffa3410c3`: dependency install, zero-vulnerability audit, complete tests, typecheck, CLI build/version, scanner and matrix benchmarks, production Next.js build, strict-CSP browser smoke, production V5/Turnstile diagnostic, and artifact handling.

Task 7 implementation includes only the minimum browser-safe state:

- `ConnectedProjectScanReadModel.autoScanEnabled` sourced exclusively from the existing public `github_repository_links.auto_scan_enabled` field
- fail-closed validation when that public boolean is absent or malformed
- `Automatic scanning: On|Off` in the connected-project panel
- independent manual `Scan project` behavior remains governed by existing access/runtime/orchestration state, not by the automatic-scan preference
- no browser query of `github_webhook_deliveries`, `github_repository_auto_scan_state`, webhook payload metadata, delivery UUIDs, signatures, provider tokens, archive capabilities, or private coalescing state

Task 8 documentation refreshed `README.md`, `docs/ARCHITECTURE.md`, `docs/ENVIRONMENT.md`, `.env.example`, `docs/development/CURRENT_STATE.md`, and `docs/development/NEXT_STEPS.md` to reflect the current local scanner, hosted control plane, connected-project stack, public/private acquisition boundaries, Phase 10A3 webhook model, seven server-only GitHub App settings, and release sequencing.

## Release-hardening lifecycle correction

During the required Task 8 changed-file security/lifecycle review, a real no-lost-head edge case was discovered before merge:

- a Phase 10A1 manual connected-project intent can remain `scan_queued` while its repository scan owns the per-link chain
- a default-branch webhook push arriving during that manual scan is correctly coalesced as the desired automatic head
- automatic snapshot completion intentionally ignores manual intents
- without a repository-scan terminal reconciliation boundary, the desired automatic head could remain stranded after the manual scan completed

Root-cause tracing confirmed that repository-scan terminal persistence is the only correct authority boundary. A failed attempt can legitimately become `retry_wait`, so an attempt-level failure result must never release the manual intent by itself.

RED CI #940 / run `34654759881` validated the regression contract before implementation. The run kept all 401 pre-existing test files / 1,831 pre-existing tests GREEN and failed only the eight new `tests/project-scans/manual-auto-followup.test.ts` assertions as intended.

The forward-only correction adds `20260912023000_phase_10a3_manual_scan_auto_followup.sql` and now:

- binds terminal settlement only by the exact persisted repository `scan_task_id`
- accepts only manual intents in `scan_queued`
- preserves queued, leased, and `retry_wait` tasks without releasing the chain
- accepts only persisted terminal task/job pairs: `completed/succeeded`, `cancelled/cancelled`, or `dead_letter/failed`
- allows a successful manual scan to satisfy the automatic successful watermark only when the immutable scanned snapshot SHA exactly equals the pending desired SHA
- otherwise releases only the exact terminal manual chain and schedules at most one provider-authoritative latest-head automatic follow-up
- reuses the existing repository-scoped GitHub installation-token boundary and public/private acquisition runtime gates
- invokes reconciliation after trusted successful repository-scan publication and after trusted failed/cancelled repository-scan finalization using only the persisted returned task ID
- keeps the new settlement RPC `SECURITY DEFINER`, service-role-only, and inaccessible to browser roles

GREEN CI #947 / run `34655979305` passed every release gate against synthetic merge ref `8960e9eff9e1db85f2a115754e8c54d4a6548b95`, which merges exact implementation head `94957dc229b96a56f5ce4e392e756358babeac25` into exact Phase 10A2 base `e812a236f3782059e72a5fd2793d4f9b2641e81f`.

Fresh CI #947 evidence:

- `npm audit --audit-level=info`: 0 vulnerabilities
- Vitest: 402 / 402 files and 1,839 / 1,839 tests passed, including all eight manual/automatic terminal reconciliation regressions
- TypeScript typecheck passed
- CLI build and `ScopeForge 0.1.0` version check passed
- scanner benchmark and dependency/IaC/source-AST benchmark matrix passed within their budgets
- optimized Next.js 15.5.24 production build passed, including `/api/integrations/github/webhook` and both repository-scan finalization routes
- strict-CSP browser smoke passed
- production `scopeforge.dev` V5/Turnstile diagnostic passed
- visual acceptance artifact upload passed with four files, artifact ID `10285786365`

The remaining warnings in CI #947 are non-gating tooling/performance deprecations (Vite future config-loader behavior, Next.js cache/performance notices, and GitHub action Node runtime deprecation notices); no application/security gate failed.

## Release state

The Phase 10A3 code and documentation are current-stack CI GREEN, but the PR remains release-sequenced behind Phase 10A1 and Phase 10A2. This validation does not authorize skipping their production gates.

The Phase 10A3 migrations remain source-only and have not been applied to any Supabase environment. No webhook has been registered. No production GitHub App webhook secret or runtime flag has been changed.

Release order remains:

1. complete the Phase 10A1 live GitHub App owner/admin connection/import canary and release Phase 10A1
2. apply/canary the Phase 10A2 private acquisition schema/runtime and release Phase 10A2
3. apply the Phase 10A3 migrations, configure the webhook secret/endpoint, run signed webhook + replay/lifecycle/public-private canaries, then merge/release Phase 10A3

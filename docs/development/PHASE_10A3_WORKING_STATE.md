# Phase 10A3 Working State

Date: 2026-09-12
Branch: `feat/phase-10a3-github-webhook-reconciliation`
Base: `feat/phase-10a2-private-repository-acquisition` at validated head `e812a236f3782059e72a5fd2793d4f9b2641e81f`

## Current checkpoint

Phase 10A3 design and implementation plan are approved and committed.

Task 1 RED evidence is captured in CI #914 / run `34631217021`. Final Task 1 CI #916 / run `34632551953` passed every release gate.

Tasks 2 and 3 RED evidence is captured in CI #918 / run `34637569190`. Final Tasks 2 and 3 CI #922 / run `34639416412` passed every release gate on exact head `d5a71c0504a6531ea94cf5ebd2477c40b6e741f6`.

Task 4 service RED evidence is captured in CI #923 / run `34645026763`; final service CI #925 / run `34646073036` passed every release gate. Task 4 route RED evidence is captured in CI #926 / run `34646601886`; final route CI #927 / run `34649158445` passed every release gate on exact head `c6d6b20a1f654539b2218994c48c8b3d7dac3edf`.

Corrected Task 5 RED CI #929 / run `34649891292` proved the lifecycle contract cleanly. Final Task 5 CI #930 / run `34650537947` passed every release gate on exact head `0e5584436bfb72189071c9e681a2ed0ef65e408e`.

Task 6 RED CI #931 / run `34651520973` proved the completion/no-lost-head contract cleanly with all 399 pre-existing test files / 1,812 pre-existing tests green and exactly 10 new Task 6 assertions failing as intended. First GREEN CI #933 / run `34652326280` had one remaining replay-normalization failure while 399 files / 1,821 tests passed. The boundary was corrected so every completion result, including injected/replayed results, passes through the same strict parser.

Final Task 6 CI #935 / run `34652736967` passed every release gate on exact head `d6cb9126191dd2476171ac3ed35835d773a59720`: dependency install, zero-vulnerability audit, full tests, typecheck, CLI build/version, scanner and matrix benchmarks, production build, CSP browser smoke, production diagnostics, and artifact handling.

Task 6 implementation now includes:

- immutable-snapshot completion authority from exact webhook intent + snapshot task + snapshot ID + `repository_source_snapshots.resolved_commit_sha`
- replay-safe successful watermark advancement
- provider-authoritative fresh-head revalidation and latest-head-wins follow-up scheduling
- public/private runtime gate preservation
- repository-restricted installation credentials confined to the trusted control plane
- worker finalize integration only after successful snapshot publication and exact-snapshot scan continuation

Task 7 RED coverage is committed in:

- `tests/project-scans/read-model.test.ts`
- `tests/components/ConnectedProjectScanPanel.test.tsx`
- `tests/github-app/webhook-security-architecture.test.ts`

The Task 7 contract requires the browser model to expose automatic scanning only through the existing public `github_repository_links.auto_scan_enabled` field, display automatic scanning on/off truthfully, preserve the independent manual scan action, keep inactive access truthful, never query private webhook/coalescing tables, and guard webhook/service-role trust and persistence boundaries. Production Task 7 read-model/UI code has not been changed yet, so the new UI/read-model assertions are expected to fail in this controlled RED run while the architecture guards should remain green.

The Phase 10A3 migrations remain source-only and have not been applied to any Supabase environment. No webhook has been registered. No production secret/runtime flag has been changed.
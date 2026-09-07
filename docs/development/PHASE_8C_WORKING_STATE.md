# ScopeForge Phase 8C Working State

Last reconciled: 2026-09-07 (Asia/Singapore)

This document is the authoritative resumable state for the non-UI Phase 8C reproducible technical publication workstream. Dashboard V5/UI remains completely separate.

## Branch and base

- repository: `LeDoNguyenTu/ScopeForge`
- implementation branch: `feat/phase-8c-reproducible-publication-v1`
- base `main`: `f896280aa8e3ee65faf8ffb4b053915390aef7d4`
- base has not advanced during Phase 8C implementation
- PR #49 and all Dashboard V5/UI branches remain untouched

## Implemented Phase 8C surface

Phase 8C now contains:

- versioned publication evidence contracts
- strict unique-key bounded JSON parsing
- exact Phase 8A and Phase 8B commit/tree provenance
- deterministic accuracy normalization and cross-checks
- deterministic Phase 8B benchmark-profile/run/summary cross-checks
- canonical JSON serialization
- deterministic Markdown rendering
- safe local developer CLI
- privacy/path leakage guards
- local/offline architecture/authority guards
- committed v1 evidence bundle
- committed human-readable technical report
- publication methodology and reproducibility instructions

The implementation adds no new dependency and does not modify `package-lock.json`.

## Exact evidence identity

Phase 8A:

- release commit: `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- release tree: `aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8`
- corpus: `scopeforge-offline-v1@1.0.0`
- corpus content hash: `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- cases: 32
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0

These metrics describe only the committed reviewed corpus and are not global or real-world ScopeForge accuracy.

Phase 8B:

- executable commit: `226a20739871c15d0262d1779b3b013520f47fc6`
- executable tree: `50f17f44e770f1179ed2b40b7713e14e864958c0`
- accepted post-merge CI evidence: #761
- Node 22.23.2 / Ubuntu 24.04.4 / Linux x64
- all three raw runs retained for every matrix profile

Catastrophic benchmark ceilings are regression guards, not product latency SLOs. RSS delta remains observational only.

## Publication artifacts

Machine-readable evidence source:

`validation/publication/phase-8-release-v1.evidence.json`

Human-readable report:

`docs/validation/reports/phase-8-release-v1.md`

Methodology:

`docs/validation/PUBLICATION.md`

Renderer:

```bash
npm run validation:publication -- --evidence validation/publication/phase-8-release-v1.evidence.json --json phase-8-release-v1.reproduced.json --markdown phase-8-release-v1.reproduced.md
```

Canonical JSON is generated deterministically from the committed evidence. The evidence remains the committed machine-readable source of truth, avoiding a second committed copy of the same normalized data.

## Authority result

Phase 8C remains local/offline publication infrastructure. It adds no:

- Supabase migration or client authority
- hosted repository acquisition
- hosted scanning authority
- runtime networking
- arbitrary HTTP/network access
- child-process or VM execution
- browser authority
- passive or active runtime-worker authority
- supervisor/control authority
- dashboard V5/UI mutation

Keep these false/absent unless separately accepted operationally:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Current verification limitation

The current ChatGPT container cannot resolve GitHub for a local clone, so an executable local/disposable preflight is unavailable in this harness. GitHub Actions has intentionally not been used as a RED/debug loop.

Implementation used test-first commits and static review. The remaining executable verification will be performed on the frozen release candidate through the final GitHub Actions gate, with any failure diagnosed before a rerun.

## Remaining release gates

Before Phase 8C can be called complete:

1. freeze exact branch head
2. inspect exact base-to-head diff for scope, privacy, determinism, dependency, and authority drift
3. verify exact-head Vercel Preview READY
4. run focused/full tests, typecheck, CLI build/version, Phase 8A regressions, Phase 8B regressions, npm audit, and production build through the final candidate validation
5. verify canonical repeated render comparison
6. verify GitHub Actions success on the exact candidate/integration head
7. recheck exact base/head and PR mergeability
8. squash-merge only the verified head
9. verify post-merge main CI
10. verify exact production deployment READY
11. create docs-only `[skip ci]` Phase 8C release/handoff checkpoint
12. make Phase 9 hardening the next non-UI boundary without starting or modifying the UI stream

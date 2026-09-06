# ScopeForge Current State

Last reconciled: 2026-09-06 (Asia/Singapore)

This is the authoritative non-UI current-state summary. Dashboard V5/UI remains a separate active workstream and is excluded from this branch.

## Repository state

- repository: `LeDoNguyenTu/ScopeForge`
- production `main`: `bf6a805030295875e5e124f5e17d2e3d79a2e6da`
- Phase 8A merged PR: #55
- Phase 8A squash merge: `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- active Phase 8B branch: `feat/phase-8b-performance-matrix-v1`
- Phase 8B workflow-integrated candidate measured at: `c28f4ef150b06adbce26c5836e1e47d00788c670`
- detailed resumable state: `docs/development/PHASE_8_WORKING_STATE.md`

## Completed boundaries

Phases 1-5C, Phase 6A foundation, Phase 6B acquisition code, Phase 6C isolated scanner code, Phase 6D dedicated network-worker code/release acceptance, Phase 7 Community Security Packs v1, and Phase 8A offline accuracy foundation are complete in code.

Code merge is not runtime authorization. Production worker capability flags remain separately gated.

## Phase 8A - complete

The committed `scopeforge-offline-v1@1.0.0` corpus remains the accuracy baseline:

- 32 reviewed cases
- 16 vulnerable / 16 clean
- 8 represented rules across `iac`, `jsts`, and `secrets`
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

These metrics describe only that committed corpus and are not global or real-world ScopeForge accuracy.

## Phase 8B - candidate in release preparation

Phase 8B adds a deterministic local/offline performance matrix while preserving `scanner-medium-v1` unchanged.

Profiles:

1. `dependency-lockfile-heavy-v1`
   - 3 analyzed files
   - exact 5,000-component compiled parser preflight
   - SCA only, OSV explicitly disabled
   - 0 findings / 0 errors expected
   - 20,000 ms catastrophic per-run ceiling
2. `iac-heavy-v1`
   - 601 analyzed files
   - exactly four sentinel findings, one each for Docker/Kubernetes/Terraform/GitHub Actions
   - IaC only
   - 30,000 ms catastrophic per-run ceiling
3. `source-ast-heavy-v1`
   - 1,201 analyzed files
   - exactly four `jsts/dynamic-code-execution` findings
   - JSTS only
   - 30,000 ms catastrophic per-run ceiling

Each profile runs exactly three times. Raw wall time, scanner duration, and RSS delta are recorded. RSS is observational and not a pass/fail gate. Catastrophic ceilings are regression guards, not product SLOs.

Exact `c28f4ef...` admission measurement:

- total matrix outer wall: 15.561 s
- sampled peak child RSS: 61,712 KiB
- dependency median wall: 2,452 ms
- IaC median wall: 385 ms
- source/AST median wall: 1,237 ms
- every run satisfied exact files/findings/errors contracts

Because total wall was <=30 s, the permanent CI step was accepted. `.github/workflows/ci.yml` now runs `npm run benchmark:matrix` immediately after the historical `npm run benchmark:scanner` step. The workflow-order regression test was witnessed RED before this change and is now GREEN.

## Current Phase 8B verification

On `c28f4ef...`:

- benchmark tests: 6 files / 31 tests passed
- typecheck passed
- CLI build passed
- real benchmark matrix passed
- no GitHub Actions run was consumed for intermediate RED/GREEN work

Full repository preflight, audit, production build, PR review, one final exact-head Actions gate, merge, and production verification are still pending.

## Production runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 8A/8B do not authorize any of these capabilities.

## Production services

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Never confuse it with the Job Command Center Supabase project.

Vercel project: `scopeforge`, production domain `scopeforge.dev`.

## UI isolation

PR #49 and every active Command Center/V5/UI branch remain separate. Phase 8 work must not edit, merge, retarget, replace, or deploy that UI stream.

## Next non-UI boundary

Finish Phase 8B release gates. After verified merge and production deployment, Phase 8C reproducible technical publication becomes the next Phase 8 boundary.

## Branch cleanup

Merged backend branches should be deleted only through a true remote delete-ref operation. The current connected GitHub surface still exposes no branch-delete action, so merged refs are left intact rather than force-moved. Preserve all active V5/UI branches.

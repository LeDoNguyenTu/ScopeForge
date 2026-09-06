# ScopeForge Current State

Last reconciled: 2026-09-06 (Asia/Singapore)

This file is the authoritative non-UI current-state summary. Dashboard V5/UI remains a separate active workstream and is intentionally excluded from mutation here.

## Repository state

- repository: `LeDoNguyenTu/ScopeForge`
- production `main` Phase 8A merge: `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- merged PR: #55, Phase 8A offline accuracy foundation
- final accepted PR head: `9b1fd4a26924f8fff21ce5f9614b8fc4e0e20510`
- validated PR merge ref: `479cffade6143852dfd9dabbd344271d729f6ba3`
- final GitHub Actions gate: CI #758, success
- exact Phase 8A production deployment: `dpl_BSfMBBxjgmFZHWmzAy5RN5N6Jvyj`, READY, `aliasError=null`, aliased to `scopeforge.dev`
- detailed Phase 8 handoff: `docs/development/PHASE_8_WORKING_STATE.md`

## Completed architecture boundaries

Phases 1-5C are complete. Phase 6A worker foundation, 6B acquisition code, 6C isolated scanner code, 6D dedicated network-worker code/release acceptance, Phase 7 local-only Community Security Packs v1, and Phase 8A offline accuracy foundation are merged.

Code merge is not runtime authorization. Worker-backed production capabilities remain separate enablement gates.

## Phase 8A - complete

Phase 8A provides local/offline validation infrastructure only:

- strict bounded ground-truth corpus/case schemas
- hostile-safe no-follow corpus/repository reads
- deterministic complete corpus hashing
- closed ownership for eight existing built-in rules
- TP/FN/FP/TN plus error/unsupported/contract-mismatch accounting
- null-safe precision/recall/FPR/F1 calculation
- deterministic provenance without timestamps
- deterministic privacy-reduced JSON and Markdown reports
- strict local developer runner
- committed `scopeforge-offline-v1@1.0.0`
- permanent offline/authority/privacy/ground-truth-integrity guards

Phase 8A adds no Supabase access/migration, hosted scanner activation, worker/network authority, browser/dashboard UI, executable plugins, or SCA/OSV network-backed accuracy measurement.

## Phase 8A covered-corpus evidence

- corpus: `scopeforge-offline-v1@1.0.0`
- content hash: `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- 32 cases: 16 vulnerable / 16 clean
- 8 rules across `iac`, `jsts`, and `secrets`
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0
- covered-corpus precision 1.00 / recall 1.00 / FPR 0.00 / F1 1.00

**These metrics describe only the committed 32-case reviewed corpus and are not global or real-world ScopeForge accuracy.**

## Final Phase 8A release evidence

CI #758 validated the proposed PR merge tree `479cffade6143852dfd9dabbd344271d729f6ba3` on Ubuntu 24.04 / Node 22.23.2:

- 312/312 test files passed
- 1,348/1,348 tests passed
- typecheck passed
- CLI build/version passed (`ScopeForge 0.1.0`)
- scanner-medium-v1: 700 files, 0 findings, 0 errors, 910 ms wall time / 20,000 ms catastrophic ceiling
- production Next.js build passed with 9/9 static pages generated

Preflight also established byte-identical repeated validation JSON/Markdown, zero npm-audit vulnerabilities, no dependency-lock drift, clean base-to-head hygiene/scope review, and no forbidden authority primitive in `packages/validation-accuracy`.

## Production Supabase

ScopeForge production Supabase project:

`tdgpibrepzcvdivztkta`

Never confuse it with the separate Job Command Center project.

Outstanding Phase 9 hardening: Supabase leaked-password protection remains disabled.

## Production runtime gates

Keep false/absent unless separate operational acceptance authorizes enablement:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 8A did not change these gates.

## Vercel

- project: `scopeforge` / `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- production domain: `scopeforge.dev`
- Phase 8A merge deployment: `dpl_BSfMBBxjgmFZHWmzAy5RN5N6Jvyj`, READY, `aliasError=null`

## UI isolation

The active dashboard V5/UI preview stream remains separate. Non-UI roadmap work must not edit, merge, replace, retarget, or deploy that branch.

## Next non-UI boundary

Phase 8B performance-matrix work is next. Phase 8C technical publication, separate 6B/6C/6D production-runtime acceptance, and Phase 9 hardening remain later/separate workstreams.

The merged Phase 8A feature branch may be deleted only through a true branch delete-ref operation. The connected GitHub tooling currently exposes no such action, so the branch is intentionally left intact rather than force-moved.

# ScopeForge Current State

Last reconciled: 2026-09-06 (Asia/Singapore)

This file is the authoritative non-UI current-state summary. Dashboard V5/UI remains a separate active workstream and is intentionally excluded from mutation here.

## Repository state

- repository: `LeDoNguyenTu/ScopeForge`
- production `main` at Phase 8A branch creation: `222d9591dbd5e357d179eb06407b0787a2efef7f`
- Phase 7 Community Security Packs v1: merged through PR #54 as `1e9a72e0c4a526b064d6d3729981b405fac6b2b1`
- active non-UI branch: `feat/phase-8a-accuracy-foundation-v1`
- latest fully verified Phase 8A executable/security head before docs: `593fc5655b538502dc3906d81794aa462f98022d`
- detailed handoff: `docs/development/PHASE_8_WORKING_STATE.md`

## Completed architecture boundaries

Phases 1-5C are complete. Phase 6A worker foundation, 6B acquisition code, 6C isolated scanner code, 6D dedicated network-worker code/release acceptance, and Phase 7 local-only Community Security Packs v1 are merged.

Code merge is not runtime authorization. Worker-backed production capabilities remain separate enablement gates.

## Phase 8A candidate

Phase 8A now implements the local/offline accuracy foundation described by the approved Phase 8 design.

Implemented candidate capabilities:

- strict bounded ground-truth corpus/case schemas
- hostile-safe no-follow corpus/repository reads
- complete deterministic corpus content hashing
- closed ownership for eight existing built-in rules
- one-case-one-rule TP/FN/FP/TN classification
- explicit error/unsupported/contract-mismatch accounting
- null-safe precision/recall/FPR/F1 calculation
- deterministic provenance without timestamps
- deterministic privacy-reduced JSON and Markdown reports
- strict local developer runner
- committed `scopeforge-offline-v1@1.0.0`
- permanent offline/authority/privacy/ground-truth-integrity guards

Phase 8A does not add Supabase, hosted scanner activation, worker/network authority, browser/dashboard UI, or SCA/OSV network-backed accuracy measurement.

## Phase 8A covered-corpus evidence

Corpus:

- ID/version: `scopeforge-offline-v1@1.0.0`
- content hash: `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- 32 cases
- 16 vulnerable / 16 clean
- 8 rules
- scanner families: `iac`, `jsts`, `secrets`

Exact Task 5 acceptance head: `398e645abda04e66d0f0c92d2238ad4df9f1c0c4`.

Covered-corpus counts:

- TP 16
- FN 0
- FP 0
- TN 16
- error 0
- unsupported 0
- contract mismatch 0

Covered-corpus derived metrics are precision 1.00, recall 1.00, FPR 0.00, F1 1.00.

**These metrics describe only the committed 32-case corpus and are not global ScopeForge accuracy.**

## Phase 8A security evidence

Exact Task 6 head `593fc5655b538502dc3906d81794aa462f98022d` passed:

- 13/13 focused files
- 66/66 tests
- typecheck

The guards prove the validation package remains local/offline and without hosted/runtime/network/worker authority, the complete 97-file ground-truth corpus remains byte-identical through evaluation/reporting, report paths inside the corpus fail closed, and normalized reports exclude source/evidence/metadata/remediation/timing details.

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

Phase 8A does not change these gates.

## Vercel

- project: `scopeforge` / `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- production domain: `scopeforge.dev`

Vercel deployment state is verified separately from scanner-validation evidence during final integration. Phase 8A does not require a production capability change.

## UI isolation

The active dashboard V5/UI preview stream remains separate. Non-UI Phase 8A work must not edit, merge, replace, retarget, or deploy that branch.

## Next non-UI boundary

Finish Phase 8A exact-tree preflight, source/security review, one final CI run, and safe PR integration. After Phase 8A merges, Phase 8B performance-matrix work is next. Phase 8C technical publication, separate 6B/6C/6D production-runtime acceptance, and Phase 9 hardening remain later/separate workstreams.

# ScopeForge Next Steps

Last reconciled: 2026-09-06 (Asia/Singapore)

## Completed non-UI phases

- Phase 7 Community Security Packs v1: complete, PR #54 merged.
- Phase 8A offline accuracy foundation: complete, PR #55 merged as `8d766f5969427a2e4525f5232b5e28b0f93675bd`.

Do not recreate completed Phase 7 or Phase 8A tasks.

## Immediate priority - finish Phase 8B release gates

Active branch: `feat/phase-8b-performance-matrix-v1`.

Implemented profiles:

1. `dependency-lockfile-heavy-v1` - SCA only, OSV false, exactly 5,000 resolved components in preflight, 3 analyzed files, zero findings/errors expected.
2. `iac-heavy-v1` - 601 analyzed files, exact four sentinel findings across Docker/Kubernetes/Terraform/GitHub Actions.
3. `source-ast-heavy-v1` - 1,201 analyzed files, exact four dynamic-code findings.

Each profile runs exactly three times. Per-run correctness is required before timing is accepted. RSS delta is observational only. Catastrophic ceilings are not product SLOs.

CI cadence decision is complete:

- measured exact candidate: `c28f4ef150b06adbce26c5836e1e47d00788c670`
- total matrix wall: 15.561 s
- threshold: <=30 s
- result: ACCEPT permanent CI integration
- workflow now runs `npm run benchmark:matrix` immediately after `npm run benchmark:scanner`

Current focused evidence:

- 6 benchmark test files / 31 tests passed
- typecheck passed
- CLI build passed
- complete real matrix passed
- all intermediate commits used `[skip ci]`; no substantive Actions run has been spent yet

Remaining Phase 8B sequence:

1. complete methodology/handoff reconciliation on the candidate branch
2. run docs-sensitive benchmark/validation/architecture verification
3. freeze one exact candidate SHA/tree
4. run full disposable Linux preflight: full tests, typecheck, CLI build/version, historical benchmark, matrix, npm audit, production Next.js build
5. review complete base-to-head diff for UI/Supabase/runtime/dependency/hygiene leakage
6. open one draft PR against current `main`
7. verify exact-head Vercel Preview READY
8. create one tree-identical verification commit and mark PR ready
9. require one substantive GitHub Actions run to pass, including the new matrix step
10. squash-merge with expected-head protection
11. verify exact merge SHA on `main` and production Vercel READY on `scopeforge.dev`
12. post-merge docs-only `[skip ci]` checkpoint

## Phase 8C - next after Phase 8B merge

Build reproducible technical publication from normalized Phase 8A/8B evidence. Reports must include exact provenance, covered-corpus counts, benchmark raw runs/summaries, limitations, unsupported cases, and explicit scope. Do not claim repository-wide or real-world accuracy from the 32-case corpus.

## Separate production worker acceptance

Keep these false/absent until their own operational acceptance gates pass:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 8 validation work does not authorize production worker enablement.

## Phase 9 hardening

Later non-UI hardening still includes leaked-password protection, abuse/threat review, production observability, private-schema defense-in-depth, incident/rollback procedures, and final public-launch security review.

## UI isolation

PR #49 and all active dashboard V5/UI branches remain separate. Do not mutate that stream from Phase 8 work.

## Branch cleanup

Delete merged backend branches only via a genuine remote delete-ref operation. The connected GitHub tool surface currently has no such write action. Do not force-move refs to simulate deletion.

# ScopeForge Phase 8C Release State

Released: 2026-09-08 (Asia/Singapore)

Status: complete, merged, CI-verified, and production-verified.

This document is the authoritative release record for Phase 8C reproducible technical publication. Dashboard V5/UI remains a separate workstream and was not modified by this release.

## Release identity

- repository: `LeDoNguyenTu/ScopeForge`
- merged PR: #57, `Phase 8C reproducible technical publication`
- Phase 8C base: `f896280aa8e3ee65faf8ffb4b053915390aef7d4`
- final verified PR head: `1964d2b581d61190eb95a82e34f233aa36a5ee2a`
- final verified tree: `68a8e502b40594778776d1fb627e6cf806158dca`
- squash merge on `main`: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`
- released main tree: `68a8e502b40594778776d1fb627e6cf806158dca`

The squash merge preserved the exact verified candidate tree.

## Released publication surface

Phase 8C adds:

- versioned publication evidence contracts
- strict bounded unique-key JSON parsing
- exact Phase 8A and Phase 8B commit/tree provenance
- deterministic accuracy normalization and consistency checks
- deterministic benchmark-profile/run/summary consistency checks
- canonical JSON serialization
- deterministic Markdown rendering
- safe local developer publication CLI
- privacy and absolute-path leakage guards
- local/offline architecture and authority guards
- committed Phase 8 evidence bundle
- committed human-readable technical report
- publication methodology and reproduction instructions
- permanent CI npm audit gate before executable validation

No new package dependency or `package-lock.json` change was introduced by Phase 8C.

## Evidence identity

Phase 8A:

- release commit: `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- release tree: `aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8`
- corpus: `scopeforge-offline-v1@1.0.0`
- corpus content hash: `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- cases: 32
- represented rules: 8
- scanner families: `iac`, `jsts`, `secrets`
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0

These metrics describe only the committed reviewed corpus. They are not global or real-world ScopeForge accuracy.

Phase 8B:

- executable commit: `226a20739871c15d0262d1779b3b013520f47fc6`
- executable tree: `50f17f44e770f1179ed2b40b7713e14e864958c0`
- accepted post-merge CI evidence: #761
- environment: Node 22.23.2, Ubuntu 24.04.4, Linux x64
- all three raw runs retained for every released matrix profile

Catastrophic wall ceilings remain regression guards, not product latency SLOs. RSS delta remains observational and is not peak RSS or a memory limit.

## Publication artifacts

Machine-readable evidence source:

`validation/publication/phase-8-release-v1.evidence.json`

Human-readable report:

`docs/validation/reports/phase-8-release-v1.md`

Publication methodology:

`docs/validation/PUBLICATION.md`

Renderer command:

```bash
npm run validation:publication -- --evidence validation/publication/phase-8-release-v1.evidence.json --json phase-8-release-v1.reproduced.json --markdown phase-8-release-v1.reproduced.md
```

The committed evidence is the machine-readable source of truth. Canonical JSON is generated deterministically from that evidence rather than maintained as a second independent data copy.

## Final verification evidence

### Preview and candidate validation

During preflight, Vercel caught two TypeScript parser type defects before the final CI candidate. Both were repaired at their source and subsequent previews reached READY.

The first frozen candidate `78039c2216770e8c8ab0c8376a0ca76698594404` reached Vercel READY. CI #763 then failed only in the newly added CI workflow-order regression test because `workflow.indexOf("npm run build")` matched the earlier `npm run build:cli` command.

That test-harness defect was corrected in `[skip ci]` commit `e30d3e2e07e01eb85196ee2ada3c22d608cf2212`. The corrected tree was `68a8e502b40594778776d1fb627e6cf806158dca` and Vercel deployment `dpl_DabFyy3xp28S48xoSSbdrHEFSg18` reached READY with `aliasError=null`.

Replacement frozen candidate:

- head: `1964d2b581d61190eb95a82e34f233aa36a5ee2a`
- tree: `68a8e502b40594778776d1fb627e6cf806158dca`
- PR CI #764: success

CI #764 passed:

- dependency install
- `npm audit --audit-level=info`
- full Vitest suite
- typecheck
- CLI build
- CLI version check
- historical `scanner-medium-v1` benchmark
- complete Phase 8B benchmark matrix
- production Next.js build

### Post-merge validation

Squash merge:

`a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`

Post-merge main CI #765 passed the complete workflow again on the released merge SHA, including audit, tests, typecheck, CLI build/version, both benchmark layers, and production build.

Exact production deployment:

- deployment: `dpl_HFrLZmrPAhFPYvq8SDCJQRYDjJpe`
- target: `production`
- state: READY
- Git SHA: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`
- Vercel project: `scopeforge`

## Scope and authority review

The final Phase 8C diff contained only publication code/tests/docs, one npm publication script, one TypeScript include, and the CI audit step plus its regression test.

Phase 8C introduced no:

- `package-lock.json` change
- Supabase migration
- Supabase client/write authority
- hosted repository acquisition authority
- hosted scanning authority
- runtime networking
- arbitrary HTTP/network client authority
- child-process or VM execution
- browser authority
- passive/active runtime worker authority
- worker supervisor/control authority
- Dashboard V5/UI change

Keep these false/absent until their separate operational acceptance gates authorize them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Claim boundaries retained at release

- the 32-case corpus is not representative global or real-world accuracy
- rules/ecosystems absent from the corpus remain unmeasured
- error and unsupported outcomes remain explicit
- Phase 8B fixtures are synthetic regression workloads, not representative production repositories
- catastrophic benchmark ceilings are regression guards, not product SLOs
- wall-clock timing is environment-sensitive
- RSS delta is not peak-memory measurement
- validation/publication success does not authorize production capabilities

## UI isolation

PR #49 and all Dashboard V5/UI branches remained untouched throughout Phase 8C. Continue treating that stream independently.

## Handoff

Phase 8C has no remaining implementation or release gate.

The next non-UI boundary is Phase 9 security hardening. Phase 9 is not started by this release record. Begin it with a fresh design/threat-model review against the released `main` baseline and explicit acceptance/rollback criteria before operational changes.

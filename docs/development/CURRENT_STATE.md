# ScopeForge Current State

Last reconciled: 2026-09-07 (Asia/Singapore)

This is the authoritative non-UI current-state summary. Dashboard V5/UI remains a separate active workstream and is excluded from mutation here.

## Repository state

- repository: `LeDoNguyenTu/ScopeForge`
- production executable baseline on `main`: `226a20739871c15d0262d1779b3b013520f47fc6`
- Phase 8B merged PR: #56, `Phase 8B scanner performance matrix`
- Phase 8B final PR head: `e09710560d2451039b493e4c777dcddf1e62a1cd`
- CI-validated PR merge ref: `5636fdfea10534dea1a4e126113ba659168e208a`
- executable tree: `50f17f44e770f1179ed2b40b7713e14e864958c0`
- authoritative Phase 8 release state: `docs/development/PHASE_8B_RELEASE_STATE.md`
- detailed resumable state: `docs/development/PHASE_8_WORKING_STATE.md`

## Completed non-UI boundaries

Phases 1-5C, Phase 6A foundation, Phase 6B acquisition code, Phase 6C isolated scanner code, Phase 6D dedicated network-worker code/release acceptance, Phase 7 Community Security Packs v1, Phase 8A offline accuracy foundation, and Phase 8B performance matrix are complete and merged.

Code merge is not runtime authorization. Production worker capabilities remain separately gated.

## Phase 8A accuracy baseline

The committed `scopeforge-offline-v1@1.0.0` corpus remains:

- 32 reviewed cases: 16 vulnerable / 16 clean
- 8 represented rules across `iac`, `jsts`, and `secrets`
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Covered-corpus precision, recall, and F1 are 1.00 and FPR is 0.00. These values describe only the committed reviewed corpus and are not global or real-world ScopeForge accuracy.

## Phase 8B - complete and released

Phase 8B adds a deterministic local/offline performance matrix while preserving `scanner-medium-v1` unchanged.

Profiles:

- `dependency-lockfile-heavy-v1`: SCA only, OSV disabled, exactly 5,000 resolved components in preflight, 3 analyzed files, 0 findings/errors, 20,000 ms catastrophic ceiling.
- `iac-heavy-v1`: 601 analyzed files, exact four expected IaC findings, 0 errors, 30,000 ms catastrophic ceiling.
- `source-ast-heavy-v1`: 1,201 analyzed files, exact `jsts/dynamic-code-execution` x4, 0 errors, 30,000 ms catastrophic ceiling.

Each profile runs exactly three times. RSS delta is observational only. Catastrophic ceilings are regression guards, not product SLOs.

Permanent CI now runs `npm run benchmark:matrix` immediately after the historical `npm run benchmark:scanner` step.

## Release evidence

Final PR CI #760 passed on the exact merge ref. Post-merge main CI #761 then passed on `226a20739871c15d0262d1779b3b013520f47fc6`:

- 318/318 test files passed
- 1,379/1,379 tests passed
- typecheck passed
- CLI build/version passed (`ScopeForge 0.1.0`)
- historical `scanner-medium-v1`: 700 files, 0 findings/errors, 644 ms wall
- Phase 8B matrix passed all repeated-run correctness contracts
- production Next.js build passed with 9/9 static pages

Preflight npm audit reported 0 vulnerabilities.

Exact feature merge production deployment `dpl_EQUz8d1CUjszH4e2Bh8qu1VDrHCu` is READY with `aliasError=null` and includes `scopeforge.dev` among its aliases.

## Production runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 8A/8B did not authorize any of these capabilities.

## Production services

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Never confuse it with the separate Job Command Center Supabase project.

Vercel project: `scopeforge`; production domain: `scopeforge.dev`.

## UI isolation

PR #49 and all active dashboard V5/UI branches remain separate. Non-UI Phase 8 work must not edit, merge, replace, retarget, or deploy that UI stream.

## Next non-UI boundary

Phase 8C reproducible technical publication is next. It must publish normalized Phase 8A/8B evidence with exact provenance, raw counts, benchmark runs/summaries, explicit limitations, unsupported cases, and scope. It must not turn the 32-case corpus into a global accuracy claim or add hosted/network/runtime authority merely to produce reports.

## Branch cleanup

Delete merged backend branches only through a genuine remote delete-ref operation. The connected GitHub tool surface does not currently expose branch deletion, so merged refs must remain intact rather than being force-moved. Preserve all V5/UI branches.

# ScopeForge Next Steps

Last reconciled: 2026-09-07 (Asia/Singapore)

## Completed non-UI phases

- Phase 7 Community Security Packs v1: complete, PR #54 merged.
- Phase 8A offline accuracy foundation: complete, PR #55 merged.
- Phase 8B scanner performance matrix: complete, PR #56 merged as `226a20739871c15d0262d1779b3b013520f47fc6`.

Do not recreate completed Phase 7, Phase 8A, or Phase 8B tasks.

## Immediate non-UI priority - Phase 8C reproducible technical publication

Build deterministic publication/reporting from the already-normalized Phase 8A accuracy evidence and Phase 8B benchmark evidence.

Required publication content:

- exact repository commit and tool version
- Phase 8A corpus ID/version/content hash
- represented scanner/rule scope
- raw TP/FN/FP/TN/error/unsupported/contract-mismatch counts
- derived precision/recall/FPR/F1 only where denominators are defined
- explicit statement that the 32-case reviewed corpus is not global or real-world ScopeForge accuracy
- Phase 8B profile identities and correctness contracts
- every repeated benchmark run plus normalized min/median/max summaries
- Node/OS/architecture/environment provenance
- RSS delta labeled as observational, not peak memory unless a future measurement truly measures peak RSS
- catastrophic ceilings labeled as regression guards, not product SLOs
- errors, unsupported cases, limitations, and known blind spots
- deterministic machine-readable output and a human-readable technical report

Implementation boundaries:

- publication must consume committed/normalized evidence rather than scrape screenshots or mutate labels
- reports must be reproducible from an exact commit
- no hidden network dependency is required for the ordinary publication path
- do not add hosted scanner, worker, browser, arbitrary network, or Supabase authority merely to produce reports
- preserve Phase 8A privacy reductions and ground-truth immutability
- use TDD and preflight-first verification

## Phase 8B release reference

- PR #56
- final PR head: `e09710560d2451039b493e4c777dcddf1e62a1cd`
- squash merge: `226a20739871c15d0262d1779b3b013520f47fc6`
- final PR CI: #760 success
- post-merge main CI: #761 success
- production deployment: `dpl_EQUz8d1CUjszH4e2Bh8qu1VDrHCu`, READY on `scopeforge.dev`
- release state: `docs/development/PHASE_8B_RELEASE_STATE.md`

## Separate production worker acceptance

Code-complete is not production-enabled. Keep these false/absent until their own operational gates pass:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Do not infer Phase 8 validation success authorizes any production worker.

## Phase 9 hardening

Remaining non-UI hardening includes:

- enable/review Supabase leaked-password protection
- abuse prevention and threat review
- Turnstile/equivalent integration only if actually implemented
- production observability and alerting
- private-schema defense-in-depth without breaking RPC-only worker authority
- incident/rollback procedures
- release engineering and final public-launch security review

Accessibility/responsive QA belongs after the separate Dashboard V5 visual stream is stable.

## UI isolation

PR #49 and all active dashboard V5/UI branches remain separate. Do not edit, merge, replace, retarget, or deploy that stream from Phase 8 work.

## Branch cleanup

Delete merged backend branches only with a true remote delete-ref mutation. The connected GitHub tooling currently exposes no branch-delete action. Never force-move a merged branch to simulate deletion.

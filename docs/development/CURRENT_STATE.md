# ScopeForge Current State

Last reconciled: 2026-09-08 (Asia/Singapore)

This is the authoritative non-UI current-state summary. Dashboard V5/UI remains a separate active workstream and is excluded from mutation here.

## Repository state

- repository: `LeDoNguyenTu/ScopeForge`
- current released non-UI baseline on `main`: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`
- released tree: `68a8e502b40594778776d1fb627e6cf806158dca`
- Phase 8C merged PR: #57, `Phase 8C reproducible technical publication`
- Phase 8C final verified PR head: `1964d2b581d61190eb95a82e34f233aa36a5ee2a`
- Phase 8C final PR CI: #764, success
- post-merge main CI: #765, success
- authoritative Phase 8C release state: `docs/development/PHASE_8C_RELEASE_STATE.md`
- Phase 8C publication evidence: `validation/publication/phase-8-release-v1.evidence.json`
- Phase 8C human report: `docs/validation/reports/phase-8-release-v1.md`

## Completed non-UI boundaries

Phases 1-5C, Phase 6A foundation, Phase 6B acquisition code, Phase 6C isolated scanner code, Phase 6D dedicated network-worker code/release acceptance, Phase 7 Community Security Packs v1, Phase 8A offline accuracy foundation, Phase 8B performance matrix, and Phase 8C reproducible technical publication are complete and merged.

Code merge is not runtime authorization. Production worker capabilities remain separately gated.

## Phase 8 accuracy and performance baseline

The committed `scopeforge-offline-v1@1.0.0` corpus remains:

- 32 reviewed cases: 16 vulnerable / 16 clean
- 8 represented rules across `iac`, `jsts`, and `secrets`
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Covered-corpus precision, recall, and F1 are 1.00 and FPR is 0.00. These values describe only the committed reviewed corpus and are not global or real-world ScopeForge accuracy.

Phase 8B retains the deterministic local/offline performance matrix with exactly three runs per profile. RSS delta is observational only. Catastrophic benchmark ceilings are regression guards, not product SLOs.

## Phase 8C - complete and released

Phase 8C publishes the accepted Phase 8A and Phase 8B evidence through a strict, deterministic, local/offline publication layer.

The released publication includes:

- exact Phase 8A and Phase 8B commit/tree provenance
- corpus identity and content hash
- raw confusion-matrix and exceptional-outcome counts
- covered-corpus derived metrics with explicit scope boundaries
- every accepted Phase 8B raw benchmark run and deterministic summaries
- environment/toolchain provenance
- explicit limitations and unsupported scenarios
- deterministic canonical JSON rendering and human-readable Markdown rendering
- privacy/path-leakage guards
- architecture/authority guards
- reproducibility instructions

The publication does not claim global accuracy, representative production latency, peak-memory measurement, or production runtime authorization.

## Phase 8C release evidence

Final candidate:

- PR head: `1964d2b581d61190eb95a82e34f233aa36a5ee2a`
- tree: `68a8e502b40594778776d1fb627e6cf806158dca`
- PR CI #764: success
- npm audit gate: success
- full test suite: success
- typecheck: success
- CLI build/version: success
- historical benchmark: success
- Phase 8B matrix: success
- production build: success
- exact-head Vercel Preview: READY

Release integration:

- squash merge: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`
- main tree: `68a8e502b40594778776d1fb627e6cf806158dca`
- post-merge main CI #765: success
- production deployment: `dpl_HFrLZmrPAhFPYvq8SDCJQRYDjJpe`
- production deployment state: READY
- production deployment target: `production`
- production deployment Git SHA: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`

## Production runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 8 validation/publication does not authorize any of these capabilities.

## Production services

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Never confuse it with the separate Job Command Center Supabase project.

Vercel project: `scopeforge`; production domain: `scopeforge.dev`.

## UI isolation

PR #49 and all active Dashboard V5/UI branches remain separate. Non-UI work must not edit, merge, replace, retarget, or deploy that UI stream.

## Next non-UI boundary

Phase 9 security hardening is next. It is not started by the Phase 8C release checkpoint.

Phase 9 should begin with a fresh design/threat-model pass against the released `main` baseline before implementation. The planned hardening scope includes leaked-password protection review, abuse prevention, production observability/alerting, private-schema defense-in-depth, incident/rollback readiness, release engineering, and final public-launch security review.

## Branch cleanup

Delete merged backend branches only through a genuine remote delete-ref operation. If the connected GitHub surface does not expose branch deletion, leave merged refs intact rather than force-moving them. Preserve all V5/UI branches.

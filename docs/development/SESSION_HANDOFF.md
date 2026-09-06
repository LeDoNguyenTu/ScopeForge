# ScopeForge Session Handoff

Last refreshed: 2026-09-07 (Asia/Singapore)

This is the fastest entry point for the current non-UI stream.

## Hard execution rules

- preflight before CI; do not use GitHub Actions as the first debugging loop
- use `[skip ci]` for intermediate/docs-only checkpoints where Actions adds no executable evidence
- reserve substantive CI for frozen executable/release candidates
- do not modify, merge, retarget, replace, or deploy the active dashboard V5/UI stream from this workstream
- do not enable hosted worker/runtime capabilities as part of a code merge
- do not rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim a test/build/audit/security gate without evidence tied to the relevant SHA

## Current completed release - Phase 8B

Phase 8B scanner performance matrix is complete, merged, CI-verified, and production-verified.

- merged PR: #56
- final PR head: `e09710560d2451039b493e4c777dcddf1e62a1cd`
- CI-validated PR merge ref: `5636fdfea10534dea1a4e126113ba659168e208a`
- squash merge on `main`: `226a20739871c15d0262d1779b3b013520f47fc6`
- executable tree: `50f17f44e770f1179ed2b40b7713e14e864958c0`
- final PR CI #760: success
- post-merge main CI #761: success
- tests on main: 318 files / 1,379 tests passed
- typecheck and CLI build/version passed
- historical benchmark: 700 files, 0 findings/errors, 644 ms wall
- Phase 8B matrix passed all correctness/timing regression guards
- production deployment: `dpl_EQUz8d1CUjszH4e2Bh8qu1VDrHCu`, READY with `aliasError=null`, aliased to `scopeforge.dev`
- preflight npm audit: zero vulnerabilities
- source/scope review: no dashboard/V5, Supabase migration, runtime-worker/repository authority, lockfile, dependency, or historical-medium-benchmark drift

Phase 8B remains local/offline validation infrastructure. It does not authorize production worker enablement.

## Existing Phase 8 accuracy baseline

Phase 8A is already merged and complete:

- corpus `scopeforge-offline-v1@1.0.0`
- 32 reviewed cases, 8 rules, 3 scanner families
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

These metrics apply only to that committed reviewed corpus.

## Current resume action - Phase 8C

Start reproducible technical publication from the normalized Phase 8A/8B evidence.

Before implementation:

1. inspect current `main`, `docs/validation/METHODOLOGY.md`, validation packages, benchmark modules, and any existing report surfaces
2. avoid recreating Phase 8A/8B logic; publication should consume their normalized evidence
3. define exact versioned provenance and deterministic output contracts
4. include raw accuracy counts, derived covered-corpus metrics, every benchmark run/summary, errors/unsupported cases, and limitations
5. preserve privacy reductions, ground-truth immutability, and local/offline authority
6. use TDD and exact-tree preflight before CI
7. keep dashboard V5/UI completely separate

Do not call the 32-case corpus global accuracy. Do not call catastrophic benchmark ceilings product SLOs. Do not add network/hosted/runtime authority merely to publish reports.

## Separate operational queues

Production enablement for Phase 6B acquisition, 6C isolated scanning, and 6D passive/active runtime workers remains separately gated. All four hosted capability flags stay false/absent until their own acceptance/canary/rollback gates complete.

Phase 9 hardening remains incomplete, including leaked-password protection, abuse controls, observability, private-schema defense-in-depth, incident readiness, and release engineering.

## Cleanup

The merged Phase 8B branch remains because the current connected GitHub write surface has no genuine branch delete-ref operation. Do not force-move the branch to simulate deletion. Preserve PR #49 and all active V5/UI branches.

# ScopeForge Session Handoff

Last refreshed: 2026-09-08 (Asia/Singapore)

This is the fastest entry point for the current non-UI stream.

## Hard execution rules

- preflight before CI; do not use GitHub Actions as the first debugging loop
- use `[skip ci]` for intermediate/docs-only checkpoints where Actions adds no executable evidence
- reserve substantive CI for frozen executable/release candidates
- do not modify, merge, retarget, replace, or deploy the active Dashboard V5/UI stream from this workstream
- do not enable hosted worker/runtime capabilities as part of a code merge
- do not rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim a test/build/audit/security gate without evidence tied to the relevant SHA

## Current completed release - Phase 8C

Phase 8C reproducible technical publication is complete, merged, CI-verified, and production-verified.

- merged PR: #57
- final verified PR head: `1964d2b581d61190eb95a82e34f233aa36a5ee2a`
- verified tree: `68a8e502b40594778776d1fb627e6cf806158dca`
- final PR CI #764: success
- squash merge on `main`: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`
- post-merge main CI #765: success
- npm audit gate passed
- full test suite passed
- typecheck and CLI build/version passed
- historical benchmark and Phase 8B matrix passed
- production Next.js build passed
- production deployment: `dpl_HFrLZmrPAhFPYvq8SDCJQRYDjJpe`
- production deployment target: `production`
- production deployment state: READY
- production deployment Git SHA: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`

The first release candidate CI #763 failed only because the new workflow-order regression test searched for `npm run build` and matched the earlier `npm run build:cli` step. The assertion was corrected to match the exact production-build workflow line, the repaired tree reached Vercel READY, and replacement candidate CI #764 passed every gate. Do not treat #763 as a product or publication-runtime defect.

## Released Phase 8 publication

Committed machine-readable source of truth:

`validation/publication/phase-8-release-v1.evidence.json`

Human-readable report:

`docs/validation/reports/phase-8-release-v1.md`

Publication methodology:

`docs/validation/PUBLICATION.md`

The release preserves exact Phase 8A/8B provenance, raw accuracy counts, all accepted benchmark runs, deterministic summaries, limitations, unsupported scenarios, privacy reductions, and explicit claim boundaries.

The 32-case corpus is not global or real-world accuracy. Catastrophic benchmark ceilings are not product SLOs. RSS delta is not peak-memory measurement.

## Current resume action - Phase 9 security hardening

Phase 9 is the next non-UI boundary and is not yet implemented by this handoff.

Start by reconciling the current `main` release state and writing a security design/threat model before changing production controls. Planned areas include:

- Supabase leaked-password protection review
- authentication/session/API abuse prevention
- challenge/bot controls only when justified and actually implemented
- production security observability and alerting
- private-schema defense-in-depth without breaking RPC-only worker authority
- incident response, credential rotation, rollback, containment, and recovery
- release engineering and final public-launch security review

Use explicit acceptance criteria, TDD for code changes, preflight-first verification, and exact-SHA evidence.

## Separate operational queues

Production enablement for Phase 6B acquisition, 6C isolated scanning, and 6D passive/active runtime workers remains separately gated. All four hosted capability flags stay false/absent until their own acceptance/canary/rollback gates complete.

## UI isolation

PR #49 and all active Dashboard V5/UI branches remain independent. Do not edit, merge, replace, retarget, or deploy them from the Phase 9 non-UI stream.

## Cleanup

Merged backend refs may remain if the connected GitHub write surface has no genuine branch delete-ref operation. Do not force-move a branch to simulate deletion. Preserve PR #49 and all active V5/UI branches.

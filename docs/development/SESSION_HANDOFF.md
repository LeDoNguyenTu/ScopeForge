# ScopeForge Session Handoff

Last refreshed: 2026-09-05 (Asia/Singapore)

This is the fastest entry point for the current non-UI stream.

## Hard execution rules

- preflight before CI; do not use GitHub Actions as the first debugging loop
- use `[skip ci]` for intermediate/docs-only checkpoints where Actions adds no executable evidence
- reserve CI for frozen executable/release candidates
- do not modify or merge the active dashboard V5/UI preview work from this stream
- do not enable hosted worker/runtime capabilities as part of a code merge
- do not rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim a test/build/audit/security gate without evidence tied to the relevant SHA

## Current completed release

Phase 7 Community Security Packs v1 is complete.

- merged PR: #54
- squash merge: `1e9a72e0c4a526b064d6d3729981b405fac6b2b1`
- final PR head: `b10f04f87ff06a81106b585973c3e7872571bfa6`
- final CI: #756, success on GitHub-hosted Ubuntu 24.04
- tests: 299 files / 1,282 tests passed
- typecheck, CLI build/version, benchmark and production Next.js build passed
- Vercel production: `dpl_9dHDoELwaxXMgAerv8LufwDEjC8B`, READY, aliased to `scopeforge.dev`
- source/security review: no unresolved reportable Phase 7 finding

Phase 7 remains local-only and explicitly selected. It adds no executable plugin, target-repository pack auto-discovery, network/runtime rule, hosted pack upload, Supabase mutation, worker enablement, or dashboard feature.

## Current resume action

Continue broader Phase 8 validation/benchmark/public-methodology work from the foundation already merged in PR #50.

Before implementation:

1. inspect current `main` and the Phase 8 foundation/specs/tests
2. verify there is no existing Phase 8 implementation branch/PR that would duplicate work
3. preserve local/offline authority unless the approved design says otherwise
4. use TDD and preflight-first verification
5. keep dashboard V5/UI completely separate

## Separate operational queues

Production enablement for Phase 6B acquisition, 6C isolated scanning, and 6D passive/active runtime workers remains separately gated. All four hosted capability flags stay false/absent until their own acceptance/canary/rollback gates complete.

Phase 9 hardening remains incomplete, including leaked-password protection, abuse controls, observability, private-schema defense-in-depth, incident readiness, and release engineering.

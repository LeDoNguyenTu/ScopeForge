# ScopeForge Session Handoff

Last refreshed: 2026-09-05 (Asia/Singapore)

This is the fastest entry point for the current non-UI stream. Also read `PHASE_7_RELEASE_STATE.md` and `UNFINISHED_WORK.md`.

## Hard execution rules

- preflight before CI; do not use GitHub Actions as the first debugging loop
- use `[skip ci]` on intermediate/documentation checkpoints where CI adds no executable evidence
- reserve one final exact-head CI run for a frozen release candidate
- do not modify or merge the active dashboard V5/UI preview work from this stream
- do not enable hosted worker/runtime capabilities as part of a code merge
- do not rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim a test/build/audit/security gate without evidence tied to the relevant SHA

## Current PR

Repository: `LeDoNguyenTu/ScopeForge`

`main`: `4ec80199ed922a5d9c92041e5432a8355f4a4277`

Branch: `feat/phase-7-community-security-packs-v1`

PR: `#54 - Phase 7 community security packs implementation`

Fully tested executable/source candidate: `e8bef81d36090402cab7af77e549e3ef268c4eef`

Phase 6D PR #52 is merged. Phase 7 has no remaining Phase 6D integration dependency.

## What Phase 7 implements

Community Security Packs v1 is local-only and explicitly selected with `--pack`.

Implemented:

- strict bounded v1 manifest/contracts
- `static_literal_v1` only
- bounded path matcher
- safe identity-checked reads
- deterministic findings and registry
- safe fixtures/behavior validation
- CLI validate/inspect/scan integration
- local output compatibility
- hosted-json rejection/authority guards
- first-party example pack
- contributor/reviewer governance

No target-repository auto-discovery, executable plugin, network rule, hosted pack upload, Supabase mutation, runtime worker enablement, or dashboard feature is introduced.

## Current verification

On `e8bef81d...`:

- focused: 19 files / 129 tests
- full: 299 files / 1,282 tests
- typecheck: pass
- CLI build/version: pass / `ScopeForge 0.1.0`
- example pack validation: pass
- deterministic inspect: byte-identical
- benchmark: 338 ms over 700 files, zero findings/errors
- npm audit: zero vulnerabilities
- Vercel Preview: READY, 9/9 pages prerendered
- security-diff review: no unresolved reportable source finding

The disposable verifier cannot drop from root, so one exact-head GitHub Actions run remains as explicit non-root Linux acceptance evidence.

## Vercel Preview correction

Earlier PR previews failed at `/auth/sign-in` because browser-safe Supabase public configuration was missing at build time. The repository Vercel configuration now provides only the ScopeForge public URL/publishable key. A subsequent Preview deployment completed successfully. No service-role/server secret was committed.

## Exact resume action

1. refresh PR #54 head/base
2. confirm final documentation checkpoint is docs-only relative to `e8bef81d...`
3. confirm diff whitespace/path hygiene and no package/lock/migration/UI drift
4. confirm no unresolved PR review thread and Vercel is green
5. convert PR #54 to draft, then mark ready once to trigger `ready_for_review` CI on the same SHA
6. require CI validate success on that exact head
7. recheck exact head/base and mergeability
8. integrate with exact-head protection, preferably squash merge with `[skip ci]`
9. leave all runtime flags disabled

## After Phase 7

Continue broader Phase 8 validation/public-methodology work. Production acceptance for Phase 6B/6C/6D worker runtimes and Phase 9 hardening remain separate workstreams.

Dashboard V5/UI remains excluded until its own implementation/preview work is stable.

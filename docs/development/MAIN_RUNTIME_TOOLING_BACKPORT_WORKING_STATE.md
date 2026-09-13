# Main Runtime Tooling Backport Working State

Last updated: 2026-09-13 (Asia/Singapore)

## Purpose

This branch backports already-validated maintenance from the Phase 10A3 stack onto current `main` while issue #79's two authenticated production browser canaries are postponed.

Branch: `chore/main-runtime-tooling-alignment`
PR: #88 - Align main runtime and tooling baseline
Base: `main` at `15323d760b00d466fd7509519c547a3e6a0b70d9`
Plan: `docs/superpowers/plans/2026-09-13-main-runtime-tooling-backport.md`

## Release isolation

This work may change only repository/tooling configuration, architecture regression tests, and documentation. It must not change:

- application authorization or product behavior;
- Supabase migrations or production data;
- GitHub App provider settings/secrets;
- Vercel production environment variables;
- hosted worker/runtime gates;
- PR #76 or PR #77 operational acceptance requirements.

## Deferred browser-only work

Issue #79 remains open. Resume later with an authenticated browser capable of proving:

1. a different valid numeric GitHub installation ID is rejected during the owner/admin callback flow;
2. a normal workspace member/viewer cannot initiate or complete Connect GitHub.

Current production has no member/viewer membership available for the second canary, so a controlled non-admin test identity must be created through a supported auth/workspace flow before that proof can be completed.

## Current cycle

Task 1 RED commit: `c5d6c400d3cee6415e0da7e3e41b9b400169a47a`

The new `tests/architecture/node-runtime-alignment.test.ts` intentionally requires Node `>=24 <25` and CI Node 24. Current main has neither, so the next required evidence is a CI run showing this new test fails for the expected reason while the pre-existing suite remains green.

PR #88 is intentionally ready for review so its synchronize events execute the full validation job. The current update exists only to trigger the RED run after an earlier branch housekeeping commit contained `[skip ci]`.

# Phase 7 Community Security Packs Working State

Last reconciled: 2026-09-04 (Asia/Singapore)

This file is the compact resumable checkpoint for Phase 7 implementation PR #54.

## Branch and base

- implementation branch: `feat/phase-7-community-security-packs-v1`
- implementation PR: #54
- reconciled base: `main` at Phase 6D merge `4ec80199ed922a5d9c92041e5432a8355f4a4277`
- branch reconciliation merge commit: `5cc61633f1cc759fb4d29288074ed2c90de125f7`
- after reconciliation the branch is ahead of `main` and not behind it
- the base-to-branch diff is Phase 7-only: design/plan, Security Pack source/tests, the shared inventory-reader Task 3 test, and CLI compilation inclusion
- dashboard V5/UI files are out of scope and untouched

## CI policy

GitHub Actions allowance is available again. Use CI selectively:

- routine documentation-only and tiny intermediate checkpoints may use `[skip ci]`
- meaningful TDD RED/GREEN boundaries and final integration candidates should run CI
- do not rerun identical successful jobs without a concrete reason
- use the workflow's existing concurrency cancellation instead of allowing obsolete runs to consume minutes

## Phase 7 safety boundary

Security Packs remain:

- local-only
- explicitly selected by the user through CLI input
- data-only
- restricted to `static_literal_v1`
- unable to introduce regex execution, scripts, dynamic imports, callbacks, subprocesses, package hooks, network access, active probing, browser authority, arbitrary runtime commands, or target-repository auto-discovery

No Supabase, Vercel runtime, hosted worker, production capability, or dashboard behavior change belongs in Phase 7.

## Completed work

### Task 1 - complete before this checkpoint

- frozen closed v1 contracts and fixed resource ceilings
- privacy-safe typed `SecurityPackError`
- strict bounded `scopeforge-pack.json` loader
- hostile JSON/identity/path/TOCTOU handling
- compatibility checks
- CLI TypeScript compilation inclusion

### Task 2 - complete before this checkpoint

- closed non-regex path-pattern compiler
- bounded dynamic-programming matching
- canonical repository-path enforcement
- unsupported wildcard syntax rejection
- drive-relative path rejection
- adversarial wildcard tests

## Task 3 - RED candidate

Task 3 adds identity-checked byte reads, static literal matching, and normalized privacy-safe findings.

RED tests now exist for:

1. `readInventoryEntryBytes(...)` returning the exact file bytes without UTF-8 or line-ending normalization while sharing all existing containment, symlink, inode/device, size, sentinel-read, and post-read checks.
2. `matchStaticLiteral(...)` implementing include/exclude paths, any/all semantics, absent literals, deterministic earliest-byte selection, ASCII-only case-insensitive behavior, CRLF-aware one-based byte locations, and no matched-source leakage.
3. `createSecurityPackFinding(...)` producing deterministic normal `Finding` values with published pack rule IDs, stable fingerprints, reviewed mappings/remediation, and no raw literal, source, ATT&CK, or NIST leakage.

The production APIs above do not exist at this checkpoint. The next intentional GitHub Actions run must therefore fail during the test stage for those missing Task 3 APIs. That failure is the required TDD RED evidence, not a release regression.

## Next exact actions

1. Mark PR #54 ready to trigger the intentional Task 3 RED run on this exact candidate.
2. Confirm failure is caused by missing `readInventoryEntryBytes`, `literal-matcher`, and/or `finding` production APIs rather than unrelated existing tests.
3. Implement the minimal Task 3 GREEN production code without expanding authority.
4. Run CI again and require focused/full tests, typecheck, CLI build/version, benchmark, and Next.js build to remain green.
5. Review the Task 3 diff before continuing to Task 4.

## Remaining plan after Task 3

- Task 4 deterministic registry and scanner adapter
- Task 5 safe fixture discovery and behavioral validation
- Task 6 CLI validate/inspect/explicit repeated `scan --pack` integration
- Task 7 output compatibility and permanent authority guards
- Task 8 first-party example pack and contributor/reviewer governance
- Task 9 full verification, security review, Linux acceptance, documentation, and final integration

Authoritative plan: `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.

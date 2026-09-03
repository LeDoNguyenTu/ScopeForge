# Phase 7 Community Security Packs Working State

Last reconciled: 2026-09-04 (Asia/Singapore)

This file is the compact resumable checkpoint for Phase 7 implementation PR #54.

## Branch and base

- implementation branch: `feat/phase-7-community-security-packs-v1`
- implementation PR: #54
- reconciled base: `main` at Phase 6D merge `4ec80199ed922a5d9c92041e5432a8355f4a4277`
- branch reconciliation merge commit: `5cc61633f1cc759fb4d29288074ed2c90de125f7`
- after reconciliation the branch is ahead of `main` and not behind it
- the base-to-branch diff is Phase 7-only
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

### Task 1 - complete

- frozen closed v1 contracts and fixed resource ceilings
- privacy-safe typed `SecurityPackError`
- strict bounded `scopeforge-pack.json` loader
- hostile JSON/identity/path/TOCTOU handling
- compatibility checks
- CLI TypeScript compilation inclusion

### Task 2 - complete

- closed non-regex path-pattern compiler
- bounded dynamic-programming matching
- canonical repository-path enforcement
- unsupported wildcard syntax rejection
- drive-relative path rejection
- adversarial wildcard tests

### Task 3 - complete through full GREEN validation

Task 3 adds identity-checked byte reads, static literal matching, and normalized privacy-safe findings.

#### RED evidence

Intentional RED candidate: `4a3842db77322a8e609738d05992e76762841fcf`

GitHub Actions run: `33818173324`, validate job `100855132904`.

The full test stage produced the expected missing-feature failures:

- `readInventoryEntryBytes` was not a function
- `@/packages/security-packs/literal-matcher` did not exist
- `@/packages/security-packs/finding` did not exist

At that RED boundary, 285 existing test files and 1,228 tests still passed. The failure was therefore pinned to the newly specified Task 3 APIs rather than unrelated branch drift.

#### GREEN implementation

GREEN candidate: `43a938308e742a346055ac6e8d60996769275f91`

Implemented:

1. `readInventoryEntryBytes(...)` reuses the existing safe inventory-open boundary and preserves exact bytes while `readInventoryEntry(...)` remains the UTF-8 compatibility wrapper.
2. `matchStaticLiteral(...)` implements include/exclude path admission, any/all semantics, absent literals, deterministic earliest-byte selection, ASCII-only case-insensitive matching, CRLF-preserving byte locations, and no source/literal output.
3. `createSecurityPackFinding(...)` emits ordinary deterministic findings with published pack rule IDs, stable fingerprints, reviewed CWE/OWASP/remediation fields, and privacy-limited metadata.
4. A self-review caught and fixed an initial ASCII-insensitive needle normalization bug before GREEN validation.

Exact RED-to-GREEN production diff is limited to:

- `packages/scanner-core/filesystem/read-inventory-entry.ts`
- `packages/security-packs/finding.ts`
- `packages/security-packs/index.ts`
- `packages/security-packs/literal-matcher.ts`

#### GREEN evidence

GitHub Actions run: `33818604589`, validate job `100856108494`.

Passed on exact head `43a938308e742a346055ac6e8d60996769275f91`:

```text
npm ci --ignore-scripts --no-audit --no-fund: PASS
npm test: PASS
npm run typecheck: PASS
npm run build:cli: PASS
node .scopeforge-build/packages/cli/index.js version: PASS
npm run benchmark:scanner: PASS
npm run build: PASS
```

Task 3 is therefore the current last fully verified implementation boundary.

## Current next task - Task 4

Task 4 adds the deterministic registry and standard scanner adapter.

Required implementation files:

- `packages/security-packs/registry.ts`
- `packages/security-packs/scanner.ts`
- `packages/security-packs/index.ts`

Required RED tests:

- `tests/security-packs/registry.test.ts`
- `tests/security-packs/scanner.test.ts`

Task 4 invariants:

- 1 to 10 selected packs
- no duplicate canonical pack directory
- no duplicate or reserved published rule ID
- no more than 500 selected rules
- deterministic pack/rule ordering
- immutable registry
- include/exclude path matchers compiled once during registry construction, not inside the per-file scan loop
- only inventory-admitted candidate files are read
- at most one finding per rule/file
- findings deduplicated and deterministically sorted
- maximum 1,000 findings per pack
- read failures and limit exhaustion produce fixed privacy-safe diagnostics
- no source-byte or literal leakage

Next exact action is to write and intentionally fail Task 4 registry/scanner behavior tests before production implementation.

## Remaining plan after Task 4

- Task 5 safe fixture discovery and behavioral validation
- Task 6 CLI validate/inspect/explicit repeated `scan --pack` integration
- Task 7 output compatibility and permanent authority guards
- Task 8 first-party example pack and contributor/reviewer governance
- Task 9 full verification, security review, Linux acceptance, documentation, and final integration

Authoritative plan: `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.

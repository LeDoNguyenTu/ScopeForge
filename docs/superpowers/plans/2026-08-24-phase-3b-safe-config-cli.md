# Phase 3B Safe Reads, Configuration, Policy, and CLI Implementation Plan

**Goal:** Add the remaining contract layer required before detector families are allowed to read repository content: a safe inventory-entry reader, root-only versioned configuration, explicit policy evaluation, and a local CLI shell.

**Architecture:** Keep all scanner behavior framework-independent. Repository files remain hostile input. Detectors must read through one bounded filesystem helper. Repository configuration is root-scoped, strict, versioned, and cannot raise scanner budgets above safe defaults. The CLI composes inventory, coordinator, policy, and existing output contracts without depending on Next.js, Supabase, or Vercel.

**Tech stack:** Node.js 22, TypeScript 5.8, Vitest 3.2, Node built-ins only.

**Approved design:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Task 1 - Safe inventory content reads

Create:
- `packages/scanner-core/filesystem/read-inventory-entry.ts`
- `tests/scanner/filesystem/read-inventory-entry.test.ts`

Requirements:
- accept only an existing `RepositoryInventory` entry
- reject absolute and traversal paths
- resolve the requested path under the inventory root
- revalidate real-path containment immediately before reading
- reject symlinks and non-regular files
- recheck size and enforce the configured maximum
- read through a file descriptor opened with `O_NOFOLLOW` where supported
- close file handles in all paths

## Task 2 - Root-only scanner configuration

Create:
- `packages/scanner-core/config/types.ts`
- `packages/scanner-core/config/load-config.ts`
- `tests/scanner/config/load-config.test.ts`

Configuration file for this first stable slice: `.scopeforge.json`.

Requirements:
- schema version must equal `1`
- load only from the explicit scan root unless a caller explicitly provides another config path
- reject unknown keys and malformed types
- support scanner-family selection, rule include/exclude lists, safe budget tightening, `failOn`, and output format/path
- repository configuration may tighten default budgets but must not raise them, preventing hostile repository configuration from weakening resource boundaries
- missing configuration means secure defaults, not an error

## Task 3 - Explicit policy and exit semantics

Create:
- `packages/scanner-core/policy/evaluate-policy.ts`
- `packages/scanner-core/policy/exit-codes.ts`
- `tests/scanner/policy/evaluate-policy.test.ts`

Requirements:
- default is report-only and returns success
- explicit `failOn` enables enforcement
- severity threshold is inclusive
- existing baseline findings do not fail the gate, preserving the approved future baseline contract
- scanner execution errors have a distinct exit code and take precedence over policy-gate failures
- configuration/usage errors have a distinct exit code

Exit codes:
- `0`: success / report-only / gate passed
- `1`: policy gate failed
- `2`: CLI usage or configuration error
- `3`: scanner execution error

## Task 4 - Local CLI shell

Create:
- `packages/cli/index.ts`
- `packages/cli/run-cli.ts`
- `packages/cli/terminal.ts`
- `tests/scanner/cli/run-cli.test.ts`
- `tsconfig.cli.json`

Update:
- `package.json`
- `.gitignore`

Initial commands:
- `scopeforge scan [path]`
- `scopeforge scan [path] --format terminal`
- `scopeforge scan [path] --format json --output <file>`
- `scopeforge scan [path] --fail-on <severity>`
- `scopeforge rules list`
- `scopeforge version`

The CLI has no detector rules yet. `scan` performs inventory plus coordinator execution with the currently registered scanner set, which is empty in Phase 3B, and emits a valid result. Future scanner families plug into the same coordinator without changing CLI semantics.

`npm run build:cli` must compile the CLI and scanner packages to `.scopeforge-build/`. `npm run scopeforge -- <args>` builds then invokes the CLI.

## Task 5 - Verification and handoff

Before merge:
- demonstrate RED tests before implementation
- `npm test`
- `npm run typecheck`
- `npm run build:cli`
- `npm run build`
- review changed files for hostile-repository boundary regressions
- update permanent development state documents
- merge only on an exact final green PR head

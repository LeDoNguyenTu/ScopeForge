# Phase 7 Community Security Packs Working State

Last reconciled: 2026-09-04 (Asia/Singapore)

This file is the compact resumable checkpoint for Phase 7 implementation PR #54.

## Branch and base

- implementation branch: `feat/phase-7-community-security-packs-v1`
- implementation PR: #54
- base: `main` after Phase 6D merge `4ec80199ed922a5d9c92041e5432a8355f4a4277`
- reconciliation merge: `5cc61633f1cc759fb4d29288074ed2c90de125f7`
- branch remains ahead of `main` and not behind it
- base-to-branch changes are Phase 7-only: Security Pack source/tests/docs, the shared identity-checked inventory reader, and CLI compilation inclusion
- dashboard V5/UI files remain out of scope and untouched

## CI policy

GitHub Actions is available again and is used selectively:

- routine docs/tiny intermediate implementation commits may use `[skip ci]`
- meaningful TDD RED/GREEN boundaries and final integration candidates run CI
- identical successful jobs are not rerun without a concrete reason
- workflow concurrency cancellation is used to avoid obsolete runner spend

## Permanent Phase 7 safety boundary

Security Packs remain:

- local-only
- explicitly selected
- data-only
- restricted to `static_literal_v1`
- unable to add regex execution, scripts, dynamic imports, callbacks, subprocesses, package hooks, network access, active probing, browser authority, arbitrary runtime commands, or target-repository auto-discovery

Phase 7 does not change Supabase, Vercel production behavior, hosted workers, production capability flags, or dashboard behavior.

## Task 1 - complete

- closed frozen v1 contracts and fixed resource ceilings
- privacy-safe typed errors
- strict bounded manifest loading
- hostile JSON/path/identity/TOCTOU handling
- compatibility checks

## Task 2 - complete

- bounded non-RegExp path-pattern compiler
- canonical repository-path enforcement
- unsupported wildcard and drive-relative rejection
- adversarial matching tests

## Task 3 - complete and GREEN

RED candidate: `4a3842db77322a8e609738d05992e76762841fcf`

RED Actions run: `33818173324`

Expected RED failures were limited to the missing Task 3 APIs. At that boundary 285 existing test files and 1,228 tests passed.

GREEN candidate: `43a938308e742a346055ac6e8d60996769275f91`

GREEN Actions run: `33818604589`

Implemented:

- identity-checked exact-byte inventory reads
- deterministic static literal matching
- ASCII-only case-insensitive matching
- privacy-safe deterministic Security Pack findings

The exact GREEN run passed tests, typecheck, CLI build/version, scanner benchmark, and production Next.js build.

## Task 4 - complete and GREEN

Task 4 adds deterministic registry construction and the standard scanner adapter.

RED candidate: `a804728b8eaefbb160f67f82be8491f1a52748fe`

RED Actions run: `33818961762`

All existing 1,235 tests passed and only the new registry/scanner suites failed because the planned modules did not exist.

GREEN candidate: `30b9439ac431e8ccb738201ef9ab3c4a6674d26c`

GREEN Actions run: `33820356775`

Implemented:

- 1-10 selected-pack ceiling
- 500 selected-rule ceiling
- canonical duplicate-directory and published/reserved-rule collision rejection
- immutable deterministic pack/rule ordering
- include/exclude matchers compiled once at registry construction
- safe inventory-only reads
- one finding per rule/file
- per-pack 1,000-finding ceiling
- fixed privacy-safe scanner diagnostics
- deterministic finding ordering

The exact GREEN run passed tests, typecheck, CLI build/version, scanner benchmark, and production Next.js build.

## Task 5 - behavior GREEN, type compatibility repair under final validation

Task 5 adds safe fixture discovery and behavioral ground-truth validation.

RED candidate: `b53fc14b4cd80e43122ff42881243940464fcf40`

RED Actions run: `33820722891`

All existing 1,242 tests passed and only the two new fixture suites failed because `packages/security-packs/fixtures.ts` did not exist.

Initial GREEN candidate: `aa02dbb3c707b5c0fb5e591f70d832e43a55e0a9`

Initial GREEN Actions run: `33821241223`

Behavioral result on that exact candidate:

- 292 test files passed
- 1,265 tests passed
- all fixture behavior and hostile-filesystem regressions passed

Typecheck then caught three ES2017-target incompatibilities caused only by bigint literal syntax (`0n` / `1n`). No behavioral test failed.

Repair commit: `e7573bcf2d81a210910ab2e53a0027a679f4f41d`

The repair preserves the already-green validation logic and replaces bigint literal syntax with `BigInt(...)`, while making bigint filesystem-stat types explicit.

Task 5 implemented boundaries include:

- exact `case.json` schema with strict unique-key JSON
- verified identity-checked metadata reads
- real-path containment
- rejection of symlinks, hard links, special files, nested manifests, hidden/vendor dependency trees, case-insensitive path collisions, and traversal
- 20 fixture cases per rule, 100 files per case, and 1 MiB per case ceilings
- mandatory positive, clean-negative, and suppressed/excluded near-miss coverage for every rule
- exact finding count/location comparison against fixture ground truth
- zero fixture or metadata writes during validation

The next CI run after this documentation checkpoint is the final Task 5 repair GREEN gate. Task 5 is not considered fully complete until tests, typecheck, CLI build/version, scanner benchmark, and production Next.js build all pass on the repaired exact head.

## Remaining plan

- Task 6 CLI validation, inspection, and explicit repeated `scan --pack` integration
- Task 7 output compatibility and permanent authority guards
- Task 8 first-party example pack and contributor/reviewer governance
- Task 9 full verification, security review, non-root Linux acceptance, release documentation, and final integration

Authoritative plan: `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.

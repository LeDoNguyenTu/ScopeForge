# Phase 7 Community Security Packs Working State

Last reconciled: 2026-09-04 (Asia/Singapore)

This is the compact resumable checkpoint for Phase 7 implementation PR #54.

## Branch and safety boundary

- branch: `feat/phase-7-community-security-packs-v1`
- PR: #54
- base: `main` after Phase 6D merge `4ec80199ed922a5d9c92041e5432a8355f4a4277`
- reconciliation merge: `5cc61633f1cc759fb4d29288074ed2c90de125f7`
- dashboard V5/UI files remain out of scope and untouched

Security Packs remain local-only, explicitly selected, data-only, and restricted to `static_literal_v1`. They cannot add regex execution, scripts, dynamic imports, callbacks, subprocesses, package hooks, network access, active probing, browser authority, arbitrary runtime commands, or target-repository auto-discovery. Phase 7 does not change Supabase, Vercel production behavior, hosted workers, production capability flags, or dashboard behavior.

## CI policy

GitHub Actions is available and used selectively. Meaningful TDD RED/GREEN and final integration candidates run CI; tiny intermediate implementation/docs checkpoints generally use `[skip ci]`.

## Task 1 - complete

Closed frozen v1 contracts, fixed resource ceilings, privacy-safe errors, strict bounded hostile-safe manifest loading, compatibility checks.

## Task 2 - complete

Bounded non-RegExp path matching, canonical repository paths, unsupported wildcard and drive-relative rejection, adversarial tests.

## Task 3 - complete and GREEN

- RED candidate: `4a3842db77322a8e609738d05992e76762841fcf`
- RED run: `33818173324`
- GREEN candidate: `43a938308e742a346055ac6e8d60996769275f91`
- GREEN run: `33818604589`

Exact-byte identity-checked inventory reads, deterministic literal matching, ASCII-only case-insensitive matching, CRLF-aware locations, and privacy-safe deterministic pack findings. Full CI passed.

## Task 4 - complete and GREEN

- RED candidate: `a804728b8eaefbb160f67f82be8491f1a52748fe`
- RED run: `33818961762`
- GREEN candidate: `30b9439ac431e8ccb738201ef9ab3c4a6674d26c`
- GREEN run: `33820356775`

Deterministic immutable registry construction, 1-10 pack and 500-rule ceilings, collision handling, once-compiled path admission, inventory-only reads, one finding per rule/file, 1,000 findings/pack ceiling, and fixed privacy-safe scanner diagnostics. Full CI passed.

## Task 5 - complete and GREEN

- RED candidate: `b53fc14b4cd80e43122ff42881243940464fcf40`
- RED run: `33820722891`
- initial behavioral GREEN candidate: `aa02dbb3c707b5c0fb5e591f70d832e43a55e0a9`
- compatibility repair: `e7573bcf2d81a210910ab2e53a0027a679f4f41d`
- final GREEN head before Task 6 tests: `a0c8fa1f58d22804e870d07c4a134357ad4d675a`
- final GREEN run: `33821554251`

The final Task 5 run passed tests, typecheck, CLI build/version, scanner benchmark, and production Next.js build. Fixture validation now enforces strict case schemas, real-path and file-identity boundaries, hostile filesystem rejection, fixed case/file/byte budgets, mandatory positive/negative/near-miss coverage, exact finding ground truth, and zero writes.

## Task 6 - RED confirmed, GREEN candidate under validation

Intentional RED head: `23348c2b031798e4d1ff3bbc66992bb7c9767a43`

RED Actions run: `33821933407`

RED evidence was clean:

- 292 pre-existing test files passed
- 1,265 pre-existing tests passed
- failures were confined to the new Task 6 inspection and CLI suites
- `packages/security-packs/inspect.ts` was absent as intended
- `pack validate`, `pack inspect`, and `--pack` parsing/integration were absent as intended

A RED-test self-review also found that the temporary scan target used an invalid raw Docker directive (`UNSAFE_SETTING=1`), causing the existing IaC scanner to fail independently of Security Packs. The Task 6 tests were corrected to use a syntactically valid Dockerfile comment containing the same literal. This preserves the Security Pack matching behavior while keeping the built-in scanner baseline valid.

Task 6 implementation now includes:

- canonical deterministic `inspectSecurityPack(...)` JSON with no matcher literals, fixture source, or absolute paths
- `scopeforge pack validate <directory>`
- `scopeforge pack inspect <directory> --json`
- repeated explicit `scan --pack <directory>`
- pack path resolution against CLI cwd, never the scanned repository root
- a 10-pack parser ceiling enforced before pack filesystem access
- deterministic registry loading with built-in rule identities reserved
- `security-pack` scanner appended only when packs are explicitly selected
- target repository manifests/fixtures never auto-activate packs
- baseline creation remains pack-free
- hosted-json plus explicitly selected packs fails closed as a usage error
- privacy-safe `SecurityPackError` CLI formatting

Implementation head before this documentation trigger: `fdcadb8932d4a3495e0ff35314e5646557273d5e`.

This documentation commit triggers the consolidated Task 6 GREEN gate. Task 6 is not complete until tests, typecheck, CLI build/version, scanner benchmark, and production Next.js build all pass on the resulting exact head.

## Remaining plan after Task 6

- Task 7 output compatibility and permanent authority guards
- Task 8 first-party example pack and contributor/reviewer governance
- Task 9 full verification, security review, non-root Linux acceptance, release documentation, and final integration

Authoritative plan: `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.

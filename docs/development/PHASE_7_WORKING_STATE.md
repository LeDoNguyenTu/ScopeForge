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

## Tasks 1-2 - complete

Task 1 delivered closed frozen v1 contracts, fixed resource ceilings, privacy-safe errors, strict bounded hostile-safe manifest loading, and compatibility checks. Task 2 delivered bounded non-RegExp path matching, canonical repository paths, unsupported wildcard and drive-relative rejection, and adversarial tests.

## Task 3 - complete and GREEN

- RED: `4a3842db77322a8e609738d05992e76762841fcf`, run `33818173324`
- GREEN: `43a938308e742a346055ac6e8d60996769275f91`, run `33818604589`

Exact-byte identity-checked inventory reads, deterministic literal matching, ASCII-only case-insensitive matching, CRLF-aware locations, and privacy-safe deterministic pack findings. Full CI passed.

## Task 4 - complete and GREEN

- RED: `a804728b8eaefbb160f67f82be8491f1a52748fe`, run `33818961762`
- GREEN: `30b9439ac431e8ccb738201ef9ab3c4a6674d26c`, run `33820356775`

Deterministic immutable registry construction, pack/rule ceilings, collision handling, once-compiled path admission, inventory-only reads, finding ceilings, and fixed privacy-safe diagnostics. Full CI passed.

## Task 5 - complete and GREEN

- RED: `b53fc14b4cd80e43122ff42881243940464fcf40`, run `33820722891`
- initial behavioral GREEN: `aa02dbb3c707b5c0fb5e591f70d832e43a55e0a9`
- ES2017 bigint compatibility repair: `e7573bcf2d81a210910ab2e53a0027a679f4f41d`
- final GREEN head before Task 6: `a0c8fa1f58d22804e870d07c4a134357ad4d675a`, run `33821554251`

Fixture validation enforces strict case schemas, real-path/file-identity boundaries, hostile filesystem rejection, fixed budgets, required positive/negative/near-miss coverage, exact finding ground truth, and zero writes.

## Task 6 - complete and GREEN

- intentional RED head: `23348c2b031798e4d1ff3bbc66992bb7c9767a43`
- RED run: `33821933407`
- initial GREEN candidate: `272dc7fa7dcfe3a89239f9a53acb786e513ded3e`
- initial GREEN run: `33858389016`
- CLI runtime portability repair: `057b56da324db53e6db18e292a555581b4e87061`
- final GREEN run: `33858705622`

RED evidence was limited to the planned inspection/CLI surfaces. During test review, the temporary Docker target was corrected from an invalid raw Docker directive to a valid Dockerfile comment carrying the same literal, so built-in IaC behavior remained a valid baseline.

Task 6 now provides:

- canonical privacy-safe `pack inspect --json`
- `pack validate`
- repeated explicit `scan --pack`
- cwd-relative pack path resolution
- parser-level 10-pack ceiling before pack filesystem access
- deterministic registry loading with built-in rule identities reserved
- no target-repository pack auto-discovery
- pack-free baseline creation
- CLI-level hosted-json rejection when packs are explicitly selected
- privacy-safe `SecurityPackError` handling

The initial GREEN run passed all 1,274 tests, typecheck, and CLI compilation, but the compiled CLI smoke found that `finding.ts` still used `@/...` TypeScript aliases. Plain CommonJS Node could not resolve them. The repair changed only those runtime imports to relative paths. Fresh exact-head verification on `057b56da324db53e6db18e292a555581b4e87061` then passed:

- `npm test` - 295 files, 1,274 tests
- `npm run typecheck`
- `npm run build:cli`
- `node .scopeforge-build/packages/cli/index.js version`
- `npm run benchmark:scanner`
- `npm run build`

## Current next task - Task 7

Task 7 adds ordinary output compatibility and permanent authority guards:

- deterministic JSON/SARIF/terminal/baseline behavior for pack findings without source/literal leakage
- direct hosted serializer rejection of any `security-pack` finding before payload construction
- package dependency guards that keep Security Packs offline/data-only
- architecture guards that keep app/hosted/runtime worker authority independent from Security Packs
- explicit CLI selection remains the only activation path

Task 7 begins with failing output/authority tests before production changes.

## Remaining plan

- Task 7 output compatibility and permanent authority guards
- Task 8 first-party example pack and contributor/reviewer governance
- Task 9 full verification, security review, non-root Linux acceptance, release documentation, and final integration

Authoritative plan: `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.

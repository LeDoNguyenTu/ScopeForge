# Phase 7 Community Security Packs Working State

Last reconciled: 2026-09-04 (Asia/Singapore)

This is the compact resumable checkpoint for Phase 7 implementation PR #54.

## Branch and safety boundary

- branch: `feat/phase-7-community-security-packs-v1`
- PR: #54
- base: `main` after Phase 6D merge `4ec80199ed922a5d9c92041e5432a8355f4a4277`
- reconciliation merge: `5cc61633f1cc759fb4d29288074ed2c90de125f7`
- branch remains based on the merged Phase 6D mainline
- dashboard V5/UI files remain out of scope and untouched

Security Packs remain local-only, explicitly selected, data-only, and restricted to `static_literal_v1`. They cannot add regex execution, scripts, dynamic imports, callbacks, subprocesses, package hooks, network access, active probing, browser authority, arbitrary runtime commands, or target-repository auto-discovery. Phase 7 does not change Supabase, Vercel production behavior, hosted workers, production capability flags, or dashboard behavior.

## CI policy

GitHub Actions is available and used selectively:

- docs/tiny intermediate implementation commits may use `[skip ci]`
- meaningful TDD RED/GREEN and final integration candidates run CI
- identical successful jobs are not rerun without a concrete reason
- workflow concurrency cancellation prevents obsolete runner spend

## Task 1 - complete

Closed frozen v1 contracts, fixed resource ceilings, privacy-safe errors, strict bounded hostile-safe manifest loading, compatibility checks.

## Task 2 - complete

Bounded non-RegExp path matching, canonical repository paths, unsupported wildcard and drive-relative rejection, adversarial tests.

## Task 3 - complete and GREEN

- RED candidate: `4a3842db77322a8e609738d05992e76762841fcf`
- RED run: `33818173324`
- GREEN candidate: `43a938308e742a346055ac6e8d60996769275f91`
- GREEN run: `33818604589`

Implemented exact-byte identity-checked inventory reads, deterministic literal matching, ASCII-only case-insensitive matching, CRLF-aware locations, and privacy-safe deterministic pack findings. Full CI passed.

## Task 4 - complete and GREEN

- RED candidate: `a804728b8eaefbb160f67f82be8491f1a52748fe`
- RED run: `33818961762`
- GREEN candidate: `30b9439ac431e8ccb738201ef9ab3c4a6674d26c`
- GREEN run: `33820356775`

Implemented deterministic immutable registry construction, 1-10 pack and 500-rule ceilings, collision handling, once-compiled path admission, inventory-only reads, one finding per rule/file, 1,000 findings/pack ceiling, and fixed privacy-safe scanner diagnostics. Full CI passed.

## Task 5 - complete and GREEN

- RED candidate: `b53fc14b4cd80e43122ff42881243940464fcf40`
- RED run: `33820722891`
- initial behavioral GREEN candidate: `aa02dbb3c707b5c0fb5e591f70d832e43a55e0a9`
- initial run: `33821241223`
- compatibility repair: `e7573bcf2d81a210910ab2e53a0027a679f4f41d`
- final repaired GREEN head before Task 6 tests: `a0c8fa1f58d22804e870d07c4a134357ad4d675a`
- final GREEN run: `33821554251`

Final repaired Task 5 run passed:

- `npm test`
- `npm run typecheck`
- `npm run build:cli`
- CLI version
- scanner benchmark
- production Next.js build

Implemented fixture boundaries:

- exact strict unique-key `case.json`
- identity-checked metadata reads
- real-path containment
- symlink, hard-link, special-file, nested-manifest, hidden/vendor tree, case-collision, and traversal rejection
- 20 cases/rule, 100 files/case, 1 MiB/case limits
- positive, clean-negative, and suppressed/excluded near-miss coverage
- exact finding count/location ground truth
- zero fixture or metadata writes

## Task 6 - intentional RED candidate

Task 6 adds:

- `scopeforge pack validate <pack-directory>`
- `scopeforge pack inspect <pack-directory> --json`
- repeated explicit `scopeforge scan <repository> --pack <pack-directory>`

RED tests now exist through commit `7799b254d21f4833d68ac75a96d2bd3d0d31ec80` for:

- deterministic privacy-safe inspection without matcher literals, fixture content, or absolute paths
- pack validation and inspection commands
- explicit `--pack` selection
- target-repository pack non-activation without `--pack`
- cwd-relative pack path resolution
- repeated pack collision behavior
- more than 10 `--pack` arguments rejected before filesystem access
- hosted-json plus packs rejected as usage error
- baseline creation remaining pack-free
- hostile pack errors not reflecting manifest text or absolute paths

The current documentation commit intentionally triggers the Task 6 RED GitHub Actions gate. Expected RED failures must be limited to the not-yet-implemented inspection module, pack subcommands, and `--pack` parsing/integration. Production Task 6 code must not be written until that RED evidence is confirmed.

## Remaining plan after Task 6

- Task 7 output compatibility and permanent authority guards
- Task 8 first-party example pack and contributor/reviewer governance
- Task 9 full verification, security review, non-root Linux acceptance, release documentation, and final integration

Authoritative plan: `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.

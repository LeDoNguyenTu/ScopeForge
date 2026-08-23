# ScopeForge Test Status

| Check | Result | Evidence / notes |
|---|---|---|
| Phase 3B implementation checkpoint | Passing | CI #93 on `f5a5e897f88949477f248c71053b8e887d7f2931` |
| Vitest | Passing | Phase 3B implementation test step passed; previous GREEN #90 showed 17 files and 88 tests, with one additional fail-closed scanner-config regression added for #93 |
| TypeScript strict typecheck | Passing | CI #93 |
| CLI TypeScript build | Passing | `npm run build:cli` on CI #93 |
| Compiled CLI runtime smoke | Passing | `node .scopeforge-build/packages/cli/index.js version` on CI #93 |
| Next.js production build | Passing | CI #93 |
| Safe read tests | Passing | inventory membership, post-inventory symlink replacement, and immediate size recheck |
| Config tests | Passing | secure defaults, root-only loading, strict schema, safe budget ceilings, and configured-output containment |
| Policy tests | Passing | report-only default, inclusive threshold, existing-baseline behavior, and distinct exit codes |
| CLI tests | Passing | terminal/JSON scans, output writing, output-symlink rejection, unknown scanner fail-closed behavior, and exit semantics |
| Remote active scanning | Disabled | Phase 3 remains local/passive |

## TDD and security regression evidence

- CI #83: initial Phase 3B RED because production modules did not exist.
- CI #84: functional tests GREEN, then strict typecheck caught a narrowing defect.
- CI #87: RED for repository-configured path traversal and output symlink overwrite.
- CI #90: GREEN after safe output hardening, 88 tests passing.
- CI #92: RED for silent unknown-scanner configuration.
- CI #93: GREEN after fail-closed scanner selection, including CLI compile and runtime smoke.

## Final merge rule

PR #7 must not merge until its final documentation head passes `npm test`, `npm run typecheck`, `npm run build:cli`, the compiled CLI runtime smoke command, and `npm run build`.

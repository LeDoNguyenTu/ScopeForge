# ScopeForge Test Status

This file records the latest verified state. Update it before ending a development session that changes product behavior or security boundaries.

| Check | Result | Evidence / notes |
|---|---|---|
| GitHub Actions Phase 3A hardening checkpoint | Passing | CI run #76 passed on commit `82a9074b8febbdccb60ccb1c0726c299ae9d00d2` |
| Vitest suite | Passing | 13 test files, 72 tests passed on CI run #76 |
| TypeScript typecheck | Passing | `npm run typecheck` passed on CI run #76 |
| Next.js production build | Passing | `npm run build` passed on CI run #76 |
| Finding fingerprint tests | Passing | Determinism, path/namespace normalization, and structural-identity sensitivity covered |
| Severity tests | Passing | Critical/high/medium/low/info ordering and threshold comparison covered |
| Repository inventory tests | Passing | Default excludes, root ignore files, symlink non-following, per-file and total-byte budgets, traversal stop at the file-count budget, and zero-or-more `**` matching covered |
| Scanner coordinator tests | Passing | Stable scanner order, fingerprint deduplication, finding ordering, and explicit scanner error capture covered |
| Native JSON tests | Passing | Schema envelope, final newline, and byte-for-byte deterministic finding ordering covered |
| Phase 2 target-normalization tests | Passing | Existing private/local target and HTTPS boundary regressions remain green in the full suite |
| Phase 2 verification/SSRF tests | Passing | Existing DNS, pinned-address, redirect, timeout, and response-size regressions remain green in the full suite |
| Workspace/quotas/component tests | Passing | Existing Phase 2 authorization, quota, and UI tests remain green in the full suite |
| Supabase security advisor | No Phase 3A change | Phase 3A contains no database migration or policy change; last Phase 2 security-advisor state was clean |
| Remote active scanning | Disabled by design | Phase 3A is local/passive foundation only |

## TDD evidence for Phase 3A

CI run #68 was the initial required RED checkpoint. The five new scanner test suites failed because their planned production modules did not yet exist, while the existing 59 tests remained green.

CI run #69 was the initial GREEN checkpoint after adding the minimal scanner-foundation implementation. All 13 test files and all 70 tests passed, followed by a clean TypeScript typecheck and production build.

During final security review, the inventory file-count budget was found to cap accepted results without stopping later sibling traversal. CI run #72 was the regression RED checkpoint: 70 tests passed and the new traversal-stop test failed because `file_limit` was observed twice. The fix stops directory traversal once the accepted-file budget is exhausted. CI run #73 was GREEN with all 71 tests, typecheck, and production build passing.

Contract review then found that `**/` required at least one directory instead of correctly matching zero or more directory segments. CI run #75 was the regression RED checkpoint with 71 tests passing and only the new double-star test failing. The glob compiler now treats `**/` as zero-or-more complete directory segments and trailing `/**` as an ignorable subtree. CI run #76 was GREEN with all 72 tests, typecheck, and production build passing.

## Scanner security regression coverage

- symlink non-following behavior
- generated/vendor default exclusions
- `.scopeforgeignore` and `.gitignore` exclusions
- `**` patterns across zero or more directories
- per-file size ceiling
- total-byte ceiling
- file-count budget stops remaining traversal
- deterministic path/scanner/finding ordering
- stable structural finding fingerprints
- explicit scanner-error reporting instead of false clean results
- framework-independent scanner contracts

## Existing Phase 2 security regression coverage

- IPv4-mapped IPv6 local-address rejection
- special-use address rejection
- DNS result validation before network access
- IP-pinned HTTPS verification
- manual redirect handling
- trusted-write-only Phase 2 mutation boundary
- immutable verified asset identity fields
- one active verification challenge per asset
- composite `(asset_id, workspace_id)` integrity constraints
- database-enforced concurrent asset and verification quotas

## Merge rule

PR #6 must not merge until its final head, including project-state documentation, passes `npm test`, `npm run typecheck`, and `npm run build`. Any scanner safety or contract regression blocks the merge.

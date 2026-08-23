# ScopeForge Implementation Log

## 2026-08-24 - Community platform direction
- Approved the community security platform direction and Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify loop.

## 2026-08-24 - Phase 2 Asset Control
- Added workspace-scoped assets, proof-of-control, authorization, SSRF defenses, quotas, audit records, and asset UI.
- Merged through PR #4.

## 2026-08-24 - Phase 3 design
- Approved and merged PR #5 defining the local/passive code and supply-chain scanner architecture.

## 2026-08-24 - Phase 3A Scanner Foundation
- Added normalized findings, stable fingerprints, bounded hostile-repository inventory, scanner coordination, and deterministic JSON.
- Hardened file-count traversal and double-star ignore semantics with dedicated RED/GREEN regressions.
- Merged through PR #6.

## 2026-08-24 - Phase 3B Safe Reads, Configuration, Policy, and CLI
- Added the shared safe inventory-entry reader, strict root config, safe policy/exit semantics, terminal/JSON CLI, safe output writing, and compiled CLI validation.
- Security review fixed configured output traversal/symlink overwrite and silent unknown-scanner configuration with dedicated RED/GREEN regressions.
- Merged through PR #7 as `d1ca23c5df0bc4ed2276f37b585db453a30b41c0`.

## 2026-08-24 - Phase 3C Secret Scanner
- Created isolated branch `feat/phase-3c-secret-scanner` and draft PR #8.
- Added the Phase 3C implementation plan before production changes.
- CI #96 established the initial RED contract while the existing 89 tests remained green.
- Added mandatory redaction for provider, generic, and private-key findings.
- Added stable one-way `sfs1:` secret fingerprints that never serialize raw secret values.
- Added high-confidence GitHub, Stripe live, Slack, and private-key rules.
- Added contextual high-entropy assignment detection with placeholder and low-diversity suppression.
- Added exact safe-fixture annotation suppression and fingerprint allowlisting.
- Registered `secrets` as the first built-in CLI scanner and exposed its five rules through `rules list`.
- Added fail-closed validation for unknown built-in rule IDs.
- Hardened inventory reads so the file-byte ceiling is enforced during the actual read, followed by a final identity/size check.
- Added end-to-end terminal/JSON no-leak regression coverage.
- CI #100 passed 23 test files and 107 tests, strict typecheck, CLI build, compiled CLI runtime smoke, and production build.
- Review found private-key location metadata used full multiline material length as a single-line column range. CI #101 reproduced the issue, then the location span was bounded to the public header match.

## Current boundary

Phase 3 remains local and passive. The built-in secret scanner is the only detector family currently implemented. JavaScript/TypeScript SAST is next. Remote DAST, fuzzing, exploitation, credential attacks, persistence, and destructive actions remain outside Phase 3.

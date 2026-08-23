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
- Created PR #7 from an isolated feature branch.
- Added a shared safe inventory-entry reader with containment, symlink, regular-file, inode/device, and size revalidation.
- Added strict root-only `.scopeforge.json` schema version 1.
- Prevented repository configuration from raising safe inventory budgets.
- Added report-only default policy and explicit inclusive `failOn` enforcement.
- Added stable exit codes for success, policy failure, usage/configuration failure, and scanner execution failure.
- Added terminal and JSON CLI shell commands for scan, rules list, and version.
- Added separate CLI TypeScript compilation and a compiled-entrypoint CI smoke test.
- Security review found repository-configured output traversal and symlink overwrite risk. CI #87 reproduced both before containment and no-follow writing were added; CI #90 passed after the fix.
- Review found unknown configured scanner families could silently reduce coverage. CI #92 reproduced the issue and CI #93 passed after scanner selection was changed to fail closed.

## Current boundary

Phase 3 remains local and passive. No detector family is registered yet. Secret scanning and mandatory redaction are the next implementation slice. Remote DAST, fuzzing, exploitation, credential attacks, persistence, and destructive actions remain outside Phase 3.

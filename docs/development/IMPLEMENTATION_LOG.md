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
- Created isolated branch `feat/phase-3c-secret-scanner` and PR #8.
- CI #96 established the initial RED contract while the existing 89 tests remained green.
- Added mandatory redaction for provider, generic, and private-key findings.
- Added stable one-way `sfs1:` secret fingerprints that never serialize raw secret values.
- Added high-confidence GitHub, Stripe live, Slack, complete private-key block, and contextual high-entropy assignment rules.
- Added exact safe-fixture annotation suppression and fingerprint allowlisting.
- Registered `secrets` as the first built-in CLI scanner and exposed its five rules through `rules list`.
- Added fail-closed validation for unknown built-in rule IDs.
- Hardened inventory reads so the file-byte ceiling is enforced during the actual read, followed by a final identity/size check.
- Added end-to-end terminal/JSON no-leak regression coverage.
- Security review fixed private-key location metadata, incomplete private-key block false positives, and annotation scope leaking into the following line with dedicated RED/GREEN regressions.
- Final exact-head verification remained green and PR #8 was squash merged as `ee2b18c37d264fc22e47e650970e66d01f7c92dd`.

## 2026-08-24 - Phase 3D JavaScript/TypeScript Structural SAST
- Created isolated branch `feat/phase-3d-jsts-structural-sast` and draft PR #9.
- Added the Phase 3D implementation plan before production implementation.
- CI #132 established the RED contract with 111 tests already passing and failures limited to the new structured-error, parser, scanner, CLI, and structural-output contracts.
- Extended the scanner coordinator compatibly so a scanner may return valid findings plus structured per-file diagnostics without weakening existing array-return scanners.
- Extended deterministic JSON error ordering to scanner, file, code, and message.
- Added an execution-free TypeScript `createSourceFile` parser boundary for JS, JSX, MJS, CJS, TS, TSX, MTS, and CTS.
- Added iterative source-order AST traversal with a fixed per-file node budget and stable semantic enclosing context.
- Added `jsts/dynamic-code-execution` for direct `eval` and `new Function` constructs, with medium severity/high confidence to avoid claiming attacker-controlled execution without data-flow evidence.
- Added `jsts/tls-verification-disabled` for recognized explicit Node.js TLS verification disablement.
- Structural finding evidence uses fixed normalized descriptors rather than repository source lines, and fingerprints remain stable across harmless line movement.
- Added repository integration that reads only bounded inventory entries and isolates syntax, binary-like, filesystem, and AST-budget failures per file.
- Added a combined built-in CLI registry so `secrets` and `jsts` run by default, rule listing remains deterministic, scanner-family selection works, and unknown built-in rules fail closed.
- Added hostile no-execution fixtures and terminal/JSON source-sentinel no-leak regressions.
- CI #150 passed all 141 runtime tests and then strict typecheck isolated two typing-boundary defects. The parser diagnostic compatibility type and the secret scanner's narrow return type were corrected without changing detector semantics.
- CI #152 passed 30 test files and 141 tests, strict typecheck, CLI build, compiled CLI runtime smoke, and production build.
- Security review rejected the initial `jsts/insecure-cookie` candidate because response-like receiver names alone were insufficient to prove framework identity. The rule was removed from this slice rather than shipping a noisy heuristic.
- Security review added a fake-HTTPS negative fixture. CI #164 reproduced that a local object named `https` could trigger the Agent rule while the other 140 tests passed.
- The TLS rule was hardened to recognize only statically declared Node `https`/`node:https` namespace bindings through imports or `require`, without resolving or executing modules.
- CI #165 confirmed the rule-level hardening and exposed one stale scanner integration fixture that omitted the new Node HTTPS binding requirement. The fixture was updated to import `node:https` explicitly.
- Final exact-head documentation/hardening CI and merge remain pending.

## Current boundary

Phase 3 remains local and passive. The built-in `secrets` and `jsts` detector families are implemented, with Phase 3D pending final merge. Phase 3D ships two intentionally narrow structural JS/TS rule families; framework-sensitive cookie analysis is deferred until stronger framework binding exists. JS/TS source-to-sink taint analysis is next. Dependency/OSV, SBOM, IaC, baselines, and SARIF remain unimplemented. Remote DAST, fuzzing, exploitation, credential attacks, persistence, and destructive actions remain outside Phase 3.

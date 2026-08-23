# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform for developers first, while making security findings understandable to people without a security background.

Product loop: `Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`.

The approved platform design is in `docs/superpowers/specs/2026-08-24-community-platform-design.md`. The approved local scanner architecture is in `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`.

## Shipped foundations

### Phase 1
- Next.js/React application shell
- Supabase authentication and workspace tenancy
- Row Level Security and server session handling
- security headers and CI

### Phase 2
- workspace-scoped web/API/public-GitHub assets
- canonical target normalization
- proof-of-control challenges
- public HTTPS verification with DNS/IP/SSRF boundaries
- trusted server-side writes, roles, quotas, audit records, and asset UI
- remote active scanning remains disabled

### Phase 3A
- normalized finding and scan-result contracts
- stable structural fingerprints
- severity helpers
- bounded deterministic repository inventory
- generated/vendor excludes, ignore patterns, symlink non-following, and file/byte budgets
- scanner coordinator, deduplication, explicit scanner errors, and deterministic JSON

### Phase 3B
Merged through PR #7 as `d1ca23c5df0bc4ed2276f37b585db453a30b41c0`.

- safe bounded inventory-entry reads
- strict root-only `.scopeforge.json` version 1
- repository configuration can tighten but not raise safe budgets
- report-only default and explicit inclusive severity gates
- distinct exit codes for success, policy failure, usage/configuration, and scanner execution failure
- local CLI commands for scan, rules list, and version
- safe output path handling and compiled CLI CI smoke testing

### Phase 3C
Merged through PR #8 as `ee2b18c37d264fc22e47e650970e66d01f7c92dd`.

- mandatory provider-aware secret redaction
- stable one-way `sfs1:` fingerprints
- GitHub token, Stripe live secret-key, Slack token, complete private-key block, and contextual high-entropy assignment detection
- exact safe-fixture annotation suppression
- fingerprint allowlisting in `.scopeforge.json`
- fail-closed built-in rule validation
- default CLI registration of the `secrets` scanner
- terminal and JSON no-leak regression coverage
- private-key location metadata bounded to the public header span
- safe reader hardened to enforce the byte ceiling during the actual file read

### Phase 3D
Implemented on branch `feat/phase-3d-jsts-structural-sast` in PR #9, pending final exact-head documentation validation and merge.

- compatible scanner-result contract allows findings plus structured per-file errors
- JavaScript/TypeScript parser boundary uses TypeScript `createSourceFile` only
- supported syntax families: JS, JSX, MJS, CJS, TS, TSX, MTS, and CTS
- parser errors are generic and do not serialize arbitrary source text
- AST traversal is iterative and bounded to a configurable per-file node budget
- stable semantic structural context is independent of line movement
- first three high-confidence structural rules:
  - direct `eval` / `new Function`
  - explicit TLS certificate-verification disablement in recognized Node.js shapes
  - recognized response-cookie calls with `secure: false`
- structural findings use fixed normalized evidence rather than source lines
- over-budget and malformed files fail closed per file without discarding valid findings from other files
- scanner reads only shared inventory entries through `readInventoryEntry`
- `jsts` is registered beside `secrets` in the built-in CLI registry
- built-in rule listing and unknown-rule validation cover both detector families
- hostile fixtures verify parsing does not execute imports, `require`, or repository side effects

CI #132 established the Phase 3D RED checkpoint with 111 passing tests and only missing Phase 3D behavior failing. CI #150 then passed all 141 tests but exposed two strict TypeScript contract issues. Those were fixed at the type boundary. CI #152 passed 30 test files and 141 tests, strict typecheck, CLI build, compiled CLI runtime smoke, and the Next.js production build.

## Not shipped yet

- limited high-confidence JavaScript/TypeScript taint analysis
- dependency/OSV analysis and CycloneDX SBOM
- Docker/Kubernetes/Terraform/GitHub Actions rules
- baseline file engine
- SARIF adapter
- hosted scanner-result ingestion
- remote DAST, API fuzzing, exploit validation, or scanner workers

## Safety boundary

Phase 3 is local and passive. Detector families must use the shared bounded inventory and safe read path. Raw detected secret values must not cross the finding/output boundary. JS/TS structural analysis parses syntax only and does not execute or resolve target modules. Source-to-sink vulnerability claims remain deferred until bounded taint analysis provides evidence. Remote active testing remains a later phase with separate authorization, isolation, egress, quota, and cancellation requirements.

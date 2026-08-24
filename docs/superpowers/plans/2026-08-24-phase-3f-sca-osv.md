# Phase 3F Dependency Inventory and OSV Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded JavaScript dependency inventory plus optional OSV vulnerability enrichment while preserving offline scanning, deterministic ordering, and the existing passive repository boundary.

**Architecture:** Introduce a focused `scanner-sca` module that reads only manifest and lockfile entries already admitted to the bounded repository inventory. Lockfile parsers normalize npm packages into a shared dependency component model, while `package.json` is used only as lower-certainty fallback when no supported lockfile exists in the same directory. OSV access is an explicit enrichment layer with batched queries, pagination, per-scan record caching, bounded responses, and structured diagnostics so network failure is never interpreted as a clean result.

**Tech Stack:** Node.js 22, TypeScript 5.8, Vitest 3.2, existing ScopeForge scanner contracts, native `fetch`, Node built-ins only.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Phase 3 remains local and passive.
- Never execute repository code, package lifecycle scripts, imported modules, lockfiles, or manifests.
- Never install target dependencies.
- All repository reads stay behind `readInventoryEntry` and the bounded repository inventory.
- Prefer resolved lockfile versions over manifest ranges.
- `package.json` fallback versions are inventory-only unless they are exact versions.
- OSV receives only normalized package identity and version, never source code, secrets, or arbitrary repository content.
- OSV enrichment is optional and must be distinguishable from deterministic local inventory.
- Query-batch pagination is handled per query and bounded against runaway responses.
- Vulnerability detail records are cached within one scan.
- Upstream aliases such as CVE and GHSA identifiers are preserved.
- Severity is normalized only from recognized upstream severity metadata. Missing upstream severity stays informational rather than inventing a score.
- Vulnerability lookup failures return structured scanner diagnostics and never imply that no vulnerabilities exist.
- Output ordering and fingerprints remain deterministic.
- CI must pass `npm test`, `npm run typecheck`, `npm run build:cli`, `node .scopeforge-build/packages/cli/index.js version`, and `npm run build` before merge.

---

### Task 1: Define the normalized npm dependency model and package-lock parser

**Files:**
- Create: `packages/scanner-sca/types.ts`
- Create: `packages/scanner-sca/lockfiles/package-lock.ts`
- Test: `tests/scanner/sca/package-lock.test.ts`

**Interfaces:**
- `NpmDependencyComponent` records package name, version, purl, source file, source kind, certainty, directness, and source line.
- `parsePackageLock({ file, content }) -> DependencyParseResult`.

- [ ] Write RED fixtures for npm lockfile v1, v2, and v3, including nested packages, scoped packages, duplicate versions, and malformed JSON.
- [ ] Verify the focused test fails because the parser does not exist.
- [ ] Implement strict JSON parsing, resolved-version extraction, deterministic deduplication, and npm Package URL construction.
- [ ] Verify the focused suite passes.

### Task 2: Add bounded pnpm, Yarn, and manifest fallback parsing

**Files:**
- Create: `packages/scanner-sca/lockfiles/pnpm-lock.ts`
- Create: `packages/scanner-sca/lockfiles/yarn-lock.ts`
- Create: `packages/scanner-sca/manifests/package-json.ts`
- Test: `tests/scanner/sca/pnpm-lock.test.ts`
- Test: `tests/scanner/sca/yarn-lock.test.ts`
- Test: `tests/scanner/sca/package-json.test.ts`

**Interfaces:**
- `parsePnpmLock`, `parseYarnLock`, and `parsePackageJson` all return `DependencyParseResult`.

- [ ] Write RED tests for common supported lockfile forms, scoped packages, malformed entries, and hostile oversized-line patterns.
- [ ] Verify the focused tests fail for missing parsers.
- [ ] Implement line-oriented parsers that recognize only supported package-entry shapes and never evaluate YAML or lockfile content.
- [ ] Implement `package.json` fallback across dependency groups with `manifest_range` certainty and exact-version detection.
- [ ] Verify all parser suites pass.

### Task 3: Build directory-aware dependency inventory with lockfile precedence

**Files:**
- Create: `packages/scanner-sca/inventory.ts`
- Test: `tests/scanner/sca/inventory.test.ts`

**Interfaces:**
- `collectNpmDependencies(inventory) -> Promise<DependencyInventoryResult>`.

- [ ] Write RED tests proving `npm-shrinkwrap.json` wins over `package-lock.json`, lockfiles win over `package.json`, unrelated directories are handled independently, and reads are constrained to inventory entries.
- [ ] Verify RED.
- [ ] Implement deterministic directory grouping, supported-lockfile priority, safe reads through `readInventoryEntry`, and parse diagnostics for malformed supported files.
- [ ] Verify GREEN.

### Task 4: Implement bounded OSV batch lookup and detail caching

**Files:**
- Create: `packages/scanner-sca/osv/client.ts`
- Create: `packages/scanner-sca/osv/types.ts`
- Test: `tests/scanner/sca/osv-client.test.ts`

**Interfaces:**
- `queryOsvDependencies(components, options) -> Promise<OsvLookupResult>`.
- Options accept an injectable `fetchImpl` for deterministic tests and fixed safety budgets for batch size, response bytes, page count, record count, and timeout.

- [ ] Write RED tests for batch request ordering, duplicate-query collapse, per-result pagination, detail-record caching, non-2xx responses, malformed JSON, and bounded pagination failure.
- [ ] Verify RED.
- [ ] Implement POST `/v1/querybatch` using npm ecosystem plus exact version, then GET `/v1/vulns/{id}` once per unique vulnerability ID.
- [ ] Keep query-to-component association stable across pagination and batches.
- [ ] Return structured lookup diagnostics for network/protocol/budget failures.
- [ ] Verify GREEN.

### Task 5: Emit normalized known-vulnerability findings and register the SCA scanner

**Files:**
- Create: `packages/scanner-sca/findings/create-vulnerability-finding.ts`
- Create: `packages/scanner-sca/scanner.ts`
- Create: `packages/scanner-sca/index.ts`
- Modify: `packages/scanner-core/config/types.ts`
- Modify: `packages/scanner-core/config/load-config.ts`
- Modify: `packages/cli/builtins.ts`
- Test: `tests/scanner/sca/scanner.test.ts`
- Test: `tests/scanner/core/config.test.ts`
- Test: `tests/cli/builtins.test.ts`

**Interfaces:**
- Scanner name: `sca`.
- Rule ID: `sca/known-vulnerability`, rule version `1.0.0`.
- Configuration: `sca.osv.enabled` boolean, default `false`.

- [ ] Write RED tests for offline inventory behavior, enabled OSV findings, aliases, fixed-version metadata, recognized upstream severity mapping, unknown-severity informational behavior, stable fingerprints, and lookup diagnostics.
- [ ] Write RED config tests for safe defaults, valid opt-in, wrong types, and unknown keys.
- [ ] Verify RED.
- [ ] Implement the SCA scanner, finding builder, rule export, strict config parser, and built-in registration.
- [ ] Verify GREEN.

### Task 6: Add CLI integration and security regressions

**Files:**
- Test: `tests/scanner/sca/security-regressions.test.ts`
- Test: `tests/scanner/sca/cli-integration.test.ts`
- Modify: `README.md`

- [ ] Add RED regressions for malformed lockfiles, duplicate packages, untrusted strings that resemble package entries outside supported sections, OSV failures that must produce scanner errors, and proof that source text is never sent to OSV.
- [ ] Add CLI tests proving the default scan remains offline and deterministic while explicit `sca.osv.enabled: true` enables enrichment.
- [ ] Verify focused suites.
- [ ] Document supported JavaScript package sources, offline default, and OSV opt-in configuration.
- [ ] Run the full verification gate: `npm test`, `npm run typecheck`, `npm run build:cli`, CLI version smoke test, and `npm run build`.

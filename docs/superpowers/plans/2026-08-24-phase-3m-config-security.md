# Phase 3M Configuration Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Phase 3 generic-configuration boundary with a small set of deterministic, high-confidence configuration checks.

**Architecture:** Extend the existing `iac` scanner rather than add another scanner family. Recognize only explicitly supported configuration files, parse each format locally without executing application code, normalize every result through the existing IaC rule contract, and keep finding evidence generic so repository values are not copied into output.

**Tech Stack:** TypeScript, Node.js, JSON parsing, bounded line parsing, Vitest, existing scanner-core and scanner-iac contracts.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Configuration analysis remains local and passive.
- No package manager, framework, shell, application, or repository code is executed.
- No network request is initiated by configuration scanning.
- Scan only formats with unambiguous setting semantics.
- Evidence is normalized and does not copy arbitrary configuration values.
- Malformed supported structured configuration is reported as incomplete coverage, not treated as clean.
- Rules share the existing IaC include/exclude selection and built-in rule registry.
- Fingerprints remain stable across harmless line movement.

---

### Task 1: Supported configuration inventory and parser boundary

**Files:**
- Modify: `packages/scanner-core/inventory/build-inventory.ts`
- Create: `packages/scanner-iac/config/types.ts`
- Create: `packages/scanner-iac/config/scan.ts`
- Test: `tests/scanner/iac/config-scanner.test.ts`

**Interfaces:**
- Recognize `.npmrc` as `config` inventory.
- `scanSecurityConfig(input)` handles only `.npmrc` and `vercel.json` in this slice.

- [ ] Write RED tests proving `.npmrc` is inventoried and unrelated config files are ignored by the scanner.
- [ ] Implement exact filename routing and bounded local reads through the existing IaC safe-read path.
- [ ] Verify the scanner integration tests pass.

### Task 2: Explicit npm TLS verification disablement

**Files:**
- Create: `packages/scanner-iac/rules/config.ts`
- Modify: `packages/scanner-iac/config/scan.ts`
- Test: `tests/scanner/iac/config-rules.test.ts`

**Interfaces:**
- Rule ID: `iac/config-npm-strict-ssl-disabled`.
- Match `.npmrc` only when the effective explicit `strict-ssl` setting is `false`.

- [ ] Write RED positive and negative tests including whitespace, comments, `true`, unrelated keys, and later-setting override behavior.
- [ ] Implement a bounded key/value parser with last-setting-wins semantics and generic evidence.
- [ ] Verify the rule tests pass.

### Task 3: Explicit wildcard CORS in Vercel configuration

**Files:**
- Modify: `packages/scanner-iac/rules/config.ts`
- Modify: `packages/scanner-iac/config/scan.ts`
- Test: `tests/scanner/iac/config-rules.test.ts`

**Interfaces:**
- Rule ID: `iac/config-vercel-wildcard-cors`.
- Parse `vercel.json` structurally and flag a header entry whose key is exactly `Access-Control-Allow-Origin` case-insensitively and whose value is exactly `*`.

- [ ] Write RED tests for wildcard CORS, scoped origins, lookalike keys, malformed JSON, and source-value non-leakage.
- [ ] Implement strict bounded JSON parsing and location discovery without evaluating Vercel configuration.
- [ ] Verify rule tests pass.

### Task 4: IaC registry, security regressions, and merge gate

**Files:**
- Modify: `packages/scanner-iac/index.ts`
- Modify: `packages/scanner-iac/scanner.ts`
- Create: `tests/scanner/iac/config-security-regressions.test.ts`

- [ ] Write RED tests for built-in registry exposure, no network or execution, generic evidence, and stable fingerprints across line movement.
- [ ] Wire config rules into the IaC registry and repository scanner.
- [ ] Run the full runtime suite, strict typecheck, CLI build/runtime smoke, and production build.
- [ ] Review every changed file for security regressions and merge only on an exact green head.

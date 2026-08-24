# Phase 3L Baseline Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, versioned finding baselines so ScopeForge can distinguish accepted legacy findings from new findings and gate CI on new findings by default.

**Architecture:** Add a bounded baseline module under `packages/scanner-core/baseline` that serializes only stable fingerprints plus non-secret metadata, loads baseline files fail-closed, and labels scan findings after scanner coordination. Wire the baseline into the existing root configuration and CLI, add `scopeforge baseline create [path]`, and make policy evaluation support either new-only or all-finding enforcement when a baseline is active.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Vitest, existing ScopeForge finding, config, policy, CLI, JSON, and safe-output contracts.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Baseline format is versioned and deterministic.
- Baselines store stable finding fingerprints and safe metadata only, never evidence, snippets, secret values, or arbitrary source text.
- Malformed, oversized, symlinked, or incompatible baselines fail closed as configuration errors.
- Root repository configuration may specify only a canonical relative baseline path inside the scan root.
- With a baseline active, matching findings are `existing` and unmatched findings are `new`.
- Without a baseline, findings retain `baselineState: "none"`.
- `--fail-on` gates new findings by default when a baseline is active.
- `--baseline-gate all` explicitly gates all findings when a baseline is active.
- `scopeforge baseline create [path]` writes `.scopeforge-baseline.json` safely in the scan root.
- Baseline creation does not weaken scanner-error handling and does not write a baseline when the scan has scanner errors.
- Baseline creation and loading never execute repository code and never initiate network behavior beyond scanner behavior explicitly enabled by existing configuration.

---

### Task 1: Baseline file contract

**Files:**
- Create: `packages/scanner-core/baseline/types.ts`
- Create: `packages/scanner-core/baseline/serialize.ts`
- Create: `packages/scanner-core/baseline/load.ts`
- Create: `packages/scanner-core/baseline/apply.ts`
- Test: `tests/scanner/baseline/baseline.test.ts`

**Interfaces:**
- Produces `BaselineFile`, `BaselineEntry`, `BaselineError`, `serializeBaseline(findings, options)`, `loadBaseline(root, path)`, and `applyBaseline(findings, baseline)`.
- Baseline entries contain `fingerprint`, `scanner`, `ruleId`, `ruleVersion`, `severity`, and `file` only.

- [ ] Write RED tests for deterministic serialization, secret-safe fields, bounded fail-closed loading, symlink rejection, version rejection, and `new`/`existing` classification.
- [ ] Verify the RED tests fail because the baseline modules do not exist.
- [ ] Implement the minimal baseline contracts and bounded reader.
- [ ] Verify the baseline tests pass.

### Task 2: Policy baseline scope

**Files:**
- Modify: `packages/scanner-core/findings/types.ts`
- Modify: `packages/scanner-core/policy/evaluate-policy.ts`
- Test: `tests/scanner/policy/evaluate-policy.test.ts`

**Interfaces:**
- Extend policy result with `baselineGate?: "new" | "all"`.
- Extend `evaluatePolicy(findings, failOn, options)` with optional `baselineGate`.

- [ ] Write RED tests proving default new-only gating ignores `existing` findings while explicit `all` gating includes them.
- [ ] Implement the policy option without changing report-only behavior.
- [ ] Verify policy tests pass.

### Task 3: Root configuration baseline path

**Files:**
- Modify: `packages/scanner-core/config/types.ts`
- Modify: `packages/scanner-core/config/load-config.ts`
- Test: `tests/scanner/config/load-config.test.ts`

**Interfaces:**
- Add `baseline: string | undefined` to `ScannerConfig`.
- Add `baselineGate: "new" | "all"` with default `new`.

- [ ] Write RED config tests for canonical relative baseline paths, default `new` baseline gate, explicit `all`, and traversal, absolute, backslash, empty, and unknown-value rejection.
- [ ] Implement strict parsing and defaults.
- [ ] Verify config tests pass.

### Task 4: CLI baseline scan integration and baseline creation

**Files:**
- Modify: `packages/cli/run-cli.ts`
- Modify: `packages/cli/terminal.ts`
- Test: `tests/scanner/cli/baseline-cli.test.ts`
- Test: `tests/scanner/cli/run-cli.test.ts`

**Interfaces:**
- Add `scan [path] --baseline file --baseline-gate new|all`.
- Add `baseline create [path]` with output `.scopeforge-baseline.json`.

- [ ] Write RED integration tests for baseline creation, scan-time labeling, CLI override of configured baseline, malformed baseline usage errors, new-only policy failure semantics, explicit all-finding gating, and refusal to create a baseline when scanner errors exist.
- [ ] Implement baseline argument parsing and application after `runScan` and before policy evaluation and rendering.
- [ ] Implement safe deterministic baseline creation through `writeScanOutput(..., { requireWithinRoot: true })`.
- [ ] Add terminal summaries for new and existing finding counts only when a baseline is active.
- [ ] Verify baseline CLI tests and existing CLI tests pass.

### Task 5: Security regressions and final verification

**Files:**
- Create: `tests/scanner/baseline/security-regressions.test.ts`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`

- [ ] Add regressions proving baseline serialization cannot copy finding evidence, metadata, secret material, arbitrary source snippets, or remediation text.
- [ ] Add regressions for baseline symlink refusal and repository-configured baseline path containment.
- [ ] Run the full runtime suite.
- [ ] Run strict TypeScript typecheck.
- [ ] Build and start the compiled CLI.
- [ ] Run the Next.js production build.
- [ ] Review the exact PR diff, resolve blockers, and squash merge only on the verified exact head.

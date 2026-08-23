# Phase 3A Scanner Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the local scanner contracts that every Phase 3 detector and output adapter can share without coupling scanner code to the hosted Next.js control plane.

**Architecture:** Add framework-independent TypeScript modules under `packages/` for normalized findings, stable fingerprints, bounded repository inventory, scanner coordination, and deterministic native JSON output. Scanner implementations remain pluggable through a small `Scanner` interface. The first slice uses only Node.js built-ins so later SAST, secrets, SCA, IaC, SARIF, baselines, and CLI work can depend on a small and well-tested core.

**Tech Stack:** Node.js 22, TypeScript 5.8, Vitest 3.2, Node built-ins only for this slice.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Scanner packages must not depend on Next.js, Supabase, or Vercel.
- Local static analysis must be deterministic for the same repository contents and scanner configuration.
- All scanner families normalize into one finding contract.
- Fingerprints must not depend only on line numbers and must never require raw secret values.
- Repository walking must be bounded and must not follow symlinks outside the scan root.
- Generated and vendor paths such as `.git`, `node_modules`, `.next`, `dist`, `build`, and `coverage` are excluded by default.
- Scanner execution errors remain distinguishable from findings.
- Native JSON output has deterministic ordering.
- No remote exploitation, remote DAST, credential attacks, persistence, or destructive behavior is introduced.
- CI remains Node.js 22 and must pass `npm test`, `npm run typecheck`, and `npm run build`.

---

## Planned file map

### Finding contracts
- Create: `packages/scanner-core/findings/types.ts` - normalized Phase 3 finding and scan result types.
- Create: `packages/scanner-core/findings/severity.ts` - severity ordering and gate comparison.
- Create: `packages/scanner-core/findings/fingerprint.ts` - stable SHA-256 fingerprints from non-secret structural identity.
- Create: `tests/scanner/findings/fingerprint.test.ts` - fingerprint stability and sensitivity tests.
- Create: `tests/scanner/findings/severity.test.ts` - severity ordering tests.

### Repository inventory
- Create: `packages/scanner-core/inventory/types.ts` - inventory budgets, entries, skip reasons, and summary.
- Create: `packages/scanner-core/inventory/patterns.ts` - bounded ignore-pattern parsing and matching.
- Create: `packages/scanner-core/inventory/build-inventory.ts` - safe filesystem traversal with limits and classification.
- Create: `tests/scanner/inventory/build-inventory.test.ts` - default excludes, scopeforge ignore, symlink, and budget tests.

### Scanner coordination
- Create: `packages/scanner-core/coordinator/types.ts` - scanner interface and execution context.
- Create: `packages/scanner-core/coordinator/run-scan.ts` - deterministic execution, error capture, deduplication, and ordering.
- Create: `tests/scanner/coordinator/run-scan.test.ts` - scanner aggregation, error capture, and fingerprint deduplication.

### Native JSON output
- Create: `packages/scanner-output/json/serialize.ts` - canonical deterministic ScopeForge JSON serialization.
- Create: `tests/scanner/output/json.test.ts` - schema metadata and stable ordering tests.

---

### Task 1: Define the unified finding identity contract

**Files:**
- Create: `packages/scanner-core/findings/types.ts`
- Create: `packages/scanner-core/findings/severity.ts`
- Create: `packages/scanner-core/findings/fingerprint.ts`
- Create: `tests/scanner/findings/fingerprint.test.ts`
- Create: `tests/scanner/findings/severity.test.ts`

**Interfaces:**
- Produces: `Finding`, `Severity`, `Confidence`, `Validation`, `FindingLocation`, `FindingEvidence`, `ScanResult`, `createFindingFingerprint(input)`, and `isSeverityAtLeast(actual, threshold)`.
- Consumes: Node `crypto` and `path` only.

- [ ] **Step 1: Write failing fingerprint tests**

```ts
import { describe, expect, it } from "vitest";
import { createFindingFingerprint } from "@/packages/scanner-core/findings/fingerprint";

describe("createFindingFingerprint", () => {
  it("stays stable when only line numbers move", () => {
    const identity = {
      scanner: "jsts",
      ruleId: "command-injection",
      file: "src/api/export.ts",
      structuralContext: "exec(request.query.cmd)",
      source: "request.query.cmd",
      sink: "child_process.exec"
    };
    expect(createFindingFingerprint(identity)).toBe(createFindingFingerprint({ ...identity }));
  });

  it("changes when the rule or structural context changes", () => {
    const base = {
      scanner: "jsts",
      ruleId: "command-injection",
      file: "src/api/export.ts",
      structuralContext: "exec(request.query.cmd)"
    };
    expect(createFindingFingerprint(base)).not.toBe(
      createFindingFingerprint({ ...base, structuralContext: "exec(request.body.cmd)" })
    );
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/scanner/findings/fingerprint.test.ts tests/scanner/findings/severity.test.ts`

Expected: FAIL because the scanner-core modules do not exist yet.

- [ ] **Step 3: Implement the normalized types and fingerprint helper**

`createFindingFingerprint` must normalize path separators to `/`, lowercase scanner/rule namespaces, trim structural identifiers, encode the canonical identity with `JSON.stringify`, and return a prefixed SHA-256 digest such as `sf1:<hex>`. It must not accept or serialize raw secret material.

- [ ] **Step 4: Implement severity ordering**

Use this exact rank order:

```ts
export const severityRank = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
} as const;
```

`isSeverityAtLeast("high", "medium")` returns `true`; `isSeverityAtLeast("low", "high")` returns `false`.

- [ ] **Step 5: Run focused and full verification**

Run: `npm test -- tests/scanner/findings`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

---

### Task 2: Build a bounded repository inventory

**Files:**
- Create: `packages/scanner-core/inventory/types.ts`
- Create: `packages/scanner-core/inventory/patterns.ts`
- Create: `packages/scanner-core/inventory/build-inventory.ts`
- Create: `tests/scanner/inventory/build-inventory.test.ts`

**Interfaces:**
- Produces: `buildRepositoryInventory(root, options?) -> Promise<RepositoryInventory>`.
- Consumes: `InventoryBudgets` with defaults of 20,000 files, 2 MiB per file, and 256 MiB total bytes.
- Later scanners consume only returned repository-relative entries and never walk the repository themselves.

- [ ] **Step 1: Write failing inventory tests**

Tests create temporary repositories with source files, ignored `node_modules`, `.scopeforgeignore`, an oversized file, and a symlink. Assert that only in-budget regular files under the scan root are returned and skip counters explain exclusions.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/scanner/inventory/build-inventory.test.ts`

Expected: FAIL because `buildRepositoryInventory` does not exist.

- [ ] **Step 3: Implement safe traversal**

Use `lstat` so symlinks are identified before traversal. Never follow directory symlinks. Sort directory entries by name before walking so inventory order is deterministic. Stop adding files when a budget is exhausted and record the applicable skip reason.

- [ ] **Step 4: Implement root ignore handling**

Always apply the default generated/vendor path set. Read root `.scopeforgeignore` and root `.gitignore` when present. Support comments, blank lines, leading `/`, trailing `/`, `*`, `**`, and `?`; unsupported negation (`!`) is ignored conservatively rather than re-including content.

- [ ] **Step 5: Run focused and full verification**

Run: `npm test -- tests/scanner/inventory/build-inventory.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

---

### Task 3: Add scanner coordination and deterministic deduplication

**Files:**
- Create: `packages/scanner-core/coordinator/types.ts`
- Create: `packages/scanner-core/coordinator/run-scan.ts`
- Create: `tests/scanner/coordinator/run-scan.test.ts`

**Interfaces:**
- Produces: `Scanner`, `ScannerContext`, and `runScan({ root, inventory, scanners }) -> Promise<ScanResult>`.
- Scanner signature: `scan(context: ScannerContext): Promise<Finding[]>`.
- Scanner failures are captured as `ScanError` entries and do not masquerade as a clean scanner result.

- [ ] **Step 1: Write failing coordinator tests**

Use two tiny in-test scanner implementations. One returns duplicate fingerprints in a different order; another throws. Assert deterministic finding order, fingerprint deduplication, and one captured scanner error.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/scanner/coordinator/run-scan.test.ts`

Expected: FAIL because coordinator modules do not exist.

- [ ] **Step 3: Implement the coordinator**

Execute scanners sequentially in stable scanner-name order for deterministic behavior in this first slice. Capture scanner exceptions with safe messages, deduplicate by fingerprint, and sort findings by severity descending, then file path, then line, then rule ID, then fingerprint.

- [ ] **Step 4: Run focused and full verification**

Run: `npm test -- tests/scanner/coordinator/run-scan.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

---

### Task 4: Emit canonical ScopeForge JSON

**Files:**
- Create: `packages/scanner-output/json/serialize.ts`
- Create: `tests/scanner/output/json.test.ts`

**Interfaces:**
- Produces: `serializeScanResult(result, options?) -> string`.
- Output schema version for this slice: `1`.
- The serializer consumes only `ScanResult`; it has no filesystem, network, Next.js, Supabase, or Vercel dependency.

- [ ] **Step 1: Write failing output tests**

Assert the serializer emits `schemaVersion`, `tool`, `scan`, `inventory`, `findings`, `errors`, and `policy` fields and that semantically identical finding sets serialize byte-for-byte identically regardless of input order.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/scanner/output/json.test.ts`

Expected: FAIL because the serializer does not exist.

- [ ] **Step 3: Implement canonical serialization**

Normalize finding order with the same comparator used by the coordinator, sort object-keyed summary maps before serialization, and pretty-print with two spaces plus a final newline.

- [ ] **Step 4: Run complete verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Update resumable project state**

Update `docs/development/SESSION_HANDOFF.md`, `CURRENT_STATE.md`, `NEXT_STEPS.md`, `TEST_STATUS.md`, and `IMPLEMENTATION_LOG.md` so the next session begins with the exact merged/PR state and the next Phase 3 slice.

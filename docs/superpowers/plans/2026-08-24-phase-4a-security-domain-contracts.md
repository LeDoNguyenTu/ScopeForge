# Phase 4A Security Domain Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a framework-independent product security domain and deterministic Phase 3 source adapter so later runtime scanning, hosted findings, risk intelligence, remediation, and optional AI assistance can integrate without coupling to scanner, database, UI, worker, or provider implementations.

**Architecture:** Keep `scanner-core` unchanged as the passive scanner execution contract. Add `packages/security-domain` for cross-product pure types/helpers and `packages/security-domain-adapters/phase3` for one-way translation from Phase 3 findings. AI readiness is represented only by provider-neutral advisory contracts and a pure context-policy boundary; no model provider or network behavior is introduced.

**Tech Stack:** TypeScript 5.8, Vitest 3.2, existing strict root TypeScript configuration. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-4a-security-domain-contracts-design.md`

## Global Constraints

- Human developers must be able to understand, test, maintain, and extend the codebase without model assistance.
- `packages/security-domain` performs no network I/O, filesystem I/O, environment reads, process-exit behavior, database access, UI work, or provider calls.
- `packages/security-domain` must not depend on scanner packages, CLI, Next.js, React, Supabase, PostgreSQL, worker code, or any AI SDK.
- Scanner packages remain authoritative for deterministic scanner evidence and retain their Phase 3 contracts unchanged.
- Provider-specific AI SDK types must never appear in the security-domain package.
- AI/advisory output is always advisory/inferred until independently confirmed and can never promote validation state by itself.
- Raw detected secrets are never valid advisory context.
- Local-model support must remain architecturally possible.
- No remote DAST, crawling, fuzzing, exploit validation, authenticated testing, queue, worker, persistence migration, R2 upload, or live model call is part of Phase 4A.
- No backward-incompatible change to existing Phase 3 CLI, scanner output, fingerprint, baseline, policy, JSON, SARIF, or SBOM behavior.
- TDD is required for domain behavior and source mapping.

---

### Task 1: Domain primitives, identity, source, and provenance contracts

**Files:**
- Create: `packages/security-domain/common/contract.ts`
- Create: `packages/security-domain/common/identifiers.ts`
- Create: `packages/security-domain/common/security-levels.ts`
- Create: `packages/security-domain/provenance/types.ts`
- Create: `packages/security-domain/sources/types.ts`
- Create: `packages/security-domain/index.ts`
- Test: `tests/security-domain/primitives.test.ts`

**Interfaces:**
- Consumes: no application package; only TypeScript language/runtime primitives.
- Produces:
  - `SECURITY_DOMAIN_CONTRACT_VERSION: 1`
  - branded identifiers: `SecurityFindingId`, `EvidenceId`, `AssetRef`, `ScanRunRef`, `RuleRef`, `RelationshipId`, `AdvisoryRecordId`
  - constructors `securityFindingId`, `evidenceId`, `assetRef`, `scanRunRef`, `ruleRef`, `relationshipId`, `advisoryRecordId`
  - `SecuritySeverity = "critical" | "high" | "medium" | "low" | "info"`
  - `SecurityConfidence = "high" | "medium" | "low"`
  - `ProvenanceKind = "observed" | "scanner-derived" | "user-confirmed" | "inferred"`
  - `FindingSourceKind = "deterministic-passive-scanner" | "deterministic-runtime-scanner" | "external-scanner" | "user-confirmed" | "advisory-inference"`
  - `ProvenanceRecord` and `FindingSourceRef`

- [ ] **Step 1: Write the failing primitive-contract test**

```ts
import { describe, expect, it } from "vitest";
import {
  SECURITY_DOMAIN_CONTRACT_VERSION,
  evidenceId,
  securityFindingId,
  type FindingSourceRef,
  type ProvenanceRecord,
} from "@/packages/security-domain";

describe("security-domain primitives", () => {
  it("exposes a versioned framework-independent contract", () => {
    expect(SECURITY_DOMAIN_CONTRACT_VERSION).toBe(1);
    expect(String(securityFindingId("sfinding:abc"))).toBe("sfinding:abc");
    expect(String(evidenceId("evidence:abc"))).toBe("evidence:abc");
  });

  it("rejects empty opaque identifiers", () => {
    expect(() => securityFindingId("  ")).toThrow(/non-empty/i);
  });

  it("keeps source and provenance as separate concepts", () => {
    const provenance: ProvenanceRecord = { kind: "scanner-derived" };
    const source: FindingSourceRef = {
      kind: "deterministic-passive-scanner",
      sourceId: "scopeforge:secrets",
      sourceVersion: "1",
    };
    expect(provenance.kind).not.toBe(source.kind);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/security-domain/primitives.test.ts`

Expected: FAIL because `packages/security-domain` does not exist.

- [ ] **Step 3: Implement minimal pure primitives**

Use one internal constructor helper in `identifiers.ts`:

```ts
type Brand<T, Name extends string> = T & { readonly __brand: Name };

function nonEmptyId<Name extends string>(value: string, name: Name): Brand<string, Name> {
  if (value.trim().length === 0) throw new Error(`${name} must be non-empty`);
  return value as Brand<string, Name>;
}
```

Expose explicit typed wrappers rather than leaking the generic helper. Define source/provenance types exactly as listed in the Interfaces block. `index.ts` re-exports public contracts only.

- [ ] **Step 4: Run primitive test and strict typecheck**

Run:

```bash
npx vitest run tests/security-domain/primitives.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add security domain primitives`

---

### Task 2: Evidence, findings, validation, lifecycle, and remediation contracts

**Files:**
- Create: `packages/security-domain/evidence/types.ts`
- Create: `packages/security-domain/remediation/types.ts`
- Create: `packages/security-domain/validation/types.ts`
- Create: `packages/security-domain/validation/transitions.ts`
- Create: `packages/security-domain/findings/types.ts`
- Create: `packages/security-domain/findings/lifecycle.ts`
- Modify: `packages/security-domain/index.ts`
- Test: `tests/security-domain/finding-lifecycle.test.ts`
- Test: `tests/security-domain/validation.test.ts`

**Interfaces:**
- Consumes: Task 1 identifiers, levels, source, provenance.
- Produces:
  - `EvidenceKind = "repository-location" | "static-analysis" | "dependency" | "http-observation" | "tls-observation" | "user-confirmed" | "artifact-reference"`
  - `ContentClassification = "public" | "internal" | "sensitive" | "secret"`
  - `EvidenceRecord`
  - `FindingLifecycleState = "open" | "acknowledged" | "in_progress" | "resolved" | "retest_pending" | "verified_fixed" | "accepted_risk" | "false_positive"`
  - `ValidationState = "unvalidated" | "static_confirmed" | "runtime_observed" | "runtime_validated" | "user_confirmed"`
  - `ValidationAuthority = "deterministic" | "human" | "advisory"`
  - `canTransitionValidation(from, to, authority): boolean`
  - `canTransitionFindingLifecycle(from, to): boolean`
  - `SecurityFinding`
  - `RemediationSummary`, `RemediationAction`, `VerificationGuidance`

- [ ] **Step 1: Write lifecycle and validation RED tests**

```ts
import { describe, expect, it } from "vitest";
import {
  canTransitionFindingLifecycle,
  canTransitionValidation,
} from "@/packages/security-domain";

describe("finding lifecycle", () => {
  it("allows explicit remediation/retest progression", () => {
    expect(canTransitionFindingLifecycle("open", "acknowledged")).toBe(true);
    expect(canTransitionFindingLifecycle("resolved", "retest_pending")).toBe(true);
    expect(canTransitionFindingLifecycle("retest_pending", "verified_fixed")).toBe(true);
  });

  it("does not silently reopen a verified finding", () => {
    expect(canTransitionFindingLifecycle("verified_fixed", "open")).toBe(false);
  });
});

describe("validation authority", () => {
  it("never lets advisory output promote validation", () => {
    expect(canTransitionValidation("unvalidated", "runtime_validated", "advisory")).toBe(false);
    expect(canTransitionValidation("static_confirmed", "user_confirmed", "advisory")).toBe(false);
  });

  it("allows deterministic runtime validation and human confirmation", () => {
    expect(canTransitionValidation("static_confirmed", "runtime_validated", "deterministic")).toBe(true);
    expect(canTransitionValidation("unvalidated", "user_confirmed", "human")).toBe(true);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/security-domain/finding-lifecycle.test.ts tests/security-domain/validation.test.ts`

Expected: FAIL because the contracts/helpers do not exist.

- [ ] **Step 3: Implement evidence/finding/remediation types and explicit transition tables**

Use explicit immutable transition maps instead of severity/order tricks. Advisory authority returns true only for a no-op validation transition. `EvidenceRecord` must carry `id`, `kind`, `provenance`, `summary`, `classification`, and optional `artifactRef`; it must not expose a generic arbitrary `metadata: Record<string, unknown>` escape hatch. `SecurityFinding` must use typed evidence references and taxonomy fields instead of scanner metadata blobs.

- [ ] **Step 4: Run focused tests plus typecheck**

```bash
npx vitest run tests/security-domain/finding-lifecycle.test.ts tests/security-domain/validation.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add security finding lifecycle contracts`

---

### Task 3: Risk relationships and provider-neutral advisory boundary

**Files:**
- Create: `packages/security-domain/relationships/types.ts`
- Create: `packages/security-domain/advisory/types.ts`
- Create: `packages/security-domain/advisory/context-policy.ts`
- Modify: `packages/security-domain/index.ts`
- Test: `tests/security-domain/advisory-context.test.ts`
- Test: `tests/security-domain/relationships.test.ts`

**Interfaces:**
- Consumes: Task 1 identifiers/provenance and Task 2 evidence/finding types.
- Produces:
  - `RiskRelationshipType = "exposes" | "reaches" | "depends_on" | "authenticates_to" | "can_lead_to" | "affects" | "mitigated_by"`
  - `SecurityEntityRef`
  - `RiskRelationship`
  - `AdvisoryPurpose = "explain-finding" | "correlate-findings" | "draft-security-story" | "clarify-remediation" | "suggest-follow-up-checks" | "assist-rule-author"`
  - `AdvisoryResultKind = "explanation" | "inference" | "relationship-suggestion" | "remediation-suggestion" | "follow-up-check-suggestion"`
  - `AdvisoryRequest`, `AdvisoryResult`, `AdvisoryService`
  - `AdvisoryContextItem`, `AdvisoryContextPolicy`, `buildAdvisoryContext(items, policy)`

- [ ] **Step 1: Write RED tests for advisory safety policy**

```ts
import { describe, expect, it } from "vitest";
import { buildAdvisoryContext } from "@/packages/security-domain";

describe("advisory context policy", () => {
  const items = [
    { id: "1", kind: "finding", summary: "public", classification: "public" as const },
    { id: "2", kind: "finding", summary: "internal", classification: "internal" as const },
    { id: "3", kind: "finding", summary: "sensitive", classification: "sensitive" as const },
    { id: "4", kind: "finding", summary: "never-send", classification: "secret" as const },
  ];

  it("always drops secret-classified context", () => {
    const result = buildAdvisoryContext(items, {
      execution: "local",
      allowSensitiveRemote: false,
      maxItems: 10,
      maxCharacters: 1000,
    });
    expect(result.map((item) => item.summary)).not.toContain("never-send");
  });

  it("requires explicit opt-in before sensitive context can reach a remote provider", () => {
    const result = buildAdvisoryContext(items, {
      execution: "remote",
      allowSensitiveRemote: false,
      maxItems: 10,
      maxCharacters: 1000,
    });
    expect(result.map((item) => item.summary)).toEqual(["public", "internal"]);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/security-domain/advisory-context.test.ts tests/security-domain/relationships.test.ts`

Expected: FAIL because advisory/relationship modules do not exist.

- [ ] **Step 3: Implement minimal relationship and advisory contracts**

`AdvisoryResult` must always include `provenance: { kind: "inferred" }` at the type level. `AdvisoryService` receives domain `AdvisoryRequest`, not provider messages/prompts. `buildAdvisoryContext` must preserve input order, drop `secret`, drop remote `sensitive` without opt-in, cap item count, and cap total emitted summary characters deterministically. It performs no I/O and does not know provider names.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
npx vitest run tests/security-domain/advisory-context.test.ts tests/security-domain/relationships.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add advisory and relationship contracts`

---

### Task 4: Deterministic Phase 3 finding adapter

**Files:**
- Create: `packages/security-domain-adapters/phase3/map-finding.ts`
- Create: `packages/security-domain-adapters/phase3/index.ts`
- Test: `tests/security-domain/phase3-finding-adapter.test.ts`

**Interfaces:**
- Consumes:
  - `Finding` from `packages/scanner-core/findings/types.ts`
  - public `security-domain` contracts from Tasks 1-3
- Produces:
  - `mapPhase3Finding(finding: Finding): { finding: SecurityFinding; evidence: EvidenceRecord[] }`
  - `mapPhase3Validation(validation: Finding["validation"]): ValidationState`

- [ ] **Step 1: Write deterministic/no-leak RED test**

Create a complete synthetic Phase 3 `Finding` with a stable fingerprint and `metadata: { privateSource: "must-not-copy" }`. Assert:

```ts
const first = mapPhase3Finding(input);
const second = mapPhase3Finding({ ...input, metadata: { other: "also-not-copy" } });

expect(first).toEqual(second);
expect(first.finding.id).toBe(`phase3:${input.fingerprint}`);
expect(first.evidence).toHaveLength(1);
expect(JSON.stringify(first)).not.toContain("must-not-copy");
expect(JSON.stringify(first)).not.toContain("also-not-copy");
expect(first.finding.provenance.kind).toBe("scanner-derived");
```

Also assert validation mapping:

```ts
expect(mapPhase3Validation("static_confirmed")).toBe("static_confirmed");
expect(mapPhase3Validation("dependency_confirmed")).toBe("static_confirmed");
expect(mapPhase3Validation("heuristic")).toBe("unvalidated");
expect(mapPhase3Validation("informational")).toBe("unvalidated");
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/security-domain/phase3-finding-adapter.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement deterministic mapping only**

Mapping rules:

```text
Phase 3 id/fingerprint      -> product id `phase3:<fingerprint>`
scanner + rule version      -> deterministic-passive-scanner source
severity/confidence         -> same vocabulary through explicit mapping functions
validation static_confirmed -> static_confirmed
validation dependency_confirmed -> static_confirmed
validation heuristic/informational -> unvalidated
finding conclusion provenance -> scanner-derived
location                    -> typed repository location
normalized evidence summary -> one typed static/dependency evidence record
CWE/OWASP/references        -> typed taxonomy fields
remediation                 -> structured deterministic remediation
metadata                    -> never copied
baseline state              -> not part of product finding lifecycle
lifecycle                   -> open
```

The mapper must not read repository files, rerun scanners, call the network, inspect environment variables, or invent runtime validation.

- [ ] **Step 4: Run adapter tests, all security-domain tests, and typecheck**

```bash
npx vitest run tests/security-domain
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: map phase 3 findings into security domain`

---

### Task 5: Enforce architecture dependency direction

**Files:**
- Create: `tests/architecture/security-domain-dependencies.test.ts`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/roadmap/FUTURE_AI_ASSISTANCE.md`

**Interfaces:**
- Consumes: completed Phase 4A package layout.
- Produces: executable architecture guard preventing forbidden imports into `packages/security-domain`.

- [ ] **Step 1: Write architecture test**

The test recursively reads only `.ts` files below `packages/security-domain` and fails if an import specifier references any forbidden boundary:

```ts
const forbidden = [
  "scanner-",
  "/cli/",
  "next",
  "react",
  "@supabase/",
  "openai",
  "anthropic",
  "gemini",
  "ollama",
];
```

Also reject direct imports from `app/`, `components/`, and `lib/supabase` aliases. Allow relative imports within `security-domain` and Node type-only/runtime-free standard modules only when justified; Phase 4A should need none.

- [ ] **Step 2: Verify the guard passes on the intended architecture**

Run: `npx vitest run tests/architecture/security-domain-dependencies.test.ts`

Expected: PASS. This is a conformance guard, not an intentional RED because the package already follows the approved dependency direction by this task.

- [ ] **Step 3: Update architecture and AI roadmap docs**

Document the one-way product boundary:

```text
scanner-core/detectors -> source adapter -> security-domain <- application services <- UI/API/workers/provider adapters
```

State explicitly that future AI consumes normalized domain records through advisory/context policy and may not import scanner internals or gain direct scanner authority.

- [ ] **Step 4: Run full type/test gate**

```bash
npm test
npm run typecheck
```

Expected: all existing Phase 1-3 tests plus new Phase 4A tests pass.

- [ ] **Step 5: Commit**

Commit message: `test: enforce security domain architecture`

---

### Task 6: Phase 4A release evidence and exact-head merge gate

**Files:**
- Modify: `docs/PHASES.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`

**Interfaces:**
- Consumes: all prior Phase 4A implementation and CI evidence.
- Produces: exact resumable project state with Phase 4B as the next design boundary.

- [ ] **Step 1: Run complete local/CI-equivalent gate before evidence docs**

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Expected: all pass. Existing Phase 3 benchmark contract remains 700 analyzed files, 0 findings, 0 errors, below the 20-second catastrophic ceiling.

- [ ] **Step 2: Perform final architecture/security review**

Block merge for any of these:

- `security-domain` imports infrastructure/scanner/provider code
- advisory type can represent confirmed/observed provenance
- advisory authority can promote validation
- generic arbitrary metadata escapes into product finding/evidence
- Phase 3 mapper copies source `metadata`
- mapper performs I/O or network work
- secret-classified advisory context can reach local or remote result context
- remote sensitive context is permitted without explicit opt-in
- Phase 3 scanner behavior/output changed unexpectedly
- unresolved review thread

- [ ] **Step 3: Update permanent state docs with measured evidence**

Record exact test count, typecheck/build result, benchmark observation, PR head SHA, no-database-change status, and next boundary. Do not claim a post-merge result before it exists.

- [ ] **Step 4: Mark implementation PR ready and require exact-head CI**

The exact final PR head must pass the complete repository CI gate. If the head changes, require a fresh run.

- [ ] **Step 5: Squash merge with expected-head protection and verify merged content**

Use squash merge with `expected_head_sha`. Confirm merged commit tree matches the verified PR tree. Verify `main` CI when the available GitHub tooling exposes the push run; otherwise record the tooling limitation explicitly and never invent verification.

- [ ] **Step 6: Finish state**

Phase 4A may be called complete only after the exact-head gate and merge verification. Phase 4B starts with verified passive runtime/API security design, reusing `security-domain`; it must not bypass Phase 2 authorization and network safety controls.

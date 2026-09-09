# Phase 8C Reproducible Technical Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic local/offline publication pipeline that validates frozen Phase 8A/8B evidence and emits canonical machine-readable JSON plus a human-readable technical report without widening ScopeForge authority.

**Architecture:** Add a focused `validation-publication` TypeScript package. A strict parser accepts one versioned evidence bundle, normalization recomputes accuracy metrics and benchmark summaries from raw evidence, and both JSON and Markdown render from the same normalized object. The first evidence bundle records already accepted Phase 8A and Phase 8B release evidence, including every Phase 8B matrix run from main CI #761.

**Tech Stack:** TypeScript 5.8, Node.js 22, Vitest 3, existing CLI TypeScript build, Node built-ins only, existing Phase 8A validation contracts and Phase 8B evidence.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-8c-reproducible-technical-publication-design.md`

## Global Constraints

- No new npm runtime dependency and no `package-lock.json` dependency drift.
- No Supabase migration, write, or client dependency.
- No network, browser, child-process, VM, worker, supervisor, repository-acquisition, or hosted-scanning authority.
- Do not modify Dashboard V5/UI paths, PR #49, or any UI branch.
- Keep all four hosted runtime capability flags false/absent and untouched.
- The 32-case Phase 8A corpus must never be described as global or real-world accuracy.
- Phase 8B catastrophic ceilings must always be labeled regression guards, never product SLOs.
- RSS delta must always be labeled observational, never peak RSS or a memory limit.
- No implicit timestamps or absolute private machine paths in canonical output.
- Canonical JSON and Markdown must be byte-identical for identical evidence input.
- Intermediate commits use `[skip ci]`; GitHub Actions is reserved for the frozen release candidate.

---

### Task 1: Evidence Contracts and Strict Parser

**Files:**
- Create: `packages/validation-publication/contracts.ts`
- Create: `packages/validation-publication/error.ts`
- Create: `packages/validation-publication/parse.ts`
- Create: `packages/validation-publication/index.ts`
- Create: `tests/validation-publication/contracts.test.ts`
- Create: `tests/validation-publication/parse.test.ts`

**Interfaces:**
- Produces: `PublicationEvidenceV1`, `NormalizedPublicationV1`, `PublicationEvidenceError`, `parsePublicationEvidence(raw: string): PublicationEvidenceV1`.
- Consumes: Node built-ins only plus stable Phase 8A field semantics copied into the publication contract.

- [ ] **Step 1: Write contract tests first**

Create tests that require `schemaVersion: 1`, exact top-level keys, 40-hex commit/tree identities, bounded strings/arrays, finite non-negative integers for counts/timings, exactly three matrix runs per Phase 8B profile, and required claim-boundary categories.

Representative failing assertions:

```ts
expect(() => parsePublicationEvidence(JSON.stringify({ schemaVersion: 2 }))).toThrowError(
  expect.objectContaining({ code: "PUBLICATION_EVIDENCE_INVALID" }),
);

expect(() => parsePublicationEvidence(validEvidence({ extra: true }))).toThrow();
expect(() => parsePublicationEvidence(validEvidence({ source: { phase8bCommit: "abc" } }))).toThrow();
```

- [ ] **Step 2: Run focused tests and witness RED locally/disposable when available**

Run:

```bash
npx vitest run tests/validation-publication/contracts.test.ts tests/validation-publication/parse.test.ts
```

Expected before implementation: FAIL because the package does not exist.

In the current ChatGPT harness the container cannot resolve GitHub, so do not burn Actions to demonstrate RED. Preserve test-first commit ordering and record this environment limitation.

- [ ] **Step 3: Implement strict v1 contracts and parser**

Contract must include:

```ts
export interface PublicationSourceIdentity {
  repository: string;
  phase8aCommit: string;
  phase8bCommit: string;
  phase8bTree: string;
  scopeforgeVersion: string;
}

export interface PublicationEvidenceV1 {
  schemaVersion: 1;
  publicationId: string;
  source: PublicationSourceIdentity;
  accuracy: PublicationAccuracyEvidence;
  performance: PublicationPerformanceEvidence;
  limitations: readonly string[];
  unsupportedScenarios: readonly string[];
  claimBoundaries: PublicationClaimBoundaries;
  reproduction: PublicationReproduction;
}
```

Parser requirements:

- JSON duplicate-key rejection using a bounded raw-text duplicate detector consistent with Phase 8A style or a focused equivalent
- exact key sets at every object level
- maximum evidence size 512 KiB
- lower-case 40-hex Git identities
- finite non-negative integer counts/timings/RSS values
- unique publication/profile/rule/case IDs
- stable string budgets, maximum 4 KiB per narrative field
- required Phase 8C claim-boundary categories
- reject absolute POSIX paths, Windows drive paths, UNC paths, and backslash traversal in reproduction/output text fields

- [ ] **Step 4: Re-run focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/validation-publication tests/validation-publication/contracts.test.ts tests/validation-publication/parse.test.ts
git commit -m "feat: add Phase 8C publication evidence contract [skip ci]"
```

---

### Task 2: Deterministic Normalization and Cross-Checks

**Files:**
- Create: `packages/validation-publication/normalize.ts`
- Create: `tests/validation-publication/normalize.test.ts`

**Interfaces:**
- Consumes: `PublicationEvidenceV1`.
- Produces: `normalizePublicationEvidence(evidence: PublicationEvidenceV1): NormalizedPublicationV1`.

- [ ] **Step 1: Write failing normalization tests**

Tests must prove:

- accuracy aggregate counts are recomputed from case outcomes
- rule counts are recomputed from rule case IDs/outcomes
- precision, recall, FPR, and F1 are recomputed from integer counts
- zero denominators produce `null`
- recorded metrics that disagree with recomputation are rejected
- contract mismatch count cannot be smaller than mismatched case count
- error and unsupported cases remain explicit
- benchmark summary is recomputed from all three raw runs
- recorded benchmark summaries that disagree are rejected
- every raw run obeys expected file/finding/error contracts
- every wall measurement remains within the recorded catastrophic ceiling
- profile IDs are exactly `dependency-lockfile-heavy-v1`, `iac-heavy-v1`, and `source-ast-heavy-v1` for the committed v1 evidence
- dependency profile requires OSV disabled and exactly 5,000 resolved lockfile components in preflight metadata
- IaC profile requires exact four expected rule counts
- source/AST profile requires exactly four `jsts/dynamic-code-execution` findings
- normalized ordering is lexical and stable

Representative test:

```ts
const normalized = normalizePublicationEvidence(evidenceFixture());
expect(normalized.performance.profiles[0].runs).toHaveLength(3);
expect(normalized.performance.profiles[0].summary.medianWallMs).toBe(
  [...normalized.performance.profiles[0].runs.map((run) => run.wallMs)].sort((a, b) => a - b)[1],
);
```

- [ ] **Step 2: Run focused normalization test and witness RED when executable preflight is available**

```bash
npx vitest run tests/validation-publication/normalize.test.ts
```

- [ ] **Step 3: Implement pure normalization**

Use integer-only count accumulation and exact raw benchmark values. Do not read files, environment variables, clocks, network, or process execution from `normalize.ts`.

Metric helper:

```ts
function metrics(counts: PublicationCounts): PublicationMetrics {
  const precisionDenominator = counts.tp + counts.fp;
  const recallDenominator = counts.tp + counts.fn;
  const fprDenominator = counts.fp + counts.tn;
  const f1Denominator = (2 * counts.tp) + counts.fp + counts.fn;
  return {
    precision: precisionDenominator === 0 ? null : counts.tp / precisionDenominator,
    recall: recallDenominator === 0 ? null : counts.tp / recallDenominator,
    falsePositiveRate: fprDenominator === 0 ? null : counts.fp / fprDenominator,
    f1: f1Denominator === 0 ? null : (2 * counts.tp) / f1Denominator,
  };
}
```

Benchmark summary helper sorts exactly three raw values and selects index 1 as median, matching Phase 8B semantics.

- [ ] **Step 4: Re-run focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/validation-publication/normalize.ts tests/validation-publication/normalize.test.ts
git commit -m "feat: normalize Phase 8C publication evidence [skip ci]"
```

---

### Task 3: Canonical JSON and Human-Readable Markdown

**Files:**
- Create: `packages/validation-publication/report-json.ts`
- Create: `packages/validation-publication/report-markdown.ts`
- Create: `tests/validation-publication/report.test.ts`
- Create: `tests/validation-publication/privacy.test.ts`

**Interfaces:**
- Consumes: `NormalizedPublicationV1`.
- Produces: `serializeTechnicalPublicationJson(result): string`, `renderTechnicalPublicationMarkdown(result): string`.

- [ ] **Step 1: Write failing determinism and privacy tests**

Require:

```ts
expect(serializeTechnicalPublicationJson(result)).toBe(serializeTechnicalPublicationJson(result));
expect(renderTechnicalPublicationMarkdown(result)).toBe(renderTechnicalPublicationMarkdown(result));
expect(json).not.toContain("/Users/private-user");
expect(json).not.toContain("C:\\Users\\private-user");
expect(markdown).not.toContain("SYNTHETIC_SECRET_SENTINEL");
```

Also require exact section presence:

- Scope and claim boundaries
- Exact provenance
- Corpus identity/hash
- Coverage and raw confusion matrix
- Per-rule results
- Error/unsupported/contract mismatch details
- Performance profile definitions
- Every raw benchmark run
- Min/median/max summaries
- Environment/toolchain
- Historical continuity benchmark
- Limitations
- Unsupported scenarios
- Reproduction instructions
- Authority statement

- [ ] **Step 2: Run focused report tests and witness RED when executable preflight is available**

```bash
npx vitest run tests/validation-publication/report.test.ts tests/validation-publication/privacy.test.ts
```

- [ ] **Step 3: Implement canonical serializers**

JSON:

```ts
export function serializeTechnicalPublicationJson(result: NormalizedPublicationV1): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
```

Markdown metric formatter:

```ts
function metric(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}
```

Do not add publication timestamps. Do not emit source snippets, finding evidence, private paths, credentials, or raw fixture content.

- [ ] **Step 4: Re-run focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/validation-publication/report-json.ts packages/validation-publication/report-markdown.ts tests/validation-publication/report.test.ts tests/validation-publication/privacy.test.ts
git commit -m "feat: render deterministic Phase 8C reports [skip ci]"
```

---

### Task 4: Safe Developer CLI and Build Integration

**Files:**
- Create: `packages/validation-publication/cli.ts`
- Modify: `packages/validation-publication/index.ts`
- Modify: `tsconfig.cli.json`
- Modify: `package.json`
- Create: `tests/validation-publication/cli.test.ts`

**Interfaces:**
- Produces: `runValidationPublicationCli(argv, options): Promise<number>`.
- npm script: `validation:publication`.

- [ ] **Step 1: Write failing CLI tests**

Cover:

- requires exactly `--evidence`, `--json`, and `--markdown`
- rejects unknown/duplicate flags
- evidence file must be a bounded regular file and not a symlink
- output parents must already exist and be real directories
- JSON and Markdown destinations must differ
- existing outputs are never overwritten
- output creation uses `O_CREAT | O_EXCL | O_NOFOLLOW` where supported
- partial output is rolled back if paired write fails
- stdout has one fixed success line
- errors expose only stable error code/message, no private absolute path

- [ ] **Step 2: Run CLI test and witness RED when executable preflight is available**

```bash
npx vitest run tests/validation-publication/cli.test.ts
```

- [ ] **Step 3: Implement CLI and integration**

Use Node `fs/promises` and the same safe-output pattern as Phase 8A `validation-accuracy/cli.ts`.

Add to `tsconfig.cli.json` include list:

```json
"packages/validation-publication/**/*.ts"
```

Add package script:

```json
"validation:publication": "npm run build:cli --silent && node .scopeforge-build/packages/validation-publication/cli.js"
```

Do not change existing `validation:accuracy`, `benchmark:scanner`, or `benchmark:matrix` commands.

- [ ] **Step 4: Re-run CLI, typecheck, and CLI build**

```bash
npx vitest run tests/validation-publication/cli.test.ts
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
```

- [ ] **Step 5: Commit**

```bash
git add packages/validation-publication package.json tsconfig.cli.json tests/validation-publication/cli.test.ts
git commit -m "feat: add Phase 8C publication CLI [skip ci]"
```

---

### Task 5: Commit Frozen Phase 8A/8B Evidence and Golden Reports

**Files:**
- Create: `validation/publication/phase-8-release-v1.evidence.json`
- Create: `docs/validation/results/phase-8-release-v1.json`
- Create: `docs/validation/reports/phase-8-release-v1.md`
- Create: `tests/validation-publication/committed-release.test.ts`

**Interfaces:**
- Consumes: frozen accepted Phase 8A corpus result and Phase 8B main CI #761 evidence.
- Produces: committed v1 evidence plus canonical golden outputs.

- [ ] **Step 1: Write failing committed-release test**

The test reads the committed evidence, parses and normalizes it, renders both outputs, and requires exact byte equality with the committed JSON and Markdown.

```ts
expect(await readFile(jsonPath, "utf8")).toBe(serializeTechnicalPublicationJson(normalized));
expect(await readFile(markdownPath, "utf8")).toBe(renderTechnicalPublicationMarkdown(normalized));
```

It also asserts:

- corpus ID/version/hash exactly match Phase 8A release
- counts TP 16 / FN 0 / FP 0 / TN 16 / error 0 / unsupported 0 / contract mismatch 0
- eight represented rules
- Phase 8B source commit `226a20739871c15d0262d1779b3b013520f47fc6`
- Phase 8B source tree `50f17f44e770f1179ed2b40b7713e14e864958c0`
- Node 22.23.2 and Ubuntu 24.04.4 evidence provenance
- all nine matrix raw runs from CI #761 are present exactly
- matrix medians dependency 2392 ms, IaC 426 ms, source/AST 1034 ms
- historical scanner-medium-v1 continuity evidence: 700 files, 0 findings/errors, 597 ms scanner, 644 ms wall, RSS delta 27738112 B

- [ ] **Step 2: Commit evidence input before generated outputs**

Build `phase-8-release-v1.evidence.json` from accepted release records only. Do not invent measurements.

Phase 8B CI #761 raw runs:

```text
dependency run 1: scanner 2426, wall 2428, RSS 1241088
dependency run 2: scanner 2391, wall 2392, RSS 4124672
dependency run 3: scanner 2350, wall 2351, RSS 3100672
IaC run 1: scanner 549, wall 588, RSS 48025600
IaC run 2: scanner 387, wall 426, RSS 524288
IaC run 3: scanner 368, wall 400, RSS 409600
source/AST run 1: scanner 1234, wall 1287, RSS 786432
source/AST run 2: scanner 978, wall 1020, RSS 131072
source/AST run 3: scanner 979, wall 1034, RSS 131072
```

- [ ] **Step 3: Generate canonical outputs with the new CLI**

```bash
mkdir -p .tmp/phase-8c
npm run validation:publication -- \
  --evidence validation/publication/phase-8-release-v1.evidence.json \
  --json .tmp/phase-8c/phase-8-release-v1.json \
  --markdown .tmp/phase-8c/phase-8-release-v1.md
cmp .tmp/phase-8c/phase-8-release-v1.json docs/validation/results/phase-8-release-v1.json
cmp .tmp/phase-8c/phase-8-release-v1.md docs/validation/reports/phase-8-release-v1.md
```

On first generation, copy the canonical outputs into the committed docs paths, then rerun the command into fresh temporary names and compare byte-for-byte.

- [ ] **Step 4: Run committed-release test twice**

```bash
npx vitest run tests/validation-publication/committed-release.test.ts
npx vitest run tests/validation-publication/committed-release.test.ts
```

Expected: both PASS with identical outputs.

- [ ] **Step 5: Commit**

```bash
git add validation/publication docs/validation/results docs/validation/reports tests/validation-publication/committed-release.test.ts
git commit -m "docs: publish frozen Phase 8 technical evidence [skip ci]"
```

---

### Task 6: Architecture Guards, Methodology, and CI-Scope Regression

**Files:**
- Create: `tests/architecture/validation-publication-dependencies.test.ts`
- Modify: `docs/validation/METHODOLOGY.md`
- Modify: `docs/development/PHASE_8_WORKING_STATE.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`
- Modify: `docs/development/TEST_STATUS.md`

**Interfaces:**
- Architecture test protects the publication package authority boundary.

- [ ] **Step 1: Write failing architecture guard first**

Read every `.ts` file in `packages/validation-publication` and reject imports/usages matching:

```text
child_process
node:vm
supabase
fetch(
WebSocket
worker_threads
runtime-network
repository-acquisition
hosted-repository
passive-runtime
active-cors
playwright
puppeteer
eval(
new Function
```

Also add a scope test that Phase 8C changed-file paths do not include dashboard/V5/UI directories or Supabase migrations.

- [ ] **Step 2: Run architecture and focused Phase 8 tests**

```bash
npx vitest run tests/architecture/validation-publication-dependencies.test.ts tests/validation-publication tests/validation-accuracy tests/benchmarks
```

- [ ] **Step 3: Update methodology and resumable docs**

`docs/validation/METHODOLOGY.md` must add a Phase 8C section that states:

- evidence capture and deterministic rendering are separate
- committed report v1 publishes already accepted Phase 8A/8B evidence
- raw benchmark runs are retained
- report normalization cross-checks raw counts and summaries
- no global accuracy claim
- no product SLO claim
- RSS delta observational only
- reproduction command
- authority boundary

Development docs must record current Phase 8C branch/head and exact test evidence, but must not claim gates that were not executed.

- [ ] **Step 4: Commit**

```bash
git add tests/architecture/validation-publication-dependencies.test.ts docs/validation/METHODOLOGY.md docs/development/PHASE_8_WORKING_STATE.md docs/development/IMPLEMENTATION_LOG.md docs/development/TEST_STATUS.md
git commit -m "docs: document Phase 8C publication methodology [skip ci]"
```

---

### Task 7: Frozen Candidate Verification and Release

**Files:**
- Modify only if verification finds a real defect.
- Final post-merge docs checkpoint may update the development handoff files listed by the Phase 8B release pattern.

- [ ] **Step 1: Verify exact base-to-head diff**

```bash
git diff --check main...HEAD
git diff --name-status main...HEAD
git diff main...HEAD -- package-lock.json supabase app components
```

Require:

- no conflict markers or trailing whitespace
- no `package-lock.json` change
- no Supabase migration/client drift
- no dashboard/V5/UI path changes
- no production worker flag changes
- no network/subprocess/browser authority
- no source/secret/private-path leakage

- [ ] **Step 2: Run focused and repository-wide preflight**

```bash
npx vitest run tests/validation-publication tests/validation-accuracy tests/benchmarks tests/architecture/validation-publication-dependencies.test.ts
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run validation:accuracy -- --corpus validation/corpus/offline-v1 --commit <HEAD40> --json <tmp.json> --markdown <tmp.md>
npm run benchmark:scanner
npm run benchmark:matrix
npm audit --audit-level=info
npm run build
```

Run the publication renderer twice against the committed evidence into fresh outputs and compare both JSON and Markdown byte-for-byte.

- [ ] **Step 3: Freeze exact release-candidate head**

No further executable change after this point unless verification reveals a real defect. Any defect fix requires re-running the affected preflight gates.

- [ ] **Step 4: Open/update draft PR and review exact diff**

PR title:

`Phase 8C reproducible technical publication`

PR body must summarize architecture, claim boundaries, exact frozen evidence sources, authority review, executed verification, and any harness limitation.

- [ ] **Step 5: Verify exact-head Vercel Preview READY**

Confirm deployment SHA equals the frozen PR head and `aliasError=null`.

- [ ] **Step 6: Run one substantive final GitHub Actions candidate**

Do not deliberately generate a RED run. Diagnose any failure before deciding whether a rerun is justified.

Final Actions must cover the repository CI workflow including tests, typecheck, CLI build/version, historical benchmark, Phase 8B matrix, and production build. Publication tests are part of the normal test suite.

- [ ] **Step 7: Recheck exact head/base immediately before merge**

Require the verified PR head and base identities to be unchanged.

- [ ] **Step 8: Squash merge**

Merge only the exact verified head. Do not touch or retarget PR #49.

- [ ] **Step 9: Verify post-merge main**

Confirm:

- main contains the exact accepted executable tree
- post-merge CI succeeds
- production deployment for the merge commit reaches READY and includes `scopeforge.dev`
- all hosted runtime flags remain false/absent

- [ ] **Step 10: Create docs-only release/handoff checkpoint**

Update:

- `docs/development/CURRENT_STATE.md`
- `docs/development/IMPLEMENTATION_LOG.md`
- `docs/development/NEXT_STEPS.md`
- `docs/development/PHASE_8_WORKING_STATE.md`
- `docs/development/SESSION_HANDOFF.md`
- `docs/development/TEST_STATUS.md`
- `docs/development/UNFINISHED_WORK.md`
- create `docs/development/PHASE_8C_RELEASE_STATE.md`

Commit message:

```text
docs: record Phase 8C release and next handoff [skip ci]
```

The checkpoint must distinguish feature-merge executable identity from the docs-only handoff commit.

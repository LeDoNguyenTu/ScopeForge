# Phase 8B Performance Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three deterministic, correctness-gated local scanner benchmark profiles with repeated measurements and attributable performance evidence while preserving the historical `scanner-medium-v1` benchmark unchanged.

**Architecture:** Add a shared ESM benchmark harness under `benchmarks/matrix/`, three isolated fixture/profile modules, and one matrix entrypoint. The harness reuses the compiled local ScopeForge CLI in-process, enforces exact correctness contracts before accepting timing data, and emits raw runs plus simple min/median/max summaries. SCA OSV remains explicitly disabled and the dependency profile performs a separate 5,000-component parser preflight before timing.

**Tech Stack:** Node.js 22 ESM, existing ScopeForge TypeScript scanners/CLI compiled by `npm run build:cli`, Vitest `.test.mjs`, built-in Node `fs/promises`, `crypto`, `os`, `path`, and `perf_hooks`. No dependency additions.

**Spec:** `docs/superpowers/specs/2026-09-06-phase-8b-performance-matrix-design.md`

## Global Constraints

- `benchmarks/scanner-medium-fixture.mjs` and `benchmarks/scanner-medium.mjs` must remain byte-for-byte unchanged.
- Phase 8B is local/offline only. No Supabase, hosted, worker, runtime-network, browser, or V5/UI authority may be added.
- OSV is explicitly disabled in the dependency profile.
- No new npm dependencies or `package-lock.json` changes.
- New fixture builders are deterministic and use no randomness, time, environment secrets, network, package installation, or target-code execution.
- Run exactly three measurements per profile.
- Record RSS delta but do not gate on it.
- Catastrophic wall ceilings are regression guards, not product SLOs.
- Intermediate commits use `[skip ci]`; reserve one substantive final Actions run for the fully preflighted release tree.
- Preserve all production worker capability flags as false/absent.
- Preserve all active dashboard V5/UI branches and PR #49.

---

### Task 1: Shared benchmark measurement contract and validator

**Files:**
- Create: `benchmarks/matrix/harness.mjs`
- Create: `tests/benchmarks/matrix-harness.test.mjs`

**Interfaces:**
- Produce `countFindingRules(findings)` -> plain object keyed by rule ID with integer counts.
- Produce `validateTimedScan({ profile, parsed, stderr, wallMs, rssDeltaBytes })` -> normalized run payload without `run`.
- Produce `summarizeRuns(runs)` -> `{ minWallMs, medianWallMs, maxWallMs, medianScanDurationMs, maxRssDeltaBytes }`.
- Produce `runBenchmarkProfile(profile, dependencies?)` -> `{ fixture, runs, maxWallMs, summary }`.
- A profile has `{ id, expectedFiles, expectedFindingRuleCounts, maxWallMs, buildFixture, preflight }`.
- `runBenchmarkProfile` defaults to exactly three runs and uses the compiled `runCli` via `createRequire`.

- [ ] **Step 1: Write validator and summary RED tests**

Create `tests/benchmarks/matrix-harness.test.mjs` with focused pure tests. The minimum cases are:

```js
import { describe, expect, it } from "vitest";
import {
  countFindingRules,
  summarizeRuns,
  validateTimedScan,
} from "../../benchmarks/matrix/harness.mjs";

const profile = {
  id: "example-v1",
  expectedFiles: 3,
  expectedFindingRuleCounts: { "jsts/dynamic-code-execution": 2 },
  maxWallMs: 1000,
};

it("accepts exact files/findings/errors and normalizes the measurement", () => {
  const parsed = {
    inventory: { filesAnalyzed: 3 },
    findings: [
      { ruleId: "jsts/dynamic-code-execution" },
      { ruleId: "jsts/dynamic-code-execution" },
    ],
    errors: [],
    scan: { durationMs: 12 },
  };
  expect(validateTimedScan({ profile, parsed, stderr: "", wallMs: 15, rssDeltaBytes: 1024 })).toEqual({
    filesAnalyzed: 3,
    findings: 2,
    errors: 0,
    findingRuleCounts: { "jsts/dynamic-code-execution": 2 },
    scanDurationMs: 12,
    wallMs: 15,
    rssDeltaBytes: 1024,
  });
});

it("summarizes exactly three integer runs", () => {
  expect(summarizeRuns([
    { wallMs: 30, scanDurationMs: 20, rssDeltaBytes: 100 },
    { wallMs: 10, scanDurationMs: 8, rssDeltaBytes: 300 },
    { wallMs: 20, scanDurationMs: 15, rssDeltaBytes: 200 },
  ])).toEqual({
    minWallMs: 10,
    medianWallMs: 20,
    maxWallMs: 30,
    medianScanDurationMs: 15,
    maxRssDeltaBytes: 300,
  });
});
```

Add rejection tests for:

- missing expected finding
- unexpected rule ID
- non-empty scanner errors
- non-empty stderr
- wrong file count
- invalid/negative scan duration
- negative/non-finite wall time
- wall time above `profile.maxWallMs`
- negative/non-finite RSS delta
- run count not equal to three in `summarizeRuns`

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run tests/benchmarks/matrix-harness.test.mjs
```

Expected: FAIL because `benchmarks/matrix/harness.mjs` does not exist.

- [ ] **Step 3: Implement the pure contract functions**

Create `benchmarks/matrix/harness.mjs` with:

```js
export const RUNS_PER_PROFILE = 3;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function countFindingRules(findings) {
  const counts = new Map();
  for (const finding of findings) {
    if (!finding || typeof finding.ruleId !== "string") throw new Error("benchmark finding lacks a ruleId");
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => compareText(a, b)));
}

function sameRuleCounts(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(
    Object.fromEntries(Object.entries(expected).sort(([a], [b]) => compareText(a, b)))
  );
}

export function validateTimedScan({ profile, parsed, stderr, wallMs, rssDeltaBytes }) {
  const filesAnalyzed = parsed?.inventory?.filesAnalyzed;
  const findings = Array.isArray(parsed?.findings) ? parsed.findings : null;
  const errors = Array.isArray(parsed?.errors) ? parsed.errors : null;
  const scanDurationMs = parsed?.scan?.durationMs;
  if (filesAnalyzed !== profile.expectedFiles) throw new Error(`benchmark ${profile.id} analyzed-file contract changed`);
  if (findings === null || errors === null) throw new Error(`benchmark ${profile.id} output shape is invalid`);
  if (errors.length !== 0) throw new Error(`benchmark ${profile.id} emitted scanner errors`);
  if (stderr.trim() !== "") throw new Error(`benchmark ${profile.id} emitted stderr`);
  const findingRuleCounts = countFindingRules(findings);
  if (!sameRuleCounts(findingRuleCounts, profile.expectedFindingRuleCounts)) {
    throw new Error(`benchmark ${profile.id} finding contract changed`);
  }
  if (!Number.isFinite(scanDurationMs) || scanDurationMs < 0) throw new Error(`benchmark ${profile.id} scan duration is invalid`);
  if (!Number.isFinite(wallMs) || wallMs < 0) throw new Error(`benchmark ${profile.id} wall time is invalid`);
  if (wallMs > profile.maxWallMs) throw new Error(`benchmark ${profile.id} exceeded catastrophic wall ceiling`);
  if (!Number.isFinite(rssDeltaBytes) || rssDeltaBytes < 0) throw new Error(`benchmark ${profile.id} RSS delta is invalid`);
  return { filesAnalyzed, findings: findings.length, errors: errors.length, findingRuleCounts, scanDurationMs, wallMs, rssDeltaBytes };
}
```

Implement `summarizeRuns` using raw numeric ascending sorts and the middle item at index 1, and reject any array whose length is not 3.

- [ ] **Step 4: Implement profile execution**

In the same module:

- import `mkdtemp`, `rm` from `node:fs/promises`
- import `createRequire` from `node:module`
- import `tmpdir` from `node:os`
- import `join` from `node:path`
- import `performance` from `node:perf_hooks`
- default dependencies load `runCli` from `../../.scopeforge-build/packages/cli/run-cli.js`
- build the fixture once
- await `profile.preflight(root)` once
- perform exactly three scans using `runCli(["scan", root, "--format", "json"], { io })`
- measure `process.memoryUsage().rss` before/after and `performance.now()` around only `runCli`
- parse stdout as JSON
- call `validateTimedScan`
- attach `run: index + 1`
- remove the fixture root in `finally`

Make `runBenchmarkProfile(profile, dependencies = {})` dependency-injectable for unit tests with optional `runCliImpl`, `makeTempRoot`, and `removeTempRoot` overrides.

- [ ] **Step 5: Run GREEN**

Run:

```bash
npx vitest run tests/benchmarks/matrix-harness.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message:

```text
test: add Phase 8B benchmark harness [skip ci]
```

---

### Task 2: Source/AST-heavy JSTS profile

**Files:**
- Create: `benchmarks/matrix/source-ast-heavy-fixture.mjs`
- Create: `tests/benchmarks/source-ast-heavy-fixture.test.mjs`

**Interfaces:**
- Export `SOURCE_AST_HEAVY_PROFILE` with id `source-ast-heavy-v1`.
- Export `buildSourceAstHeavyFixture(root)`.
- Expected files: 1,201.
- Expected findings: `{ "jsts/dynamic-code-execution": 4 }`.
- Ceiling: 30,000 ms.

- [ ] **Step 1: Write RED fixture tests**

The test builds the fixture twice in independent temporary roots and computes a SHA-256 digest from raw-text-sorted relative paths plus file bytes. Require:

```js
expect(first.digest).toBe(second.digest);
expect(first.files).toBe(1201);
expect(SOURCE_AST_HEAVY_PROFILE.id).toBe("source-ast-heavy-v1");
expect(SOURCE_AST_HEAVY_PROFILE.expectedFiles).toBe(1201);
expect(SOURCE_AST_HEAVY_PROFILE.expectedFindingRuleCounts).toEqual({
  "jsts/dynamic-code-execution": 4,
});
```

Also inspect `.scopeforge.json` and require exactly `scanners: ["jsts"]` and `rules.include: ["jsts/dynamic-code-execution"]`.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/benchmarks/source-ast-heavy-fixture.test.mjs
```

Expected: FAIL because the fixture module does not exist.

- [ ] **Step 3: Implement deterministic dense source generation**

Use 600 `.ts` and 600 `.js` files. Every file contains eight deterministic functions shaped like:

```js
export function transform000_0(input) {
  const values = [0, 1, 2, 3, 4, 5, 6, 7];
  const mapped = values.map((value) => ({ value, doubled: value * 2, input }));
  const filtered = mapped.filter((item) => item.doubled % 3 !== 0);
  return filtered.reduce((total, item) => total + item.doubled, 0);
}
```

Use stable zero-padded file names.

For exactly four known files, append exactly one supported sentinel:

- `src/ts/module-000.ts`: `eval("1 + 1");`
- `src/ts/module-001.ts`: `eval("2 + 2");`
- `src/js/module-000.js`: `const generatedOne = new Function("return 1"); generatedOne();`
- `src/js/module-001.js`: `const generatedTwo = new Function("return 2"); generatedTwo();`

Write root `.scopeforge.json` selecting JSTS and the one rule.

The profile `preflight` is a no-op returning `undefined`; timed sentinel findings provide the correctness proof.

- [ ] **Step 4: Run fixture GREEN**

```bash
npx vitest run tests/benchmarks/source-ast-heavy-fixture.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run real compiled profile once via a temporary probe**

Build CLI and invoke `runBenchmarkProfile(SOURCE_AST_HEAVY_PROFILE)` from Node. If the exact finding/file contract differs, inspect scanner behavior before changing the fixture contract. Do not weaken correctness expectations merely to obtain a timing.

Commands:

```bash
npm run build:cli
node --input-type=module -e 'import { runBenchmarkProfile } from "./benchmarks/matrix/harness.mjs"; import { SOURCE_AST_HEAVY_PROFILE } from "./benchmarks/matrix/source-ast-heavy-fixture.mjs"; console.log(JSON.stringify(await runBenchmarkProfile(SOURCE_AST_HEAVY_PROFILE)))'
```

Expected: three successful runs, exact 1,201 files and four dynamic-code findings each.

- [ ] **Step 6: Commit**

```text
feat: add source AST benchmark profile [skip ci]
```

---

### Task 3: Dependency/lockfile-heavy SCA profile

**Files:**
- Create: `benchmarks/matrix/dependency-lockfile-heavy-fixture.mjs`
- Create: `tests/benchmarks/dependency-lockfile-heavy-fixture.test.mjs`

**Interfaces:**
- Export `DEPENDENCY_LOCKFILE_HEAVY_PROFILE` with id `dependency-lockfile-heavy-v1`.
- Export `buildDependencyLockfileHeavyFixture(root)`.
- Export `DEPENDENCY_COMPONENT_COUNT = 5000`.
- Expected analyzed files: 3.
- Expected findings: `{}`.
- Ceiling: 20,000 ms.
- `preflight(root)` uses compiled inventory/SCA APIs and requires exactly 5,000 parsed components.

- [ ] **Step 1: Write RED tests**

Require deterministic tree digest, exactly three files, explicit SCA-only config with OSV false, and a parsed JSON lockfile containing exactly 5,001 `packages` keys including the root entry.

Require every generated non-root entry to have a stable `node_modules/bench-package-xxxxx` location and a non-empty exact version.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/benchmarks/dependency-lockfile-heavy-fixture.test.mjs
```

Expected: missing module failure.

- [ ] **Step 3: Implement lockfile generator**

Generate:

```js
const packages = {
  "": {
    name: "scopeforge-dependency-benchmark",
    version: "1.0.0",
    dependencies: {},
  },
};
for (let index = 0; index < 5000; index += 1) {
  const name = `bench-package-${String(index).padStart(5, "0")}`;
  packages[`node_modules/${name}`] = { version: `1.${index % 100}.${Math.floor(index / 100)}` };
}
```

`package.json` contains only the root package identity and no install scripts.

`.scopeforge.json` is exactly the supported v1 shape selecting `sca` and `sca.osv.enabled=false`.

Before writing `package-lock.json`, compute `Buffer.byteLength(serialized, "utf8")` and throw if it is `>= 2 * 1024 * 1024`.

- [ ] **Step 4: Implement compiled preflight**

Inside the profile's async `preflight(root)` use `createRequire(import.meta.url)` to load:

```text
../../.scopeforge-build/packages/scanner-core/inventory/build-inventory.js
../../.scopeforge-build/packages/scanner-sca/inventory.js
```

Call `buildRepositoryInventory(root)` then `collectNpmDependencies(inventory)` and require:

- `inventory.summary.filesAnalyzed === 3`
- `result.errors.length === 0`
- `result.components.length === 5000`
- every component has `sourceFile === "package-lock.json"`
- every component has `certainty === "resolved"`

Throw a fixed benchmark-contract error when any invariant fails.

- [ ] **Step 5: Run GREEN and real profile**

```bash
npx vitest run tests/benchmarks/dependency-lockfile-heavy-fixture.test.mjs
npm run build:cli
node --input-type=module -e 'import { runBenchmarkProfile } from "./benchmarks/matrix/harness.mjs"; import { DEPENDENCY_LOCKFILE_HEAVY_PROFILE as profile } from "./benchmarks/matrix/dependency-lockfile-heavy-fixture.mjs"; console.log(JSON.stringify(await runBenchmarkProfile(profile)))'
```

Expected: fixture tests pass; real profile has three runs, 3 files, zero findings/errors, and preflight proves 5,000 parsed components.

- [ ] **Step 6: Commit**

```text
feat: add dependency lockfile benchmark profile [skip ci]
```

---

### Task 4: IaC-heavy profile

**Files:**
- Create: `benchmarks/matrix/iac-heavy-fixture.mjs`
- Create: `tests/benchmarks/iac-heavy-fixture.test.mjs`

**Interfaces:**
- Export `IAC_HEAVY_PROFILE` with id `iac-heavy-v1`.
- Export `buildIacHeavyFixture(root)`.
- Expected files: 601.
- Expected exact finding counts: one finding for each selected IaC rule.
- Ceiling: 30,000 ms.

- [ ] **Step 1: Write RED tests**

Require two builds to have identical SHA-256 tree digests and exactly:

- 150 Dockerfiles
- 150 Kubernetes manifests
- 150 Terraform files
- 150 workflow files
- one `.scopeforge.json`

Require profile rule counts:

```js
{
  "iac/docker-floating-base-image": 1,
  "iac/github-actions-write-all-permissions": 1,
  "iac/kubernetes-privileged-container": 1,
  "iac/terraform-aws-public-rds": 1,
}
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/benchmarks/iac-heavy-fixture.test.mjs
```

Expected: missing module failure.

- [ ] **Step 3: Implement deterministic IaC builders**

For indices 0-149 generate:

- `docker/NNN/Dockerfile.NNN`: multi-stage Node build; only index 0 uses `FROM node:latest`, all others use `node:22.18.0`.
- `k8s/deployment-NNN.yaml`: deployment with two containers and security contexts; only index 0 sets one container `privileged: true`, all others explicitly use `false`.
- `terraform/rds-NNN.tf`: `aws_db_instance` plus adjacent safe fields; only index 0 has `publicly_accessible = true`, all others false.
- `.github/workflows/benchmark-NNN.yml`: two jobs; only index 0 has workflow `permissions: write-all`, all others have `contents: read`.

Write `.scopeforge.json` selecting `iac` and exactly the four rules from the spec.

The profile preflight is a no-op; exact timed findings prove all four parser/rule families execute.

- [ ] **Step 4: Run GREEN and real profile**

```bash
npx vitest run tests/benchmarks/iac-heavy-fixture.test.mjs
npm run build:cli
node --input-type=module -e 'import { runBenchmarkProfile } from "./benchmarks/matrix/harness.mjs"; import { IAC_HEAVY_PROFILE } from "./benchmarks/matrix/iac-heavy-fixture.mjs"; console.log(JSON.stringify(await runBenchmarkProfile(IAC_HEAVY_PROFILE)))'
```

Expected: three runs, 601 files, four exact findings, zero errors.

- [ ] **Step 5: Commit**

```text
feat: add IaC benchmark profile [skip ci]
```

---

### Task 5: Matrix runner, output contract, and package script

**Files:**
- Create: `benchmarks/scanner-matrix.mjs`
- Create: `tests/benchmarks/scanner-matrix.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Export `MATRIX_PROFILES` from `benchmarks/scanner-matrix.mjs` in raw-text ID order.
- Export `runBenchmarkMatrix(profiles = MATRIX_PROFILES)` -> `{ schemaVersion: 1, runsPerProfile: 3, profiles }`.
- Executing the module directly prints exactly `SCOPEFORGE_BENCHMARK_MATRIX <json>\n` on success.

- [ ] **Step 1: Write RED matrix tests**

Tests require:

```js
expect(MATRIX_PROFILES.map((profile) => profile.id)).toEqual([
  "dependency-lockfile-heavy-v1",
  "iac-heavy-v1",
  "source-ast-heavy-v1",
]);
```

Inject stub profiles/harness execution to verify the returned schema is version 1, `runsPerProfile` is 3, profile result order is stable, and duplicate profile IDs are rejected before any run begins.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/benchmarks/scanner-matrix.test.mjs
```

Expected: missing matrix module.

- [ ] **Step 3: Implement the runner**

Import the three profiles and `RUNS_PER_PROFILE`, `runBenchmarkProfile`. Raw-text sort profiles by ID once. Reject duplicate IDs using a `Set`.

Run profiles sequentially, not in parallel, so RSS and wall measurements do not contend with another benchmark profile in the same process.

Use direct-entry detection:

```js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBenchmarkMatrix()
    .then((result) => process.stdout.write(`SCOPEFORGE_BENCHMARK_MATRIX ${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
```

- [ ] **Step 4: Add package script**

Add only:

```json
"benchmark:matrix": "node benchmarks/scanner-matrix.mjs"
```

Do not touch dependencies or lockfile.

- [ ] **Step 5: Run focused GREEN**

```bash
npx vitest run tests/benchmarks
npm run typecheck
npm run build:cli
npm run benchmark:matrix
```

Expected: all benchmark tests pass and the real matrix emits one `SCOPEFORGE_BENCHMARK_MATRIX` line with three profiles and three runs/profile.

Capture actual runtime. Do not add the matrix to permanent CI yet.

- [ ] **Step 6: Commit**

```text
feat: add Phase 8B benchmark matrix runner [skip ci]
```

---

### Task 6: Decide permanent CI integration from measured cost

**Files:**
- Modify only if accepted by measured evidence: `.github/workflows/ci.yml`
- Test: existing benchmark tests plus exact workflow source review

**Interfaces:**
- Historical `npm run benchmark:scanner` remains unchanged and present.
- If accepted, new step immediately after it runs `npm run benchmark:matrix`.

- [ ] **Step 1: Measure exact matrix cost in disposable Linux**

On the exact Task 5 head run:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build:cli
/usr/bin/time -f 'MATRIX_WALL_SECONDS=%e MATRIX_MAX_RSS_KB=%M' npm run benchmark:matrix
```

Record the matrix JSON and outer process wall/RSS evidence.

- [ ] **Step 2: Apply the CI decision rule**

Add the permanent CI step only if all are true:

- every profile correctness gate passes
- every profile is below its catastrophic ceiling on all three runs
- total matrix command wall time is <= 30 seconds on the disposable Linux verifier
- no network call is observed/required
- the command does not materially increase install/build work because it reuses the existing compiled CLI

If total wall time exceeds 30 seconds, do **not** shrink fixtures. Leave `.github/workflows/ci.yml` unchanged, document the measured cost, and carry cadence selection to Phase 8C/release engineering.

- [ ] **Step 3A: If accepted, write a workflow regression test first**

Create/extend a small architecture/workflow test under `tests/benchmarks/` that reads `.github/workflows/ci.yml` and requires `npm run benchmark:scanner` to appear before `npm run benchmark:matrix`.

Run RED before editing the workflow.

- [ ] **Step 3B: If accepted, add the CI step and run GREEN**

Add:

```yaml
- name: Run scanner performance matrix
  run: npm run benchmark:matrix
```

immediately after the existing historical scanner benchmark step.

Run the workflow test and full benchmark tests.

- [ ] **Step 3C: If not accepted, create no workflow mutation**

Instead add a test/document assertion that the benchmark script exists and remains manually/release runnable. Do not create an intentionally failing CI expectation.

- [ ] **Step 4: Commit**

Accepted path:

```text
ci: enforce Phase 8B performance matrix [skip ci]
```

Non-accepted path:

```text
docs: record Phase 8B matrix cadence decision [skip ci]
```

---

### Task 7: Methodology and resumable state

**Files:**
- Modify: `docs/validation/METHODOLOGY.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/PHASE_8_WORKING_STATE.md`

**Interfaces:**
- Record exact measured results only from the current candidate SHA.
- Preserve the Phase 8A corpus non-claim and all runtime/UI isolation statements.
- Set Phase 8C publication as next only after Phase 8B release integration succeeds; before merge, describe Phase 8B as candidate/in release gates.

- [ ] **Step 1: Update methodology with the matrix protocol**

Document:

- three fixture IDs and shapes
- three runs/profile
- exact correctness contracts
- raw run output and min/median/max summary meaning
- RSS delta limitation
- catastrophic ceiling vs product SLO distinction
- CI cadence decision and its measured rationale
- environment provenance requirements

- [ ] **Step 2: Update working/test state with actual evidence**

Record exact candidate SHA, exact matrix JSON values, total matrix wall time, focused/full verification state, and whether CI integration was accepted by the <=30-second rule.

Do not pre-write final CI or merge success.

- [ ] **Step 3: Run docs-sensitive verification**

```bash
npx vitest run tests/benchmarks tests/validation-accuracy tests/architecture/validation-accuracy-dependencies.test.ts
npm run typecheck
npm run build:cli
npm run benchmark:scanner
npm run benchmark:matrix
```

Expected: PASS.

- [ ] **Step 4: Commit**

```text
docs: record Phase 8B performance evidence [skip ci]
```

---

### Task 8: Freeze, full preflight, review, one CI gate, and merge

**Files:**
- No feature files after candidate freeze unless a diagnosed defect requires repair.
- Update PR metadata only during release reconciliation.
- Post-merge update the same central state docs with the observed merge/deployment IDs.

- [ ] **Step 1: Freeze one exact candidate tree**

Capture branch head and tree SHA. From this point, do not add source changes unless preflight identifies a concrete defect.

- [ ] **Step 2: Run complete disposable Linux preflight**

Run against the frozen exact SHA:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx vitest run tests/benchmarks tests/validation-accuracy tests/architecture/validation-accuracy-dependencies.test.ts
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run benchmark:matrix
npm audit --audit-level=info
NODE_ENV=production npm run build
```

Require all commands to pass. Capture the complete matrix JSON and benchmark outputs.

- [ ] **Step 3: Review base-to-head scope and hygiene**

Require:

- `main` has not unexpectedly advanced, or reconcile it before release
- no dashboard/V5 changes
- no Supabase migrations
- no runtime worker/network/repository acquisition authority
- no dependency or lockfile drift
- historical medium benchmark files are byte-identical to base
- no conflict markers or added trailing whitespace
- no network primitives in new benchmark modules

- [ ] **Step 4: Open one draft PR**

Title:

```text
Phase 8B scanner performance matrix
```

Body includes exact head/tree, all three profile contracts, actual measurements, CI-cadence decision, security/authority scope, and the statement that ceilings are not product SLOs.

- [ ] **Step 5: Create one tree-identical verification commit and trigger one substantive CI run**

While PR is draft, create a commit with the same tree and message:

```text
chore: verify Phase 8B release candidate
```

Push it, then mark the PR ready. Confirm any draft synchronize run is skipped and only the ready-for-review validation job runs.

- [ ] **Step 6: Require final exact-head acceptance**

Require:

- exact final head unchanged
- exact base unchanged/reconciled
- PR mergeable
- zero unresolved review threads/change requests
- final Actions run success
- if matrix was accepted into CI, final logs show the matrix step success
- exact final-head Vercel Preview READY

- [ ] **Step 7: Squash merge with expected-head protection**

Use squash title:

```text
feat: add Phase 8B scanner performance matrix [skip ci]
```

Include covered performance evidence and the non-SLO statement in the commit body. Use expected-head protection.

- [ ] **Step 8: Verify production and reconcile post-merge docs**

Require the exact merge SHA to appear on `main` and the corresponding production Vercel deployment to become READY with `aliasError=null` and `scopeforge.dev` alias present.

Create one atomic docs-only `[skip ci]` checkpoint on `main` recording:

- final accepted head
- CI merge ref/run/totals
- squash merge SHA
- exact profile measurements
- production deployment ID
- Phase 8C as next
- runtime flags still disabled
- V5/UI still isolated

- [ ] **Step 9: Branch cleanup only with a true delete-ref action**

If the connected GitHub tool surface exposes a real remote delete-ref operation, delete only `feat/phase-8b-performance-matrix-v1` after verified integration. Otherwise leave it intact and document the limitation. Never force-move a branch to simulate deletion.

## Definition of done

Phase 8B is complete only when the historical medium benchmark is unchanged, all three new fixtures are deterministic, exact correctness sentinels pass, the 5,000-component lockfile preflight passes with OSV disabled, three raw runs/profile are emitted, catastrophic ceilings are enforced without SLO language, the CI cadence decision is evidence-based, full verification and one final exact-head Linux gate are green, production is READY, and the handoff identifies Phase 8C as next.

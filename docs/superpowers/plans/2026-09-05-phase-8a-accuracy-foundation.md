# Phase 8A Accuracy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ScopeForge's first versioned offline labeled corpus and deterministic rule-level accuracy evaluator, producing privacy-safe JSON and Markdown evidence without widening scanner, network, hosted, worker, Supabase, browser, or UI authority.

**Architecture:** Add a framework-independent `packages/validation-accuracy` package that strictly loads ground truth, constructs exactly one existing built-in scanner for each case's target rule, scans the case repository through the existing bounded inventory and safe readers, classifies one case into TP/FN/FP/TN/error, aggregates rule-level metrics, and renders deterministic reports from one normalized result. The committed `validation/corpus/offline-v1` corpus is ground truth and is never rewritten from scanner output.

**Tech Stack:** TypeScript 5.8, Node.js 22, Vitest 3, existing `yaml` 2.9 parser for duplicate-key detection, existing scanner-core inventory/coordinator contracts, existing scanner-secrets/scanner-jsts/scanner-iac implementations, CommonJS CLI build output.

**Spec:** `docs/superpowers/specs/2026-09-05-phase-8-validation-accuracy-design.md`

## Global Constraints

- Work on an isolated Phase 8A implementation branch created from the exact design/plan head. Do not implement on `main`.
- Keep the PR draft throughout implementation. Intermediate commits use `[skip ci]` unless a hosted confirmation is specifically required.
- Do not deliberately push RED commits just to make GitHub Actions fail. Establish RED and GREEN in the disposable Linux preflight environment first.
- Add no runtime dependency and no package-lock dependency delta.
- Do not add Supabase migrations, RLS/auth changes, hosted mutation authority, runtime-network imports, worker capability, browser authority, active runtime profiles, or hosted Security Pack activation.
- Do not modify `app/dashboard/**`, Command Center source, PR #49, `preview/command-center-v5-*`, `diag/v5-*`, or other active V5/UI branches.
- Accuracy evaluation is offline. OSV must remain disabled and the evaluator must have no generic network path.
- Target case repositories are hostile input: no execution, package installation, lifecycle hooks, shell commands, container execution, build systems, or target imports.
- Use `buildRepositoryInventory` plus existing scanner safe readers. Ground-truth manifests require their own bounded no-follow identity checks.
- Scanner errors and incomplete inventory coverage must never become TN or FN.
- The unit of the confusion matrix is one case for one exact rule. Duplicate findings do not increase TP/FP counts.
- Machine-readable ground truth is authoritative and separate from generated output. There is no label-update command.
- Reports must not contain source snippets, raw synthetic secret values, absolute local roots, or arbitrary finding evidence.
- Rule-level results are primary. Any aggregate must be labeled as covered-corpus-only and must never be described as universal ScopeForge accuracy.
- Final release requires local/disposable preflight first, then one exact-head GitHub-hosted Linux gate. Diagnose any failure before another CI run.

---

## File responsibility map

| File | Responsibility |
| --- | --- |
| `packages/validation-accuracy/contracts.ts` | Frozen corpus/case/result types and fixed v1 limits |
| `packages/validation-accuracy/error.ts` | Stable privacy-safe `ValidationAccuracyError` |
| `packages/validation-accuracy/safe-read.ts` | Bounded no-follow identity-checked manifest reads |
| `packages/validation-accuracy/parse.ts` | Strict corpus/case JSON parsing and canonical path validation |
| `packages/validation-accuracy/scanners.ts` | Closed mapping from validated scanner/rule IDs to one existing offline scanner |
| `packages/validation-accuracy/evaluate.ts` | Case execution and TP/FN/FP/TN/error/contract classification |
| `packages/validation-accuracy/metrics.ts` | Deterministic integer aggregation and derived metrics |
| `packages/validation-accuracy/report-json.ts` | Canonical privacy-safe JSON serialization |
| `packages/validation-accuracy/report-markdown.ts` | Markdown rendered only from normalized result |
| `packages/validation-accuracy/cli.ts` | Developer/release command adapter, not public `scopeforge` CLI |
| `packages/validation-accuracy/index.ts` | Reviewed package exports |
| `validation/corpus/offline-v1/corpus.json` | Authoritative ordered v1 corpus index |
| `validation/corpus/offline-v1/cases/**` | Versioned case manifests, rationale, and small local repositories |
| `tests/validation-accuracy/**` | Parser, evaluator, metrics, privacy, integration, and authority regressions |
| `tests/architecture/validation-accuracy-dependencies.test.ts` | Permanent forbidden-authority dependency guard |
| `package.json` | Add `validation:accuracy` developer script only |
| `tsconfig.cli.json` | Compile validation package and required offline scanner packages |
| `docs/validation/METHODOLOGY.md` | Record the concrete offline-v1 evaluator/corpus contract once implemented |
| `docs/development/PHASE_8_WORKING_STATE.md` | Resumable Phase 8 execution state and exact verification evidence |

---

## Initial offline-v1 rule set

The first corpus uses these exact existing rules and contracts:

| Family | Rule | Version | Severity | Confidence |
| --- | --- | --- | --- | --- |
| secrets | `secrets/github-token` | `1.0.0` | high | high |
| JS/TS structural | `jsts/dynamic-code-execution` | `1.0.0` | medium | high |
| JS/TS taint | `jsts/command-injection` | `1.0.0` | high | high |
| Docker | `iac/docker-floating-base-image` | `1.0.0` | medium | high |
| Kubernetes | `iac/kubernetes-privileged-container` | `1.0.0` | high | high |
| Terraform | `iac/terraform-aws-public-rds` | `1.0.0` | high | high |
| GitHub Actions | `iac/github-actions-write-all-permissions` | `1.0.0` | medium | high |
| generic configuration | `iac/config-npm-strict-ssl-disabled` | `1.0.0` | medium | high |

Each rule gets exactly four initial cases: one clear positive, one second positive or alternate supported construct where useful, one structurally similar clean near miss, and one remediated clean case. The initial corpus therefore contains exactly 32 cases. Expansion is a later versioned corpus change, not silent mutation of `offline-v1` after publication.

---

### Task 1: Closed corpus contracts, safe manifest reads, and strict parser

**Files:**
- Create: `packages/validation-accuracy/contracts.ts`
- Create: `packages/validation-accuracy/error.ts`
- Create: `packages/validation-accuracy/safe-read.ts`
- Create: `packages/validation-accuracy/parse.ts`
- Create: `packages/validation-accuracy/index.ts`
- Test: `tests/validation-accuracy/contracts.test.ts`
- Test: `tests/validation-accuracy/parse.test.ts`
- Test: `tests/validation-accuracy/parse-security-regressions.test.ts`

**Interfaces:**
- Consumes: `Severity` and `Confidence` from `packages/scanner-core/findings/types.ts`, `compareText`, Node filesystem/path primitives, and `parseDocument` from `yaml`.
- Produces: `VALIDATION_ACCURACY_LIMITS`, `ValidationAccuracyError`, `ValidationCaseV1`, `LoadedValidationCase`, `ValidationCorpusV1`, `LoadedValidationCorpus`, `readVerifiedValidationManifest`, and `loadValidationCorpus(corpusDirectory): Promise<LoadedValidationCorpus>`.

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import {
  VALIDATION_ACCURACY_LIMITS,
  ValidationAccuracyError,
} from "@/packages/validation-accuracy";

describe("Phase 8A validation contracts", () => {
  it("locks v1 limits and stable error identity", () => {
    expect(VALIDATION_ACCURACY_LIMITS).toEqual({
      manifestBytes: 64 * 1024,
      corpusCases: 256,
      expectedFilesPerPositiveCase: 16,
      rationaleBytes: 4 * 1024,
      notesBytes: 4 * 1024,
      diagnosticBytes: 512,
    });
    expect(new ValidationAccuracyError("VALIDATION_CORPUS_INVALID", "Corpus is invalid."))
      .toMatchObject({ name: "ValidationAccuracyError", code: "VALIDATION_CORPUS_INVALID" });
  });
});
```

- [ ] **Step 2: Run the contract test locally and prove RED**

Run:

```bash
npx vitest run tests/validation-accuracy/contracts.test.ts
```

Expected: FAIL because `@/packages/validation-accuracy` does not exist.

- [ ] **Step 3: Implement exact v1 types and limits**

Use these public types:

```ts
export type ValidationScannerFamily = "secrets" | "jsts" | "iac";
export type ValidationCaseLabel = "vulnerable" | "clean";
export type ValidationCaseOutcomeKind = "tp" | "fn" | "fp" | "tn" | "error";

export interface ValidationCaseV1 {
  schemaVersion: 1;
  caseId: string;
  scanner: ValidationScannerFamily;
  ruleId: string;
  label: ValidationCaseLabel;
  repository: "repository";
  rationale: string;
  expectedFiles: string[];
  expectedSeverity?: Severity;
  expectedConfidence?: Confidence;
  expectedCwe?: string[];
  remediationOf?: string;
  notes?: string;
}

export interface ValidationCorpusV1 {
  schemaVersion: 1;
  corpusId: string;
  corpusVersion: string;
  cases: string[];
}

export interface LoadedValidationCase {
  caseDirectory: string;
  repositoryDirectory: string;
  manifestPath: string;
  manifest: ValidationCaseV1;
}

export interface LoadedValidationCorpus {
  corpusDirectory: string;
  manifestPath: string;
  manifest: ValidationCorpusV1;
  cases: readonly LoadedValidationCase[];
  contentHash: string;
}
```

Positive cases require at least one `expectedFiles` item plus severity/confidence. Clean cases require `expectedFiles: []` and omit severity/confidence. `caseId` and `corpusId` use lowercase ASCII segments separated by `-`, `/`, or `.` only; reject controls, bidi characters, whitespace-only strings, absolute paths, backslashes, `.`/`..` segments, drive forms, and hostile values without reflecting them in error messages.

- [ ] **Step 4: Write strict parser and filesystem RED tests**

The tests must include:

```ts
it("loads and deeply freezes one exact corpus", async () => {
  const corpus = await loadValidationCorpus(await validCorpusRoot());
  expect(corpus.manifest.corpusId).toBe("scopeforge-offline-v1");
  expect(Object.isFrozen(corpus.manifest)).toBe(true);
  expect(Object.isFrozen(corpus.cases)).toBe(true);
});

it.each([
  "../case-a",
  "/case-a",
  "C:/case-a",
  "cases\\case-a",
  "cases//case-a",
])("rejects unsafe case reference %s", async (path) => {
  await expect(corpusWithCaseReference(path)).rejects.toMatchObject({
    code: "VALIDATION_PATH_INVALID",
  });
});

it("rejects duplicate JSON keys", async () => {
  await expect(corpusFromRaw('{"schemaVersion":1,"schemaVersion":1}'))
    .rejects.toMatchObject({ code: "VALIDATION_CORPUS_INVALID" });
});

it("rejects duplicate case IDs even when directories differ", async () => {
  await expect(corpusWithDuplicateCaseIds()).rejects.toMatchObject({
    code: "VALIDATION_CORPUS_INVALID",
  });
});
```

Also cover symlink corpus root, symlink/hard-linked manifest, directory manifest, oversized manifest, non-UTF-8 bytes, case path escaping through canonical realpath, unknown keys, invalid labels, clean case with expected files, positive case without expected files, invalid scanner/rule pairing, duplicate expected files, duplicate CWE values, and case-count ceiling.

- [ ] **Step 5: Implement identity-checked bounded manifest reads**

`readVerifiedValidationManifest(path, expectedStat)` must:

```ts
const handle = await open(path, O_RDONLY | O_NOFOLLOW);
try {
  const opened = await handle.stat({ bigint: true });
  assertSameRegularFile(expectedStat, opened);
  const bytes = Buffer.alloc(Number(expectedStat.size) + 1);
  const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
  if (bytesRead > VALIDATION_ACCURACY_LIMITS.manifestBytes) throw tooLarge();
  const after = await handle.stat({ bigint: true });
  assertSameRegularFile(opened, after);
  return bytes.subarray(0, bytesRead);
} finally {
  await handle.close();
}
```

Use `BigInt(1)`, not bigint literal syntax, to stay compatible with repository compile targets. Resolve realpaths before reading and prove corpus/case/manifest paths remain within the canonical corpus root. Error messages use fixed phrases and never absolute paths or hostile input.

- [ ] **Step 6: Implement strict unique-key JSON parsing and content identity**

Use `parseDocument(text, { schema: "json", uniqueKeys: true })` only as duplicate-key/strict-JSON validation, then `JSON.parse` into `unknown` and validate exact object keys yourself. Compute `contentHash` as SHA-256 over a deterministic sequence of the exact corpus manifest bytes plus, in canonical case-id order, each exact case manifest byte sequence and each repository inventory entry path + SHA-256 file bytes. Prefix domains before each component so concatenation is unambiguous.

- [ ] **Step 7: Run focused GREEN and commit**

Run:

```bash
npx vitest run tests/validation-accuracy/contracts.test.ts tests/validation-accuracy/parse.test.ts tests/validation-accuracy/parse-security-regressions.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add packages/validation-accuracy tests/validation-accuracy
git commit -m "feat: add strict Phase 8A corpus contracts [skip ci]"
```

---

### Task 2: Closed offline scanner adapter and case evaluator

**Files:**
- Create: `packages/validation-accuracy/scanners.ts`
- Create: `packages/validation-accuracy/evaluate.ts`
- Modify: `packages/validation-accuracy/index.ts`
- Test: `tests/validation-accuracy/scanners.test.ts`
- Test: `tests/validation-accuracy/evaluate.test.ts`

**Interfaces:**
- Consumes: `buildRepositoryInventory`, `runScan`, `Scanner`, `Finding`, `createSecretScanner`, `createJstsScanner`, `createIacScanner`, and built-in rule lists.
- Produces: `createValidationScanner(scanner, ruleId): Scanner`, `evaluateValidationCase(loadedCase): Promise<ValidationCaseOutcome>`, and `evaluateValidationCorpus(corpus, provenance): Promise<ValidationAccuracyResult>`.

- [ ] **Step 1: Write scanner-adapter RED tests**

```ts
it.each([
  ["secrets", "secrets/github-token", "secrets"],
  ["jsts", "jsts/dynamic-code-execution", "jsts"],
  ["jsts", "jsts/command-injection", "jsts"],
  ["iac", "iac/docker-floating-base-image", "iac"],
  ["iac", "iac/kubernetes-privileged-container", "iac"],
  ["iac", "iac/terraform-aws-public-rds", "iac"],
  ["iac", "iac/github-actions-write-all-permissions", "iac"],
  ["iac", "iac/config-npm-strict-ssl-disabled", "iac"],
])("creates only the selected offline scanner", (family, ruleId, expectedName) => {
  expect(createValidationScanner(family, ruleId).name).toBe(expectedName);
});

it("rejects a rule owned by another scanner family", () => {
  expect(() => createValidationScanner("jsts", "secrets/github-token"))
    .toThrowError(expect.objectContaining({ code: "VALIDATION_RULE_INVALID" }));
});
```

- [ ] **Step 2: Implement the closed scanner mapping**

Use exact include-only rule selection:

```ts
const rules = { include: [ruleId], exclude: [] };

switch (scanner) {
  case "secrets":
    assertRuleIn(SECRET_RULES, ruleId);
    return createSecretScanner({ allowFingerprints: [], rules });
  case "jsts":
    assertRuleIn(JSTS_RULES, ruleId);
    return createJstsScanner({ rules });
  case "iac":
    assertRuleIn(IAC_RULES, ruleId);
    return createIacScanner({ rules });
}
```

Do not import CLI parsing, OSV transport, runtime-network, workers, Supabase, app code, or Security Pack hosted logic.

- [ ] **Step 3: Write case-classification RED tests**

Test injected outcomes without filesystem dependence:

```ts
expect(classifyValidationCase(vulnerableCase, [finding("target", "src/a.ts")], []))
  .toMatchObject({ kind: "tp", contractMismatches: [] });

expect(classifyValidationCase(vulnerableCase, [], []))
  .toMatchObject({ kind: "fn" });

expect(classifyValidationCase(cleanCase, [finding("target", "src/a.ts")], []))
  .toMatchObject({ kind: "fp" });

expect(classifyValidationCase(cleanCase, [], []))
  .toMatchObject({ kind: "tn" });

expect(classifyValidationCase(cleanCase, [], [scanError()]))
  .toMatchObject({ kind: "error" });
```

Also require:
- correct rule in wrong file on vulnerable case => FN, not TP
- other rule only => target FN/TN plus `unexpectedRuleIds`
- duplicate target findings => one case outcome only
- matching target with wrong severity => TP plus `severity` contract mismatch
- matching target with wrong confidence => TP plus `confidence` mismatch
- expected CWE mismatch => TP plus `cwe` mismatch
- any inventory skip reason `file_limit`, `total_bytes_limit`, `file_too_large`, or `unreadable` affecting nonzero count => error

- [ ] **Step 4: Implement case evaluation through existing inventory and coordinator**

```ts
export async function evaluateValidationCase(caseInput: LoadedValidationCase): Promise<ValidationCaseOutcome> {
  const inventory = await buildRepositoryInventory(caseInput.repositoryDirectory);
  const coverageError = coverageDiagnostic(inventory.summary);
  if (coverageError) return errorOutcome(caseInput, coverageError);

  const scanner = createValidationScanner(caseInput.manifest.scanner, caseInput.manifest.ruleId);
  const result = await runScan({
    root: caseInput.repositoryDirectory,
    inventory,
    scanners: [scanner],
  });
  return classifyValidationCase(caseInput.manifest, result.findings, result.errors);
}
```

Do not serialize `result.scan.root`, `startedAt`, `durationMs`, finding evidence, snippets, metadata, or remediation into the normalized accuracy result.

- [ ] **Step 5: Run focused GREEN and commit**

```bash
npx vitest run tests/validation-accuracy/scanners.test.ts tests/validation-accuracy/evaluate.test.ts
npm run typecheck
git add packages/validation-accuracy tests/validation-accuracy
git commit -m "feat: evaluate offline validation cases [skip ci]"
```

---

### Task 3: Metrics and deterministic normalized result

**Files:**
- Create: `packages/validation-accuracy/metrics.ts`
- Modify: `packages/validation-accuracy/contracts.ts`
- Modify: `packages/validation-accuracy/evaluate.ts`
- Modify: `packages/validation-accuracy/index.ts`
- Test: `tests/validation-accuracy/metrics.test.ts`

**Interfaces:**
- Consumes: ordered `ValidationCaseOutcome[]`.
- Produces: `ValidationCounts`, `ValidationDerivedMetrics`, `ValidationRuleResult`, `ValidationAccuracyResult`, `computeDerivedMetrics(counts)`, and `aggregateValidationResult(...)`.

- [ ] **Step 1: Write exact metric tests**

```ts
expect(computeDerivedMetrics({ tp: 8, fn: 2, fp: 1, tn: 9, error: 0 }))
  .toEqual({ precision: 8 / 9, recall: 0.8, falsePositiveRate: 0.1, f1: 16 / 19 });

expect(computeDerivedMetrics({ tp: 0, fn: 0, fp: 0, tn: 4, error: 0 }))
  .toEqual({ precision: null, recall: null, falsePositiveRate: 0, f1: null });
```

Keep raw JavaScript numbers in the normalized object. Presentation rounding happens only in Markdown.

- [ ] **Step 2: Implement stable aggregation**

`ValidationCounts` is exactly:

```ts
export interface ValidationCounts {
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  error: number;
  contractMismatch: number;
}
```

Group outcomes by exact `ruleId`, sort rule IDs and case IDs with `compareText`, compute one covered-corpus aggregate by summing raw counts, and list represented scanner families and represented rule IDs separately. Include an explicit non-claim string constant in the result:

```ts
interpretation: "Metrics describe only the committed covered corpus and are not global ScopeForge accuracy."
```

- [ ] **Step 3: Prove ordering and mutation resistance**

Test shuffled input order and verify identical output. Freeze normalized result objects before returning them. Verify aggregation does not mutate case outcomes.

- [ ] **Step 4: Run focused GREEN and commit**

```bash
npx vitest run tests/validation-accuracy/metrics.test.ts tests/validation-accuracy/evaluate.test.ts
npm run typecheck
git add packages/validation-accuracy tests/validation-accuracy
git commit -m "feat: add deterministic validation metrics [skip ci]"
```

---

### Task 4: Privacy-safe JSON, Markdown, and developer runner

**Files:**
- Create: `packages/validation-accuracy/report-json.ts`
- Create: `packages/validation-accuracy/report-markdown.ts`
- Create: `packages/validation-accuracy/cli.ts`
- Modify: `packages/validation-accuracy/index.ts`
- Modify: `package.json`
- Modify: `tsconfig.cli.json`
- Test: `tests/validation-accuracy/report.test.ts`
- Test: `tests/validation-accuracy/cli.test.ts`
- Test: `tests/validation-accuracy/privacy.test.ts`

**Interfaces:**
- Consumes: one normalized `ValidationAccuracyResult`.
- Produces: `serializeValidationAccuracyJson(result): string`, `renderValidationAccuracyMarkdown(result): string`, and compiled developer runner arguments `--corpus`, `--commit`, `--json`, `--markdown`.

- [ ] **Step 1: Write deterministic serializer RED tests**

```ts
const first = serializeValidationAccuracyJson(resultFixture());
const second = serializeValidationAccuracyJson(resultFixture());
expect(first).toBe(second);
expect(first.endsWith("\n")).toBe(true);
expect(JSON.parse(first).schemaVersion).toBe(1);

const md1 = renderValidationAccuracyMarkdown(resultFixture());
const md2 = renderValidationAccuracyMarkdown(resultFixture());
expect(md1).toBe(md2);
expect(md1).toContain("covered corpus");
```

- [ ] **Step 2: Add privacy regressions**

Create fixture sentinels such as `ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, an absolute temporary root, a source-code sentinel, and finding evidence sentinel. Assert none appear in JSON or Markdown. Repository-relative expected file names are allowed.

- [ ] **Step 3: Implement canonical JSON and Markdown**

JSON uses `JSON.stringify(result, null, 2) + "\n"` after all ordering has already been normalized. Markdown is derived only from the normalized result and formats nullable metrics as `n/a`; percentages are rendered to two decimal places with a pure helper.

The Markdown heading must be:

```md
# ScopeForge Offline Validation Report - scopeforge-offline-v1
```

Required sections: Scope, Provenance, Coverage, Rule Results, Errors/Unsupported, Contract Mismatches, Unexpected Rules, Limitations.

- [ ] **Step 4: Implement developer runner without public CLI expansion**

`packages/validation-accuracy/cli.ts` must parse only:

```text
--corpus <directory>
--commit <40-hex-sha>
--json <output-file>
--markdown <output-file>
```

All four are required. Reject duplicates, unknown flags, missing values, non-40-hex commit IDs, output paths resolving inside the corpus tree, and output symlinks. Write output with exclusive/no-follow semantics following existing safe output patterns.

Add:

```json
"validation:accuracy": "npm run build:cli --silent && node .scopeforge-build/packages/validation-accuracy/cli.js"
```

Add these CLI-build includes:

```json
"packages/scanner-iac/**/*.ts",
"packages/validation-accuracy/**/*.ts"
```

`scanner-secrets` and `scanner-jsts` are already compiled. Do not add dependencies.

- [ ] **Step 5: Run focused GREEN, compiled smoke, and commit**

```bash
npx vitest run tests/validation-accuracy/report.test.ts tests/validation-accuracy/cli.test.ts tests/validation-accuracy/privacy.test.ts
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
git add packages/validation-accuracy tests/validation-accuracy package.json tsconfig.cli.json
git commit -m "feat: add validation reporting runner [skip ci]"
```

---

### Task 5: Commit the 32-case offline-v1 corpus

**Files:**
- Create: `validation/corpus/offline-v1/corpus.json`
- Create: `validation/corpus/offline-v1/cases/**/case.json`
- Create: `validation/corpus/offline-v1/cases/**/README.md`
- Create: `validation/corpus/offline-v1/cases/**/repository/**`
- Test: `tests/validation-accuracy/offline-v1-corpus.test.ts`

**Interfaces:**
- Consumes: Task 1 parser and Task 2 evaluator.
- Produces: immutable corpus `scopeforge-offline-v1` version `1.0.0` with exactly 32 reviewed cases.

- [ ] **Step 1: Add the authoritative corpus index**

Use exactly:

```json
{
  "schemaVersion": 1,
  "corpusId": "scopeforge-offline-v1",
  "corpusVersion": "1.0.0",
  "cases": [
    "cases/config-npm-strict-ssl-clean-default",
    "cases/config-npm-strict-ssl-clean-remediated",
    "cases/config-npm-strict-ssl-positive-basic",
    "cases/config-npm-strict-ssl-positive-last-setting",
    "cases/docker-floating-clean-digest",
    "cases/docker-floating-clean-versioned",
    "cases/docker-floating-positive-latest",
    "cases/docker-floating-positive-untagged",
    "cases/github-actions-write-all-clean-job-read",
    "cases/github-actions-write-all-clean-workflow-map",
    "cases/github-actions-write-all-positive-job",
    "cases/github-actions-write-all-positive-workflow",
    "cases/jsts-command-clean-execfile",
    "cases/jsts-command-clean-numeric",
    "cases/jsts-command-positive-exec",
    "cases/jsts-command-positive-execsync",
    "cases/jsts-dynamic-clean-json-parse",
    "cases/jsts-dynamic-clean-shadowed-eval",
    "cases/jsts-dynamic-positive-eval",
    "cases/jsts-dynamic-positive-function",
    "cases/kubernetes-privileged-clean-false",
    "cases/kubernetes-privileged-clean-omitted",
    "cases/kubernetes-privileged-positive-container",
    "cases/kubernetes-privileged-positive-init-container",
    "cases/secrets-github-clean-env",
    "cases/secrets-github-clean-near-miss",
    "cases/secrets-github-positive-classic",
    "cases/secrets-github-positive-fine-grained",
    "cases/terraform-rds-clean-false",
    "cases/terraform-rds-clean-omitted",
    "cases/terraform-rds-positive-basic",
    "cases/terraform-rds-positive-with-other-fields"
  ]
}
```

The list is raw-text sorted by case path.

- [ ] **Step 2: Add secret cases using synthetic detector-shaped values only**

Use:

```ts
// positive classic
export const token = "ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// positive fine-grained
export const token = "github_pat_AAAAAAAAAAAAAAAAAAAA";

// clean env
export const token = process.env.GITHUB_TOKEN;

// clean near miss
export const token = "ghp_short";
```

The case manifests target `secrets/github-token`, scanner `secrets`, expected file `src/config.ts` for positives, severity/confidence `high`/`high`. State in each README that values are synthetic pattern fixtures and not usable credentials.

- [ ] **Step 3: Add JS/TS dynamic-code cases**

Repositories use `src/app.ts`:

```ts
// positive eval
eval(userInput);

// positive Function
const calculate = new Function("value", "return value + 1");

// clean JSON parse
const value = JSON.parse(input);

// clean shadowed eval
function run(eval: (value: string) => unknown, value: string) {
  return eval(value);
}
```

Target `jsts/dynamic-code-execution`, scanner `jsts`, expected `medium`/`high` for positives.

- [ ] **Step 4: Add JS/TS command-injection cases**

Use these exact supported/unsupported flows:

```ts
// positive exec
import express from "express";
import { exec } from "node:child_process";
const app = express();
app.get("/run", (req, res) => exec(req.query.cmd));

// positive execSync
import express from "express";
import { execSync as runSync } from "child_process";
const app = express();
app.post("/run", (request, response) => {
  const command = request.body.command;
  runSync(`prefix ${command}`);
});

// clean numeric conversion
import express from "express";
import { exec } from "node:child_process";
const app = express();
app.get("/run", (req, res) => exec(String(Number(req.query.cmd))));

// clean execFile
import express from "express";
import { execFile } from "node:child_process";
const app = express();
app.get("/run", (req, res) => execFile("tool", [String(req.query.cmd)]));
```

Target `jsts/command-injection`, expected `high`/`high` for positives.

- [ ] **Step 5: Add Docker cases**

Use `Dockerfile`:

```dockerfile
# positive untagged
FROM node
RUN node --version
```

```dockerfile
# positive latest
FROM node:latest
RUN node --version
```

```dockerfile
# clean versioned
FROM node:22.18.0
RUN node --version
```

```dockerfile
# clean digest
FROM node@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
RUN node --version
```

Target `iac/docker-floating-base-image`, scanner `iac`, expected `medium`/`high` for positives.

- [ ] **Step 6: Add Kubernetes cases**

Use `deployment.yaml` and target `iac/kubernetes-privileged-container`, expected `high`/`high` for positives. Positive container sets `securityContext.privileged: true`; positive init-container places the same field under `spec.template.spec.initContainers`. Clean cases use `privileged: false` and an omitted `securityContext.privileged` respectively. All manifests include `apiVersion: apps/v1`, `kind: Deployment`, metadata name, selector, pod template labels, and one deterministic `nginx:1.27.0` image.

- [ ] **Step 7: Add Terraform cases**

Use `main.tf`:

```hcl
# positive basic
resource "aws_db_instance" "example" {
  identifier          = "scopeforge-fixture"
  engine              = "postgres"
  publicly_accessible = true
}
```

Second positive includes harmless fields before/after the same explicit `publicly_accessible = true`. Clean false sets it to `false`. Clean omitted removes the field entirely. Target `iac/terraform-aws-public-rds`, expected `high`/`high` for positives.

- [ ] **Step 8: Add GitHub Actions cases**

Use `.github/workflows/ci.yml`. Positive workflow has top-level `permissions: write-all`; positive job has `jobs.build.permissions: write-all`. Clean workflow uses explicit `contents: read`; clean job uses `permissions: read-all`. Keep the workflow otherwise minimal with `on: push`, `runs-on: ubuntu-latest`, and one `run: echo scopeforge`. Target `iac/github-actions-write-all-permissions`, expected `medium`/`high` for positives.

- [ ] **Step 9: Add npm configuration cases**

Use `.npmrc`:

```ini
# positive basic
strict-ssl=false
```

```ini
# positive last-setting-wins
strict-ssl=true
strict-ssl=false
```

```ini
# clean default
registry=https://registry.npmjs.org/
```

```ini
# clean remediated
strict-ssl=false
strict-ssl=true
```

Target `iac/config-npm-strict-ssl-disabled`, expected `medium`/`high` for positives.

- [ ] **Step 10: Add corpus integration tests and run GREEN**

```ts
it("loads exactly 32 unique offline-v1 cases", async () => {
  const corpus = await loadValidationCorpus(OFFLINE_V1);
  expect(corpus.cases).toHaveLength(32);
  expect(new Set(corpus.cases.map((item) => item.manifest.caseId)).size).toBe(32);
});

it("evaluates the committed corpus with zero infrastructure errors or contract mismatches", async () => {
  const result = await evaluateValidationCorpus(await loadValidationCorpus(OFFLINE_V1), provenance());
  expect(result.coverage.totalCases).toBe(32);
  expect(result.aggregate.counts.error).toBe(0);
  expect(result.aggregate.counts.contractMismatch).toBe(0);
});
```

Run:

```bash
npx vitest run tests/validation-accuracy/offline-v1-corpus.test.ts tests/validation-accuracy
npm run typecheck
```

Commit all corpus content and tests with:

```bash
git commit -m "test: add offline-v1 accuracy corpus [skip ci]"
```

---

### Task 6: Architecture, privacy, and ground-truth mutation guards

**Files:**
- Create: `tests/architecture/validation-accuracy-dependencies.test.ts`
- Create: `tests/validation-accuracy/ground-truth-security.test.ts`
- Modify: `tests/validation-accuracy/privacy.test.ts`

**Interfaces:**
- Consumes: committed validation package/corpus.
- Produces: permanent executable authority and evidence-integrity boundaries.

- [ ] **Step 1: Add forbidden-dependency architecture tests**

Read all `packages/validation-accuracy/**/*.ts` files and reject import specifiers or source primitives containing:

```ts
const forbidden = [
  "next",
  "react",
  "@supabase/",
  "runtime-network",
  "runtime-observer",
  "runtime-validator",
  "runtime-worker",
  "worker-supervisor",
  "worker-control",
  "node:child_process",
  "node:vm",
  "node:http",
  "node:https",
  "node:dns",
  "node:net",
  "node:tls",
  "node:dgram",
  "node:worker_threads",
];
```

Also reject `eval(`, `new Function(`, dynamic `import(`, `fetch(`, and imports from `app/` or `lib/` hosted mutation modules. Permit the normal static TypeScript import syntax and filesystem/path/crypto primitives required for local validation.

- [ ] **Step 2: Prove scanner output cannot mutate ground truth**

Snapshot SHA-256 of every `corpus.json` and `case.json`, run complete evaluation plus JSON/Markdown output to a separate temp directory, snapshot again, and require byte-for-byte equality. Test runner output paths inside the corpus are rejected before writing.

- [ ] **Step 3: Expand privacy tests**

Require JSON/Markdown to exclude:
- all fixture file contents
- `ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
- `github_pat_AAAAAAAAAAAAAAAAAAAA`
- temporary absolute corpus root
- scanner evidence summaries/redacted snippets
- arbitrary finding metadata
- scan timestamps/durations generated by `runScan`

- [ ] **Step 4: Run security GREEN and commit**

```bash
npx vitest run tests/architecture/validation-accuracy-dependencies.test.ts tests/validation-accuracy/ground-truth-security.test.ts tests/validation-accuracy/privacy.test.ts
npm run typecheck
git add tests/architecture tests/validation-accuracy
git commit -m "test: lock Phase 8A validation authority [skip ci]"
```

---

### Task 7: Developer script, methodology update, and resumable state

**Files:**
- Modify: `docs/validation/METHODOLOGY.md`
- Create: `docs/development/PHASE_8_WORKING_STATE.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/TEST_STATUS.md`

**Interfaces:**
- Consumes: fully implemented Phase 8A behavior.
- Produces: accurate handoff that distinguishes Phase 8A complete from Phase 8B/8C pending.

- [ ] **Step 1: Update methodology with concrete implemented semantics**

Document exact corpus identity `scopeforge-offline-v1@1.0.0`, 32 cases, the eight represented rules, one-case-one-rule counting, scanner-error exclusion from denominators, contract mismatch handling, privacy boundaries, and covered-corpus non-claim. Do not publish performance numbers in this task.

- [ ] **Step 2: Create the working-state handoff**

Record:
- exact branch/head
- completed tasks and verification commands
- corpus ID/version/hash once known
- case count 32
- represented rule IDs
- current aggregate counts/metrics from the exact candidate
- Vercel status separately from scanner validation
- Phase 8B performance plan as the next implementation boundary
- Phase 8C publication still pending
- branch-cleanup requirement and protected V5 branches

- [ ] **Step 3: Reconcile central state docs**

State that Phase 7 remains complete, Phase 8A is the active/implemented validation slice, production worker gates remain disabled, dashboard V5 remains separate, and no accuracy claim extends beyond the committed corpus.

- [ ] **Step 4: Run docs-sensitive tests and commit**

```bash
npx vitest run tests/validation-accuracy tests/architecture/validation-accuracy-dependencies.test.ts
npm run typecheck
git add docs
git commit -m "docs: record Phase 8A accuracy foundation [skip ci]"
```

---

### Task 8: Exact-tree preflight, one CI gate, review, and integration

**Files:**
- No new feature source unless verification exposes a concrete defect.
- Modify handoff/release docs only after exact evidence exists.

**Interfaces:**
- Consumes: Tasks 1-7 frozen candidate.
- Produces: exact-head Phase 8A acceptance and safely mergeable draft PR.

- [ ] **Step 1: Freeze one exact candidate and run disposable Linux preflight**

On a clean archive/check-out of the exact GitHub head, run in separate chunks if the verifier has a 120-second ceiling:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx vitest run tests/validation-accuracy tests/architecture/validation-accuracy-dependencies.test.ts
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run validation:accuracy -- --corpus validation/corpus/offline-v1 --commit <EXACT_HEAD_SHA> --json /tmp/offline-v1.json --markdown /tmp/offline-v1.md
npm run benchmark:scanner
npm audit --audit-level=info
NODE_ENV=production npm run build
```

Require focused tests, full tests, typecheck, CLI build/version, evaluator, existing scanner benchmark, audit, and production build all to pass before a CI-triggering commit/event.

- [ ] **Step 2: Inspect generated evidence**

Require:
- exactly 32 case outcomes
- exactly 8 represented rule IDs
- zero evaluator infrastructure errors
- zero contract mismatches
- no absolute root/source/secret sentinel leakage
- JSON byte-identical across two runs with identical provenance
- Markdown byte-identical across two runs with identical provenance
- no ground-truth file changed by evaluation

Do not require every rule to have perfect metrics by editing labels to match output. If a genuine FN/FP appears, review scanner behavior and the ground truth independently; fix only if the evidence shows an actual rule or label defect.

- [ ] **Step 3: Create/update one draft implementation PR without triggering validation while draft**

PR title:

```text
Phase 8A offline accuracy foundation
```

PR body must list exact candidate SHA, corpus hash, case/rule counts, raw per-rule confusion matrices, limitations, preflight evidence, authority boundaries, and the explicit statement that these are covered-corpus measurements only.

- [ ] **Step 4: Review the complete diff**

Verify there are no changes under:
- `app/dashboard/**`
- active Command Center/V5 presentation source
- `supabase/migrations/**`
- runtime-worker/network authority
- Vercel capability flags
- package-lock dependency graph

Run `git diff --check` in the preflight checkout and inspect PR review threads/statuses.

- [ ] **Step 5: Trigger exactly one final GitHub-hosted Linux gate on the already-preflighted tree**

If the final tree's last commit contains `[skip ci]`, create one empty tree-identical verification commit without a skip token. Do not alter files merely to trigger CI. Mark the PR ready only for this final gate.

Require the existing repository CI workflow to pass on the exact final head and actual PR merge ref. If CI fails, diagnose the precise failure before any rerun.

- [ ] **Step 6: Merge with exact-head protection and preserve runtime/UI boundaries**

Use squash merge only after:
- exact head unchanged
- CI green
- Vercel green or any Vercel failure independently diagnosed as environment-only
- zero unresolved review threads
- branch mergeable
- full diff reviewed

Use a `[skip ci]` squash subject so `main` does not immediately spend another redundant Actions run after exact merge-ref acceptance.

- [ ] **Step 7: Post-merge verification and branch hygiene**

Verify `main` exact squash commit and production Vercel deployment if triggered. Update Phase 8 handoff to record Phase 8A complete and Phase 8B next. Delete the merged Phase 8A implementation branch when a true branch-delete operation is available. Do not approximate deletion by force-moving refs. Preserve PR #49 and every active V5/UI branch.

---

## Phase 8A definition of done

Phase 8A is complete only when:

1. `scopeforge-offline-v1@1.0.0` contains exactly 32 committed cases over the eight listed deterministic offline rules.
2. Corpus/case manifests are strict, bounded, identity-checked, unique-key JSON and the corpus content hash is deterministic.
3. The evaluator uses existing bounded inventory and scanners and never adds execution/network/hosted authority.
4. TP/FN/FP/TN/error semantics match the approved design, including expected-file checks and no error-to-clean conversion.
5. Metrics use raw counts as source of truth and null for undefined denominators.
6. Severity/confidence/CWE mismatches are functional contract mismatches, not hidden inside detection metrics.
7. JSON and Markdown are deterministic for identical inputs and do not leak source, synthetic secret values, evidence, or local roots.
8. Scanner output cannot modify corpus ground truth.
9. The developer runner is compiled through existing TypeScript tooling and adds no dependency.
10. Focused and full local/disposable preflight is green before the single final CI gate.
11. Exact-head GitHub-hosted Linux CI is green before merge.
12. No dashboard V5/UI, Supabase, runtime worker, network authority, or production capability drift exists.
13. Post-merge docs identify Phase 8B performance matrix as the next staged implementation boundary.

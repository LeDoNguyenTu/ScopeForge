# Phase 8A Accuracy Foundation Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development. Follow the tasks in order and preserve the RED/GREEN discipline locally before pushing CI-triggering candidates.

**Goal:** Build ScopeForge's first versioned offline labeled corpus and deterministic rule-level accuracy evaluator, producing privacy-safe JSON and Markdown evidence without widening scanner, network, hosted, worker, Supabase, browser, or UI authority.

**Architecture:** Add a framework-independent `packages/validation-accuracy` package. It strictly validates ground truth, validates and hashes complete case repository trees, constructs exactly one existing built-in offline scanner for each target rule, scans through `buildRepositoryInventory` and `runScan`, classifies each case, aggregates rule-level confusion matrices, and renders deterministic reports from one normalized result. Scanner output never rewrites labels.

**Tech stack:** TypeScript 5.8, Node.js 22, Vitest 3, existing `yaml` 2.9 duplicate-key validation, scanner-core inventory/coordinator/finding contracts, scanner-secrets, scanner-jsts, scanner-iac, existing CommonJS CLI build.

**Approved spec:** `docs/superpowers/specs/2026-09-05-phase-8-validation-accuracy-design.md`

## Global constraints

- Create an isolated Phase 8A implementation branch from the exact design/plan head. Never implement on `main`.
- Keep the implementation PR draft until final preflight is green.
- Intermediate implementation commits use `[skip ci]`. Do not create deliberate RED GitHub Actions runs.
- Use the disposable Linux verifier as the first executable feedback loop. Focused tests first, then broader checks.
- No new runtime dependency or package-lock dependency delta.
- No Supabase migration, RLS/auth change, hosted mutation authority, runtime-network, worker capability, active runtime profile, browser authority, or hosted Security Pack activation.
- Do not modify dashboard V5/UI or PR #49. Preserve every active `preview/command-center-v5-*` and `diag/v5-*` branch.
- Offline accuracy evaluation cannot use OSV or any generic network path.
- Target case repositories are hostile input. Never execute repository code, install packages, run lifecycle hooks, shells, containers, build systems, or target imports.
- Ground truth is immutable evidence. No label-update/snapshot-rewrite command exists.
- Scanner errors or incomplete coverage never become FN or TN.
- One case is one target-rule confusion-matrix unit. Duplicate findings do not multiply counts.
- Reports may contain bounded repository-relative file names but no source snippets, raw synthetic secret values, absolute roots, arbitrary finding evidence, metadata, remediation, scan timestamps, or per-case scan duration.
- Rule-level results are primary. Any aggregate is explicitly covered-corpus-only and never described as universal ScopeForge accuracy.
- Final acceptance uses one exact-head GitHub-hosted Linux CI run after the exact tree is already green in preflight.

## Initial offline-v1 rule set

Exactly eight deterministic offline rules are represented:

| Family | Rule | Version | Severity | Confidence |
| --- | --- | --- | --- | --- |
| secrets | `secrets/github-token` | `1.0.0` | high | high |
| JS/TS structural | `jsts/dynamic-code-execution` | `1.0.0` | medium | high |
| JS/TS taint | `jsts/command-injection` | `1.0.0` | high | high |
| Docker | `iac/docker-floating-base-image` | `1.0.0` | medium | high |
| Kubernetes | `iac/kubernetes-privileged-container` | `1.0.0` | high | high |
| Terraform | `iac/terraform-aws-public-rds` | `1.0.0` | high | high |
| GitHub Actions | `iac/github-actions-write-all-permissions` | `1.0.0` | medium | high |
| config | `iac/config-npm-strict-ssl-disabled` | `1.0.0` | medium | high |

Each rule starts with exactly four cases: two supported positives plus two clean/near-miss/remediated cases. `scopeforge-offline-v1@1.0.0` therefore contains exactly 32 cases.

## Fixed v1 validation limits

```ts
export const VALIDATION_ACCURACY_LIMITS = Object.freeze({
  manifestBytes: 64 * 1024,
  corpusCases: 256,
  expectedFilesPerPositiveCase: 16,
  rationaleBytes: 4 * 1024,
  notesBytes: 4 * 1024,
  diagnosticBytes: 512,
  repositoryFilesPerCase: 128,
  repositoryFileBytes: 512 * 1024,
  repositoryBytesPerCase: 4 * 1024 * 1024,
});
```

The corpus repository-tree limits are stricter than ordinary scanner limits by design. They constrain research evidence rather than product scan scope.

---

## Task 1: Contracts, safe reads, strict parser, and complete repository identity

**Create:**
- `packages/validation-accuracy/contracts.ts`
- `packages/validation-accuracy/error.ts`
- `packages/validation-accuracy/safe-read.ts`
- `packages/validation-accuracy/parse.ts`
- `packages/validation-accuracy/index.ts`
- `tests/validation-accuracy/contracts.test.ts`
- `tests/validation-accuracy/parse.test.ts`
- `tests/validation-accuracy/parse-security-regressions.test.ts`

### Step 1 - RED contracts

Test the exact limits above and stable error type:

```ts
new ValidationAccuracyError("VALIDATION_CORPUS_INVALID", "Corpus is invalid.")
```

Stable error codes:

```ts
export type ValidationAccuracyErrorCode =
  | "VALIDATION_PATH_INVALID"
  | "VALIDATION_MANIFEST_INVALID"
  | "VALIDATION_MANIFEST_TOO_LARGE"
  | "VALIDATION_CORPUS_INVALID"
  | "VALIDATION_CASE_INVALID"
  | "VALIDATION_REPOSITORY_INVALID"
  | "VALIDATION_RULE_INVALID"
  | "VALIDATION_OUTPUT_INVALID";
```

Run `npx vitest run tests/validation-accuracy/contracts.test.ts`; expected RED because the package is absent.

### Step 2 - Implement exact data contracts

```ts
export type ValidationScannerFamily = "secrets" | "jsts" | "iac";
export type ValidationCaseLabel = "vulnerable" | "clean";
export type ValidationCaseOutcomeKind = "tp" | "fn" | "fp" | "tn" | "error" | "unsupported";

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
```

Positive cases require non-empty `expectedFiles`, severity, and confidence. Clean cases require `expectedFiles: []` and omit positive-only fields.

### Step 3 - RED strict parser/security cases

Cover:
- duplicate JSON keys
- unknown keys
- unsupported schema
- duplicate case paths
- duplicate case IDs
- invalid scanner literal
- invalid rule-ID syntax
- invalid labels
- absolute/traversal/backslash/drive paths
- clean case with expected files
- vulnerable case without expected files
- duplicate expected files/CWE values
- corpus count ceiling
- symlink corpus/case/repository/manifest/file
- hard-linked manifest or repository file
- directory manifest
- FIFO/socket/device/special repository entry where platform permits
- oversized manifest, file, repository, or file count
- non-UTF-8 manifest
- canonical realpath escape

**Do not** validate scanner-family/rule ownership in Task 1. Ownership is Task 2 and depends on built-in rule registries.

### Step 4 - Implement no-follow identity-checked reads

Use `lstat`, `realpath`, `open`, `O_RDONLY | O_NOFOLLOW` where available, handle `stat({ bigint: true })`, device/inode/type/size equality before and after read, `nlink === BigInt(1)`, one-byte sentinel reads, and `finally` close.

All error messages are fixed and privacy-safe. Never echo absolute paths or hostile values.

### Step 5 - Validate and hash the complete repository tree

Implement a deterministic walker independent of `.gitignore`/`.scopeforgeignore` semantics. It must:
- raw-text sort children
- reject symlinks, hard links, and special files
- reject file/count/byte limit overflow
- identity-check each opened file before/after read
- include every regular file in the content identity, including ignore files
- return ordered `{ path, size, sha256 }` metadata without file contents

Then compute corpus `contentHash` with SHA-256 over domain-separated exact corpus manifest bytes, case manifest bytes in canonical case-ID order, and each validated repository entry path + size + file SHA-256. No ambiguous concatenation.

### Step 6 - GREEN

```bash
npx vitest run tests/validation-accuracy/contracts.test.ts tests/validation-accuracy/parse.test.ts tests/validation-accuracy/parse-security-regressions.test.ts
npm run typecheck
```

Commit: `feat: add strict Phase 8A corpus contracts [skip ci]`.

---

## Task 2: Closed scanner ownership mapping and case classification

**Create:**
- `packages/validation-accuracy/scanners.ts`
- `packages/validation-accuracy/evaluate.ts`
- `tests/validation-accuracy/scanners.test.ts`
- `tests/validation-accuracy/evaluate.test.ts`

### Step 1 - RED scanner ownership

Prove exact accepted mappings for all eight rules. Prove cross-family ownership fails with `VALIDATION_RULE_INVALID`, for example `jsts + secrets/github-token`.

### Step 2 - Implement exactly one existing scanner

```ts
const rules = { include: [ruleId], exclude: [] };
```

- secrets: validate against `SECRET_RULES`, return `createSecretScanner({ allowFingerprints: [], rules })`
- jsts: validate against `JSTS_RULES`, return `createJstsScanner({ rules })`
- iac: validate against combined `IAC_RULES`, return `createIacScanner({ rules })`

No SCA/OSV scanner is constructed in offline-v1.

### Step 3 - RED classification semantics

Pure classification tests cover:
- vulnerable + exact target finding in expected file => TP
- vulnerable + none => FN
- clean + target finding => FP
- clean + none => TN
- scan error => error
- known unsupported diagnostic => unsupported
- correct rule in wrong file => FN
- other rule only => target FN/TN plus sorted `unexpectedRuleIds`
- duplicate target findings => still one case outcome
- severity mismatch => TP + `severity` mismatch
- confidence mismatch => TP + `confidence` mismatch
- expected CWE mismatch => TP + `cwe` mismatch

### Step 4 - Evaluate through existing inventory/coordinator

Use `buildRepositoryInventory(case.repositoryDirectory)` and `runScan` with exactly one selected scanner.

Before scan, validate inventory completeness. Nonzero `file_limit`, `total_bytes_limit`, `file_too_large`, or `unreadable` is `error`. A symlink should already be impossible because the corpus tree validator rejects it.

Map scanner diagnostics with explicitly unsupported codes to `unsupported`; other diagnostics are `error`. Do not copy arbitrary diagnostic messages into normalized output; expose fixed bounded codes/categories only.

Task 2 produces `ValidationCaseOutcome` and `evaluateValidationCases(corpus): Promise<readonly ValidationCaseOutcome[]>`. It does **not** produce final `ValidationAccuracyResult` yet.

### Step 5 - GREEN

```bash
npx vitest run tests/validation-accuracy/scanners.test.ts tests/validation-accuracy/evaluate.test.ts
npm run typecheck
```

Commit: `feat: evaluate offline validation cases [skip ci]`.

---

## Task 3: Metrics, provenance, and normalized result

**Create:** `packages/validation-accuracy/metrics.ts`, `tests/validation-accuracy/metrics.test.ts`.

**Modify:** contracts/evaluate/index.

Define:

```ts
export interface ValidationCounts {
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  error: number;
  unsupported: number;
  contractMismatch: number;
}
```

Derived metrics exclude error/unsupported:
- precision = TP / (TP + FP)
- recall = TP / (TP + FN)
- FPR = FP / (FP + TN)
- F1 = 2TP / (2TP + FP + FN)
- zero denominator => `null`

Metric fixtures include **all** count fields.

Define deterministic provenance:

```ts
export interface ValidationProvenance {
  scopeforgeVersion: string;
  commitSha: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}
```

No timestamp.

`aggregateValidationResult(corpus, outcomes, provenance)` sorts rule IDs/case IDs with `compareText`, freezes output, stores raw counts, represented scanner families, represented rules, corpus ID/version/hash, and exact interpretation:

`Metrics describe only the committed covered corpus and are not global ScopeForge accuracy.`

Then implement `evaluateValidationCorpus(corpus, provenance)` as Task 2 case execution + Task 3 aggregation.

GREEN:

```bash
npx vitest run tests/validation-accuracy/metrics.test.ts tests/validation-accuracy/evaluate.test.ts
npm run typecheck
```

Commit: `feat: add deterministic validation metrics [skip ci]`.

---

## Task 4: Deterministic JSON/Markdown and developer runner

**Create:** report-json.ts, report-markdown.ts, cli.ts, report/CLI/privacy tests.

**Modify:** `package.json`, `tsconfig.cli.json`, index.

### Reports

JSON is normalized object serialization only:

```ts
JSON.stringify(result, null, 2) + "\n"
```

Markdown derives only from the normalized result. Heading:

`# ScopeForge Offline Validation Report - scopeforge-offline-v1`

Sections: Scope, Provenance, Coverage, Rule Results, Errors/Unsupported, Contract Mismatches, Unexpected Rules, Limitations.

Nullable metrics render as `n/a`; defined percentages render to two decimals only in Markdown.

Privacy tests inject source/evidence/root/secret sentinels and prove they are absent.

### Developer runner

Required arguments only:
- `--corpus <directory>`
- `--commit <40-hex-sha>`
- `--json <output-file>`
- `--markdown <output-file>`

Reject unknown/duplicate/missing flags, invalid SHA, output inside corpus, output symlink, and aliasing JSON/Markdown to the same file.

Use safe exclusive/no-follow writes. Read ScopeForge version from trusted root `package.json`; collect `process.version`, `process.platform`, `process.arch`. Do not accept environment/provenance claims from target repository data.

Add script:

```json
"validation:accuracy": "npm run build:cli --silent && node .scopeforge-build/packages/validation-accuracy/cli.js"
```

Add explicit `packages/validation-accuracy/**/*.ts` to `tsconfig.cli.json`; add `packages/scanner-iac/**/*.ts` if needed for stable compile ownership. No dependency additions.

GREEN:

```bash
npx vitest run tests/validation-accuracy/report.test.ts tests/validation-accuracy/cli.test.ts tests/validation-accuracy/privacy.test.ts
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
```

Commit: `feat: add validation reporting runner [skip ci]`.

---

## Task 5: Commit `scopeforge-offline-v1@1.0.0` with exactly 32 cases

Create `validation/corpus/offline-v1/corpus.json` and `cases/<case-id>/{case.json,README.md,repository/**}`.

Canonical case IDs, raw-text sorted:

1. `config-npm-strict-ssl-clean-default`
2. `config-npm-strict-ssl-clean-remediated`
3. `config-npm-strict-ssl-positive-basic`
4. `config-npm-strict-ssl-positive-last-setting`
5. `docker-floating-clean-digest`
6. `docker-floating-clean-versioned`
7. `docker-floating-positive-latest`
8. `docker-floating-positive-untagged`
9. `github-actions-write-all-clean-job-read`
10. `github-actions-write-all-clean-workflow-map`
11. `github-actions-write-all-positive-job`
12. `github-actions-write-all-positive-workflow`
13. `jsts-command-clean-execfile`
14. `jsts-command-clean-numeric`
15. `jsts-command-positive-exec`
16. `jsts-command-positive-execsync`
17. `jsts-dynamic-clean-json-parse`
18. `jsts-dynamic-clean-shadowed-eval`
19. `jsts-dynamic-positive-eval`
20. `jsts-dynamic-positive-function`
21. `kubernetes-privileged-clean-false`
22. `kubernetes-privileged-clean-omitted`
23. `kubernetes-privileged-positive-container`
24. `kubernetes-privileged-positive-init-container`
25. `secrets-github-clean-env`
26. `secrets-github-clean-near-miss`
27. `secrets-github-positive-classic`
28. `secrets-github-positive-fine-grained`
29. `terraform-rds-clean-false`
30. `terraform-rds-clean-omitted`
31. `terraform-rds-positive-basic`
32. `terraform-rds-positive-with-other-fields`

Use the exact supported fixture concepts already proven by scanner tests:

- secrets positives: synthetic `ghp_` + 36 `A`s and `github_pat_` + 20 `A`s; clean env reference and `ghp_short`. README explicitly says synthetic/not usable.
- dynamic positives: direct global `eval(...)`, `new Function(...)`; clean `JSON.parse`, shadowed `eval` parameter.
- command positives: Express `req.query` -> imported `exec`; Express body -> imported `execSync`; clean numeric conversion and `execFile`.
- Docker positives: `FROM node`, `FROM node:latest`; clean explicit version and 64-hex digest.
- Kubernetes positives: `privileged: true` in container and initContainer; clean `false` and omitted.
- Terraform positives: `aws_db_instance` with `publicly_accessible = true`; clean false and omitted.
- GitHub Actions positives: workflow/job `permissions: write-all`; clean explicit least-privilege map and `read-all`.
- npm config positives: `strict-ssl=false` and last-setting-wins false; clean default and remediated last-setting-wins true.

Every positive case declares expected file, severity, confidence, and expected CWE where the built-in rule defines one. Every case README states why the label is correct and, for clean cases, why the similar construct is intentionally not in rule scope.

Integration tests require exactly 32 unique cases, eight represented rules, zero infrastructure error/unsupported outcomes, and zero contract mismatches. **Do not require perfect metrics by changing labels to match scanner output.** If an unexpected FP/FN occurs, independently review scanner behavior and ground truth.

GREEN:

```bash
npx vitest run tests/validation-accuracy/offline-v1-corpus.test.ts tests/validation-accuracy
npm run typecheck
```

Commit: `test: add offline-v1 accuracy corpus [skip ci]`.

---

## Task 6: Permanent authority, privacy, and ground-truth mutation guards

Create:
- `tests/architecture/validation-accuracy-dependencies.test.ts`
- `tests/validation-accuracy/ground-truth-security.test.ts`

Expand privacy tests.

Architecture guard rejects validation-package imports/source primitives for Next/React/Supabase, runtime-network/observer/validator, runtime workers/supervisors/control, `node:child_process`, `node:vm`, `node:http`, `node:https`, `node:dns`, `node:net`, `node:tls`, `node:dgram`, `node:worker_threads`, dynamic import, `eval`, `new Function`, `fetch`, and app/lib hosted mutation modules.

Ground-truth test hashes every `corpus.json`, `case.json`, README, and repository file before evaluation/report output and after; hashes must remain byte-identical. Output paths within corpus must fail before write.

Privacy rejects both synthetic secret values, absolute temporary roots, fixture contents, finding evidence, metadata, remediation text, run-scan timestamps, and durations.

GREEN and commit: `test: lock Phase 8A validation authority [skip ci]`.

---

## Task 7: Methodology and resumable state

Modify `docs/validation/METHODOLOGY.md`, central state docs, and create `docs/development/PHASE_8_WORKING_STATE.md`.

Record actual exact evidence only:
- corpus ID/version/hash
- 32 cases / eight rules
- exact raw per-rule counts and derived covered-corpus metrics
- zero/nonzero errors/unsupported/mismatches
- exact branch/head and commands
- Phase 8B performance matrix next
- Phase 8C publication later
- worker gates remain disabled
- V5/UI remains separate
- branch cleanup still required after integration

Do not pre-write success before verification.

GREEN focused tests/typecheck and commit: `docs: record Phase 8A accuracy foundation [skip ci]`.

---

## Task 8: Freeze exact tree, preflight, one CI gate, review, merge

1. Freeze one exact GitHub candidate.
2. In a clean disposable Linux checkout/archive, run:

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

Split commands if the verifier has a 120-second ceiling. Clean old temp archives to avoid disk exhaustion.

3. Run evaluator twice with identical provenance and require byte-identical JSON/Markdown.
4. Require 32 outcomes, eight rules, no ground-truth mutation, no privacy leakage, zero infrastructure errors/unsupported and zero contract mismatches for the committed v1 corpus.
5. Create/update one **draft** PR named `Phase 8A offline accuracy foundation` with exact SHA/hash/count/evidence and covered-corpus non-claim.
6. Review the complete base-to-head diff. Must contain no dashboard/V5, Supabase migration, runtime worker/network authority, production capability, or dependency-graph drift. `git diff --check` must be clean.
7. Trigger exactly one final GitHub-hosted Linux CI run on the already-preflighted tree. If `[skip ci]` suppresses events, create one empty tree-identical verification commit without a skip token.
8. Require exact-head CI, Vercel status reconciliation, zero unresolved review threads, and mergeability.
9. Squash merge with expected-head protection and `[skip ci]` release subject after exact merge-ref validation.
10. Verify `main` and production Vercel after merge. Reconcile docs to Phase 8A complete / Phase 8B next.
11. Delete the merged Phase 8A branch only with a true delete-ref operation. Never force-move an obsolete branch to simulate deletion. Preserve PR #49 and all active V5/UI branches.

## Definition of done

Phase 8A is done only when the 32-case corpus is strict/bounded/fully hashed, evaluator semantics match the approved spec, errors/unsupported are excluded from confusion-matrix denominators, JSON/Markdown are deterministic/privacy-safe, ground truth is mutation-proof, no new authority/dependency/UI drift exists, full preflight is green, one exact-head Linux CI gate is green, integration is verified, and the handoff identifies Phase 8B as next.

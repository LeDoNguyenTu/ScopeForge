# Phase 8 Validation, Accuracy, and Public Methodology Design

Status: approved design, implementation not started

Date: 2026-09-05

Base: `main` at `222d9591dbd5e357d179eb06407b0787a2efef7f`

Design branch: `design/phase-8-validation-accuracy-v1`

## 1. Purpose

Phase 8 turns ScopeForge's existing validation methodology into reproducible, reviewable evidence for scanner correctness, detection quality, performance, and limitations.

The repository already has strong deterministic regression evidence, hostile-input safety coverage, golden output tests, and the `scanner-medium-v1` benchmark. It does not yet have a committed labeled accuracy corpus, a confusion-matrix evaluator, materially different performance fixtures, or public technical reports that can support defensible accuracy claims.

This phase must close those gaps without widening scanner authority, runtime networking, hosted mutation, worker capability, Supabase schema, or dashboard behavior.

## 2. Selected approach

Use a staged, offline-first in-repository validation system.

### Phase 8A - Accuracy foundation

Add:

- a versioned machine-readable labeled corpus
- small deterministic vulnerable and negative-control repositories
- a strict corpus parser and validator
- a case-level evaluator over existing built-in scanners
- deterministic JSON accuracy output
- deterministic Markdown rendering from the same normalized result
- rule-level confusion-matrix reporting
- explicit unsupported/error accounting

The first accuracy corpus covers only deterministic offline scanner behavior.

### Phase 8B - Performance matrix

Preserve `scanner-medium-v1` unchanged and add generated fixtures representing materially different repository shapes, including:

- source/AST-heavy repositories
- dependency/lockfile-heavy repositories
- IaC-heavy repositories

Each benchmark keeps correctness gates attached to timing. A run that silently skips expected files, changes expected findings, or emits scanner errors is invalid even if it is fast.

### Phase 8C - Public technical reporting

Generate reviewable technical reports that include:

- exact ScopeForge commit
- corpus/fixture version
- rule versions
- raw TP/FN/FP/TN counts
- derived metrics only when denominators are defined
- unsupported/error counts
- benchmark measurements
- environment/provenance
- known blind spots and limitations

No report may describe covered-corpus results as global ScopeForge accuracy.

## 3. Rejected alternatives

### 3.1 One monolithic all-scanner benchmark release

Rejected because it would couple ground-truth review, metric semantics, performance work, optional network behavior, and reporting into one large release. That makes errors harder to isolate and encourages misleading aggregate claims.

### 3.2 External benchmark service or separate validation repository

Rejected because validation evidence should remain reviewable beside the exact scanner code, rule versions, fixtures, and CI configuration it evaluates.

### 3.3 Reusing ordinary scanner tests as precision/recall evidence

Rejected because pass/fail regression tests do not create a labeled denominator and cannot support valid precision, recall, FPR, or F1 claims.

## 4. Hard safety and scope boundaries

Phase 8 is local validation infrastructure.

It MUST NOT:

- add Supabase migrations
- change RLS/auth/database mutation authority
- enable Phase 6B, 6C, or 6D production worker capabilities
- add active runtime validation profiles
- add generic network access
- execute repository code
- run package managers, lifecycle hooks, shell commands, container workloads, or target build systems
- add browser authority
- add hosted Security Pack activation
- modify dashboard V5/UI source
- change the active Command Center workstream
- claim production runtime enablement

The first accuracy corpus MUST NOT require OSV or any other network-backed advisory lookup.

Optional network-backed dependency advisory accuracy is a later, separately reported measurement class.

## 5. Architecture

Phase 8A introduces a small framework-independent validation package above existing local scanner contracts.

Proposed structure:

```text
packages/validation-accuracy/
  contracts.ts
  error.ts
  parse.ts
  evaluate.ts
  metrics.ts
  report-json.ts
  report-markdown.ts
  cli.ts

validation/
  corpus/
    offline-v1/
      corpus.json
      cases/
        <case-id>/
          case.json
          README.md
          repository/
            ...

benchmarks/
  scanner-medium-fixture.mjs
  scanner-medium.mjs
  scanner-source-heavy-fixture.mjs
  scanner-source-heavy.mjs
  scanner-lockfile-heavy-fixture.mjs
  scanner-lockfile-heavy.mjs
  scanner-iac-heavy-fixture.mjs
  scanner-iac-heavy.mjs

docs/validation/
  METHODOLOGY.md
  reports/
    offline-v1.md
  results/
    offline-v1.json
```

Exact filenames may be adjusted during implementation only when doing so preserves these boundaries and keeps responsibilities separated.

## 6. Corpus contract

### 6.1 Corpus index

`validation/corpus/offline-v1/corpus.json` is the authoritative corpus index.

It contains only bounded metadata and case references.

Required conceptual fields:

- `schemaVersion`: exactly `1`
- `corpusId`: stable identifier such as `scopeforge-offline-v1`
- `corpusVersion`: immutable version string
- `cases`: ordered list of relative case directories

The parser rejects:

- unknown top-level keys
- duplicate keys
- duplicate case paths
- absolute paths
- `..` traversal
- backslashes or drive-relative path forms
- empty case sets
- unsupported schema versions
- out-of-budget case counts

### 6.2 Case contract

Each `case.json` represents one binary rule-evaluation unit.

A v1 case targets exactly one built-in rule. This keeps confusion-matrix semantics unambiguous.

Required conceptual fields:

- `schemaVersion`: exactly `1`
- `caseId`: stable unique identifier
- `scanner`: exact built-in scanner family
- `ruleId`: exact built-in rule ID
- `label`: `vulnerable` or `clean`
- `repository`: exactly the local `repository` directory
- `rationale`: bounded human-readable explanation

Positive cases additionally require:

- one or more expected repository-relative file paths
- expected severity
- expected confidence

Optional metadata may include:

- CWE mapping expected from the rule
- remediation case relationship
- notes describing the nearby negative/control construct

Case manifests MUST NOT contain raw real credentials, production targets, executable test instructions, or environment secrets.

### 6.3 Case identity

`caseId` is stable across harmless fixture line movement.

Changing the vulnerability concept or target rule requires a new case ID.

Changing only formatting while preserving the same concept may retain the case ID if the expected rule/file contract remains unchanged.

Corpus versions are immutable once used for a published report. Material ground-truth changes require a new corpus version.

## 7. Initial offline-v1 coverage

The first corpus should cover representative deterministic rule families already implemented in ScopeForge.

The initial selected set should include at least one reviewed rule from each of:

- secrets
- JavaScript/TypeScript structural SAST
- JavaScript/TypeScript bounded command taint
- Docker
- Kubernetes
- Terraform
- GitHub Actions
- generic configuration

For each selected rule, the corpus should include multiple cases across:

- clearly vulnerable positives
- structurally similar negatives/near misses
- a remediated form where practical
- at least one case intended to catch a known false-positive boundary

The implementation plan should target approximately 4-6 cases per selected rule, producing a first corpus large enough to expose obvious precision/recall regressions without pretending to be representative of all software ecosystems.

Secrets fixtures use synthetic detector-shaped values only. They must never contain a valid credential.

## 8. Corpus filesystem safety

Corpus content is committed by ScopeForge maintainers but is still treated as potentially hostile input.

Validation must preserve existing repository safety semantics:

- root containment
- no symlink following
- no hard-link ambiguity where identity guarantees would be weakened
- no special files
- bounded file count
- bounded byte count
- bounded individual file size
- deterministic traversal
- no target execution
- no target dependency installation
- no target network behavior

Ground-truth manifest reads must be bounded and no-follow.

The evaluator is read-only with respect to the corpus. There is no command that rewrites labels from current scanner output.

## 9. Evaluator semantics

### 9.1 Unit of evaluation

The confusion-matrix unit is one case for one target rule.

A case cannot inflate TP/FP counts through duplicate findings.

### 9.2 Positive case

For `label: vulnerable`:

- TP: the exact target rule produces at least one finding in an expected file
- FN: the target rule produces no qualifying finding and the case completed without scanner/inventory error
- ERROR/UNSUPPORTED: the case cannot be evaluated reliably because the relevant scanner path failed or coverage was incomplete

A finding for the correct rule in an unrelated file does not satisfy the positive contract.

### 9.3 Negative case

For `label: clean`:

- FP: the exact target rule produces any finding in the case repository
- TN: the exact target rule produces no finding and the case completed without scanner/inventory error
- ERROR/UNSUPPORTED: the case cannot be evaluated reliably

Scanner errors are never converted into TN.

### 9.4 Unexpected other rules

Findings from non-target rules are recorded as unexpected findings for review but do not become the target rule's TP or FP.

This prevents one rule from being credited for another rule's detection.

### 9.5 Severity/confidence contract

For positive cases, detection accuracy and finding-contract correctness are measured separately.

If the expected target rule fires in the expected file but severity/confidence differs:

- detection classification remains TP
- a contract mismatch is recorded
- release acceptance fails until the mismatch is reviewed and ground truth or rule behavior is intentionally reconciled

This prevents detection metrics from hiding functional metadata regressions.

## 10. Metrics

For every selected rule, emit raw counts:

- TP
- FN
- FP
- TN
- ERROR/UNSUPPORTED
- contract mismatch count

Derived metrics:

- precision = TP / (TP + FP)
- recall = TP / (TP + FN)
- false-positive rate = FP / (FP + TN)
- F1 = 2 * precision * recall / (precision + recall)

When a denominator is zero, the metric is `null`/undefined rather than invented as zero or one.

Metrics are calculated from integer counts using deterministic rounding only at presentation time.

The machine-readable result should preserve full raw counts as the source of truth.

## 11. Aggregation rules

Rule-level results are primary.

A covered-corpus aggregate may be emitted only when clearly labeled as an aggregate over the selected `offline-v1` cases.

The report MUST NOT call that value:

- global ScopeForge precision
- global ScopeForge recall
- production accuracy
- industry-wide accuracy

Unsupported families and unrepresented rules must be listed explicitly.

## 12. Accuracy result schema

The normalized JSON result is deterministic and contains no source snippets or fixture contents.

Conceptual fields:

- result schema version
- ScopeForge version
- ScopeForge commit SHA supplied by the caller or CI
- corpus ID/version
- corpus content identity/hash
- selected rule versions
- environment metadata
- total case counts
- per-rule raw counts
- derived metrics
- case outcomes by stable case ID
- contract mismatches
- unexpected rule IDs by case
- unsupported/error diagnostics using fixed bounded messages

Case output may include repository-relative file paths but must not include source lines or secret-like fixture values.

Repeated evaluation of the same commit/corpus/environment inputs must serialize result structure and ordering identically except for explicitly measured runtime fields if those are included.

No wall-clock timestamp is generated implicitly. If a report needs a publication date, it is supplied explicitly by the release process.

## 13. Markdown reporting

Markdown is rendered from the normalized JSON result, not from a second independent calculation path.

Required sections:

- scope and corpus coverage
- exact commit and corpus identity
- environment
- per-rule TP/FN/FP/TN table
- derived metrics
- unsupported/error counts
- contract mismatches
- known blind spots
- interpretation limits

The renderer must use stable ordering and fixed formatting.

No raw fixture contents, detected secret values, arbitrary finding evidence, or local absolute paths are copied into reports.

## 14. Developer execution surface

Phase 8 validation is developer/release tooling, not a new end-user product command.

Preferred integration:

- compile the validation package through the existing TypeScript build path
- add an npm script such as `validation:accuracy`
- invoke the compiled evaluator with explicit corpus and output arguments

The implementation should avoid adding a new runtime dependency solely for executing TypeScript scripts.

A public `scopeforge` CLI subcommand is not required for v1.

## 15. Phase 8B performance matrix

### 15.1 Existing benchmark remains immutable

`scanner-medium-v1` remains the continuity baseline and is not redefined to make later performance look better.

### 15.2 New fixture classes

Add deterministic generators for materially different workloads within existing scanner safety budgets.

#### Source-heavy

Emphasizes:

- JavaScript/TypeScript parsing
- AST traversal
- bounded taint analysis
- many small/medium source files

The fixture declares expected file count, finding count, and error count.

#### Dependency-heavy

Emphasizes:

- large deterministic lockfile parsing
- dependency inventory construction
- local/offline behavior only

No OSV network lookup is part of this benchmark.

#### IaC-heavy

Emphasizes:

- Dockerfiles
- Kubernetes YAML
- Terraform
- GitHub Actions
- generic configuration

The fixture declares correctness expectations in addition to timing.

### 15.3 Threshold policy

Performance thresholds are not invented before measurements exist.

For each new benchmark:

1. generate the deterministic fixture
2. verify correctness
3. collect repeated reference measurements in a documented Linux environment
4. record individual runs and median
5. choose a broad catastrophic regression ceiling with written rationale
6. distinguish that ceiling from any future product SLO

The initial implementation may land the benchmark and measurement protocol before a strict relative regression budget if the evidence is not yet strong enough to justify one.

## 16. Phase 8C technical reports

A public report release contains both:

- machine-readable JSON under `docs/validation/results/`
- human-readable Markdown under `docs/validation/reports/`

Every published report must identify:

- exact git commit
- ScopeForge CLI/tool version
- corpus version/hash
- benchmark fixture versions
- rule versions where applicable
- Node.js version
- OS and architecture
- commands used
- raw accuracy counts
- performance measurements
- limitations

Measured timing values are evidence, not deterministic golden text. Report schema/order remains deterministic, while the actual measured numbers may differ across environments.

## 17. Review protection for ground truth

Ground truth is part of the security/research evidence base and receives stronger review rules than ordinary snapshots.

Implementation must make it difficult to silently redefine success.

Required protections:

- labels stored separately from generated scanner output
- no auto-update-label command
- exact schema validation
- stable unique case IDs
- duplicate case rejection
- corpus versioning
- tests proving scanner output cannot mutate labels
- PR review checklist requiring rationale for label changes
- generated reports cannot overwrite corpus labels

Changes that alter labels after a report is published require a new corpus version and an explanation in the technical report history.

## 18. Testing strategy

Implementation follows TDD but does not use intentionally failing GitHub Actions runs as the first feedback loop.

Required test classes include:

### Contracts/parser

- exact valid corpus/case parsing
- duplicate keys
- unknown keys
- duplicate case IDs
- path traversal
- absolute/backslash/drive paths
- unsupported schema versions
- budget enforcement
- bounded no-follow reads

### Evaluator

- TP
- FN
- FP
- TN
- scanner error is not TN/FN
- duplicate findings do not inflate counts
- unexpected rule does not satisfy target rule
- expected-file mismatch does not become TP
- severity/confidence mismatch remains TP plus contract error
- zero-denominator derived metrics become null

### Privacy/determinism

- repeated JSON output byte-identical for deterministic inputs
- repeated Markdown output byte-identical for deterministic inputs
- no source snippet leakage
- no synthetic secret leakage
- no absolute local root leakage

### Architecture/safety

- validation package cannot import process execution, VM, browser, worker, runtime-network, Supabase, or hosted mutation authority
- no network dependency in offline-v1 evaluation
- corpus repositories remain behind existing safe inventory/read boundaries

### Integration

- complete offline-v1 corpus evaluation produces the expected case count
- zero evaluator infrastructure errors
- zero unresolved finding-contract mismatches at release
- report generation uses the normalized evaluator result

### Performance

- each generator produces deterministic file identities/content
- expected analyzed file/finding/error counts are enforced
- benchmark output schema is stable
- benchmark correctness failure invalidates timing result

## 19. CI and preflight policy

The user has explicitly requested that CI allowance not be wasted on predictable failures.

Phase 8 uses this policy:

1. Work on an isolated Phase 8 branch.
2. Keep PR draft during implementation.
3. Use local/disposable Linux preflight as the primary feedback loop.
4. Run focused tests before full tests.
5. Run typecheck and CLI build/smoke before pushing a release candidate.
6. Use `[skip ci]` for intermediate commits when no hosted confirmation is needed.
7. Do not push deliberate RED commits solely to make GitHub Actions fail.
8. Before final CI, freeze one exact tree and run:
   - focused Phase 8 tests
   - full test suite
   - typecheck
   - CLI build/version
   - accuracy evaluator
   - scanner benchmark matrix
   - npm audit
   - production Next.js build
9. Trigger one final GitHub-hosted Linux acceptance run on the already-preflighted exact tree.
10. Diagnose any failure before another run. No blind reruns.

Vercel preview status is monitored separately from scanner validation so deployment-environment failures are not misreported as Phase 8 code failures.

## 20. Branch and UI isolation

Phase 8 work starts from current `main` and remains isolated from the active Command Center/V5 branches.

Do not merge, rebase, retarget, rewrite, or delete:

- PR #49
- `preview/command-center-v5-*`
- `diag/v5-*`
- other active V5/UI branches

Phase 8 must not change dashboard/UI source unless a later separately approved UI task explicitly requires it.

## 21. Release and branch hygiene

After a Phase 8 implementation PR is safely merged:

- verify `main` exact merge commit
- verify production Vercel status if the merge triggers a deployment
- update handoff/roadmap documents
- delete the merged Phase 8 implementation branch when tooling permits
- prune completed backend branches only after confirming their work is safely represented in `main` or permanent history
- preserve all still-active V5/UI branches

Branch deletion must never be approximated by force-moving an obsolete branch name to `main`.

## 22. Phase 8 completion criteria

Phase 8 is complete only when all of the following exist and are verified:

1. A versioned offline labeled corpus with representative positive, negative, near-miss, and remediation cases.
2. Strict machine-readable ground truth separate from scanner output.
3. A deterministic evaluator producing raw confusion-matrix counts and valid derived metrics.
4. Explicit unsupported/error handling that never converts incomplete coverage into a clean result.
5. Deterministic JSON and Markdown reporting without source/secret leakage.
6. At least three materially different performance workloads in addition to `scanner-medium-v1`.
7. Documented benchmark threshold rationale based on collected measurements.
8. A public technical report with exact provenance and limitations.
9. Review protections preventing scanner output from silently redefining labels.
10. Full local preflight plus one exact-head GitHub-hosted Linux acceptance gate.
11. No widening of runtime, network, hosted mutation, worker, Supabase, or browser authority.
12. No dashboard V5/UI drift.

## 23. Explicit non-claims after Phase 8

Even after Phase 8 completes, ScopeForge must not claim that the first corpus proves universal scanner accuracy across arbitrary languages, frameworks, ecosystems, repository sizes, or vulnerability classes.

The correct claim is narrower: ScopeForge publishes reproducible rule-level and covered-corpus measurements for the committed cases, with raw counts, environment, and limitations available for review.

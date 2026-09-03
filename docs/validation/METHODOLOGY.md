# ScopeForge Validation Methodology

ScopeForge publishes validation evidence so scanner behavior can be evaluated from reproducible tests rather than marketing claims.

This document is the Phase 8 methodology foundation. It records what the repository can measure today, what it cannot yet measure honestly, and the acceptance rules for future public benchmark and vulnerable-lab reports.

## Principles

1. **Reproducible before impressive.** A measurement must be rerunnable from committed code and fixtures before it is used as a public claim.
2. **Detection quality and performance are separate measurements.** A fast scanner is not necessarily an accurate scanner, and an accurate fixture does not prove representative performance.
3. **Negative fixtures matter.** Clean code and infrastructure fixtures are required to detect false-positive regressions.
4. **Hostile-input safety is part of scanner quality.** A security scanner that executes target content, escapes the target tree, leaks source, or silently treats malformed coverage as clean is not acceptable even if its detection counts look good.
5. **Output stability is testable.** Machine-readable and human-readable outputs are versioned behavior and should not drift accidentally.
6. **No invented precision or recall.** ScopeForge will not publish precision, recall, F1, or false-positive rates until the corresponding labeled corpus and counting protocol are committed and reviewable.
7. **Limitations are part of the result.** Unsupported languages, parser gaps, intentionally bounded analyses, disabled network lookups, and environment-dependent measurements must be stated beside the result.

## Current evidence baseline

### Medium repository performance fixture

The repository contains `benchmarks/scanner-medium-fixture.mjs` and `benchmarks/scanner-medium.mjs`.

The current fixture identity is:

- fixture: `scanner-medium-v1`
- expected analyzed files: `700`
- source files: 310 TypeScript and 310 JavaScript modules
- infrastructure files: 15 Dockerfiles, 15 Kubernetes manifests, 15 Terraform files, and 15 GitHub Actions workflows
- configuration files: 8 `.npmrc` files and 8 Vercel configuration files
- dependency manifests: one `package.json` and one `package-lock.json`
- documentation files: two Markdown files

The fixture is intentionally clean. A successful benchmark requires:

- exactly 700 analyzed files
- zero findings
- zero scanner errors
- valid scanner-reported duration metadata
- no stderr output
- successful scanner exit
- wall time no greater than the catastrophic regression ceiling of 20,000 ms

The benchmark records:

- fixture name
- files analyzed
- finding count
- error count
- scanner-reported duration
- measured wall time
- process RSS delta
- configured wall-time ceiling

The 20-second value is a catastrophic regression guard, not a statement that 20 seconds is an acceptable product latency target.

Performance comparisons should record the exact commit, Node.js version, operating system, architecture, CPU allocation, memory allocation, cold/warm state where relevant, and the complete emitted `SCOPEFORGE_BENCHMARK` object. Results from materially different environments must not be presented as directly comparable without qualification.

### Golden output continuity

`tests/scanner/output/golden-output.test.ts` compares committed expected output against the actual serializers for:

- native ScopeForge JSON
- SARIF
- terminal output

The test uses a fixed scan result containing deterministic findings, inventory, errors, policy state, evidence, remediation metadata, fingerprints, locations, severity, confidence, CWE, and OWASP mappings.

Each serializer is also invoked twice and required to return the same output. This protects deterministic output behavior and catches accidental schema/text drift.

Golden-output continuity does **not** measure finding accuracy. It measures representation stability.

### Hostile repository safety

`tests/scanner/integration/phase3-hostile-repository.test.ts` builds a hostile repository containing:

- source code that would write a marker if executed
- a malicious package lifecycle script
- malformed package/configuration/infrastructure content
- an oversized source file
- a symlink to data outside the repository
- sensitive sentinels that must not appear in output

The test requires ScopeForge to:

- never execute target source or package lifecycle content
- perform no default scanner network request in the tested path
- not follow the external symlink
- report malformed scanner coverage as errors instead of clean success
- record bounded skip reasons such as symlink and file-size exclusions
- continue to detect an analyzable dynamic-code-execution finding
- keep source/configuration/outside-secret sentinels out of JSON, terminal, and SARIF output

These tests are security-boundary tests. They are not a substitute for accuracy evaluation on labeled vulnerabilities.

## Measurement classes

ScopeForge Phase 8 reports will distinguish the following measurement classes.

### 1. Functional regression

Question: does a known scanner behavior still work?

Examples:

- expected rule fires on a fixed fixture
- expected clean fixture remains clean
- baseline classification remains stable
- JSON/SARIF output remains deterministic

A functional regression result is pass/fail and must not be represented as precision or recall.

### 2. Safety regression

Question: does hostile input preserve the scanner's authority and privacy boundaries?

Examples:

- target code is not executed
- symlinks cannot escape the scan root
- scanner output does not leak raw secrets or fixture sentinels
- malformed content does not become a silent clean result
- network access remains absent where the scanner contract says it is absent

### 3. Performance regression

Question: does a fixed workload remain within a stated resource envelope?

At minimum reports should include wall time. Where available they should include process RSS delta and scanner-reported duration. A performance threshold must identify whether it is:

- a catastrophic ceiling
- a regression budget relative to a baseline
- a product SLO

Those categories must not be conflated.

### 4. Detection accuracy

Question: how often does a rule identify labeled vulnerable and non-vulnerable examples correctly?

This class requires a labeled corpus. For a binary rule evaluation, ScopeForge will use:

- **TP**: labeled vulnerable case detected by the expected rule
- **FN**: labeled vulnerable case not detected by the expected rule
- **FP**: labeled non-vulnerable case incorrectly detected by the rule
- **TN**: labeled non-vulnerable case not detected by the rule

Derived metrics, when denominators are non-zero:

- precision = TP / (TP + FP)
- recall = TP / (TP + FN)
- false-positive rate = FP / (FP + TN)
- F1 = 2 * precision * recall / (precision + recall)

A report must publish the raw TP/FN/FP/TN counts beside derived percentages.

## Labeled corpus rules

ScopeForge does not yet claim repository-wide precision/recall because a representative committed labeled corpus has not been completed.

Future Phase 8 corpora must follow these rules:

1. Every case has a stable identifier.
2. Every case declares the expected scanner and rule ID.
3. Every positive case states why it is vulnerable and where the relevant source/sink/configuration behavior exists.
4. Every negative case states why the superficially similar construct is safe or outside rule scope.
5. Fixtures contain no hidden network or package-install dependency unless the measurement explicitly evaluates such behavior.
6. Expected labels are version-controlled separately from scanner output so scanner changes cannot silently rewrite ground truth.
7. Scanner output is normalized before comparison, but normalization cannot erase rule identity or convert an unexpected rule into the expected rule.
8. Duplicate findings from one root cause must follow a documented counting policy.
9. Parser/scanner errors are not counted as true negatives.
10. Unsupported cases remain unsupported and are excluded from the accuracy denominator with an explicit count and reason.

## Required negative-case design

A useful accuracy corpus must contain more than obviously safe files. Negative cases should deliberately resemble vulnerable constructs.

Examples include:

- fixed arguments adjacent to shell execution APIs
- sanitized or allow-listed values
- unreachable or non-request-controlled values where the rule claims request-to-sink flow
- secure Docker/Kubernetes/Terraform configurations near insecure variants
- pinned or permission-restricted GitHub Actions variants
- configuration files with safe CORS/TLS/security settings
- strings that resemble secrets but fail provider structure or entropy requirements

This is necessary to measure whether a detector distinguishes relevant context rather than only matching suspicious tokens.

## Vulnerable-lab protocol

Phase 8 vulnerable labs should be small, deterministic, offline-first fixtures rather than production-like applications with unrelated behavior.

Each lab should contain:

- a README describing the vulnerability
- one or more positive fixtures
- at least one nearby negative/control fixture
- the expected rule ID and severity/confidence contract
- a remediation variant when practical
- a verification step demonstrating that rescanning the remediated variant removes the expected finding without suppressing unrelated findings

Labs must not require real credentials, destructive operations, external targets, or uncontrolled exploit execution.

## Rule-level reporting

Public accuracy reports should be rule-level first. Aggregated scanner-wide statistics may be published only when the aggregation method is documented.

A rule report should include:

| Field | Required |
| --- | --- |
| ScopeForge commit | yes |
| Rule ID and rule version | yes |
| Fixture/corpus version | yes |
| Positive cases | yes |
| Negative cases | yes |
| TP / FN / FP / TN | yes |
| Precision / recall / FPR / F1 | when defined |
| Unsupported/error count | yes |
| Known blind spots | yes |
| Environment | yes |

If a rule intentionally optimizes for precision over recall, that should be stated rather than hidden behind a single aggregate score.

## Performance reporting protocol

For reproducible scanner performance reports:

1. Build the CLI from the exact tested commit.
2. Generate the committed benchmark fixture from source.
3. Run the documented benchmark command without modifying fixture content.
4. Record the complete emitted benchmark object.
5. Record Node.js and host/runtime information.
6. Repeat measurements when making comparative claims.
7. Report individual runs plus the chosen summary statistic. Do not report only the fastest run.
8. Keep correctness gates enabled. A fast run that skips files, emits errors, or changes expected findings is invalid.

The existing `scanner-medium-v1` benchmark is a clean-repository throughput/regression fixture. It must not be used to claim performance on large monorepos, deeply nested dependency graphs, large lockfiles, or repositories dominated by complex AST/IaC inputs until separate fixtures cover those workloads.

## Reproducibility and provenance

Every published Phase 8 result should be traceable to:

- repository commit SHA
- fixture/corpus version
- rule versions
- CLI/tool version
- command used
- relevant configuration
- runtime environment
- raw machine-readable result where practical

A screenshot alone is not benchmark evidence.

## Current limitations

As of this methodology foundation:

- ScopeForge has strong deterministic regression, hostile-input, output-continuity, and medium-fixture performance evidence.
- The repository does not yet contain a complete representative labeled accuracy corpus across all scanners.
- Therefore ScopeForge should not claim global precision, recall, F1, or false-positive percentages yet.
- The medium benchmark is synthetic and clean by design.
- RSS delta is a useful signal but is not a peak-memory measurement.
- Wall-clock timing is environment-sensitive.
- Optional network-backed dependency advisory behavior must be evaluated separately from offline scanner behavior.
- Passing hostile-input tests does not prove absence of every possible parser, archive, filesystem, or sandbox vulnerability.

## Phase 8 completion direction

This methodology foundation is complete when it is present and reviewable. Phase 8 as a roadmap phase is **not** complete until ScopeForge also has:

1. versioned vulnerable and negative-control labs for representative rule families
2. machine-readable ground-truth labels
3. an accuracy evaluator that emits raw confusion-matrix counts and derived metrics
4. additional performance fixtures for materially different repository shapes
5. regression thresholds with documented rationale
6. public technical reports that include limitations and raw provenance
7. review rules preventing benchmark/ground-truth changes from silently redefining success

Until those artifacts exist, public claims should stay within the evidence described in this document.

# ScopeForge Validation Methodology

ScopeForge publishes validation evidence so scanner behavior can be evaluated from reproducible tests rather than marketing claims.

This document defines the implemented Phase 8A offline accuracy protocol and the Phase 8B local/offline performance-matrix protocol.

## Principles

1. **Reproducible before impressive.** Measurements must be rerunnable from committed code and fixtures.
2. **Accuracy and performance are separate.** Fast does not imply accurate, and a small correct corpus does not imply representative speed.
3. **Correctness gates precede timing.** A benchmark cannot pass by skipping files, parsers, rules, or work.
4. **Ground truth is independent of scanner output.** Scanner output cannot rewrite labels or fixture bytes.
5. **Errors are not clean results.** Scanner/inventory failures never become FN/TN or benchmark success.
6. **Negative and near-miss fixtures matter.** They expose false-positive regressions.
7. **Hostile-input safety is part of quality.** Path escape, source execution, unsafe reads, or data leakage fail closed.
8. **Limitations travel with results.** Unsupported behavior and bounded analyses must stay visible.
9. **No unsupported global claims.** Corpus metrics describe the covered corpus only; benchmark ceilings are regression guards, not product SLOs.

The Phase 8A interpretation string remains:

> Metrics describe only the committed covered corpus and are not global ScopeForge accuracy.

## Phase 8A offline accuracy protocol

### Committed corpus

`scopeforge-offline-v1@1.0.0` under `validation/corpus/offline-v1` contains:

- 32 reviewed cases
- 16 vulnerable / 16 clean
- 8 represented rules
- scanner families: `iac`, `jsts`, `secrets`
- 97 corpus files
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Represented rules:

- `iac/config-npm-strict-ssl-disabled`
- `iac/docker-floating-base-image`
- `iac/github-actions-write-all-permissions`
- `iac/kubernetes-privileged-container`
- `iac/terraform-aws-public-rds`
- `jsts/command-injection`
- `jsts/dynamic-code-execution`
- `secrets/github-token`

Each represented rule has two vulnerable and two clean/near-miss cases.

### Current covered-corpus result

| Count | Value |
| --- | ---: |
| TP | 16 |
| FN | 0 |
| FP | 0 |
| TN | 16 |
| Error | 0 |
| Unsupported | 0 |
| Contract mismatch | 0 |

Derived metrics for this corpus:

- precision 1.00
- recall 1.00
- false-positive rate 0.00
- F1 1.00

These are regression-quality values for the 32 committed reviewed cases only. They are not repository-wide, scanner-wide, or real-world accuracy claims.

### Counting protocol

For one case and one declared target rule:

- TP: vulnerable case produces the target rule in an expected file
- FN: vulnerable case does not produce the target rule in an expected file
- FP: clean case produces the target rule
- TN: clean case does not produce the target rule

A case contributes at most one binary outcome even if duplicate target findings exist. A target finding in the wrong file does not satisfy a vulnerable case. Findings from other rules are recorded separately.

Severity, confidence, or expected-CWE differences are contract mismatches. Detection can remain TP while metadata mismatch is counted separately.

Scanner/inventory failures are `error` or `unsupported`, excluded from derived-metric denominators.

Derived metrics use:

- precision = TP / (TP + FP)
- recall = TP / (TP + FN)
- FPR = FP / (FP + TN)
- F1 = 2TP / (2TP + FP + FN)

A zero denominator produces `null` and renders as `n/a`; the evaluator never fabricates zero or perfect scores.

### Corpus integrity

The Phase 8A parser enforces:

- exact v1 object shapes and duplicate-key rejection
- stable IDs and rule syntax
- bounded manifest/case/repository sizes
- raw-text deterministic ordering
- traversal/absolute/drive/backslash path rejection
- no symlinks, hard links, or special files
- identity-checked no-follow reads
- complete repository-tree validation independent of ignore files
- deterministic SHA-256 identity over corpus content

Security tests hash the complete committed corpus before and after evaluation/report generation and require byte-for-byte equality.

### Scanner ownership and authority

The evaluator constructs exactly one existing built-in scanner for each represented case. Closed ownership maps the eight rules to `secrets`, `jsts`, or `iac` only.

The accuracy package adds no SCA/OSV network evaluation, Supabase, hosted runtime, worker authority, browser authority, child process, VM execution, network APIs, dynamic import, `eval`, `new Function`, `fetch`, or WebSocket capability. Permanent architecture tests guard this boundary.

### Privacy-reduced accuracy output

Normalized JSON/Markdown reports exclude fixture source, synthetic credential values, absolute roots, scanner evidence snippets, arbitrary metadata, remediation text, timestamps, and scanner timing.

Deterministic provenance contains only the information needed to identify the tool/environment, including ScopeForge version, supplied commit SHA, Node version, platform, and architecture.

## Phase 8B performance-matrix protocol

Phase 8B preserves `benchmarks/scanner-medium-fixture.mjs` and `benchmarks/scanner-medium.mjs` unchanged as the historical `scanner-medium-v1` benchmark.

The new matrix is local/offline and is executed with:

```bash
npm run build:cli
npm run benchmark:matrix
```

The matrix emits one line beginning with:

`SCOPEFORGE_BENCHMARK_MATRIX `

The JSON payload has `schemaVersion: 1`, `runsPerProfile: 3`, and three deterministic profile results.

### Shared measurement contract

Every profile:

- builds its deterministic fixture once
- runs an explicit correctness preflight where required
- performs exactly three timed scans sequentially
- requires exact analyzed-file count
- requires exact finding rule counts
- requires zero scanner errors
- requires empty stderr
- requires valid non-negative scanner duration and wall time
- requires valid non-negative RSS delta
- rejects any run above its catastrophic wall ceiling
- records every raw run before producing simple min/median/max summaries

The timed region covers only the local `runCli` scan call. Fixture generation and profile preflight are outside the timed scan region.

RSS delta is an observational signal, not a peak-memory guarantee and not a pass/fail threshold.

### `source-ast-heavy-v1`

Purpose: stress JS/TS parsing and structural AST analysis while isolating one rule.

Contract:

- 1,201 analyzed files
- 600 generated TypeScript files
- 600 generated JavaScript files
- root `.scopeforge.json`
- scanner selection: `jsts`
- rule selection: `jsts/dynamic-code-execution`
- exact finding count: 4
- scanner errors: 0
- catastrophic wall ceiling: 30,000 ms/run

The four sentinel findings come from two `eval(...)` and two `new Function(...)` constructs in known generated files.

### `dependency-lockfile-heavy-v1`

Purpose: stress deterministic npm lockfile parsing without network-backed advisory work.

Contract:

- 3 analyzed files: `.scopeforge.json`, `package.json`, `package-lock.json`
- scanner selection: `sca`
- `sca.osv.enabled = false`
- timed findings: 0
- scanner errors: 0
- catastrophic wall ceiling: 20,000 ms/run

Before timing, a compiled local preflight must prove:

- exactly 5,000 parsed dependency components
- every component comes from `package-lock.json`
- every component has `certainty === "resolved"`
- parser diagnostics: 0

This preflight is the correctness proof that dependency work actually occurred even though OSV is deliberately disabled and the timed scan emits no vulnerability findings.

### `iac-heavy-v1`

Purpose: stress four IaC parser/rule families in one attributable profile.

Contract:

- 601 analyzed files
- 150 Dockerfiles
- 150 Kubernetes manifests
- 150 Terraform files
- 150 GitHub Actions workflows
- root `.scopeforge.json`
- scanner selection: `iac`
- exact findings:
  - `iac/docker-floating-base-image`: 1
  - `iac/github-actions-write-all-permissions`: 1
  - `iac/kubernetes-privileged-container`: 1
  - `iac/terraform-aws-public-rds`: 1
- scanner errors: 0
- catastrophic wall ceiling: 30,000 ms/run

### Exact CI-admission evidence

The workflow-integrated Phase 8B candidate `c28f4ef150b06adbce26c5836e1e47d00788c670` produced:

- full matrix outer wall: 15.561 s
- sampled benchmark child peak RSS: 61,712 KiB
- CI admission threshold: <=30 s
- decision: accept permanent CI execution

Per-profile median wall times from that run:

- dependency: 2,452 ms
- IaC: 385 ms
- source/AST: 1,237 ms

Every run satisfied its correctness contract and its catastrophic ceiling.

Because the matrix stayed below the evidence-based 30-second admission threshold and reused the already compiled CLI, CI now runs `npm run benchmark:matrix` immediately after the historical `npm run benchmark:scanner` step. A workflow-order regression test was witnessed RED before the workflow change.

This admission threshold controls CI cadence only. It is not a claim about acceptable product latency.

## Performance provenance and comparison rules

Performance evidence should identify:

- exact repository commit SHA
- fixture/profile ID
- Node version
- OS/platform
- architecture
- command
- all three raw runs
- scanner duration
- measured wall time
- RSS delta or sampled peak signal with its exact measurement method
- catastrophic ceiling
- correctness contract outcome

Do not compare materially different machines/environments without qualification. Never publish only the fastest run. Do not present RSS delta as peak RSS. Do not treat catastrophic ceilings as customer-facing SLOs.

## Golden output continuity

`tests/scanner/output/golden-output.test.ts` protects deterministic native JSON, SARIF, and terminal serialization. Golden output is representation-stability evidence, not accuracy evidence.

## Hostile repository safety

Scanner hostile-repository integration tests prove key boundaries against malicious lifecycle content, malformed files, oversized inputs, symlinks, and privacy sentinels. ScopeForge must not execute target repository code, follow unsafe external links, silently convert malformed coverage into clean success, or leak protected fixture values.

These are security-boundary tests, not substitutes for labeled accuracy evaluation.

## Ground-truth review policy

Future corpus changes must preserve:

1. stable case identity and explicit rule ownership
2. documented vulnerable/clean rationale
3. labels version-controlled independently from scanner output
4. no auto-rewrite/snapshot acceptance of labels
5. errors never counted as true negatives
6. unsupported cases kept explicit
7. duplicate findings not inflated into multiple statistical samples
8. independent review of FP/FN before deciding scanner vs fixture/label fault
9. no real credentials, destructive targets, uncontrolled exploit execution, or hidden package/network dependencies in ordinary offline corpora

## Current limitations

- 32 Phase 8A cases do not represent the full real-world input distribution.
- Only eight deterministic rules are represented by the accuracy corpus.
- SCA/OSV network-backed advisory accuracy is not evaluated in Phase 8A.
- Global scanner/repository accuracy metrics remain unsupported.
- Phase 8B fixtures are generated synthetic workloads, not a representative production repository sample.
- Wall-clock timing is environment-sensitive.
- RSS delta is not peak-memory measurement.
- Passing hostile-input and architecture tests does not prove absence of every parser/filesystem/security defect.

## Phase 8 continuation

Phase 8A provides the offline accuracy foundation. Phase 8B adds a correctness-gated local performance matrix. Phase 8B is not complete until its final repository-wide preflight, exact-head GitHub Actions gate, merge, and production verification succeed.

After Phase 8B release integration, **Phase 8C** will produce reproducible technical publication from normalized Phase 8A/8B evidence with exact provenance, raw counts, benchmark results, limitations, and explicit scope.

Production worker enablement, hosted scanning authority, dashboard V5/UI work, and Phase 9 hardening remain separate workstreams.

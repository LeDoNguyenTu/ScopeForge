# ScopeForge Validation Methodology

ScopeForge publishes validation evidence so scanner behavior can be evaluated from reproducible tests rather than marketing claims.

This document describes the implemented Phase 8A offline accuracy foundation, the existing scanner regression/performance evidence, and the rules for future Phase 8B/8C measurements.

## Principles

1. **Reproducible before impressive.** A measurement must be rerunnable from committed code and fixtures before it is used as a claim.
2. **Detection quality and performance are separate measurements.** A fast scanner is not necessarily an accurate scanner, and a correct fixture does not prove representative performance.
3. **Negative fixtures matter.** Clean and near-miss cases are required to expose false-positive regressions.
4. **Hostile-input safety is part of scanner quality.** Scanner errors, skipped coverage, source execution, path escape, or data leakage cannot be converted into clean results.
5. **Ground truth is independent of scanner output.** Labels live in committed case manifests and the evaluator has no mutation path back into the corpus.
6. **Output stability is testable.** Machine-readable and Markdown reports are deterministic behavior.
7. **Limitations are part of the result.** Unsupported behavior and intentionally bounded analyses must remain visible beside measurements.
8. **No unsupported global accuracy claim.** Metrics from a bounded corpus describe that corpus only.

The exact Phase 8A interpretation string is:

> Metrics describe only the committed covered corpus and are not global ScopeForge accuracy.

## Implemented Phase 8A corpus

The first committed labeled corpus is:

- corpus ID: `scopeforge-offline-v1`
- corpus version: `1.0.0`
- cases: 32
- represented scanner families: `iac`, `jsts`, `secrets`
- represented rules: 8
- network-backed SCA/OSV evaluation: excluded from this offline corpus

The corpus is stored under `validation/corpus/offline-v1` and is loaded through the strict `packages/validation-accuracy` parser.

### Represented rules

The v1 corpus covers exactly:

- `iac/config-npm-strict-ssl-disabled`
- `iac/docker-floating-base-image`
- `iac/github-actions-write-all-permissions`
- `iac/kubernetes-privileged-container`
- `iac/terraform-aws-public-rds`
- `jsts/command-injection`
- `jsts/dynamic-code-execution`
- `secrets/github-token`

Each represented rule has four reviewed cases:

- two vulnerable cases
- two clean or near-miss cases

The corpus therefore contains 16 vulnerable and 16 clean cases.

### Current covered-corpus result

Exact Task 5 acceptance on commit `398e645abda04e66d0f0c92d2238ad4df9f1c0c4` produced corpus content hash:

`3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Raw aggregate counts:

| Count | Value |
| --- | ---: |
| TP | 16 |
| FN | 0 |
| FP | 0 |
| TN | 16 |
| Error | 0 |
| Unsupported | 0 |
| Contract mismatch | 0 |

Derived metrics for this committed covered corpus:

| Metric | Value |
| --- | ---: |
| Precision | 1.00 |
| Recall | 1.00 |
| False-positive rate | 0.00 |
| F1 | 1.00 |

Every represented rule currently has `TP=2`, `FN=0`, `FP=0`, and `TN=2` within this corpus.

These values are intentionally **not** presented as global ScopeForge accuracy. The corpus is small, curated, offline-first, and limited to eight deterministic rules. It is regression-quality evidence for the cases it contains.

## Counting protocol

Phase 8A evaluates one case against one declared target rule.

For binary detection accuracy:

- **TP**: a vulnerable case produces the declared target rule in an expected file
- **FN**: a vulnerable case does not produce the declared target rule in an expected file
- **FP**: a clean case produces the declared target rule
- **TN**: a clean case does not produce the declared target rule

A case contributes at most one TP/FN/FP/TN outcome even if the scanner emits duplicate target findings.

A target finding in the wrong file does not satisfy a vulnerable case. Findings from other rules are recorded as `unexpectedRuleIds` rather than silently credited to the target rule.

Severity, confidence, and expected CWE differences are recorded as contract mismatches. A detection with a metadata mismatch remains a TP for detection counting, while the mismatch is counted separately.

Scanner or inventory failures never become FN/TN. They are reported as `error` or `unsupported` and excluded from the derived-metric denominators.

Known unsupported diagnostics are normalized to bounded diagnostic codes. Arbitrary scanner messages are not copied into validation output.

## Derived metrics

When denominators are non-zero:

- precision = TP / (TP + FP)
- recall = TP / (TP + FN)
- false-positive rate = FP / (FP + TN)
- F1 = 2TP / (2TP + FP + FN)

A zero denominator produces `null`, rendered as `n/a` in Markdown. The evaluator never invents a zero or perfect score for an undefined metric.

Raw TP/FN/FP/TN/error/unsupported/contract-mismatch counts must accompany derived metrics.

## Corpus integrity and hostile filesystem rules

Corpus manifests and repository fixtures are treated as hostile local input even though the first-party corpus is committed.

The parser enforces:

- exact v1 object shapes
- duplicate-key rejection
- stable identifiers and rule-ID syntax
- raw-text deterministic ordering
- bounded manifest/case/repository sizes
- path traversal, absolute path, drive path, and backslash rejection
- no symlinks
- no hard links
- no special files
- identity-checked no-follow reads
- complete repository-tree validation independent of `.gitignore` or `.scopeforgeignore`
- deterministic SHA-256 content identity over manifest and repository bytes

The committed Phase 8A corpus currently contains 97 files. Task 6 security tests hash the complete corpus before and after evaluation/report generation and require byte-for-byte equality.

Validation report output paths inside the corpus are rejected before either output file is created.

## Scanner ownership

The offline-v1 evaluator constructs exactly one existing built-in scanner for each case and only for the eight represented rules.

Closed mapping:

- `secrets/github-token` -> secrets scanner
- `jsts/dynamic-code-execution` -> JS/TS scanner
- `jsts/command-injection` -> JS/TS scanner
- the five represented `iac/*` rules -> IaC scanner

Cross-family rule selection and unrepresented rules fail closed with `VALIDATION_RULE_INVALID`.

The evaluator does not construct SCA/OSV scanners, does not perform network access, and does not add scanner authority.

## Validation package authority boundary

`packages/validation-accuracy` is local/offline measurement infrastructure.

Permanent architecture tests reject dependencies or primitives that would introduce:

- Next.js or React application authority
- Supabase access
- runtime network/observer/validator authority
- worker/supervisor/control authority
- hosted app/lib mutation modules
- child processes or VM execution
- Node HTTP/HTTPS/DNS/net/TLS/datagram APIs
- worker threads
- dynamic import
- `eval` / `new Function`
- `fetch` / WebSocket networking

Filesystem, path, and cryptographic primitives required for local validation are allowed.

## Privacy-reduced validation output

The normalized accuracy result contains only the evidence needed to reproduce counts and contracts. It does not copy target repository source or scanner internals.

Tests require JSON and Markdown reports to exclude:

- fixture source contents
- synthetic credential-shaped fixture values
- absolute corpus/temp roots
- scanner evidence snippets
- arbitrary finding metadata
- remediation text
- scan start/completion timestamps
- scan durations

Provenance is deterministic and contains only:

- ScopeForge version
- exact commit SHA supplied by the developer runner
- Node version
- platform
- architecture

No timestamp is part of the normalized result.

## Developer runner

The local developer command is:

```bash
npm run validation:accuracy -- \
  --corpus validation/corpus/offline-v1 \
  --commit <40-hex-commit> \
  --json <output.json> \
  --markdown <output.md>
```

The runner requires all four arguments and rejects unknown, duplicate, or missing flags. It rejects invalid commit SHAs, aliased outputs, pre-existing/symlink outputs, and outputs inside the corpus.

Writes are exclusive/no-follow. The ScopeForge version comes from the trusted repository `package.json`, not target repository content or environment claims.

## Existing performance evidence

The repository also contains `benchmarks/scanner-medium-fixture.mjs` and `benchmarks/scanner-medium.mjs`.

The current fixture identity is `scanner-medium-v1` with 700 expected analyzed files and zero expected findings/errors. Its 20,000 ms wall-time threshold is a catastrophic regression ceiling, not a product latency SLO.

Performance reports must record the exact commit, Node.js version, OS, architecture, fixture identity, scanner-reported duration, measured wall time, RSS delta where available, and the complete emitted benchmark object. Materially different environments must not be compared without qualification.

The medium fixture is clean and synthetic. It does not establish large-monorepo, dependency-heavy, AST-heavy, or IaC-heavy performance. Phase 8B will add materially different workload shapes while preserving correctness gates.

## Golden output continuity

`tests/scanner/output/golden-output.test.ts` protects deterministic native JSON, SARIF, and terminal serialization against a fixed scan result.

Golden output is representation-stability evidence, not finding-accuracy evidence.

## Hostile repository safety

`tests/scanner/integration/phase3-hostile-repository.test.ts` proves key scanner safety properties against target code, malicious package lifecycle content, malformed inputs, oversized files, symlinks, and source/privacy sentinels.

The test requires ScopeForge not to execute target content, not to follow external symlinks, not to silently convert malformed coverage into clean success, and not to leak sentinels into output.

These are security-boundary tests, not substitutes for labeled accuracy evaluation.

## Ground-truth review rules

Any future corpus change must preserve these rules:

1. Stable case identity and explicit scanner/rule ownership.
2. Vulnerable cases explain why the case is in rule scope and identify the expected file.
3. Clean cases explain why a similar construct is safe or outside rule scope.
4. Labels are version-controlled independently from scanner output.
5. Scanner output cannot mutate labels or fixture bytes.
6. Errors are never true negatives.
7. Unsupported cases remain explicitly unsupported.
8. Duplicate findings do not inflate one case into multiple statistical samples.
9. Ground-truth changes require independent review rather than snapshot-style auto-acceptance.
10. Real credentials, destructive targets, uncontrolled exploit execution, and hidden network/package-install dependencies are prohibited from ordinary offline corpora.

If an FP/FN appears, reviewers must independently determine whether the scanner or the label/fixture is wrong. Labels must not be changed merely to make a score green.

## Reproducibility and provenance

A technical validation result should be traceable to:

- repository commit SHA
- corpus ID/version/content hash
- represented rule IDs and rule versions
- raw case outcomes/counts
- derived metrics when defined
- CLI/tool version
- command used
- Node/OS/architecture
- known limitations and unsupported cases

A screenshot alone is not benchmark or accuracy evidence.

## Current limitations

Phase 8A materially improves the evidence baseline, but important limits remain:

- 32 cases are not representative of the full real-world input distribution.
- only eight deterministic rules are represented.
- SCA/OSV network-backed advisory accuracy is not evaluated here.
- scanner-wide/global metrics remain unsupported.
- the medium performance benchmark remains synthetic and clean.
- wall-clock timing is environment-sensitive and RSS delta is not peak-memory measurement.
- passing hostile-input tests does not prove absence of every parser/filesystem/security defect.

## Phase 8 continuation

Phase 8A provides the accuracy foundation. Phase 8 is not complete.

Next boundaries:

1. **Phase 8B - performance matrix:** preserve `scanner-medium-v1` and add materially different generated source/AST-heavy, dependency/lockfile-heavy, and IaC-heavy workloads with correctness gates.
2. **Phase 8C - reproducible technical publication:** produce deterministic machine-readable and Markdown reports with exact provenance, raw counts, benchmark evidence, limitations, and review policy.

Production worker enablement, hosted scanning authority, dashboard V5/UI work, and Phase 9 hardening remain separate workstreams.

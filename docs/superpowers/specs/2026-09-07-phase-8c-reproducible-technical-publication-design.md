# Phase 8C Reproducible Technical Publication Design

Status: approved autonomous design

Date: 2026-09-07

Base: `main` at `f896280aa8e3ee65faf8ffb4b053915390aef7d4`

Implementation branch: `feat/phase-8c-reproducible-publication-v1`

## 1. Purpose

Phase 8C turns the already accepted Phase 8A accuracy evidence and Phase 8B performance evidence into reproducible technical publication artifacts.

The publication layer must preserve evidence exactly, expose limitations and unsupported behavior, and make every claim traceable to a versioned machine-readable record. It must not reinterpret the 32-case corpus as global or real-world accuracy, hide errors or unsupported cases, suppress benchmark variance, or convert catastrophic regression ceilings into product latency SLOs.

Phase 8C is reporting infrastructure only. It does not widen scanner authority, hosted runtime authority, repository acquisition authority, Supabase authority, browser authority, worker authority, or dashboard/UI scope.

## 2. Selected architecture

Use a two-layer publication model:

1. a versioned evidence bundle containing normalized Phase 8A and Phase 8B evidence plus exact provenance and explicit claim boundaries
2. a deterministic renderer that validates the evidence bundle and emits canonical JSON plus a human-readable Markdown report

Measurement capture and publication rendering remain separate concerns.

This separation is required because benchmark measurements are inherently environment-sensitive while publication serialization can and should be deterministic. Re-rendering the same evidence bundle must produce byte-identical canonical JSON and Markdown.

The first committed publication evidence bundle represents already accepted release evidence rather than silently re-measuring it:

- Phase 8A corpus `scopeforge-offline-v1@1.0.0`
- Phase 8A content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- Phase 8A reviewed counts and normalized outcomes from the released evaluator
- Phase 8B accepted post-merge CI evidence from main CI #761
- Phase 8B exact executable commit `226a20739871c15d0262d1779b3b013520f47fc6`
- Phase 8B executable tree `50f17f44e770f1179ed2b40b7713e14e864958c0`
- Node 22.23.2 and Ubuntu 24.04.4 execution environment for CI #761

The publication pipeline may later support fresh capture, but v1 must not require online services or subprocess execution merely to render a report.

## 3. Alternatives considered

### 3.1 Re-run benchmarks every time a report is rendered

Rejected.

This would make report generation non-deterministic, blur the distinction between measurement and publication, and encourage comparison of environment-sensitive timing values without an explicit evidence boundary.

### 3.2 Publish only Markdown assembled by hand

Rejected.

A hand-maintained report would allow drift between narrative text and the underlying raw counts or measurements. Machine-readable evidence must remain the source of truth.

### 3.3 Add a hosted reporting service

Rejected.

Phase 8C does not need network, Supabase, browser, worker, or hosted execution authority. Adding those capabilities would widen ScopeForge authority without improving reproducibility.

## 4. Repository structure

Phase 8C adds a focused package and versioned publication evidence.

```text
packages/validation-publication/
  contracts.ts
  error.ts
  parse.ts
  normalize.ts
  report-json.ts
  report-markdown.ts
  cli.ts
  index.ts

validation/publication/
  phase-8-release-v1.evidence.json

docs/validation/results/
  phase-8-release-v1.json

docs/validation/reports/
  phase-8-release-v1.md

tests/validation-publication/
  contracts.test.ts
  parse.test.ts
  normalize.test.ts
  report.test.ts
  cli.test.ts
  privacy.test.ts

 tests/architecture/
  validation-publication-dependencies.test.ts
```

Exact filenames may be adjusted during implementation only when the same separation of evidence, normalization, and presentation is preserved.

## 5. Evidence bundle contract

The v1 evidence bundle is machine-readable JSON with `schemaVersion: 1`.

Required top-level fields:

- `schemaVersion`
- `publicationId`
- `source`
- `accuracy`
- `performance`
- `limitations`
- `unsupportedScenarios`
- `claimBoundaries`
- `reproduction`

Unknown keys are rejected so the contract cannot silently expand.

### 5.1 Publication identity

`publicationId` is a stable identifier such as `scopeforge-phase-8-release-v1`.

The source section identifies the repository and exact evidence-producing Git identities.

Required source fields:

- repository: exactly `LeDoNguyenTu/ScopeForge` for the committed v1 bundle
- Phase 8A evidence commit when applicable
- Phase 8B executable commit
- Phase 8B executable tree
- ScopeForge tool version

All commit and tree identities are lowercase 40-hex values.

The evidence bundle must not imply that a docs-only publication commit is the executable benchmark source when it is not.

### 5.2 Accuracy evidence

Accuracy evidence contains the normalized Phase 8A result fields needed for publication:

- corpus ID
- corpus version
- content hash
- total cases
- represented scanner families
- represented rule IDs and rule versions
- aggregate TP/FN/FP/TN/error/unsupported/contract-mismatch counts
- derived metrics only where denominators are defined
- per-rule counts and metrics
- stable case outcomes
- diagnostic codes for error/unsupported outcomes
- contract mismatch identities
- unexpected rule IDs
- the exact covered-corpus interpretation string

The renderer does not recalculate labels from scanner output and cannot modify ground truth.

### 5.3 Performance evidence

Performance evidence contains:

- benchmark result schema version
- runs per profile
- environment/toolchain provenance
- one definition for each Phase 8B profile
- every raw run
- normalized min/median/max summaries
- correctness expectations
- catastrophic wall ceilings
- observational RSS delta labeling
- historical `scanner-medium-v1` continuity evidence when available

For every matrix profile, the definition records at least:

- profile ID
- scanner family
- expected analyzed-file count
- expected finding rule counts
- expected scanner errors
- special preflight contract where applicable
- catastrophic wall ceiling

The dependency-heavy profile explicitly records that OSV was disabled and that compiled preflight required exactly 5,000 resolved `package-lock.json` components with zero parser diagnostics.

The IaC-heavy profile explicitly records the exact four expected IaC findings.

The source/AST-heavy profile explicitly records exactly four `jsts/dynamic-code-execution` findings.

Raw runs are never reduced to a single best run. Every accepted repeated run is retained.

## 6. Claim boundaries

The v1 bundle contains explicit machine-readable claim boundaries that the renderer must reproduce in human-readable form.

Required boundaries:

1. Phase 8A metrics describe only the committed reviewed corpus and are not global or real-world ScopeForge accuracy.
2. Rules and ecosystems absent from the corpus are unmeasured by the accuracy report.
3. Error and unsupported outcomes remain explicit and are excluded from derived-metric denominators.
4. Phase 8B synthetic workloads are regression workloads, not a representative production-repository sample.
5. Catastrophic benchmark ceilings are regression guards, not product latency SLOs.
6. Wall-clock measurements are environment-sensitive.
7. RSS delta is observational and is not peak RSS or a memory limit.
8. Passing these validation artifacts does not authorize hosted repository acquisition, hosted scanning, passive runtime workers, active CORS workers, or any other production capability.

The parser requires these semantic categories rather than allowing a publication to silently omit them.

## 7. Limitations and unsupported scenarios

Limitations are first-class evidence, not optional prose.

The committed v1 bundle must include at least:

- 32 reviewed cases do not represent the full real-world input distribution
- only eight deterministic rules are represented
- SCA/OSV network-backed advisory accuracy is not evaluated by Phase 8A
- global scanner/repository accuracy remains unsupported
- Phase 8B workloads are generated synthetic fixtures
- timing is environment-sensitive
- RSS delta is not peak memory
- validation cannot prove absence of every parser, filesystem, or security defect

Unsupported scenarios are represented separately from limitations. V1 must include network-backed advisory accuracy and unrepresented rules/ecosystems as unsupported publication claims.

## 8. Deterministic normalization

The renderer validates the evidence bundle and constructs a normalized publication object.

Determinism rules:

- no implicit timestamp
- no random IDs
- no current working directory in output
- no absolute private machine paths
- stable lexical ordering for rule IDs, case IDs, diagnostic codes, limitations, unsupported scenarios, and profile IDs where ordering is not semantically fixed
- stable integer representation
- stable floating-point presentation rules
- canonical JSON serialization with two-space indentation and one trailing newline
- Markdown generated only from the normalized publication object
- repeated render of the same input and arguments must be byte-identical

Measured performance values are not altered, averaged away, or rounded in the machine-readable output. Human-readable presentation may use fixed formatting while retaining every raw value.

## 9. Numeric rules

Accuracy metrics remain numbers or `null` in canonical JSON.

Markdown renders metrics as fixed two-decimal percentages or `n/a` for `null`.

Benchmark timing and RSS values remain integer measurements exactly as recorded by the source evidence.

The renderer recomputes benchmark summaries from raw runs and rejects the evidence bundle if the recorded summary does not match the deterministic recomputation.

The renderer also recomputes aggregate accuracy metrics from raw counts and rejects inconsistent evidence rather than publishing it.

## 10. Privacy and source-leakage rules

Publication input and output must not contain:

- fixture source contents
- detected secret values
- finding evidence snippets
- arbitrary remediation text
- environment secrets
- tokens, credentials, or session identifiers
- private absolute machine paths

Allowed repository-relative paths are limited to stable case metadata already present in privacy-reduced Phase 8A output. The v1 publication bundle does not need fixture contents.

The privacy test suite uses sentinel values and absolute-path sentinels and requires that neither canonical JSON nor Markdown contains them.

## 11. CLI surface

Phase 8C remains developer/release tooling, not a public end-user scanner command.

Preferred npm surface:

```text
npm run validation:publication -- --evidence <path> --json <path> --markdown <path>
```

The renderer:

1. reads one bounded evidence file
2. validates exact schema and budgets
3. normalizes and cross-checks counts/summaries
4. refuses to overwrite existing outputs
5. writes JSON and Markdown as an atomic pair where practical
6. performs no network access and launches no subprocesses

A public `scopeforge` CLI subcommand is not required for v1.

## 12. Reproducibility instructions

The human-readable report contains commands required to reproduce publication from committed evidence:

```bash
npm ci
npm run build:cli
npm run validation:publication -- --evidence validation/publication/phase-8-release-v1.evidence.json --json <output.json> --markdown <output.md>
```

The report separately documents how the Phase 8A and Phase 8B evidence was originally produced. Rendering the report does not silently re-run measurements.

Future fresh measurement capture must remain a separate explicit action and must record its own environment and exact Git identities.

## 13. Architecture and authority boundaries

The `validation-publication` package may import only bounded local utilities and its own contracts. It must not import or reference:

- `child_process`
- VM execution
- browser automation
- network clients
- `fetch`
- WebSocket
- Supabase clients
- repository acquisition workers
- hosted scan workers
- passive or active runtime workers
- worker supervisors or control planes
- dynamic code execution

No new runtime dependency is required for Phase 8C.

No Supabase migration or lockfile dependency change is expected.

The following production flags remain false/absent and untouched:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

PR #49 and all Dashboard V5/UI branches remain completely isolated.

## 14. Testing strategy

Implementation follows TDD using local/disposable execution when available. In this ChatGPT harness the container cannot resolve GitHub, so test-first commits and static review are used before the single frozen GitHub Actions candidate. No deliberate RED Actions run is allowed.

Required tests:

### Contract and parser

- valid v1 evidence accepted
- unknown keys rejected
- unsupported schema rejected
- malformed Git SHA/tree rejected
- duplicate IDs rejected
- bounded evidence size enforced
- invalid numeric values rejected
- missing required claim boundaries rejected

### Accuracy cross-checks

- aggregate counts recomputed from case outcomes
- derived metrics recomputed from raw counts
- error/unsupported remain explicit
- contract mismatches cannot disappear
- rule ordering stable
- inconsistent counts rejected

### Benchmark cross-checks

- exactly three runs per Phase 8B profile
- raw runs retained
- summary recomputed from raw runs
- analyzed-file and finding contracts enforced
- zero error contract enforced
- catastrophic ceiling retained and labeled as regression guard
- RSS delta retained and labeled observational
- profile definitions and measurements cannot disagree

### Determinism and privacy

- repeated canonical JSON byte-identical
- repeated Markdown byte-identical
- no timestamps added implicitly
- no absolute private paths
- no fixture source or secret sentinel leakage
- stable ordering
- stable numeric formatting

### Architecture

- no network imports
- no child process imports
- no browser/runtime worker/Supabase imports
- no dashboard/UI path change

### Integration

- committed `phase-8-release-v1.evidence.json` validates
- committed canonical JSON equals renderer output
- committed Markdown equals renderer output
- Phase 8A evaluator regressions remain green
- Phase 8B benchmark regressions remain green

## 15. Release procedure

1. Create the isolated Phase 8C branch from verified main.
2. Land design and plan using `[skip ci]`.
3. Implement tests before production code changes.
4. Use focused validation-publication tests first.
5. Run broader preflight when an executable environment is available.
6. Freeze one exact release candidate.
7. Review exact base-to-head diff for scope, dependency, privacy, authority, and determinism.
8. Verify Vercel Preview reaches READY.
9. Run one substantive final GitHub Actions candidate.
10. Merge only the exact verified head.
11. Verify main CI and production deployment.
12. Create one docs-only `[skip ci]` release/handoff checkpoint.

The final release review must explicitly confirm no new network, Supabase, hosted runtime, worker, browser, subprocess, or UI authority.

## 16. Completion criteria

Phase 8C is complete only when:

- the evidence contract is versioned and validated
- exact Phase 8A/8B provenance is represented
- raw accuracy counts and all valid derived metrics are represented
- error, unsupported, and contract mismatch counts are explicit
- all Phase 8B repeated runs are retained
- benchmark summaries are reproducible from raw runs
- environment/toolchain provenance is included
- limitations and unsupported scenarios are first-class fields
- claim boundaries are machine-readable and human-readable
- canonical JSON and Markdown are deterministic
- reproducibility instructions are complete
- privacy and absolute-path tests pass
- no misleading global accuracy or product-SLO claims are present
- no authority widening is introduced
- focused tests, full tests, typecheck, CLI build/version, Phase 8A regressions, Phase 8B regressions, repeated render comparison, npm audit, production build, Vercel Preview, final Actions validation, and exact-head/base checks are all satisfied before merge

## 17. Explicit non-goals

Phase 8C does not:

- expand the Phase 8A corpus
- add new scanner rules
- change Phase 8B workload definitions or catastrophic ceilings
- define customer-facing latency or memory SLOs
- evaluate network-backed OSV accuracy
- enable production workers
- change Supabase
- change dashboard V5/UI
- add public hosted reporting
- claim representative real-world accuracy

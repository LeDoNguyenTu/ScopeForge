# ScopeForge Phase 8B Performance Matrix Design

Date: 2026-09-06
Status: approved implementation design under the standing autonomous Phase 8 roadmap

## 1. Purpose

Phase 8B expands ScopeForge's reproducible performance evidence beyond the existing mixed clean `scanner-medium-v1` fixture. It must make performance regressions attributable to a scanner workload class while preserving correctness, local/offline execution, and the authority boundaries established by Phase 8A.

Phase 8B is a regression and characterization matrix. It is not a product latency benchmark, not a public SLO, and not an accuracy corpus.

## 2. Existing baseline that must remain unchanged

The existing files:

- `benchmarks/scanner-medium-fixture.mjs`
- `benchmarks/scanner-medium.mjs`

and the fixture identity `scanner-medium-v1` remain byte-for-byte unchanged in Phase 8B.

`scanner-medium-v1` remains the historical mixed, clean, 700-file regression workload. New profiles are additive.

## 3. Scope and non-goals

Phase 8B adds:

- one shared local benchmark harness
- three deterministic workload-specific fixture builders
- one matrix runner
- correctness guards for each profile
- repeat-run raw measurements and summary statistics
- tests for fixture determinism, measurement validation, and fail-closed behavior
- a permanent CI matrix step if release preflight proves the runtime cost is acceptable
- methodology/state documentation with actual measured evidence only

Phase 8B does not add:

- Supabase access or migrations
- Vercel/runtime configuration changes
- hosted benchmark execution
- repository acquisition authority
- worker/supervisor/control authority
- network access
- OSV lookup enablement
- browser/dashboard/V5 changes
- new production scanner rules
- dependency additions
- benchmark result persistence in the database
- public global performance claims
- peak-memory claims from RSS deltas

## 4. Chosen architecture

### 4.1 Shared harness

Create `benchmarks/matrix/harness.mjs` as the only implementation of measurement and correctness validation for the new matrix.

The harness consumes a profile with:

```js
{
  id,
  expectedFiles,
  expectedFindingRuleCounts,
  maxWallMs,
  buildFixture(root),
  preflight(root)
}
```

The harness:

1. builds the fixture once in a temporary directory
2. runs the profile's correctness preflight outside the timed region
3. scans the same immutable fixture three times in the same process
4. validates every timed scan against exact correctness contracts
5. records raw `scan.durationMs`, wall time, and non-negative RSS delta
6. enforces only the profile's catastrophic wall-time ceiling
7. emits a machine-readable matrix object with all raw runs and summary statistics
8. removes the temporary fixture in `finally`

The timed command is the existing local CLI path:

```text
scopeforge scan <fixture-root> --format json
```

The harness calls the existing `runCli` implementation in-process from `.scopeforge-build` after `npm run build:cli`. It must not spawn a shell or subprocess.

### 4.2 Repeated runs

Each profile runs exactly three times per matrix invocation.

Three runs are enough to expose severe variance and support a median without making the permanent regression gate unnecessarily expensive. The matrix records all three values. The median is a summary convenience, not a replacement for raw runs.

The first/second/third runs are identified by `run: 1`, `run: 2`, and `run: 3`. Phase 8B does not label them `cold` or `warm`, because the process, filesystem cache, and runtime cache state are not sufficiently controlled to justify those terms.

### 4.3 Measurement schema

Each timed run records:

```js
{
  run,
  filesAnalyzed,
  findings,
  errors,
  findingRuleCounts,
  scanDurationMs,
  wallMs,
  rssDeltaBytes
}
```

Each profile result records:

```js
{
  fixture,
  runs,
  maxWallMs,
  summary: {
    minWallMs,
    medianWallMs,
    maxWallMs,
    medianScanDurationMs,
    maxRssDeltaBytes
  }
}
```

The full matrix output is:

```js
{
  schemaVersion: 1,
  runsPerProfile: 3,
  profiles: [...]
}
```

The CLI script prints exactly one machine-readable line:

```text
SCOPEFORGE_BENCHMARK_MATRIX <json>
```

No timestamp is included. Environment provenance belongs in release/report documentation and CI logs rather than the timing object itself.

## 5. Profile A: `source-ast-heavy-v1`

### 5.1 Goal

Exercise JavaScript/TypeScript inventory reads, Babel parsing, AST traversal, and JSTS rule dispatch much more heavily than `scanner-medium-v1`.

### 5.2 Fixture shape

Generate:

- 600 TypeScript files
- 600 JavaScript files
- one root `.scopeforge.json`

Expected analyzed files: 1,201.

Every source file contains deterministic, syntactically valid, moderately dense code with repeated functions, array operations, branches, object literals, and local calls. The fixture must contain enough AST nodes to be materially heavier per source file than the current one-line medium-fixture modules while remaining comfortably below the 2 MiB per-file inventory limit.

### 5.3 Scanner selection

Root config explicitly selects only `jsts` and includes only:

`jsts/dynamic-code-execution`

No SCA, IaC, secrets, Security Packs, network lookup, or hosted behavior participates.

### 5.4 Correctness sentinels

Exactly four source files contain one direct supported dynamic-code execution primitive each:

- two direct global `eval(...)` calls
- two `new Function(...)` constructions

Expected finding rule counts:

```js
{
  "jsts/dynamic-code-execution": 4
}
```

The benchmark fails if the exact rule multiset changes, if scanner errors appear, or if analyzed-file count differs.

### 5.5 Catastrophic ceiling

Initial ceiling: 30,000 ms per run.

This is deliberately generous relative to current scanner behavior. It is a catastrophic regression guard, not a latency target. Phase 8B release evidence must record actual measurements and may tighten the ceiling later only with reviewed cross-environment evidence.

## 6. Profile B: `dependency-lockfile-heavy-v1`

### 6.1 Goal

Exercise npm lockfile JSON parsing, normalization, component creation, sorting, deduplication, and SCA inventory traversal without any OSV network call.

### 6.2 Fixture shape

Generate:

- one root `.scopeforge.json`
- one `package.json`
- one npm lockfile v3 `package-lock.json`
- exactly 5,000 deterministic resolved package entries under `packages`

Expected analyzed files: 3.

5,000 components are well below the existing `MAX_PARSED_COMPONENTS = 25_000` safety budget and must keep the generated lockfile below the 2 MiB per-file inventory ceiling. The fixture generator must assert its final serialized lockfile byte size is below that limit before writing.

### 6.3 Scanner selection

Root config explicitly selects only `sca` and explicitly keeps:

```json
{"sca":{"osv":{"enabled":false}}}
```

OSV must remain false even though false is already the product default. The benchmark must not rely on an implicit default for its no-network boundary.

### 6.4 Correctness preflight

Because an offline SCA scan intentionally emits zero vulnerability findings, finding count alone cannot prove the lockfile parser did the intended work.

Before timing, the profile preflight must use the existing compiled local APIs:

- `buildRepositoryInventory(root)`
- `collectNpmDependencies(inventory)`

and require:

- inventory analyzed files = 3
- dependency diagnostics = 0
- parsed components = exactly 5,000
- every parsed component is resolved from `package-lock.json`

The timed CLI scan then requires:

- analyzed files = 3
- findings = 0
- errors = 0

This combination proves the fixture is parser-valid and the measured SCA path remains offline.

### 6.5 Catastrophic ceiling

Initial ceiling: 20,000 ms per run.

This matches the order of the historical medium fixture ceiling and remains a catastrophic guard only.

## 7. Profile C: `iac-heavy-v1`

### 7.1 Goal

Exercise ScopeForge's four major IaC parser/rule paths in one attributable profile:

- Dockerfile
- Kubernetes YAML
- Terraform HCL subset
- GitHub Actions YAML

### 7.2 Fixture shape

Generate 150 files for each parser family:

- 150 Dockerfiles
- 150 Kubernetes manifests
- 150 Terraform files
- 150 GitHub Actions workflows
- one root `.scopeforge.json`

Expected analyzed files: 601.

The bulk files are deterministic, syntactically supported, and safe. They include enough structure to exercise non-trivial parsing: multi-stage Dockerfiles, multi-container Kubernetes specs, multiple Terraform attributes/blocks, and multi-job workflows.

### 7.3 Scanner/rule selection

Root config explicitly selects only `iac` and includes exactly:

- `iac/docker-floating-base-image`
- `iac/kubernetes-privileged-container`
- `iac/terraform-aws-public-rds`
- `iac/github-actions-write-all-permissions`

### 7.4 Correctness sentinels

Exactly one file in each family is intentionally changed to the already-supported positive shape for the selected rule:

- Docker: floating `latest` base image
- Kubernetes: `privileged: true`
- Terraform: `aws_db_instance` with `publicly_accessible = true`
- GitHub Actions: `permissions: write-all`

Expected finding rule counts:

```js
{
  "iac/docker-floating-base-image": 1,
  "iac/kubernetes-privileged-container": 1,
  "iac/terraform-aws-public-rds": 1,
  "iac/github-actions-write-all-permissions": 1
}
```

The benchmark fails if the exact multiset or analyzed-file count changes or if any scanner error occurs.

### 7.5 Catastrophic ceiling

Initial ceiling: 30,000 ms per run.

Again, this is not a product SLO.

## 8. Correctness validation rules

The shared validator must reject a run when any of these are true:

- CLI exit is non-zero
- stdout is not valid ScopeForge JSON
- stderr is non-empty
- `inventory.filesAnalyzed` differs from the profile contract
- `findings` is not an array
- `errors` is not an array
- any scanner error exists
- finding count differs from the exact expected rule multiset
- any unexpected finding rule ID appears
- `scan.durationMs` is absent, non-finite, or negative
- measured wall time is non-finite or negative
- measured wall time exceeds the catastrophic ceiling
- RSS delta is non-finite or negative

RSS delta is recorded but never used as a pass/fail threshold in Phase 8B because before/after RSS is not peak memory and is runtime-sensitive.

## 9. Fixture determinism and mutation safety

Every fixture generator must:

- accept an explicit temporary root
- use only deterministic content based on fixed integer ranges
- use stable raw-text filename ordering
- write UTF-8 only
- never read environment secrets
- never access the network
- never execute generated target code
- never install packages
- never use randomness, current time, hostname, or external data

Tests generate each fixture twice and compare a deterministic SHA-256 tree digest over sorted relative paths and bytes. The two digests must match.

The benchmark harness builds once and performs no fixture writes after preflight starts. Timed scans must therefore observe identical target bytes for all three runs.

## 10. Shared summary calculations

For exactly three numeric values sorted ascending `[a, b, c]`:

- minimum = `a`
- median = `b`
- maximum = `c`

No percentile terminology is used with only three runs.

`maxRssDeltaBytes` is the maximum raw non-negative before/after RSS delta across the three runs.

All summary values remain integers because source measurements are rounded integer milliseconds/bytes.

## 11. CI integration

Add a package script:

```json
"benchmark:matrix": "node benchmarks/scanner-matrix.mjs"
```

After Phase 8B implementation passes exact-tree preflight and the complete matrix is shown to be bounded on GitHub-hosted Linux, add one CI step after the historical `npm run benchmark:scanner` step:

```text
npm run benchmark:matrix
```

The existing medium benchmark remains in CI separately. The matrix must not replace it.

If release preflight shows the matrix consumes an unreasonable fraction of the existing CI duration, do not silently weaken fixtures. Keep the script and correctness tests, document the measured cost, and leave permanent CI integration out until a separately reviewed cadence is chosen.

## 12. Tests

Create runtime tests under `tests/benchmarks/` using Vitest-compatible `.test.mjs` files so the benchmark `.mjs` modules can be imported without changing application TypeScript compilation.

Tests must cover:

- exact validator success for expected findings/files
- rejection of unexpected/missing findings
- rejection of scanner errors/stderr/invalid duration/wall ceiling
- summary median/min/max behavior
- each fixture builds deterministically twice
- exact expected fixture file counts
- lockfile preflight returns exactly 5,000 components and zero diagnostics
- matrix profile IDs are unique and raw-text sorted in output
- harness removes temporary fixtures on success and failure where testable without process-global races

The release gate also runs the real compiled matrix script.

## 13. Documentation

Update:

- `docs/validation/METHODOLOGY.md`
- `docs/development/CURRENT_STATE.md`
- `docs/development/NEXT_STEPS.md`
- `docs/development/TEST_STATUS.md`
- `docs/development/PHASE_8_WORKING_STATE.md`

Only actual measured results from an exact commit may be recorded. Do not pre-write final wall times.

Documentation must distinguish:

- fixture correctness contracts
- catastrophic regression ceilings
- raw measurements
- environment-sensitive comparative evidence
- product SLOs, which Phase 8B does not define

## 14. Release/integration policy

Phase 8B follows the same economical CI policy proven in Phase 8A:

1. intermediate TDD commits use `[skip ci]`
2. RED/GREEN is witnessed in disposable Linux against exact SHAs where possible
3. full exact-tree preflight runs before the final Actions gate
4. source/security/diff review confirms no UI, Supabase, runtime-worker/network, dependency, or production-authority drift
5. freeze one final tree-identical verification head
6. open/reconcile one PR
7. trigger one substantive exact-head GitHub Actions run
8. merge only after exact-head/base/merge-ref/status/review invariants are clean
9. use `[skip ci]` on the squash merge subject to avoid a duplicate push-to-main validation run
10. verify the exact production Vercel deployment after merge
11. reconcile post-merge docs

## 15. Alternatives considered

### Three independent benchmark scripts

Rejected because measurement validation, JSON parsing, RSS handling, ceiling semantics, and output schema would be duplicated and eventually drift.

### One giant mixed benchmark fixture

Rejected because a slowdown would not identify whether AST parsing, lockfile normalization, or IaC parsing regressed. It would also duplicate the role of `scanner-medium-v1` rather than complement it.

### Network-backed OSV benchmark

Rejected from Phase 8B because external latency, rate limiting, service availability, and outbound authority would make the result non-reproducible and would violate the local/offline Phase 8 boundary.

### Memory pass/fail gate based on RSS delta

Rejected because a before/after RSS delta is not peak resident memory and is too runtime-sensitive to support a defensible hard threshold in this phase.

## 16. Definition of done

Phase 8B is complete only when:

- `scanner-medium-v1` is unchanged
- all three new fixtures are deterministic and bounded
- correctness sentinels prove the intended scanner/parser work executes
- dependency profile proves 5,000 parsed components with OSV disabled
- three raw runs/profile and summary values are emitted
- catastrophic ceilings are enforced without being described as SLOs
- tests and full repository verification pass
- actual matrix execution passes on the release candidate
- authority/UI/dependency boundaries remain unchanged
- final Linux CI and production Vercel are green
- docs record actual evidence and identify Phase 8C as next

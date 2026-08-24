# ScopeForge Scanner Performance

ScopeForge records scanner performance using a deterministic synthetic repository benchmark. This benchmark exists for regression tracking. It is not a general performance claim for arbitrary repositories.

## Benchmark command

```bash
npm run build:cli
npm run benchmark:scanner
```

The runner emits one machine-readable line beginning with `SCOPEFORGE_BENCHMARK`. It exits non-zero if the scan fails, the fixture contract changes unexpectedly, output is invalid, or wall-clock time exceeds the broad CI regression ceiling.

## Module layout

The benchmark is split by responsibility:

- `benchmarks/scanner-medium-fixture.mjs` owns deterministic fixture composition and the expected analyzed-file contract
- `benchmarks/scanner-medium.mjs` owns timing, CLI invocation, result validation, measurement serialization, and temporary-directory cleanup

Fixture construction is outside the timed interval. Keeping fixture generation separate makes future benchmark shapes easier to add without duplicating measurement logic.

## Medium fixture

`scanner-medium-v1` contains exactly 700 analyzed files:

- 310 TypeScript source files
- 310 JavaScript source files
- 15 Dockerfiles
- 15 Kubernetes manifests
- 15 Terraform files
- 15 GitHub Actions workflows
- 8 `.npmrc` files with TLS verification enabled
- 8 `vercel.json` files with scoped CORS
- `package.json` and `package-lock.json` with no dependencies
- 2 Markdown files

The fixture is intentionally clean. Expected output is 0 findings and 0 scanner errors. OSV enrichment is disabled, so the benchmark performs no scanner-initiated network request.

## What is measured

The timer starts immediately before an in-process call to the compiled CLI and stops when native JSON scanning finishes. The interval includes repository inventory, bounded reads, built-in local scanners, coordination, policy evaluation, and JSON serialization.

The benchmark records:

- analyzed file count
- finding count
- scanner error count
- scanner-reported duration
- wall-clock duration
- process RSS difference before and after the scan

The RSS value is a before/after delta, not peak memory. It is floored at zero because garbage collection and allocator behavior can otherwise make the simple delta negative.

The measurement does not include dependency installation, CLI compilation, fixture construction, temporary-directory cleanup, OSV enrichment, CycloneDX generation, SARIF file writing, hosted ingestion, or remote application testing.

## Latest implementation GREEN measurement

CI #346 ran on PR #21 head `6ffb249c0ac7463c410cfd1536b105ebca9507d3` using GitHub-hosted Ubuntu 24.04, Node.js 22.23.2, and npm 10.9.8.

Observed line:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"scanDurationMs":816,"wallMs":876,"rssDeltaBytes":17399808,"maxWallMs":20000}
```

For that run:

- wall clock: 876 ms
- scanner-reported duration: 816 ms
- RSS delta: 17,399,808 bytes, about 16.6 MiB
- findings: 0
- scanner errors: 0

CI #346 also passed the reproducible dependency install, 86 test files / 331 tests, strict typecheck, CLI build/runtime smoke, and Next.js production build. Permanent evidence documentation changed the PR head after this checkpoint, so the final immutable PR head still requires the same complete gate before merge.

The earlier CI #311 measurement remains historical evidence, but CI #346 supersedes it as the latest implementation-head performance observation.

## CI regression ceiling

The ceiling is 20,000 ms for the 700-file fixture. It is intentionally much looser than the observed measurement and is designed to catch catastrophic regressions without creating flaky failures from normal hosted-runner variance.

Future public performance claims should use repeated measurements, controlled hardware, multiple repository shapes, percentile reporting, and separate network-enabled measurements where applicable.

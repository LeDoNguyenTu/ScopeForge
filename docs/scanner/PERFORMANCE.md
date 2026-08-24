# ScopeForge Scanner Performance

ScopeForge records scanner performance using a deterministic synthetic repository benchmark. The benchmark is evidence for regression tracking, not a general claim about production repositories.

## Benchmark command

Build the CLI first, then run:

```bash
npm run build:cli
npm run benchmark:scanner
```

The benchmark prints one machine-readable line beginning with `SCOPEFORGE_BENCHMARK` and exits non-zero only when the scan fails, the fixture contract changes unexpectedly, output is invalid, or wall-clock time exceeds the broad CI regression ceiling.

## Medium fixture

`benchmarks/scanner-medium.mjs` generates the fixture under the operating-system temporary directory and removes it after the run. Fixture generation is not included in the timed interval.

The `scanner-medium-v1` fixture contains exactly 700 analyzed files:

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

The fixture is intentionally clean. Expected results are 0 findings and 0 scanner errors. OSV enrichment is disabled, so the benchmark performs no scanner-initiated network request.

## What is measured

The timer starts immediately before an in-process call to the compiled CLI and stops when the JSON scan finishes. The wall-clock measurement therefore includes repository inventory, bounded content reads, the built-in local scanners, coordination, policy evaluation, and native JSON serialization.

The benchmark also records:

- analyzed file count
- finding count
- scanner error count
- scanner-reported duration
- process RSS difference from immediately before to immediately after the scan

The RSS value is a before/after delta, not a peak-memory measurement. It is floored at zero because garbage collection and allocator behavior can make a simple after-minus-before observation negative.

The benchmark does not include dependency installation, TypeScript CLI compilation, fixture generation, process startup, fixture cleanup, OSV network enrichment, CycloneDX generation, SARIF file writing, hosted ingestion, or remote application testing.

## Latest observed CI measurement

Diagnostic Phase 3O CI run #311 executed on GitHub-hosted Ubuntu 24.04 with Node.js 22.23.2. The hosted runner was in Azure `westus`; hardware is shared GitHub Actions infrastructure rather than dedicated benchmark hardware.

Observed line:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"wallMs":928,"scanDurationMs":859,"rssDeltaBytes":22900736,"maxWallMs":20000}
```

For that run:

- total timed wall clock: 928 ms
- scanner-reported duration: 859 ms
- process RSS delta: 22,900,736 bytes, about 21.8 MiB
- findings: 0
- scanner errors: 0

These numbers are one CI observation. They should not be extrapolated to arbitrary repositories, hardware, language mixes, or network-enabled scans.

## CI regression ceiling

The current CI ceiling is 20,000 ms for the 700-file fixture. This is intentionally much looser than the observed measurement. It is designed to catch catastrophic regressions while avoiding false failures from normal GitHub-hosted runner variance.

A future performance claim should use repeated measurements, controlled hardware, multiple repository shapes, percentile reporting, and separate network-enabled measurements where applicable.

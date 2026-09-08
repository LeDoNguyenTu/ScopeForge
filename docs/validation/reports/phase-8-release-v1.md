# ScopeForge Phase 8 Technical Publication - scopeforge-phase-8-release-v1

## Scope and Claim Boundaries

- Metrics describe only the committed reviewed corpus and are not global or real-world ScopeForge accuracy.
- Rules and ecosystems absent from the corpus are unmeasured by this publication.
- Error and unsupported outcomes remain explicit and are excluded from derived-metric denominators.
- Phase 8B synthetic workloads are regression workloads, not a representative production-repository sample.
- Catastrophic benchmark ceilings are regression guards, not product latency SLOs.
- Wall-clock measurements are environment-sensitive.
- RSS delta is observational and is not peak RSS or a memory limit.
- Validation publication does not authorize hosted repository acquisition, hosted scanning, passive runtime workers, active CORS workers, or any other production capability.

## Provenance

- Repository: `LeDoNguyenTu/ScopeForge`
- ScopeForge version: `0.1.0`
- Phase 8A evidence commit: `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- Phase 8A evidence tree: `aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8`
- Phase 8B executable commit: `226a20739871c15d0262d1779b3b013520f47fc6`
- Phase 8B executable tree: `50f17f44e770f1179ed2b40b7713e14e864958c0`

## Accuracy Evidence

- Corpus: `scopeforge-offline-v1@1.0.0`
- Corpus content SHA-256: `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- Reviewed cases: 32
- Scanner families: `iac`, `jsts`, `secrets`
- Represented rules: `iac/config-npm-strict-ssl-disabled`, `iac/docker-floating-base-image`, `iac/github-actions-write-all-permissions`, `iac/kubernetes-privileged-container`, `iac/terraform-aws-public-rds`, `jsts/command-injection`, `jsts/dynamic-code-execution`, `secrets/github-token`
- Interpretation: Metrics describe only the committed covered corpus and are not global ScopeForge accuracy.

### Covered-corpus confusion matrix

- TP: 16
- FN: 0
- FP: 0
- TN: 16
- Errors: 0
- Unsupported: 0
- Contract mismatches: 0
- Precision: 100.00%
- Recall: 100.00%
- False-positive rate: 0.00%
- F1: 100.00%

## Rule Results

| Rule | Version | Scanner | TP | FN | FP | TN | Error | Unsupported | Contract mismatch | Precision | Recall | FPR | F1 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `iac/config-npm-strict-ssl-disabled` | `1.0.0` | `iac` | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 0.00% | 100.00% |
| `iac/docker-floating-base-image` | `1.0.0` | `iac` | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 0.00% | 100.00% |
| `iac/github-actions-write-all-permissions` | `1.0.0` | `iac` | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 0.00% | 100.00% |
| `iac/kubernetes-privileged-container` | `1.0.0` | `iac` | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 0.00% | 100.00% |
| `iac/terraform-aws-public-rds` | `1.0.0` | `iac` | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 0.00% | 100.00% |
| `jsts/command-injection` | `1.0.0` | `jsts` | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 0.00% | 100.00% |
| `jsts/dynamic-code-execution` | `1.0.0` | `jsts` | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 0.00% | 100.00% |
| `secrets/github-token` | `1.0.0` | `secrets` | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 0.00% | 100.00% |

## Exceptional Accuracy Outcomes

- None.

## Performance Environment

- Node.js: `22.23.2`
- OS: `Ubuntu 24.04.4`
- Platform: `linux`
- Architecture: `x64`
- Repeated runs per matrix profile: 3
- Wall-clock measurements are environment-sensitive.
- RSS delta is observational and is not peak RSS or a memory limit.

## Historical Benchmark Continuity

- Fixture: `scanner-medium-v1`
- Files analyzed: 700
- Findings: 0
- Errors: 0
- Scanner duration: 597 ms
- Wall time: 644 ms
- RSS delta: 27738112 bytes (observational only)
- Catastrophic wall ceiling: 20000 ms (regression guard, not a product SLO)

## Performance Matrix

### `dependency-lockfile-heavy-v1`

- Scanner: `sca`
- Expected analyzed files: 3
- Expected findings: none
- Expected scanner errors: 0
- Catastrophic wall ceiling: 20000 ms per run (regression guard, not a product SLO)
- Dependency preflight: 5000 resolved package-lock components, 0 parser diagnostics, OSV enabled: false

| Run | Files | Findings | Errors | Scanner ms | Wall ms | RSS delta bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | 0 | 0 | 2426 | 2428 | 1241088 |
| 2 | 3 | 0 | 0 | 2391 | 2392 | 4124672 |
| 3 | 3 | 0 | 0 | 2350 | 2351 | 3100672 |

- Wall min / median / max: 2351 / 2392 / 2428 ms
- Median scanner duration: 2391 ms
- Maximum observed RSS delta: 4124672 bytes

### `iac-heavy-v1`

- Scanner: `iac`
- Expected analyzed files: 601
- Expected findings: `iac/docker-floating-base-image` x1, `iac/github-actions-write-all-permissions` x1, `iac/kubernetes-privileged-container` x1, `iac/terraform-aws-public-rds` x1
- Expected scanner errors: 0
- Catastrophic wall ceiling: 30000 ms per run (regression guard, not a product SLO)
- Separate profile preflight: none

| Run | Files | Findings | Errors | Scanner ms | Wall ms | RSS delta bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 601 | 4 | 0 | 549 | 588 | 48025600 |
| 2 | 601 | 4 | 0 | 387 | 426 | 524288 |
| 3 | 601 | 4 | 0 | 368 | 400 | 409600 |

- Wall min / median / max: 400 / 426 / 588 ms
- Median scanner duration: 387 ms
- Maximum observed RSS delta: 48025600 bytes

### `source-ast-heavy-v1`

- Scanner: `jsts`
- Expected analyzed files: 1201
- Expected findings: `jsts/dynamic-code-execution` x4
- Expected scanner errors: 0
- Catastrophic wall ceiling: 30000 ms per run (regression guard, not a product SLO)
- Separate profile preflight: none

| Run | Files | Findings | Errors | Scanner ms | Wall ms | RSS delta bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1201 | 4 | 0 | 1234 | 1287 | 786432 |
| 2 | 1201 | 4 | 0 | 978 | 1020 | 131072 |
| 3 | 1201 | 4 | 0 | 979 | 1034 | 131072 |

- Wall min / median / max: 1020 / 1034 / 1287 ms
- Median scanner duration: 979 ms
- Maximum observed RSS delta: 786432 bytes

## Limitations

- Only eight deterministic rules are represented by the released corpus.
- Phase 8B workloads are generated synthetic fixtures rather than a representative production-repository sample.
- RSS delta is not peak process memory.
- SCA/OSV network-backed advisory accuracy is not evaluated by Phase 8A.
- The 32 reviewed cases do not represent the full real-world input distribution.
- Validation does not prove absence of every parser, filesystem, scanner, or security defect.
- Wall-clock timing remains environment-sensitive.

## Unsupported Scenarios

- Accuracy claims for rules or ecosystems absent from the reviewed corpus.
- Global or real-world ScopeForge accuracy claims.
- Network-backed SCA/OSV advisory accuracy.
- Peak-memory claims derived from RSS delta.
- Product latency SLO claims derived from catastrophic benchmark ceilings.
- Production runtime authorization inferred from validation evidence.

## Reproduction

Publication rendering consumes committed evidence. It does not silently rerun environment-sensitive measurements.

```bash
npm ci
npm run build:cli
npm run validation:publication -- --evidence validation/publication/phase-8-release-v1.evidence.json --json phase-8-release-v1.reproduced.json --markdown phase-8-release-v1.reproduced.md
```

Original evidence commands:

```bash
npm run validation:accuracy -- --corpus validation/corpus/offline-v1 --commit 8d766f5969427a2e4525f5232b5e28b0f93675bd --json phase-8a.reproduced.json --markdown phase-8a.reproduced.md
npm run benchmark:scanner && npm run benchmark:matrix
```

## Authority Boundary

- Validation publication does not authorize hosted repository acquisition, hosted scanning, passive runtime workers, active CORS workers, or any other production capability.
- Report generation is local/offline and does not require Supabase, hosted scanning, repository acquisition, browser authority, runtime workers, or arbitrary network access.

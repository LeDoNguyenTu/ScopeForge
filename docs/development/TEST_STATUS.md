# ScopeForge Test Status

## Phase 4B supporting GREEN gate

CI #437 passed on PR #25 supporting implementation head `364ccd435c824bfdfab75407db967d027bf18656`.

| Check | Result | Evidence |
|---|---|---|
| Reproducible dependency install | Passing | `npm ci --ignore-scripts --no-audit --no-fund` |
| Vitest | Passing | 109 test files, 474 tests |
| TypeScript strict typecheck | Passing | `npm run typecheck` |
| CLI TypeScript build | Passing | `npm run build:cli` |
| Compiled CLI runtime smoke | Passing | `ScopeForge 0.1.0` |
| Medium scanner benchmark | Passing | 700 files, 0 findings, 0 errors, 971 ms wall time |
| Next.js production build | Passing | `npm run build` |

Benchmark line:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"scanDurationMs":910,"wallMs":971,"rssDeltaBytes":34701312,"maxWallMs":20000}
```

The benchmark is regression evidence on one GitHub-hosted runner, not a universal performance claim.

Permanent architecture/documentation and dependency-guard changes move the head after CI #437. Therefore CI #437 is supporting evidence, not the immutable final merge gate. PR #25 must receive a fresh complete run on its exact final head.

## Phase 4B TDD evidence

The implementation used contract-first RED/GREEN checkpoints while preserving existing regression coverage.

### Shared network-safety extraction

- Phase 2 public-IP and resolution-result safety behavior was extracted into `packages/network-safety` with Phase 2 regression coverage retained.
- Runtime code reuses the pure policy instead of copying SSRF rules.

### Runtime target, budget, DNS, and transport contracts

Coverage includes:

- verified web/API target normalization
- HTTPS port 443 and GET-only policy
- same-host redirect restrictions
- request, redirect, byte, observation, request-timeout, and total-time budgets
- public DNS classification before connections
- DNS-pinned HTTPS transport
- timeout and network failure handling

### Passive observation and redaction

Coverage verifies:

- bounded HTTP status and redirect observations
- selected response-header state
- cookie security attributes without cookie values
- TLS metadata
- no response-body observation contract
- deterministic redaction and observation-size enforcement

### Runtime finding mapping

Coverage verifies deterministic mapping of passive runtime rule matches into the Phase 4A `security-domain`, including stable identity, observed provenance, typed evidence, validation, severity/confidence, taxonomy, and remediation.

### Persistence and authorization

Coverage verifies:

- passive runtime job migration and RLS/write boundaries
- allowed job-state transitions
- bounded normalized observation persistence
- workspace/operator checks
- verified web/API requirement
- immutable enqueue authorization snapshot
- execution-time reauthorization before networking
- changed authorization blocks execution
- cancellation before persistence
- stable failure codes
- bounded audits without raw exception text

### Application service and UI

The original PR #25 blocker was an intentional service contract suite whose production module was missing. `lib/runtime-observations/service.ts` was added and the full service suite now passes.

The asset UI used a second RED/GREEN checkpoint:

- RED: all existing suites remained green and only the missing `RuntimeObservationPanel` suite failed.
- GREEN: the panel covers unverified/repository restrictions, verified web/API execution, queued/running cancellation controls, bounded success summaries, and safe blocked/failed reasons.

CI #437 confirms the completed UI slice with 109 test files and 474 tests.

## Architecture dependency guards

The final Phase 4B head adds `tests/architecture/runtime-observer-dependencies.test.ts` alongside the existing security-domain guard.

The guards require:

- `security-domain` to remain independent of scanners, CLI, Next.js, React, Supabase, application/component layers, and named model providers
- `runtime-observer` to remain independent of Next.js, React, Supabase, application/component layers, and named model providers
- `network-safety` to remain free of DNS, HTTP, TLS, database, and framework dependencies

These new architecture assertions require the final exact-head CI gate before merge.

## Phase 3 regression continuity

All existing Phase 3 integration, hostile-repository, secret non-leakage, parser safety, no-execution, SCA/OSV, SBOM, IaC, baseline, JSON/SARIF/golden-output, policy, filesystem, and benchmark coverage remained green in CI #437.

No Phase 3 output schema, fingerprint, baseline, policy, CLI, scanner-rule, SARIF, SBOM, or benchmark semantic was intentionally changed by Phase 4B.

## Database boundary

Phase 4B adds a migration for passive runtime jobs and normalized observations. Tests cover schema constraints, guarded status transitions, immutable authorization snapshots, row-level workspace reads, bounded observation payloads, and revocation of direct authenticated writes. Runtime writes are performed through the trusted server adapter.

## Phase 4B merge rule

The exact final PR #25 head must pass:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Merge is blocked by any of the following:

- unverified or repository assets reaching runtime network execution
- authorization not being rechecked immediately before execution
- redirects widening beyond same-host HTTPS port 443 policy
- a connection occurring without fresh public-IP classification and pinning
- response-body or cookie-value persistence
- raw network/database exception text reaching audits or browser-facing errors
- cancellation being ignored before persistence
- runtime-observer dependency reversal into UI/database/provider code
- network-safety gaining DNS/HTTP/TLS/database/framework behavior
- unexpected Phase 2 or Phase 3 regression
- unresolved blocking review thread

## Completion rule

A green supporting run is not enough. Phase 4B is complete only after the exact final PR #25 head passes the full gate, the complete security-sensitive diff is reviewed, the PR is squash merged with head protection, and merged content is verified. The resulting `main` CI should also be verified when exposed by the available GitHub tooling.

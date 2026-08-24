# ScopeForge Test Status

## Phase 4B supporting GREEN gate

CI #459 passed on PR #25 security-hardening implementation head `3fa117745a002ba6f3c0b01107593b2ff9913254`.

| Check | Result | Evidence |
|---|---|---|
| Reproducible dependency install | Passing | `npm ci --ignore-scripts --no-audit --no-fund` |
| Vitest | Passing | 112 test files, 484 tests |
| TypeScript strict typecheck | Passing | `npm run typecheck` |
| CLI TypeScript build | Passing | `npm run build:cli` |
| Compiled CLI runtime smoke | Passing | `ScopeForge 0.1.0` |
| Medium scanner benchmark | Passing | 700 files, 0 findings, 0 errors |
| Next.js production build | Passing | `npm run build` |

CI #459 is supporting implementation evidence. Permanent documentation changes move the branch beyond that commit, so PR #25 still requires a fresh complete run on its exact final head before merge.

## Phase 4B TDD and security-regression evidence

The implementation used RED/GREEN checkpoints while preserving existing regression coverage.

### Shared network-safety extraction

- Phase 2 public-IP and resolution-result safety behavior was extracted into `packages/network-safety` with Phase 2 regression coverage retained.
- Runtime code reuses the pure policy instead of copying SSRF rules.
- Dependency guards keep `packages/network-safety` free of DNS, HTTP, TLS, database, and framework I/O.

### Runtime target, budget, DNS, and transport contracts

Coverage includes:

- verified web/API target normalization
- HTTPS port 443 and GET-only policy
- same-host redirect restrictions
- request-count, redirect-count, observation-size, request-timeout, and total-time budgets
- public DNS classification before every outbound connection
- DNS-pinned HTTPS transport
- DNS resolution included inside each request deadline
- HTTPS timeout reduced by time already spent resolving DNS
- remaining-total-budget enforcement when a request begins near the global deadline
- timeout and network failure classification through stable codes

### Cancellation hardening

Regression coverage verifies:

- cancellation before initial networking
- asynchronous cancellation checks after a request and before another network operation
- a workspace-bound database cancellation callback injected by the trusted service
- cancellation remains a distinct terminal state
- observations/findings are not persisted after the observer reports cancellation

### Passive observation and redaction

Coverage verifies:

- bounded HTTP status and redirect observations
- selected response-header state
- cookie security attributes without cookie values
- TLS metadata
- no response-body persistence
- URL query strings and fragments removed from persisted HTTP-status and redirect-source observations
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
- stable failure codes
- bounded audits without raw exception text

### Application service and UI

The original PR #25 blocker was a service contract suite whose production module was missing. `lib/runtime-observations/service.ts` now implements the trusted orchestration layer.

The asset workflow covers:

- unverified/repository restrictions
- verified web/API execution
- queued/running cancellation controls
- bounded success summaries
- safe blocked/failed reasons
- no UI-side networking or duplicated authorization logic

## Architecture dependency guards

CI enforces:

- `security-domain` remains independent of scanners, CLI, Next.js, React, Supabase, application/component layers, and named model providers
- `runtime-observer` remains independent of Next.js, React, Supabase, application/component layers, and named model providers
- `network-safety` remains free of DNS, HTTP, TLS, database, and framework dependencies

## Phase 3 regression continuity

Existing Phase 3 integration, hostile-repository, secret non-leakage, parser safety, no-execution, SCA/OSV, SBOM, IaC, baseline, JSON/SARIF/golden-output, policy, filesystem, and benchmark coverage remain part of the full repository gate.

No Phase 3 output schema, fingerprint, baseline, policy, CLI, scanner-rule, SARIF, SBOM, or benchmark semantic is intentionally changed by Phase 4B.

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
- DNS work escaping the request deadline
- response-body, cookie-value, or URL query-secret persistence
- raw network/database exception text reaching audits or browser-facing errors
- cancellation being ignored between network operations or before persistence
- runtime-observer dependency reversal into UI/database/provider code
- network-safety gaining DNS/HTTP/TLS/database/framework behavior
- unexpected Phase 2 or Phase 3 regression
- unresolved blocking review thread

## Completion rule

A green supporting run is not enough. Phase 4B is complete only after the exact final PR #25 head passes the full gate, the complete security-sensitive diff is reviewed, the PR is squash merged with head protection, and merged content is verified. The resulting `main` CI should also be verified when exposed by the available GitHub tooling.

# ScopeForge Test Status

## Phase 4C-1 supporting GREEN gate

CI #546 passed on PR #27 implementation/security-hardening head `cc57248fd525e1a05312bb221ce35844c18a2530`.

| Check | Result | Evidence |
|---|---|---|
| Reproducible dependency install | Passing | `npm ci --ignore-scripts --no-audit --no-fund` |
| Vitest | Passing | 122 test files, 538 tests |
| TypeScript strict typecheck | Passing | `npm run typecheck` |
| CLI TypeScript build | Passing | `npm run build:cli` |
| Compiled CLI runtime smoke | Passing | `ScopeForge 0.1.0` |
| Medium scanner benchmark | Passing | 700 files, 0 findings, 0 errors |
| Next.js production build | Passing | `npm run build` |

CI #546 is supporting implementation evidence. Permanent documentation commits move the branch beyond that commit, so PR #27 requires a fresh complete run on its exact final head before merge.

## Phase 4C-1 TDD and security-regression evidence

The implementation used explicit RED/GREEN checkpoints while preserving all earlier Phase 2, Phase 3, Phase 4A, and Phase 4B regression coverage.

### Shared runtime-network extraction

Coverage verifies:

- fresh DNS resolution per connection
- rejection of empty, invalid, private/reserved, and mixed public/private resolution sets
- socket pinning to a validated public address
- original authorized hostname retained for Host/SNI/certificate validation
- HTTPS port 443 and GET-only transport
- DNS included inside the absolute request deadline
- HTTPS timeout reduced by DNS elapsed time
- outer deadline abort of active HTTPS
- no automatic redirects
- response-body destruction
- unsafe or caller-controlled Origin values rejected by the shared contract

Passive `runtime-observer` regressions remain green after the extraction.

### Active request authority

Coverage verifies `cors-origin-policy@1` cannot become a generic HTTP client:

- exact verified canonical target only
- exact fixed `Origin: https://scopeforge.invalid`
- exactly one GET
- zero redirects followed
- zero retries
- no request body
- no cookies or Authorization
- no arbitrary browser/user headers
- no caller-selectable method, target, profile, Origin, redirect policy, or budget
- total active runtime deadline and cancellation boundaries

### Explicit authorization and reauthorization

Coverage verifies:

- verification alone is insufficient for active execution
- owner/admin role required
- separate explicit consent required at enqueue
- immutable workspace/asset/target/kind/verified-at/profile/version/authorization-time/budget snapshot
- changed target, revoked verification, profile drift, cancellation, or snapshot drift blocks execution before network traffic
- dedicated server action exposes no raw HTTP configuration surface

### CORS observation, finding, and privacy boundary

Coverage verifies:

- bounded CORS-only normalized observation
- target query/fragment/credentials removed from persisted URLs
- no response-body persistence
- no Set-Cookie value or arbitrary response-header persistence
- exact synthetic-origin plus credential allowance produces a conservative high/high finding
- exact synthetic-origin reflection without credentials produces a conservative low/high finding
- wildcard and missing Vary remain observation-only
- deterministic security-domain mapping uses `runtime_validated`
- finding/evidence identity and source/rule provenance include `cors-origin-policy@1`
- bounded evidence summaries

### Cancellation and persistence hardening

Coverage verifies:

- cancellation before initial networking
- asynchronous DB-backed cancellation between active execution boundaries
- cancellation after response but before persistence writes no active observation/finding
- runtime observation insert requires an exact running, uncancelled parent job
- the observation guard locks the parent workspace/job/asset row before state validation
- if cancellation wins first, persistence is rejected
- if active evidence commits first, a later cancellation request is rejected
- committed active evidence therefore cannot coexist with a `cancelled` terminal job state
- success still requires a running, uncancelled job

### Persistence and trusted-write boundary

Coverage verifies:

- `active_validation` reuses `scan_jobs` rather than creating a parallel job table
- `cors-policy` reuses `runtime_observations`
- immutable active profile/version/authorization fields
- exact bounded active budget constraint
- legal runtime state transitions
- composite workspace/job/asset identity
- workspace-scoped reads
- authenticated select-only runtime observations
- trusted server adapters perform writes

### Application service and UI

Coverage verifies:

- active validation is separate from passive observation
- explicit-consent UI
- fixed profile/request explanation
- dedicated active run and cancel actions
- bounded active job/evidence rendering
- normalized Origin displayed as a distinct evidence value
- no UI-side networking or duplicated active authorization logic

## Architecture dependency guards

CI enforces:

- `security-domain` remains independent of scanner, CLI, web, database, and provider layers
- `network-safety` remains free of DNS/HTTP/TLS/database/framework behavior
- `runtime-network` remains a low-level implementation layer and does not depend on observer/validator/application/domain layers
- `app`, `components`, and application `lib` code do not import generic `runtime-network` authority directly
- `runtime-observer` remains passive and does not import active validation authority
- `runtime-validator` remains independent of passive observer, Next.js, React, Supabase, application/component layers, and providers
- `runtime-validator` does not re-export shared generic transport authority

## Regression continuity

Existing Phase 3 integration, hostile-repository, secret non-leakage, parser safety, no-execution, SCA/OSV, SBOM, IaC, baseline, JSON/SARIF/golden-output, policy, filesystem, and benchmark coverage remain part of the full repository gate.

Existing Phase 4B target, redirect, budget, cancellation, redaction, observation, finding, persistence, authorization, service, UI, and architecture tests remain part of the full gate. No passive authority is intentionally widened by Phase 4C-1.

## Phase 4C-1 exact merge rule

The exact final PR #27 head must pass:

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

- a non-owner/admin actor authorizing active validation
- verification being treated as sufficient active consent
- execution proceeding after target/verification/profile/budget/snapshot drift
- caller-controlled URL, path, method, Origin, header map, body, credential, redirect policy, profile, or budget reaching the active network layer
- anything other than the fixed one-request unauthenticated HTTPS/443 GET authority
- a connection occurring without fresh complete public-IP classification and pinning
- DNS or HTTPS work escaping the request/total deadlines
- response-body, cookie-value, Authorization, arbitrary-header, query, fragment, or raw infrastructure exception persistence
- active observation persistence after cancellation has linearized
- a late cancellation producing a cancelled job after active evidence has committed
- browser direct write authority to runtime jobs/observations
- runtime-network being imported directly by application/UI code
- passive observer gaining active validator authority
- runtime-validator gaining passive/UI/database/provider dependencies or generic transport re-export authority
- unexpected earlier-phase regression
- unresolved blocking review thread or blocking submitted review
- exact final head not being fully green and mergeable

## Completion rule

A supporting green run is not enough. Phase 4C-1 is complete only after the exact final PR #27 head passes the full gate, the complete security-sensitive diff is reviewed, the PR is squash merged with expected-head protection, merged content is verified, and post-merge `main` CI is inspected when exposed by GitHub tooling.

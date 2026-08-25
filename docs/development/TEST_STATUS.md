# ScopeForge Test Status

## Current Phase 5A baseline

The last implementation/security-guard checkpoint before the documentation tail was exact head `3d71ac3b408828608e9173d77db3c739a86f4710`, which passed CI #618.

| Check | Result | Evidence |
|---|---|---|
| Reproducible dependency install | Passing | `npm ci --ignore-scripts --no-audit --no-fund` |
| Vitest | Passing | 131 test files / 579 tests |
| TypeScript strict typecheck | Passing | `npm run typecheck` |
| CLI TypeScript build | Passing | `npm run build:cli` |
| Compiled CLI runtime smoke | Passing | `node .scopeforge-build/packages/cli/index.js version` |
| Scanner benchmark | Passing | `npm run benchmark:scanner` |
| Next.js production build | Passing | `npm run build` |

The exact final PR #30 head must pass this same complete gate before merge. Documentation-only commits do not replace exact-head verification.

## Phase 5A TDD evidence

Implementation used explicit RED/GREEN checkpoints rather than adding production behavior before its boundary tests.

### Hosted result transaction

Coverage verifies:

- passive and active repositories use dedicated atomic result RPCs instead of direct ledger inserts
- exact workspace/job/asset parent identity
- correct job kind
- running and uncancelled state required while holding the parent row lock
- runtime observation persistence and canonical finding/evidence ingestion occur in one PostgreSQL transaction
- retries are idempotent
- conflicting observation/finding/evidence identity reuse is rejected
- passive and active services persist the result before attempting the success transition

### Hosted ingestion boundary

Coverage verifies:

- deterministic-runtime-scanner sources only
- scanner-derived finding provenance only
- `runtime_observed` or `runtime_validated` only
- observed HTTP/TLS evidence only
- `public` evidence classification only
- exact hosted asset binding
- finding evidence references must exist in the trusted batch
- bounded IDs, source metadata, descriptions, taxonomy/remediation JSON, and 4 KiB evidence summaries
- runtime evidence artifact references rejected in Phase 5A
- duplicate IDs with different content rejected

### Canonical identity and recurrence

Coverage verifies:

- passive finding identity includes source version before hosted persistence is activated
- active identity remains profile/version scoped
- finding identity stays stable across reobservation
- immutable evidence identity changes when bounded evidence content changes
- evidence records therefore remain immutable without blocking legitimate recurrence
- one occurrence per `(workspace, finding, scan job)`
- system observation events are retry-safe
- current canonical finding content changes only for observations at least as recent as the stored `last_seen_at`
- trusted recurrence reopens resolved/retest-pending/verified-fixed states according to the domain policy while preserving accepted-risk/false-positive states

### Lifecycle workflow

Coverage verifies:

- allowed Phase 5A actions: acknowledge, start work, resolve, reopen
- owner/admin/member can mutate; viewer is read-only
- resolve/reopen require a bounded note
- browser action surface contains no arbitrary lifecycle target or generic ledger-write API
- PostgreSQL independently checks actor membership/role
- expected lifecycle is checked under row lock
- only the Phase 5A transition pairs are accepted by the mutation RPC
- canonical state update and append-only lifecycle event occur in one transaction
- lifecycle RPC is `SECURITY DEFINER`, pins an empty search path, and is executable only by `service_role`

### Hosted read model

Coverage verifies:

- list/detail queries are workspace-scoped
- authenticated pages use the normal dashboard/RLS client for reads
- no admin client is used by list/detail pages
- list is capped at 100 rows
- evidence links/evidence, occurrences, and events are capped at 100 rows
- dashboard uses a count-only query instead of loading the entire finding ledger
- findings navigation and lifecycle UI remain separate from runtime-network authority

### Database immutability and browser authority

Coverage verifies:

- one canonical ledger rather than passive/active-specific finding tables
- evidence rows are immutable
- finding/evidence links, occurrences, and events are append-only
- workspace/asset/job composite integrity
- RLS enabled on every ledger table
- authenticated users receive SELECT only
- no INSERT/UPDATE/DELETE grants to browser roles
- result and lifecycle mutation RPCs are service-role-only
- hosted schema does not add raw response-body, cookie-value, credential, or arbitrary-header storage fields

### Architecture guards

CI enforces:

- `security-domain` stays framework/infrastructure/provider independent
- `network-safety` remains I/O-free policy
- `runtime-network` remains below observer/validator/application/domain layers
- application/components cannot import generic `runtime-network` authority
- `runtime-observer` cannot import active-validation or hosted finding persistence authority
- `runtime-validator` cannot import passive observer, hosted finding persistence, UI/database/provider layers, or re-export generic transport authority
- `lib/security-findings` cannot acquire runtime-network or scanner execution authority
- passive and active repositories remain on their narrow atomic result RPCs

## Security review findings resolved during Phase 5A

Two correctness/resource-bound issues were found during the implementation review and fixed before the final gate:

1. **Immutable evidence identity recurrence** - finding IDs were correctly stable, but evidence IDs originally reused the finding digest. Changed evidence content could therefore collide with an immutable prior evidence row. The mapper now keeps finding identity stable while evidence identity additionally fingerprints bounded evidence kind, classification, and summary content. RED: 2 failures / 575 passes. GREEN: CI #611, 131 files / 577 tests plus the full gate.
2. **Unbounded hosted finding reads** - list/detail history reads and the dashboard finding count initially materialized unbounded rows. Read paths are now explicitly capped at 100 and dashboard aggregation is count-only. RED: 2 failures / 577 passes. GREEN: CI #615 plus the full gate.

No regression test was weakened to make either fix pass.

## Regression continuity

Existing Phase 2, Phase 3, Phase 4A, Phase 4B, and Phase 4C-1 tests remain part of the full repository gate. Phase 5A does not widen runtime network authority or remove existing cancellation, SSRF, hostile-input, redaction, no-execution, SCA, IaC, JSON/SARIF, baseline, or benchmark coverage.

## Required merge gate

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Merge only when every command is green on the exact PR head and GitHub reports no blocking review state.

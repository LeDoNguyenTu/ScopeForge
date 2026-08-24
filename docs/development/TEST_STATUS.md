# ScopeForge Test Status

## Phase 4A supporting GREEN gate

CI #375 passed on PR #23 supporting implementation head `c0e93ac0408a01a8c2b1ec513e38286a7f102cef`.

| Check | Result | Evidence |
|---|---|---|
| Reproducible dependency install | Passing | `npm ci --ignore-scripts --no-audit --no-fund` |
| Vitest | Passing | 93 test files, 350 tests |
| TypeScript strict typecheck | Passing | `npm run typecheck` |
| CLI TypeScript build | Passing | `npm run build:cli` |
| Compiled CLI runtime smoke | Passing | `ScopeForge 0.1.0` |
| Medium scanner benchmark | Passing | 700 files, 0 findings, 0 errors, 919 ms wall time |
| Next.js production build | Passing | `npm run build` |

Benchmark line:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"scanDurationMs":860,"wallMs":919,"rssDeltaBytes":28692480,"maxWallMs":20000}
```

The benchmark is regression evidence on one GitHub-hosted runner, not a universal performance claim.

Permanent project-state documentation changes the head after CI #375. Therefore CI #375 is supporting evidence, not the immutable final merge gate. PR #23 must receive a fresh complete run on its exact final documentation head.

## Phase 4A TDD evidence

The implementation used contract-first RED/GREEN checkpoints:

| Boundary | RED evidence | GREEN evidence |
|---|---|---|
| Domain primitives | Existing 331 tests stayed green; only the missing new domain module failed | CI #363 full gate passed |
| Lifecycle, validation, advisory | Failures isolated to the missing new functions | CI #367 full gate passed |
| Phase 3 adapter | CI #370 retained 91 existing test files / 346 existing tests green; only the missing adapter module failed | CI #373 full gate passed |
| Architecture dependency direction | Conformance test expected to pass immediately | CI #375 full gate passed |

## New Phase 4A coverage

### Domain primitives

- versioned product security contract
- non-empty branded identity constructors
- separate source and provenance concepts

### Finding lifecycle and validation

- explicit remediation/retest lifecycle transitions
- terminal review states cannot silently reopen
- idempotent lifecycle handling
- advisory authority cannot promote validation
- deterministic authority may establish supported scanner/runtime confirmation
- user confirmation remains human-authority only

### Advisory privacy boundary

- secret-classified context is always excluded
- sensitive remote context requires explicit opt-in
- local execution remains available
- item and character budgets are deterministic
- provider-specific SDK/messages are absent from the domain contract

### Phase 3 source adapter

- deterministic mapping from stable fingerprint identity
- explicit severity/confidence/validation translation
- typed source, location, taxonomy, remediation, and evidence mapping
- dependency-confirmed findings use dependency evidence
- scanner metadata changes do not affect mapped output
- scanner metadata is not copied
- redacted snippets and data-flow internals are not copied
- no product validation inflation for heuristic/informational Phase 3 findings

### Architecture dependency guard

`tests/architecture/security-domain-dependencies.test.ts` recursively checks every TypeScript file under `packages/security-domain` and blocks imports from:

- scanner packages
- CLI implementation
- Next.js
- React
- Supabase
- application/component layers
- named model providers

This guard makes the clean dependency direction part of CI rather than documentation only.

## Phase 3 regression continuity

All existing Phase 3 integration, hostile-repository, secret non-leakage, parser safety, no-execution, SCA/OSV, SBOM, IaC, baseline, JSON/SARIF/golden-output, policy, filesystem, and benchmark coverage remains green in CI #375.

No Phase 3 output schema, fingerprint, baseline, policy, CLI, scanner-rule, SARIF, SBOM, or benchmark semantic was intentionally changed by Phase 4A.

## Database checks

Phase 4A has no database migration, schema, RLS, RPC, storage, queue, worker, or hosted-ingestion change. Supabase advisor checks are not a merge dependency for this diff.

## Phase 4A merge rule

The exact final PR #23 head must pass:

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

- `security-domain` dependency reversal into scanners or infrastructure
- advisory result provenance capable of representing observed/confirmed authority
- advisory validation promotion
- secret advisory context leakage
- remote sensitive advisory context without explicit opt-in
- arbitrary metadata added to product finding/evidence contracts
- Phase 3 mapper metadata/snippet/data-flow passthrough
- mapper filesystem/network/process behavior
- unexpected Phase 3 scanner/output regression
- unresolved blocking review thread

## Completion rule

A green supporting run is not enough. Phase 4A is complete only after the exact final PR #23 head passes the full gate, the PR is squash merged with expected-head protection, and merged content is verified. The resulting `main` CI should also be verified when exposed by the available GitHub tooling.

# ScopeForge Test Status

## Phase 3O implementation GREEN gate

CI #346 on PR #21 head `6ffb249c0ac7463c410cfd1536b105ebca9507d3` passed the complete runtime, reproducible-install, benchmark, and production-build gate after the final maintainability hardening.

| Check | Result | Evidence |
|---|---|---|
| Reproducible dependency install | Passing | `npm ci --ignore-scripts --no-audit --no-fund` on CI #346 using committed lockfile v3 |
| Vitest | Passing | 86 test files, 331 tests on CI #346 |
| TypeScript strict typecheck | Passing | `npm run typecheck` on CI #346 |
| CLI TypeScript build | Passing | `npm run build:cli` on CI #346 |
| Compiled CLI runtime smoke | Passing | `ScopeForge 0.1.0` on CI #346 |
| Medium scanner benchmark | Passing | 700 files, 0 findings, 0 errors, 876 ms wall time on CI #346 |
| Next.js production build | Passing | `npm run build` on CI #346 |

Benchmark line:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"scanDurationMs":816,"wallMs":876,"rssDeltaBytes":17399808,"maxWallMs":20000}
```

CI #346 is the latest implementation-head evidence. Permanent evidence documentation changes the head after this checkpoint, so the exact final documentation head must pass the same complete gate before merge.

## Phase 3O completion coverage

| Area | Result | Evidence / intent |
|---|---|---|
| Mixed-repository integration | Passing | `tests/scanner/integration/phase3-e2e.test.ts` |
| Report-only vs policy enforcement | Passing | Same mixed repository succeeds by default and returns policy failure with `--fail-on high` |
| Baseline new/existing behavior | Passing | Baseline plus one introduced high-severity secret gates only the new finding by default |
| SARIF and CycloneDX integration | Passing | Same mixed repository emits parseable SARIF 2.1.0 and CycloneDX 1.7 |
| Secret non-leak in combined scan | Passing | Raw synthetic token absent from native JSON, SARIF, and baseline artifacts |
| Hostile target no-execution | Passing | Executable-looking JS and package lifecycle content never creates the marker file |
| Default scanner no-network | Passing | Global fetch guard remains unused when OSV is disabled |
| Symlink boundary | Passing | External symlink is skipped and outside secret content is not read into output |
| Tightened file-size boundary | Passing | Oversized synthetic source appears in inventory skip counts |
| Malformed supported input | Passing | Structured scanner diagnostics prevent incomplete coverage from appearing clean |
| Hostile sentinel non-leak | Passing | Source/config/outside-secret sentinels absent from terminal, JSON, and SARIF |
| Native JSON golden output | Passing | Byte-for-byte committed `scan-result.json` |
| SARIF golden output | Passing | Byte-for-byte committed `scan-result.sarif` |
| Terminal golden output | Passing | Byte-for-byte committed `scan-result.txt` |
| Repeated serialization determinism | Passing | Golden tests require repeated serialization to be identical |
| Shared deterministic text ordering | Passing | `tests/scanner/core/deterministic-text-order.test.ts` |
| Medium benchmark contract | Passing | Exactly 700 analyzed files, clean result, broad 20-second ceiling |

## Maintainability and CI hardening

Phase 3O also verifies the codebase remains modular rather than moving scanner logic into the CLI:

- `scanner-core` owns shared safety, finding, policy, baseline, and deterministic-order contracts
- secret, JS/TS, SCA, and IaC detector packages depend on core rather than on the CLI
- output adapters consume normalized scan results and do not rerun detectors
- the CLI remains the composition and presentation layer
- benchmark fixture generation is separated from measurement and validation logic
- deterministic text comparison is centralized in `packages/scanner-core/determinism/compare-text.ts`
- dependency resolution is captured in committed `package-lock.json`
- CI uses current `actions/checkout@v7` and `actions/setup-node@v7`
- CI token permissions are read-only and checkout credential persistence is disabled
- CI installs from the committed lock with lifecycle scripts disabled

The initial clean-install hardening deliberately exposed the missing package lock. A temporary same-repository CI bootstrap generated lockfile v3 with npm 10.9.8 on Node 22.23.2, committed it once, and was then removed. The final workflow contains no self-modifying step and no write permission.

## Existing Phase 3 security/regression coverage

The full suite retains dedicated regression coverage for:

- repository inventory budgets and ignore semantics
- no-follow identity-checked content reads
- secret redaction and one-way secret fingerprints
- secret provider and entropy false-positive controls
- JS/TS no-execution parsing
- generic parser diagnostics without source-line leakage
- AST traversal and taint step budgets
- Node HTTPS binding identity and shadowing
- Express and child-process binding shadowing/mutation
- unsupported control-flow conservatism
- npm manifest and lockfile parser failures
- OSV request/response boundaries and failure semantics
- CycloneDX generation
- Docker parser/rules and no-execution behavior
- Kubernetes parser/rules, alias/document limits, and hostile YAML
- Terraform parser/rules and no Terraform/provider/module/cloud execution
- GitHub Actions parser/rules and no workflow/action execution
- `.npmrc` and `vercel.json` configuration rules and source-value non-leakage
- baseline size/schema/duplicate/symlink/path security
- SARIF metadata/source/secret/path leakage prevention
- safe output path behavior
- policy exit-code distinctions

## Phase 3 trust-boundary merge rule

PR #21 must not merge unless its exact final head passes:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Any of the following blocks merge:

- target repository execution or lifecycle-script execution
- repository symlink following for scanner content reads
- unbounded or materially weakened scanner resource limit
- raw detected secret leakage
- arbitrary hostile source/configuration text reflected into unsafe output
- default scanner network access
- OSV sending data beyond normalized package identity/version
- false clean result when supported analysis fails
- policy/scanner error conflation
- unsafe output or baseline path regression
- SARIF arbitrary metadata/source/root-path leakage
- unexplained golden-output contract change
- benchmark fixture count/result mismatch
- nondeterministic locale-sensitive output ordering
- detector-to-CLI dependency reversal
- unresolved blocking review thread

## Database checks

Phase 3O has no database migration, schema, RLS, RPC, storage, or hosted-ingestion change. Supabase advisor checks are not a merge dependency for this local-scanner-only diff.

## Post-merge completion rule

A green PR #21 head is necessary but not sufficient. Phase 3 is complete only after PR #21 is merged and the resulting `main` CI validation is also green.

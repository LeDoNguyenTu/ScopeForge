# ScopeForge Test Status

## Phase 3O diagnostic completion gate

CI #311 on PR #21 head `4d7dbc43a41e15a26d6dd634e29eb1a96a299ea0` passed the complete implementation and benchmark gate before the final documentation commits.

| Check | Result | Evidence |
|---|---|---|
| Vitest | Passing | 85 test files, 329 tests on CI #311 |
| TypeScript strict typecheck | Passing | `npm run typecheck` on CI #311 |
| CLI TypeScript build | Passing | `npm run build:cli` on CI #311 |
| Compiled CLI runtime smoke | Passing | `ScopeForge 0.1.0` on CI #311 |
| Medium scanner benchmark | Passing | 700 files, 0 findings, 0 errors, 928 ms wall time on CI #311 |
| Next.js production build | Passing | `npm run build` on CI #311 |

Benchmark line:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"wallMs":928,"scanDurationMs":859,"rssDeltaBytes":22900736,"maxWallMs":20000}
```

CI #311 is supporting evidence only because documentation commits changed the PR head afterward. The exact final PR head must run the same complete gate before merge.

## Phase 3O completion coverage

| Area | Result | Evidence / intent |
|---|---|---|
| Mixed-repository integration | Passing | `tests/scanner/integration/phase3-e2e.test.ts` |
| Report-only vs policy enforcement | Passing | Same mixed repository returns success by default and policy failure with `--fail-on high` |
| Baseline new/existing behavior | Passing | Baseline creation plus one introduced high-severity secret gates only the new finding by default |
| SARIF and CycloneDX integration | Passing | Same mixed repository emits parseable SARIF 2.1.0 and CycloneDX 1.7 |
| Secret non-leak in combined scan | Passing | Raw synthetic token absent from native JSON, SARIF, and baseline artifacts |
| Hostile target no-execution | Passing | Executable-looking JS and package lifecycle content never creates the marker file |
| Default scanner no-network | Passing | Global fetch guard remains unused when OSV is disabled |
| Symlink boundary | Passing | External symlink is skipped and outside secret content is not read into output |
| Tightened file-size boundary | Passing | Oversized synthetic source file appears in inventory skip counts |
| Malformed supported input | Passing | Structured scanner diagnostics prevent incomplete coverage from appearing clean |
| Hostile sentinel non-leak | Passing | Source/config/outside-secret sentinels absent from terminal, JSON, and SARIF output |
| Native JSON golden output | Passing | Byte-for-byte committed `scan-result.json` |
| SARIF golden output | Passing | Byte-for-byte committed `scan-result.sarif` |
| Terminal golden output | Passing | Byte-for-byte committed `scan-result.txt` |
| Repeated serialization determinism | Passing | Golden tests repeat serialization and require identical bytes |
| Medium benchmark contract | Passing | Exactly 700 analyzed files, clean result, broad 20-second ceiling |

## Existing Phase 3 security/regression coverage

The full test suite also retains dedicated regression coverage for:

- repository inventory budgets and ignore semantics
- no-follow identity-checked content reads
- secret redaction and one-way secret fingerprints
- secret provider and entropy rule false-positive controls
- JS/TS no-execution parsing
- generic parser diagnostics without source-line leakage
- AST traversal budget
- Node HTTPS binding identity and shadowing
- bounded taint step budget
- Express and child-process binding shadowing/mutation
- unsupported control-flow conservatism
- npm lockfile parser failures
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

PR #21 must not merge unless the exact final head passes all of these commands:

```bash
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Any of the following blocks merge:

- target repository execution path
- target package lifecycle execution
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
- unexpected golden-output contract change without explicit review
- benchmark fixture count/result mismatch
- unresolved blocking review thread

## Database checks

Phase 3O has no database migration, schema, RLS, RPC, storage, or hosted-ingestion change. Supabase advisor checks are not a merge dependency for this local-scanner-only diff.

## Post-merge completion rule

A green PR #21 head is necessary but not sufficient. Phase 3 is complete only after PR #21 is merged and the resulting `main` CI run also passes the repository validation workflow.

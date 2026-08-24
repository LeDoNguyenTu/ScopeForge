# ScopeForge Phase 3 Release Readiness

## Status

**Release candidate pending the exact final PR #21 CI gate and post-merge `main` verification.**

The Phase 3 code and supply-chain security feature set is implemented. This document records the final release-hardening evidence and the conditions that must be true before Phase 3 is declared complete.

A previous green run is not enough. The exact immutable final PR head must pass the full gate, the pull request must merge with expected-head protection, and the resulting `main` commit must pass CI.

## Phase 3 delivered scope

Phase 3 provides a local/passive repository scanner that does not require a ScopeForge account.

Delivered capabilities include:

- bounded deterministic repository inventory
- safe no-follow content reads
- normalized findings and explicit scanner errors
- stable finding fingerprints and deterministic result ordering
- strict root-only repository configuration
- report-only policy by default and opt-in severity enforcement
- distinct success, policy, usage/configuration, and scanner-error exits
- provider-aware secret scanning with mandatory redaction
- JavaScript/TypeScript syntax-aware structural SAST
- bounded high-confidence Express to Node command-injection taint analysis
- npm dependency inventory from supported lockfiles and manifest fallback
- optional fixed-endpoint OSV vulnerability enrichment
- CycloneDX 1.7 JSON SBOM generation independent of OSV
- Dockerfile analysis
- Kubernetes YAML analysis
- selected Terraform AWS analysis
- GitHub Actions workflow analysis
- `.npmrc` and `vercel.json` security checks
- deterministic version 1 baselines with new/existing finding classification
- terminal output
- deterministic native ScopeForge JSON
- deterministic SARIF 2.1.0 compatible with GitHub Code Scanning
- GitHub Actions usage guidance
- mixed-repository integration coverage
- hostile-repository completion coverage
- byte-for-byte golden output coverage
- deterministic scanner benchmark and CI catastrophic-regression gate

Canonical limitations are documented in `LIMITATIONS.md`.

## Phase 3O completion scope

PR #21 `Complete Phase 3 release hardening` is intentionally a completion and verification slice rather than a detector expansion.

It adds:

- `tests/scanner/integration/phase3-e2e.test.ts`
- `tests/scanner/integration/phase3-hostile-repository.test.ts`
- native JSON, SARIF, and terminal golden fixtures and continuity tests
- `benchmarks/scanner-medium.mjs`
- `npm run benchmark:scanner`
- benchmark execution in the normal CI validation job
- `docs/scanner/CI.md`
- `docs/scanner/PERFORMANCE.md`
- `docs/scanner/LIMITATIONS.md`
- refreshed permanent development state and phase boundaries
- this release-readiness record

No Phase 3O detector rule semantics or remote-testing scope are intentionally expanded.

## Diagnostic verification evidence

CI #311 ran against PR #21 head `4d7dbc43a41e15a26d6dd634e29eb1a96a299ea0` after the completion tests and benchmark were added, before final documentation commits changed the PR head.

CI #311 passed:

- 85 test files
- 329 tests
- `npm run typecheck`
- `npm run build:cli`
- compiled CLI runtime smoke printing `ScopeForge 0.1.0`
- `npm run benchmark:scanner`
- `npm run build`

The exact benchmark output was:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"wallMs":928,"scanDurationMs":859,"rssDeltaBytes":22900736,"maxWallMs":20000}
```

This proves the Phase 3O integration, hostile-input, golden-output, and benchmark contracts passed together at that implementation head. CI #311 is supporting evidence only. The final documentation head still requires a fresh complete CI run before merge.

## Whole-Phase-3 security review

The final review focuses on the Phase 3 trust boundary rather than attempting to widen scanner coverage at release time.

### Repository inventory and safe reads

Reviewed boundaries include `packages/scanner-core/inventory/build-inventory.ts` and `packages/scanner-core/filesystem/read-inventory-entry.ts`.

Verified properties:

- inventory traversal uses `lstat` and does not follow repository symlinks
- generated/vendor directories are excluded by default
- root ignore patterns are bounded
- file-count, per-file byte, and total-byte budgets are enforced during inventory construction
- detector reads require canonical repository-relative inventory paths
- detector reads require the path to exist in the bounded inventory
- resolved paths must remain inside the real scan root
- symlinks and non-regular files are rejected at read time
- reads are chunk-bounded rather than blindly loading an arbitrary file
- `O_NOFOLLOW` is used when the platform exposes it
- opened device/inode identity is compared with the inspected path
- final size and identity are revalidated after reading

The Phase 3O hostile-repository test additionally proves an external symlink is skipped and its outside secret sentinel is never reflected into scanner output.

### Root configuration

Reviewed `packages/scanner-core/config/load-config.ts`.

Verified properties:

- default configuration is read only from `.scopeforge.json` at the explicit scan root
- configuration size is bounded
- a stable configuration symlink or directory is rejected
- unknown keys fail closed
- scanner and rule selections fail closed on unknown built-ins through the CLI registry
- repository configuration may tighten safe inventory budgets but cannot raise built-in ceilings
- configured baseline/output paths must be canonical relative paths without absolute paths, backslashes, empty components, `.` components, or `..` traversal
- OSV configuration is a boolean enable/disable setting only and cannot provide a repository-controlled endpoint or request headers

### Scanner coordination and error semantics

Reviewed `packages/scanner-core/coordinator/run-scan.ts`, policy evaluation behavior, and CLI integration.

Verified properties:

- scanner families execute in deterministic order
- findings are deduplicated by stable fingerprint
- structured scanner diagnostics are retained without erasing valid findings from other files/scanners
- scanner failures remain explicit errors
- report-only findings do not become process failures
- policy failure is distinct from scanner failure
- incomplete analysis cannot be returned as a successful clean scan when a scanner error exists

Phase 3O mixed and hostile repository tests exercise these semantics end-to-end.

### Secret handling

Reviewed `packages/scanner-secrets/scanner.ts`, `packages/scanner-secrets/scan-file.ts`, `packages/scanner-secrets/redaction/redact.ts`, and `packages/scanner-secrets/findings/fingerprint.ts`.

Verified properties:

- secret scanning reads repository entries only through the shared safe-read boundary
- detected raw secret values are passed into redaction/fingerprinting internally but are not stored in normalized findings
- evidence contains only a safe public provider prefix where applicable plus `[REDACTED]`
- private-key evidence exposes only a public key-header description
- secret metadata stores provider identity and secret length, not the secret
- secret fingerprints include a SHA-256 digest rather than the raw value and are one-way hashed again into the public `sfs1:` identity
- safe-fixture annotation parsing does not treat marker-like string contents as comments
- baselines, native JSON, SARIF, and Phase 3O integration tests contain explicit secret non-leakage checks

### JavaScript and TypeScript execution boundary

Reviewed `packages/scanner-jsts/parser/parse-source.ts`, `packages/scanner-jsts/scanner.ts`, structural analysis, and bounded command-taint paths.

Verified properties:

- target files are parsed with TypeScript `createSourceFile` only
- no target `Program`, type checker, emit, module resolution, import execution, or `require` execution is introduced
- syntax diagnostics are generic and do not serialize target source lines
- AST traversal and taint analysis have fixed resource budgets
- an over-budget taint analysis discards partial taint results and emits a scanner diagnostic
- supported command-injection findings require statically established Express routing and Node child-process sink identity
- shadowing, mutation, unsupported control flow, and unmodeled constructs are handled conservatively

The hostile-repository completion test includes executable-looking target JavaScript and verifies its marker file is never created.

### SCA and OSV outbound data

Reviewed `packages/scanner-sca/scanner.ts` and `packages/scanner-sca/osv/client.ts`.

Verified properties:

- OSV is disabled by default
- the built-in SCA scanner performs no vulnerability network lookup when OSV is disabled
- the default endpoint is fixed to `https://api.osv.dev/v1`
- repository configuration cannot override that endpoint or inject headers
- OSV query payloads contain npm ecosystem, normalized package name, exact version, and pagination token only
- OSV responses are bounded by timeout, response-byte, pagination, query-batch, and record-count limits
- network/protocol failures return scanner diagnostics instead of a clean result
- vulnerability detail lookups are made only by vulnerability IDs returned by OSV
- repository source files, arbitrary target configuration, and detected secret values are not part of OSV requests

Phase 3O's default-offline integration test guards global `fetch` and verifies it is never called.

### Infrastructure and configuration scanners

Reviewed the IaC dispatcher and representative Docker, Kubernetes, Terraform, GitHub Actions, and generic configuration paths.

Verified properties:

- supported files are selected from bounded inventory entries and read through the shared safe-read function
- Dockerfiles are parsed as logical instructions rather than executed
- Kubernetes documents are parsed locally with alias/document limits and no cluster tooling
- Terraform uses local HCL parsing, catches parser failure into generic diagnostics, and does not invoke Terraform/provider/module/provisioner/cloud behavior
- GitHub Actions files are parsed as YAML and never executed as workflows or actions
- generic configuration checks use normalized evidence rather than arbitrary source values
- malformed supported structured input is surfaced as incomplete coverage

### Baselines

Reviewed `packages/scanner-core/baseline/load.ts` and baseline integration.

Verified properties:

- baseline path must remain inside the scan root
- baseline parent path is realpath-checked for containment
- symlink baselines are rejected
- `O_NOFOLLOW` is used when available
- opened file device/inode identity is revalidated
- reads are bounded to 4 MiB and 50,000 entries
- schema keys are exact and malformed/duplicate identities fail closed
- baseline data stores stable identity and safe metadata only
- secret values, arbitrary evidence, remediation text, and source snippets are not serialized into baselines

### Safe output writing

Reviewed `packages/cli/safe-output.ts` and CLI usage.

Verified properties:

- repository-configured output paths must remain inside the scan root
- configured output parent realpath is checked for containment
- existing output symlinks are rejected
- existing non-regular destinations are rejected
- final file open uses `O_NOFOLLOW` where available
- created output files use mode `0600`
- normal output and SBOM cannot share the same destination
- explicit CLI output paths may intentionally point outside the scan root because that destination is supplied by the invoking user rather than repository configuration

### SARIF output

Reviewed `packages/scanner-output/sarif/serialize.ts` and SARIF regressions.

Verified properties:

- SARIF is deterministic and versioned as 2.1.0
- rule IDs and rule indexes are stable/deterministic for equivalent input
- severity and baseline-state mappings are explicit
- existing ScopeForge fingerprints are used for alert continuity
- repository-relative locations use `%SRCROOT%`
- absolute paths, traversal components, backslashes, drive-letter paths, empty components, and `.` components are omitted rather than serialized
- result properties use a fixed ScopeForge allowlist
- arbitrary finding metadata is not copied into SARIF
- source snippets and internal taint data-flow labels are not copied into SARIF
- secret regression sentinels and local scan-root paths are excluded from SARIF output

### Review conclusion

No release-blocking security vulnerability was identified in the reviewed Phase 3 trust-boundary paths or the Phase 3O completion behavior.

The scanner's security claims remain deliberately scoped to passive local analysis. A separate local process with permission to mutate the working tree concurrently is an operational race environment rather than the static hostile-repository model. CI and release guidance should use immutable/reviewed checkouts where practical. Phase 3 does not claim protection against a privileged local adversary controlling the scanner host.

This conclusion does not imply complete vulnerability coverage. False-negative and unsupported-analysis boundaries are documented in `LIMITATIONS.md`.

## Database and hosted-service applicability

Phase 3O does not change:

- Supabase migrations
- PostgreSQL schema
- Row Level Security
- RPCs/functions
- storage buckets/policies
- hosted scanner-result ingestion
- remote scan orchestration

Database security/performance advisor checks are therefore not a merge dependency for PR #21. Existing Phase 1 and Phase 2 authorization/database boundaries remain unchanged.

## Performance readiness

The deterministic benchmark is documented in `PERFORMANCE.md`.

The benchmark's 20-second CI ceiling is a catastrophic-regression guard, not a performance target. The observed 928 ms diagnostic result must not be marketed as universal repository performance.

Future public performance claims require repeated runs, controlled hardware, multiple repository shapes, percentile reporting, and separate network-enabled measurements.

## Known limitations and residual boundaries

See `LIMITATIONS.md` for the canonical list.

Important current boundaries include:

- JavaScript/TypeScript is the only syntax-aware application SAST family
- command taint analysis is intentionally narrow and not whole-program
- SCA covers the npm ecosystem only
- OSV is optional and network-derived vulnerability completeness depends on upstream data
- infrastructure scanners analyze local syntax rather than effective deployed state
- Terraform provider/module/state evaluation is not performed
- Kubernetes cluster/admission state is not queried
- GitHub organization/runtime workflow policy is not queried
- arbitrary executable community plugins are not supported
- ScopeForge has not yet published a standalone package or reusable Action
- no remote DAST, authenticated crawling, API fuzzing, exploit validation, credential attacks, persistence, destructive validation, or remote worker fleet exists in Phase 3

## Exact final merge gate

The final immutable PR #21 head must pass all commands below in the GitHub CI validation job:

```bash
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Before merge, additionally require:

- every PR #21 changed file reviewed
- no unresolved blocking review thread
- no unexpected database/hosted-service diff
- benchmark fixture still reports exactly 700 analyzed files, 0 findings, and 0 scanner errors
- no unexplained golden-output change
- PR #21 metadata records the exact final head and CI evidence without changing the head

Merge must use squash merge with `expected_head_sha` so a moved head cannot be merged using stale verification.

## Post-merge gate

After PR #21 merges:

1. identify the resulting `main` commit
2. require the normal `push` CI validation workflow to run
3. verify tests, typecheck, CLI build/runtime, benchmark, and production build pass on `main`
4. only then update project status verbally and in the next development work as **Phase 3 complete**

If post-merge CI fails, Phase 3 completion is blocked even if the PR head was green.

## Next phase boundary

After the post-merge gate is green, Phase 4 verified runtime and API security is next.

Phase 4 must start with architecture and threat-boundary design because it introduces active remote behavior, authorization enforcement, worker isolation, egress control, request budgets, cancellation, and abuse-prevention requirements that do not exist in the passive Phase 3 scanner.

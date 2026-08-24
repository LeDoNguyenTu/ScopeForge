# ScopeForge Phase 3 Release Readiness

## Status

**Release candidate pending one exact-final-head CI gate, squash merge, and merged `main` verification.**

PR #21 `Complete Phase 3 release hardening` is the final Phase 3 completion slice. The code and supply-chain scanner feature set is implemented. Phase 3 must not be declared complete from an older green run.

The authoritative supporting documents are intentionally split by responsibility:

- `docs/development/TEST_STATUS.md` - test, CI, maintainability, and merge-blocker ledger
- `docs/scanner/PERFORMANCE.md` - benchmark fixture, methodology, and measurements
- `docs/scanner/LIMITATIONS.md` - canonical supported and unsupported analysis boundaries
- `docs/scanner/CI.md` - source-install and GitHub Code Scanning usage
- this file - release decision and trust-boundary review

## Delivered Phase 3 contract

Phase 3 provides a local/passive repository scanner with:

- bounded deterministic inventory and safe no-follow content reads
- normalized findings, explicit scanner diagnostics, stable fingerprints, and deterministic ordering
- strict root-only repository configuration and safe inventory ceilings
- report-only default policy with explicit severity gating
- provider-aware secret detection with mandatory redaction
- JavaScript/TypeScript structural SAST and bounded command-injection taint analysis
- npm dependency inventory with optional fixed-endpoint OSV enrichment
- CycloneDX 1.7 JSON SBOM output
- Docker, Kubernetes, selected Terraform AWS, GitHub Actions, `.npmrc`, and `vercel.json` analysis
- deterministic version 1 baselines with new/existing finding classification
- terminal, native JSON, and SARIF 2.1.0 output
- mixed-repository and hostile-input integration coverage
- committed byte-for-byte golden outputs
- deterministic 700-file performance regression benchmark

Phase 3 remains local and passive. Remote DAST, crawling, fuzzing, exploit validation, credential attacks, persistence, destructive behavior, hosted remote scanner execution, and cloud/cluster control-plane access remain outside this phase.

## Maintainability and reproducibility hardening

The final Phase 3O review also tightened engineering quality without expanding detector semantics:

- benchmark fixture composition is separated from measurement and validation logic
- shared deterministic text comparison lives in `packages/scanner-core/determinism/compare-text.ts`
- findings, secrets, SCA inventory, OSV, SBOM, and built-in rule listing reuse the same deterministic ordering contract
- detector packages depend on shared core contracts rather than on the CLI
- output adapters consume normalized scan results rather than rerunning detectors
- the CLI remains the composition and presentation layer
- dependency resolution is captured by committed lockfile v3
- CI uses `actions/checkout@v7` and `actions/setup-node@v7`
- CI token permissions are read-only
- checkout credential persistence is disabled
- CI uses `npm ci --ignore-scripts --no-audit --no-fund`

The temporary lockfile-bootstrap workflow used during hardening was removed after generating the committed lock. The final workflow contains no self-modifying branch step and no write permission.

## Latest implementation GREEN evidence

CI #346 on head `6ffb249c0ac7463c410cfd1536b105ebca9507d3` passed after the maintainability and reproducibility changes:

- reproducible `npm ci --ignore-scripts --no-audit --no-fund`
- 86 test files and 331 tests
- strict TypeScript typecheck
- CLI compilation
- compiled `ScopeForge 0.1.0` runtime smoke
- 700-file benchmark with 0 findings and 0 scanner errors
- benchmark observation: 876 ms wall, 816 ms scanner duration, 17,399,808-byte RSS delta
- Next.js production build

CI #346 is supporting implementation evidence only because permanent evidence documentation changed the PR head afterward. The final immutable documentation head must rerun the complete gate before merge.

## Whole-Phase-3 trust-boundary review

The release review followed the scanner trust boundaries rather than widening detector coverage at release time.

### Repository reads and configuration

Reviewed inventory construction, `readInventoryEntry`, root configuration, baseline loading, and safe output behavior.

Verified:

- repository symlinks are not followed for scanner content reads
- canonical repository-relative inventory paths are required
- real-path containment and regular-file checks are enforced
- reads are byte-bounded and identity-revalidated
- `O_NOFOLLOW` is used where available
- repository configuration can tighten but cannot raise safe inventory ceilings
- repository-configured output/baseline paths cannot traverse outside the scan root
- unsafe symlink/non-regular output destinations are rejected

### Scanner execution boundary

Reviewed JS/TS parsing, IaC parsing, scanner coordination, and hostile-repository integration coverage.

Verified:

- target repository code is not executed
- target package lifecycle scripts are not run
- target dependencies are not installed
- JS/TS analysis does not execute imports/modules
- Dockerfiles and RUN commands are not executed
- Terraform/provider/module/provisioner/cloud behavior is not executed
- Kubernetes, Helm, Kustomize, and kubectl are not executed
- GitHub Actions workflows/actions are not executed
- malformed supported analysis produces scanner diagnostics rather than false-clean output

### Network and secret boundary

Reviewed secret handling and OSV behavior.

Verified:

- raw detected secret values are redacted before normalized findings
- baselines, terminal output, native JSON, SARIF, and integration artifacts are covered by secret non-leakage regressions
- scanner-initiated network access is disabled by default
- OSV is explicitly opt-in
- repository configuration cannot provide an arbitrary OSV endpoint or request headers
- OSV requests contain normalized npm package identity/version and pagination state only
- OSV responses are bounded by timeout, response-size, pagination, batch, and record limits
- OSV failures are scanner diagnostics, not clean vulnerability results

### Determinism and output boundary

Reviewed normalized ordering, golden output, baseline, and SARIF behavior.

Verified:

- shared ordering is locale-independent
- equivalent results are deterministically ordered
- native JSON, SARIF, and terminal output have byte-for-byte golden contracts
- SARIF uses stable rule indexes and ScopeForge fingerprints
- unsafe SARIF paths are omitted rather than reflected
- SARIF uses a fixed property allowlist and does not copy arbitrary finding metadata/source snippets/internal data-flow labels

### Review conclusion

No release-blocking security vulnerability or architecture-layering blocker was identified in the reviewed Phase 3 trust-boundary paths or Phase 3O completion changes.

This conclusion does not imply complete vulnerability detection. Scanner coverage limits and false-negative boundaries remain documented in `LIMITATIONS.md`. Phase 3 also does not claim protection against a privileged local adversary controlling the scanner host or concurrently mutating the checkout.

## Database applicability

PR #21 does not change Supabase migrations, PostgreSQL schema, RLS, RPCs, storage policies, hosted scanner-result ingestion, or remote scan orchestration. Database advisor checks are therefore not a merge dependency for this local-scanner-only release-hardening PR.

## Exact final merge gate

The exact immutable final PR #21 head must pass:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Before merge also require:

- the complete final changed-file set reviewed
- no unresolved blocking review thread
- no unexpected database or hosted-service change
- exactly 700 benchmark files, 0 benchmark findings, and 0 benchmark scanner errors
- no unexplained golden-output contract change
- no detector-to-CLI dependency reversal
- no locale-sensitive deterministic-output regression

Merge must use squash merge with `expected_head_sha` so a moved PR head cannot be merged using stale verification.

## Post-merge gate

After the squash merge:

1. identify the resulting `main` commit
2. require the normal `push` CI validation workflow to pass on that commit
3. only then declare Phase 3 complete

If merged `main` CI fails, Phase 3 remains blocked regardless of the PR-head result.

## Next boundary

After post-merge verification, Phase 4 verified runtime and API security is next. It must begin with architecture and threat-boundary design for authorization, worker isolation, DNS/IP/redirect/egress controls, budgets, cancellation, auditability, and abuse prevention before active scanning is implemented.

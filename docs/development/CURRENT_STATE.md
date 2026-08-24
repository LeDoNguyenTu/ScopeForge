# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform for developers first, while making security findings understandable to people without a security background.

Product loop: `Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`.

Approved architecture:

- `docs/superpowers/specs/2026-08-24-community-platform-design.md`
- `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Completed foundations

### Phase 1 - Foundation

- Next.js and React application shell
- Supabase authentication and workspace tenancy
- Row Level Security and server session handling
- security headers and CI baseline

### Phase 2 - Asset control and authorization

- workspace-scoped web, API, and public-GitHub assets
- canonical target normalization
- proof-of-control challenges
- public HTTPS verification with DNS, IP, and SSRF boundaries
- trusted server writes, roles, quotas, audit events, and asset UI

Remote active scanning remains disabled through Phase 3.

## Phase 3 - Code and supply-chain security

The Phase 3 scanner feature set is implemented. PR #21 contains the final release-hardening slice. Phase 3 is declared complete only after the exact final PR #21 head passes the full gate, PR #21 is merged with expected-head protection, and merged `main` CI is green.

Phase 3N SARIF was merged through PR #20 as `f2859f5028965276c9dc69ddf10398740a6f9ec7`.

### Scanner foundation and safety

- deterministic bounded repository inventory
- default generated/vendor exclusions and root ignore handling
- file-count, per-file byte, and total-byte ceilings
- repository symlink non-following
- identity-checked no-follow content reads
- normalized findings and scanner errors
- stable finding fingerprints and deterministic ordering
- strict root-only `.scopeforge.json` version 1
- repository configuration may tighten but not raise safe inventory ceilings
- report-only default policy and explicit inclusive severity gating
- distinct success, policy, usage/configuration, and scanner-error exit codes
- no-follow normal output and baseline file handling

### Secret scanner

- GitHub token detection
- Stripe live secret-key detection
- Slack token detection
- complete private-key block detection
- contextual high-entropy assignment detection
- mandatory redaction before normalized finding output
- stable one-way `sfs1:` secret fingerprints
- exact safe-fixture annotation support
- reviewed fingerprint allowlisting

### JavaScript and TypeScript SAST

Supported syntax families:

- JS
- JSX
- MJS
- CJS
- TS
- TSX
- MTS
- CTS

The parser treats repository files as syntax data only. It does not resolve or execute target modules.

Current structural rules include:

- direct `eval` / `new Function`
- explicit Node HTTPS certificate-verification disablement where runtime binding identity is established statically

Current bounded taint coverage is intentionally narrow:

- statically established Express route handlers
- request fields under query, route params, and body
- selected local propagation and string construction
- statically established Node `child_process.exec` and `execSync`
- conservative shadowing, mutation, sanitizer, unsupported-control-flow, and step-budget behavior

No whole-program or cross-file generalized taint engine exists yet.

### Software composition analysis

Supported npm dependency sources:

- `npm-shrinkwrap.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `package.json` fallback

Resolved lockfile versions are preferred. npm Package URLs are normalized where possible.

OSV enrichment is disabled by default. When enabled, only normalized npm package identity and exact version are sent to ScopeForge's fixed OSV endpoint. Lookup failures are scanner errors and cannot appear as clean results.

### CycloneDX SBOM

- CycloneDX 1.7 JSON output
- root application component
- supported discovered npm dependencies and purls
- direct dependency relationships where local inventory establishes them
- tool metadata, timestamp, and serial number
- independent from OSV/network availability

### Infrastructure and configuration analysis

Implemented local/passive analysis:

- Dockerfiles
- Kubernetes manifests
- selected Terraform AWS resources and IAM policy documents
- GitHub Actions workflows under `.github/workflows/`
- `.npmrc`
- `vercel.json`

The scanner does not execute Dockerfiles, RUN commands, Terraform, providers, modules, provisioners, external data sources, Kubernetes manifests, Helm, Kustomize, kubectl, workflows, target package managers, or cloud APIs.

### Baselines and policy

- deterministic version 1 baseline files
- strict bounded parser and schema validation
- no-follow baseline reads and symlink refusal
- stable fingerprint matching
- `new` and `existing` finding classification
- resolved baseline-entry tracking
- baseline-aware policy defaults to gating new findings only
- explicit `--baseline-gate all`
- no raw secret values, source evidence, arbitrary finding metadata, or remediation text in baselines

### Output formats

- developer terminal output
- deterministic native ScopeForge JSON schema version 1
- deterministic SARIF 2.1.0 compatible with GitHub Code Scanning
- stable ScopeForge fingerprints carried into SARIF partial fingerprints
- repository-relative `%SRCROOT%` SARIF locations with unsafe paths omitted
- fixed SARIF property allowlist that excludes arbitrary metadata, source snippets, internal data-flow labels, and raw secret material

### Phase 3O completion hardening

PR #21 adds:

- mixed-repository end-to-end integration coverage
- hostile-repository no-execution, no-default-network, symlink, budget, malformed-input, and output-leakage coverage
- committed byte-for-byte native JSON, SARIF, and terminal golden outputs
- deterministic `scanner-medium-v1` benchmark over exactly 700 synthetic files
- benchmark CI regression gate with a broad 20-second ceiling
- GitHub Actions and Code Scanning documentation
- performance methodology and known-limitations documentation
- permanent project-state and release-readiness records

Diagnostic CI #311 at the implementation/benchmark head passed:

- 85 test files
- 329 tests
- strict TypeScript typecheck
- CLI compilation
- compiled `ScopeForge 0.1.0` runtime smoke
- scanner benchmark
- Next.js production build

CI #311 benchmark evidence:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"wallMs":928,"scanDurationMs":859,"rssDeltaBytes":22900736,"maxWallMs":20000}
```

The documentation head still requires its own exact-head gate before merge.

## Database status for Phase 3O

Phase 3O contains no Supabase schema, migration, policy, RPC, storage, or hosted-ingestion change. Database security/performance advisor checks are therefore not a merge dependency for this local-scanner-only release-hardening diff.

Existing Phase 1 and Phase 2 database authorization boundaries remain unchanged.

## Safety boundary

Phase 3 is local and passive.

Repository content remains hostile input. Phase 3 does not perform:

- remote DAST
- authenticated crawling
- API fuzzing
- exploit validation
- generalized network scanning
- cloud-account posture access
- credential attacks
- persistence
- destructive actions
- hosted remote scanner execution

Those require later authorization, isolation, egress, quota, cancellation, audit, and abuse-prevention boundaries.

## Known limitations

Canonical scanner limitations are maintained in `docs/scanner/LIMITATIONS.md`.

Key current boundaries include unsupported programming-language SAST engines beyond JS/TS, npm-only SCA ecosystem coverage, narrow command-injection taint analysis, conservative infrastructure semantics, no full Terraform evaluation, no cluster/cloud/workflow execution, no arbitrary community executable plugins, and no remote application testing.

## Next boundary

After PR #21 passes its exact-head gate, merges, and `main` CI is green, Phase 4 is the next implementation boundary: verified runtime and API security with explicit authorization and stronger execution isolation.

Do not begin Phase 4 active scanning inside the Phase 3O PR.

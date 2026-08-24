# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

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

The Phase 3 local scanner feature set is implemented. PR #21 contains the final release-hardening slice. Phase 3 is complete only after the exact final PR head is green, the PR is squash merged with expected-head protection, and the resulting `main` CI validation is green.

Phase 3N SARIF was merged through PR #20 as `f2859f5028965276c9dc69ddf10398740a6f9ec7`.

### Scanner foundation and safety

- deterministic bounded repository inventory
- generated/vendor exclusions and root ignore handling
- file-count, per-file byte, and total-byte ceilings
- repository symlink non-following
- identity-checked no-follow content reads
- normalized findings and scanner diagnostics
- stable finding fingerprints
- shared deterministic code-unit text ordering for output-sensitive sorting
- strict root `.scopeforge.json` version 1
- repository configuration may tighten but not raise safe inventory ceilings
- report-only default policy and explicit inclusive severity gating
- distinct success, policy, usage/configuration, and scanner-error exits
- safe no-follow output and baseline file handling

### Modular package boundaries

Phase 3 keeps scanner logic split by responsibility:

- `packages/scanner-core` owns shared safety, inventory, findings, coordination, configuration, policy, baseline, and deterministic-order contracts
- `packages/scanner-secrets` owns secret matching, redaction, suppression, and secret findings
- `packages/scanner-jsts` owns JS/TS parsing, structural SAST, and bounded command taint analysis
- `packages/scanner-sca` owns npm dependency inventory, optional OSV enrichment, vulnerability findings, and CycloneDX generation
- `packages/scanner-iac` owns Docker, Kubernetes, Terraform, GitHub Actions, and recognized configuration analyzers
- `packages/scanner-output` owns native JSON and SARIF serialization over normalized results
- `packages/cli` is the composition and presentation layer, not a detector package

Detector packages do not depend back on the CLI. This dependency direction is documented in `docs/ARCHITECTURE.md` so future workers and packaged front ends can reuse scanner engines without duplicating CLI behavior.

### Secret scanner

- GitHub token detection
- Stripe live secret-key detection
- Slack token detection
- complete private-key block detection
- contextual high-entropy assignment detection
- mandatory redaction before normalized output
- stable one-way `sfs1:` secret fingerprints
- safe-fixture annotation and reviewed fingerprint allowlisting

### JavaScript and TypeScript SAST

Supported syntax families: JS, JSX, MJS, CJS, TS, TSX, MTS, and CTS.

The parser treats target files as syntax data only. It does not resolve or execute target modules.

Current structural checks include direct `eval` / `new Function` and statically established Node HTTPS verification disablement.

Bounded taint coverage is intentionally narrow:

- statically established Express route handlers
- request query, route-param, and body fields
- selected local propagation and string construction
- statically established Node `child_process.exec` and `execSync`
- conservative shadowing, mutation, sanitizer, unsupported-control-flow, and step-budget handling

No generalized whole-program or cross-file taint engine exists yet.

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

- CycloneDX 1.7 JSON
- root application component
- supported discovered npm dependencies and purls
- direct dependency relationships where local inventory establishes them
- tool metadata, timestamp, and serial number
- independent from OSV availability

### Infrastructure and configuration analysis

Implemented local/passive analysis:

- Dockerfiles
- Kubernetes manifests
- selected Terraform AWS resources and IAM policy documents
- GitHub Actions workflows under `.github/workflows/`
- `.npmrc`
- `vercel.json`

The scanner does not execute Dockerfiles, RUN commands, Terraform, providers, modules, provisioners, external data sources, Kubernetes manifests, Helm, Kustomize, kubectl, workflows, target package managers, or cloud APIs.

### Baselines and output

- deterministic version 1 baselines
- bounded exact-schema parser
- no-follow baseline reads and symlink refusal
- stable fingerprint matching with `new` / `existing` classification
- new-only policy gating by default when a baseline is active
- explicit `--baseline-gate all`
- terminal output
- native ScopeForge JSON schema version 1
- SARIF 2.1.0 compatible with GitHub Code Scanning
- fixed SARIF property allowlist and safe repository-relative locations
- CycloneDX 1.7 JSON SBOM artifact

## Phase 3O release hardening

PR #21 adds completion evidence rather than broadening detector scope:

- mixed-repository end-to-end coverage
- hostile-repository no-execution, no-default-network, symlink, budget, malformed-input, and output-leakage coverage
- byte-for-byte native JSON, SARIF, and terminal golden outputs
- `scanner-medium-v1` benchmark over exactly 700 synthetic files
- benchmark fixture generation separated from timing/validation logic
- GitHub Code Scanning, performance, limitations, and release-readiness documentation
- committed npm lockfile v3 for reproducible installs
- current `actions/checkout@v7` and `actions/setup-node@v7`
- read-only CI token permissions, disabled checkout credential persistence, and `npm ci --ignore-scripts`
- shared `scanner-core` deterministic text comparator reused by findings, secret output, SCA, OSV, SBOM, and rule listing

Latest implementation GREEN evidence is CI #346 on `6ffb249c0ac7463c410cfd1536b105ebca9507d3`:

- 86 test files and 331 tests passed
- strict TypeScript typecheck passed
- CLI build and compiled `ScopeForge 0.1.0` smoke passed
- 700-file benchmark passed with 0 findings and 0 errors
- benchmark: 876 ms wall, 816 ms scanner duration, 17,399,808 bytes RSS delta
- Next.js production build passed

The permanent evidence documentation changes the PR head after that checkpoint, so one exact final documentation-head CI run is still required before merge.

## Database status for Phase 3O

Phase 3O contains no Supabase schema, migration, policy, RPC, storage, or hosted-ingestion change. Database advisor checks are not a merge dependency for this local-scanner-only diff.

## Safety boundary

Phase 3 remains local and passive. It does not perform remote DAST, authenticated crawling, API fuzzing, exploit validation, generalized network scanning, cloud-account posture access, credential attacks, persistence, destructive actions, or hosted remote scanner execution.

Canonical scanner limitations are in `docs/scanner/LIMITATIONS.md`.

## Next boundary

After PR #21 passes its exact final gate, merges, and `main` CI is green, Phase 4 verified runtime and API security is next.

Phase 4 must start with architecture and threat-boundary design. Do not add active remote scanning inside PR #21.

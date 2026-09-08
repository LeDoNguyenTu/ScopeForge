# ScopeForge

**Open-source application security that helps developers discover security problems, understand the evidence, and verify fixes without turning a scanner into another source of risk.**

ScopeForge is designed around a practical security loop:

**Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify**

The project combines a local/passive repository scanner with a web control plane that will later support authorized runtime security, normalized findings, remediation workflows, and community security knowledge.

> Use ScopeForge only on systems and repositories you own or are explicitly authorized to assess.

## Current status

The Phase 3 code and supply-chain security feature set is implemented. Final completion is gated by the release-readiness process in `docs/scanner/RELEASE_READINESS.md`, including exact-head CI and post-merge `main` verification.

Phase 3 scanning is local and passive. It does not require a ScopeForge account.

Phase 7 Community Security Packs v1 is implemented in candidate PR #54 and is pending exact-head acceptance. The v1 design is local-only, explicitly selected, data-only, and limited to the closed `static_literal_v1` matcher. Hosted pack distribution/activation, active rules, executable plugins, and target-repository auto-discovery do not exist.

### Local scanner capabilities

- bounded hostile-repository inventory with file-count, file-size, total-byte, ignore, and symlink boundaries
- safe no-follow content reads with file identity and size revalidation
- normalized findings, stable fingerprints, deterministic ordering, explicit scanner errors, and policy exit codes
- report-only default with opt-in severity enforcement
- provider-aware secret detection with mandatory redaction and one-way fingerprints
- JavaScript/TypeScript syntax-aware structural SAST without target module execution
- bounded high-confidence Express request-input to Node `child_process.exec` / `execSync` command-injection analysis
- npm dependency inventory from supported lockfiles and manifest fallback
- optional OSV vulnerability enrichment, disabled by default
- CycloneDX 1.7 JSON SBOM generation independent of OSV availability
- Dockerfile security analysis
- Kubernetes manifest security analysis
- selected Terraform AWS configuration analysis
- GitHub Actions workflow security analysis
- `.npmrc` and `vercel.json` security checks
- explicitly selected local Security Packs using the bounded `static_literal_v1` matcher
- versioned baselines with new/existing finding classification
- terminal, deterministic native JSON, and deterministic SARIF 2.1.0 output
- GitHub Code Scanning compatible SARIF generation
- committed golden-output continuity tests
- mixed-repository and hostile-input integration coverage
- deterministic 700-file CI benchmark for catastrophic performance regression detection

Detailed limitations are documented in `docs/scanner/LIMITATIONS.md`.

## Quick start

Requirements:

- Node.js 22
- npm

From this repository:

```bash
npm install
npm run scopeforge -- version
npm run scopeforge -- rules list
npm run scopeforge -- scan .
```

The repository is currently source-installed. ScopeForge is not yet published as a standalone npm package or reusable GitHub Action.

## CLI examples

Terminal report:

```bash
npm run scopeforge -- scan .
```

Native JSON:

```bash
npm run scopeforge -- scan . --format json
npm run scopeforge -- scan . --format json --output scopeforge-results.json
```

SARIF 2.1.0:

```bash
npm run scopeforge -- scan . --format sarif --output scopeforge.sarif
```

CycloneDX 1.7 SBOM:

```bash
npm run scopeforge -- scan . --sbom scopeforge.cdx.json
```

JSON and SBOM together:

```bash
npm run scopeforge -- scan . \
  --format json \
  --output scopeforge-results.json \
  --sbom scopeforge.cdx.json
```

Opt-in severity gate:

```bash
npm run scopeforge -- scan . --fail-on high
```

Create a baseline:

```bash
npm run scopeforge -- baseline create .
```

Gate only new high-severity findings against a baseline:

```bash
npm run scopeforge -- scan . \
  --baseline .scopeforge-baseline.json \
  --fail-on high
```

Gate on both existing and new findings explicitly:

```bash
npm run scopeforge -- scan . \
  --baseline .scopeforge-baseline.json \
  --baseline-gate all \
  --fail-on high
```

List built-in rules:

```bash
npm run scopeforge -- rules list
```

## Security Packs - local v1 candidate

Security Packs are loaded only from explicit local paths. A target repository containing `scopeforge-pack.json` or a `fixtures/` directory cannot activate a pack.

Validate and inspect the first-party example:

```bash
npm run build:cli
node .scopeforge-build/packages/cli/index.js pack validate security-packs/first-party/node-tls-verification
node .scopeforge-build/packages/cli/index.js pack inspect security-packs/first-party/node-tls-verification --json
```

Scan with an explicitly selected pack:

```bash
node .scopeforge-build/packages/cli/index.js scan . \
  --pack security-packs/first-party/node-tls-verification
```

Multiple `--pack` flags may be supplied up to the fixed v1 ceiling. Pack paths resolve from the CLI working directory, not from the scanned repository. Baseline creation remains pack-free, and hosted JSON rejects Security Pack findings.

See `docs/security-packs/AUTHORING.md` and `docs/security-packs/REVIEWING.md` for the exact schema, limits, fixture contract, versioning, and review requirements.

## Exit codes

| Code | Meaning |
|---:|---|
| 0 | Successful scan. Findings are allowed by the active policy. |
| 1 | Policy gate failed. |
| 2 | Usage, configuration, baseline, or unsafe-output error. |
| 3 | Scanner execution or incomplete-analysis error. |

Findings alone return 0 in report-only mode. Scanner failures remain distinct from policy failures so incomplete coverage cannot masquerade as a clean scan.

## Repository configuration

ScopeForge reads configuration only from `.scopeforge.json` at the explicit scan root. Nested repository configuration cannot silently weaken scanner behavior.

Example:

```json
{
  "version": 1,
  "scanners": ["secrets", "jsts", "sca", "iac"],
  "rules": {
    "include": [],
    "exclude": []
  },
  "secrets": {
    "allowFingerprints": []
  },
  "sca": {
    "osv": {
      "enabled": false
    }
  },
  "baseline": ".scopeforge-baseline.json",
  "baselineGate": "new",
  "failOn": "high",
  "output": {
    "format": "sarif",
    "path": "scopeforge.sarif"
  }
}
```

Repository configuration may tighten inventory budgets but cannot raise ScopeForge's built-in safe ceilings. Security Pack selection is not accepted from `.scopeforge.json` in v1.

## Secret handling

The current provider-aware scanner includes GitHub, Stripe live, Slack, complete private-key block, and contextual high-entropy assignment rules.

Raw detected secret values are redacted before normalized findings are constructed. They must not appear in terminal, native JSON, SARIF, baselines, benchmark output, or hosted audit data.

Use `scopeforge:allow-secret` only for intentional fixture content on the same line or on an exact standalone immediately preceding comment. Prefer reviewed fingerprint allowlisting for durable exceptions.

## JavaScript and TypeScript analysis

ScopeForge parses JS, JSX, MJS, CJS, TS, TSX, MTS, and CTS using the TypeScript parser without executing repository code or resolving target modules.

Current structural rules include direct dynamic-code execution constructs and explicit TLS certificate-verification disablement where Node HTTPS identity can be established statically.

The current bounded taint rule proves selected Express `req.query`, `req.params`, and `req.body` field flows into statically established Node `child_process.exec` or `execSync` sinks. It is intentionally narrow and does not claim generalized whole-program taint coverage.

## Dependency and SBOM behavior

JavaScript dependency inventory currently supports:

- `npm-shrinkwrap.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `package.json` fallback

Resolved lockfile versions are preferred. OSV enrichment is disabled by default. When enabled, only normalized npm package identity and exact version are sent to ScopeForge's fixed OSV endpoint. Repository source, arbitrary target configuration, and detected secret values are not sent.

CycloneDX generation is local and independent of OSV. A network outage does not prevent supported dependency inventory or SBOM generation.

## Infrastructure and workflow analysis

Phase 3 includes conservative local checks for:

- Dockerfiles
- Kubernetes YAML
- selected Terraform AWS resources and policy documents
- GitHub Actions workflows under `.github/workflows/`
- `.npmrc`
- `vercel.json`

ScopeForge does not execute Dockerfiles, shell commands, Terraform, providers, provisioners, Kubernetes manifests, Helm, Kustomize, kubectl, GitHub Actions workflows, package managers from the target repository, or cloud APIs while scanning.

## GitHub Actions and Code Scanning

A complete source-install and SARIF upload example is documented in `docs/scanner/CI.md`.

Until a standalone distribution exists, CI users should pin a reviewed ScopeForge revision, install ScopeForge's own dependencies with lifecycle scripts disabled in an isolated tool directory, build the CLI there, and pass the target repository path explicitly.

## Performance evidence

The Phase 3 completion benchmark generates a deterministic 700-file mixed repository and invokes the compiled CLI in-process with OSV disabled.

Diagnostic CI #311 observed 700 files analyzed, 0 findings, 0 errors, 928 ms wall time, 859 ms scanner duration, and a 22,900,736-byte process RSS delta on a GitHub-hosted Ubuntu 24.04 runner. The CI gate uses a deliberately broad 20-second ceiling only to catch catastrophic regressions.

These values are benchmark evidence, not a production performance guarantee. Methodology and caveats are in `docs/scanner/PERFORMANCE.md`.

## Architecture

```text
Repository
  |
  v
ScopeForge CLI
  +--> bounded inventory
  +--> safe no-follow content reads
  +--> secrets
  +--> JS/TS structural SAST
  +--> bounded command taint analysis
  +--> dependency inventory
  +--> optional fixed-endpoint OSV enrichment
  +--> Docker / Kubernetes / Terraform / GitHub Actions / config checks
  +--> explicitly selected local static Security Packs
  +--> normalized findings + explicit scanner errors
  +--> baseline classification + policy
  +--> terminal / JSON / SARIF
  +--> local CycloneDX SBOM

Browser
  |
  v
Next.js / Vercel control plane
  +--> Supabase Auth + PostgreSQL
  +--> authorized hosted/runtime workflows behind separate capability boundaries
```

The local scanner and web control plane are deliberately separated. Local Security Pack selection does not grant hosted, worker, browser, or network authority.

## Security boundary

Scanned repositories are hostile input.

ScopeForge local scanning:

- reads only through bounded repository inventory and safe content-read boundaries
- does not follow repository symlinks for scanner content reads
- does not execute target repository code or lifecycle scripts
- does not install target project dependencies
- does not execute target Docker, Terraform, Kubernetes, or workflow definitions
- does not send source code to OSV
- does not send detected secret values anywhere
- fails distinctly when requested analysis is incomplete
- uses no-follow output and baseline file handling
- requires Security Packs to be explicitly selected outside the target repository
- keeps Security Packs data-only and offline

Report ScopeForge vulnerabilities privately as described in `SECURITY.md`.

## Development validation

```bash
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Current validation evidence is tracked in `docs/development/TEST_STATUS.md` and the active phase release/handover documents.

## Project direction

ScopeForge is being built around more than detection.

### Security Story

Important findings should separate observed evidence from inferred consequence and help people understand what could be affected.

### Explain Mode

Security information should support progressive disclosure from plain-language explanation to developer and security detail.

### Prepare Mode

Findings should lead to practical preparation, including what to fix, what related systems to review, what telemetry to inspect, whether credentials may need rotation, and how to verify remediation.

### Community Security Packs

The reviewed local v1 candidate carries versioned static detection metadata, mappings, explainers, remediation guidance, preparedness information, fixtures, validation, and false-positive notes through a closed machine-validated schema. It does not execute arbitrary community JavaScript, provide hosted distribution, or permit active/network-capable pack rules.

## Roadmap

1. Foundation
2. Asset control and authorization
3. Code and supply-chain security
4. Verified runtime and API security
5. Findings, Security Stories, and remediation
6. Isolated workers and scanner scale
7. Community Security Packs
8. Validation, benchmarks, and public methodology
9. Production hardening and public release

Detailed phase state and acceptance gates are tracked in `docs/PHASES.md`.

## Documentation

Start with:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/scanner/CI.md`
4. `docs/scanner/LIMITATIONS.md`
5. `docs/scanner/PERFORMANCE.md`
6. `docs/security-packs/AUTHORING.md`
7. `docs/security-packs/REVIEWING.md`

Long-term product architecture is in `docs/superpowers/specs/2026-08-24-community-platform-design.md`.

Phase 7 Security Pack architecture and implementation steps are in the active Phase 7 spec/plan under `docs/superpowers/`.

## Community

ScopeForge is a community project. Contributions can include scanner rules, reviewed Security Packs, safe fixtures, parsers, vulnerability explanations, remediation recipes, preparedness guidance, security mappings, accessibility, UX, documentation, test infrastructure, and security architecture.

See `CONTRIBUTING.md` before opening a contribution.

## License

MIT. See `LICENSE`.

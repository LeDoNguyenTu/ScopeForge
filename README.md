# ScopeForge

**Open-source application security for finding problems, preserving evidence, and verifying fixes without turning the scanner itself into another source of risk.**

ScopeForge combines a deterministic local repository scanner with a hosted security control plane built around a practical loop:

**Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify**

The project is deliberately security-boundary-first: scanned repositories are hostile input, provider credentials stay out of workers and browsers, source acquisition is separated from scanner execution, and higher-risk runtime capabilities remain independently gated.

> Use ScopeForge only on systems and repositories you own or are explicitly authorized to assess.

## Current state

The released production baseline is the Phase 10C platform/admin build on `scopeforge.dev`. The local scanner and the broader hosted security platform are implemented across the repository, while the GitHub connected-project rollout is progressing through a deliberately stacked release sequence:

- **Phase 10A1 — Connected GitHub projects:** implemented and fully CI-validated. Production database migrations/ACL hardening are already verified, but release still requires a live GitHub App configuration and authenticated connection/import canary.
- **Phase 10A2 — Private GitHub repository acquisition:** implemented as a separate credential-isolated execution class and fully validated on the current Phase 10A1 stack. Its production schema/private-worker canary is intentionally blocked behind Phase 10A1 release.
- **Phase 10A3 — GitHub webhook reconciliation:** implemented on the stacked development branch with signed raw-body verification, replay protection, provider-authoritative lifecycle reconciliation, latest-head coalescing, immutable-snapshot completion tracking, and browser-safe automatic-scan status. Its migrations remain source-only and no production webhook/secret/runtime activation is implied by implementation or CI.

Exact release state, validation evidence, blockers, and sequencing are tracked in `docs/development/CURRENT_STATE.md`, `docs/development/NEXT_STEPS.md`, and the active phase working-state documents.

## What ScopeForge provides

### Local deterministic repository security

The local scanner is passive by default and does not require a ScopeForge account. Current capabilities include:

- bounded hostile-repository inventory with file-count, file-size, total-byte, ignore, and symlink boundaries
- safe no-follow content reads with file identity and size revalidation
- normalized findings, stable fingerprints, deterministic ordering, explicit scanner errors, and policy exit codes
- provider-aware secret detection with mandatory redaction and one-way fingerprints
- JavaScript/TypeScript syntax-aware structural SAST without target module execution
- bounded high-confidence Express request-input to Node `child_process.exec` / `execSync` command-injection analysis
- npm dependency inventory from supported lockfiles and manifest fallback
- optional OSV vulnerability enrichment, disabled by default
- CycloneDX 1.7 JSON SBOM generation independent of OSV availability
- Dockerfile, Kubernetes, selected Terraform AWS, GitHub Actions, `.npmrc`, and `vercel.json` checks
- explicitly selected local Security Packs using the closed `static_literal_v1` matcher
- versioned baselines with new/existing finding classification
- terminal, deterministic native JSON, and deterministic SARIF 2.1.0 output
- GitHub Code Scanning-compatible SARIF generation
- hostile-input integration coverage and deterministic CI performance benchmarks

Detailed limitations are documented in `docs/scanner/LIMITATIONS.md`.

### Hosted security control plane

The Next.js/Supabase control plane adds product workflows around deterministic evidence while preserving separate authority boundaries:

- authenticated workspaces and RLS-backed browser read models
- repository assets, verification, canonical security findings, evidence, and lifecycle history
- remediation/retest workflows and Security Story presentation
- isolated worker scheduling, leases, recovery, cancellation, and bounded execution classes
- immutable repository source snapshots backed by private artifact storage
- exact-snapshot hosted repository scanning with no implicit reacquisition
- platform administration and operational visibility
- strict nonce CSP and hardened browser security headers

Hosted runtime/network capabilities remain independently reviewed and default-off until their own production canaries pass.

## Connected GitHub project pipeline

ScopeForge’s connected-project architecture is designed to support the convenient workflow of selecting a repository while keeping provider credentials and hostile source code out of inappropriate trust zones.

```text
GitHub App installation
        |
        v
ScopeForge control plane
  +--> verify installation + repository identity
  +--> repository-scoped read-only provider token
  +--> choose public/private acquisition class
        |
        v
immutable source snapshot
        |
        v
zero-egress repository scanner
        |
        v
canonical findings + evidence
```

For automatic scanning, Phase 10A3 extends that path without trusting webhook payload metadata as repository truth:

```text
signed GitHub webhook
        |
        +--> exact raw-byte HMAC-SHA256 verification
        +--> delivery replay protection
        +--> authoritative installation/repository/default-head re-fetch
        +--> latest-default-head coalescing
        |
        v
existing immutable snapshot + zero-egress scan pipeline
```

Important boundaries:

- GitHub App private keys, OAuth tokens, App JWTs, and installation tokens remain in the trusted control plane.
- Public and private repository acquisition use distinct execution classes and capability gates.
- A private worker receives only an attempt-bound archive capability, never provider credentials.
- Repository scanners consume immutable published snapshots and do not receive GitHub/R2 acquisition authority.
- Webhook raw bodies, signatures, secrets, authorization headers, temporary archive URLs, and source bytes are not persisted as webhook reconciliation metadata.
- Browser code sees only reviewed public link/read-model state such as repository identity, access status, scan state, and the automatic-scan preference.
- Manual owner/admin scans remain independent from the automatic-scan preference.
- Rapid default-branch pushes coalesce to the newest authoritative head rather than creating an unbounded scan fan-out.

The full authority model is documented in `docs/ARCHITECTURE.md`.

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

ScopeForge is currently source-installed; the CLI is not yet published as a standalone npm package or reusable GitHub Action.

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

## Security Packs

Security Packs v1 are explicitly selected local, data-only rule bundles. They cannot be auto-activated by content inside the target repository and cannot execute arbitrary code.

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

See `docs/security-packs/AUTHORING.md` and `docs/security-packs/REVIEWING.md` for schema, limits, fixture contracts, versioning, and review requirements.

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

The provider-aware scanner includes GitHub, Stripe live, Slack, complete private-key block, and contextual high-entropy assignment rules.

Raw detected secret values are redacted before normalized findings are constructed. They must not appear in terminal, native JSON, SARIF, baselines, benchmark output, or hosted audit data.

Use `scopeforge:allow-secret` only for intentional fixture content on the same line or on an exact standalone immediately preceding comment. Prefer reviewed fingerprint allowlisting for durable exceptions.

## Dependency and infrastructure analysis

JavaScript dependency inventory supports:

- `npm-shrinkwrap.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `package.json` fallback

Resolved lockfile versions are preferred. OSV enrichment is disabled by default. When enabled, only normalized npm package identity and exact version are sent to ScopeForge's fixed OSV endpoint. Repository source, arbitrary target configuration, and detected secret values are not sent.

ScopeForge also performs conservative local checks for Dockerfiles, Kubernetes YAML, selected Terraform AWS resources/policies, GitHub Actions workflows, `.npmrc`, and `vercel.json`. It does not execute those definitions or invoke target package managers/cloud tooling while scanning.

## Architecture

```text
Repository / GitHub project
        |
        +-------------------- local ---------------------+
        |                                                |
        v                                                v
ScopeForge CLI                                Next.js / Vercel control plane
  +--> bounded inventory                       +--> Supabase Auth + PostgreSQL
  +--> safe no-follow reads                     +--> verified GitHub App integration
  +--> secrets / SAST / SCA / IaC              +--> immutable snapshot orchestration
  +--> local Security Packs                     +--> private worker/control boundaries
  +--> JSON / SARIF / SBOM                      +--> canonical findings + remediation
                                                    |
                                                    v
                                           isolated worker classes
                                             +--> public acquisition
                                             +--> private acquisition
                                             +--> zero-egress repo scan
```

The local scanner and hosted control plane are deliberately separated. Local rule selection does not grant hosted, browser, worker, provider, or network authority.

## Security boundary

Scanned repositories are hostile input.

ScopeForge local scanning:

- uses bounded inventory and safe no-follow content reads
- does not execute target repository code or lifecycle scripts
- does not install target dependencies
- does not execute target Docker, Terraform, Kubernetes, or workflow definitions
- does not send source code to OSV
- does not send detected secret values anywhere
- fails distinctly when requested analysis is incomplete

ScopeForge hosted scanning additionally separates provider authorization, source acquisition, immutable artifact publication, zero-egress scanner execution, runtime-network capabilities, and browser authority. Workers never receive Supabase `service_role`, and repository scanner workers do not inherit GitHub App credentials or general network access.

Report ScopeForge vulnerabilities privately as described in `SECURITY.md`.

## Environment and deployment

Environment requirements, server-only GitHub App settings, R2 configuration, runtime gates, and rollout rules are documented in `docs/ENVIRONMENT.md` and `.env.example`.

Production capability flags are intentionally default-off. A successful code review or CI run does **not** by itself authorize production worker activation, database migration, webhook registration, or provider-secret changes.

## Development validation

The CI release matrix covers the full repository rather than only the changed package:

```bash
npm audit --audit-level=info
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run benchmark:matrix
npm run build
```

CI also runs the strict-CSP browser smoke, production V5/Turnstile diagnostic, and visual acceptance artifact step.

Current validation evidence is tracked in `docs/development/TEST_STATUS.md` and the active phase release/working-state documents.

## Project direction

ScopeForge is designed around more than detection:

- **Security Story** separates observed evidence from inferred consequence and helps explain what can be affected.
- **Explain Mode** supports progressive disclosure from plain-language explanation to developer/security detail.
- **Prepare Mode** turns findings into practical remediation, telemetry, credential-rotation, and verification steps.
- **Community Security Packs** provide reviewed, versioned, machine-validated local detection knowledge without executable plugin authority.
- **Connected projects** aim to make repository security continuous while retaining immutable provenance and strict provider/worker isolation.

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
10. Connected repositories, platform operations, and continuous reconciliation

Detailed phase state and acceptance gates are tracked in `docs/PHASES.md`.

## Documentation

Start with:

1. `docs/development/CURRENT_STATE.md`
2. `docs/development/NEXT_STEPS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ENVIRONMENT.md`
5. `docs/scanner/CI.md`
6. `docs/scanner/LIMITATIONS.md`
7. `docs/scanner/PERFORMANCE.md`
8. `docs/security-packs/AUTHORING.md`
9. `docs/security-packs/REVIEWING.md`

Long-term and phase-specific designs/plans live under `docs/superpowers/`.

## Community

ScopeForge is a community project. Contributions can include scanner rules, reviewed Security Packs, safe fixtures, parsers, vulnerability explanations, remediation recipes, preparedness guidance, security mappings, accessibility, UX, documentation, test infrastructure, and security architecture.

See `CONTRIBUTING.md` before opening a contribution.

## License

MIT. See `LICENSE`.

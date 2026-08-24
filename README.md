# ScopeForge

**Open-source application security that helps you discover vulnerabilities, understand what they could lead to, and prepare before they become incidents.**

ScopeForge is built for developers first, while making security findings understandable to anyone responsible for an application. It combines practical security testing, evidence, risk context, remediation, retesting, and community-maintained security knowledge in one workflow.

> ScopeForge is for systems you own or are explicitly authorized to assess.

## Why ScopeForge

Most security tools stop at "we found a vulnerability." ScopeForge is designed around a longer loop:

**Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify**

The goal is not only to surface technical weaknesses, but also to help people understand what they could affect, what to prioritize, what to prepare for, how to fix them, and how to verify that the risk is actually gone.

## Current status

**Phase 3 - Code and supply-chain security is in development.**

Shipped foundation:

- Next.js control plane and Supabase authentication/workspaces
- workspace-scoped asset registration and proof-of-control verification
- Row Level Security and trusted server-side mutation boundaries
- bounded hostile-repository inventory
- normalized scanner findings and stable fingerprints
- deterministic native ScopeForge JSON
- bounded no-follow inventory-entry reads
- strict root-only `.scopeforge.json` configuration
- report-only default policy with explicit `--fail-on` severity enforcement
- distinct success, policy, usage/configuration, and scanner-error exit codes
- local CLI with terminal and JSON output
- built-in secret scanning
- syntax-aware JavaScript/TypeScript structural SAST and bounded command taint analysis
- bounded JavaScript dependency inventory with optional OSV vulnerability enrichment
- CycloneDX 1.7 JSON SBOM generation using the maintained CycloneDX JavaScript library

The secret scanner currently detects high-confidence GitHub tokens, Stripe live secret keys, Slack tokens, complete private-key blocks, and contextual high-entropy secret assignments. Raw detected values are redacted before findings reach terminal or JSON output. Safe-fixture annotations and stable fingerprint allowlisting are supported.

The JavaScript/TypeScript scanner parses JavaScript, TypeScript, JSX, TSX, MJS, CJS, MTS, and CTS as hostile data using the TypeScript parser without executing repository code or resolving imports. Structural rules detect direct `eval`/`new Function` use, explicit TLS certificate-verification disablement, and bounded Express request-input flows to `child_process.exec` and `execSync`. Framework-sensitive checks are only reported when the relevant bindings can be established statically. Malformed or over-budget files are surfaced as scanner errors while valid files continue to produce findings.

The SCA scanner inventories JavaScript dependencies from `npm-shrinkwrap.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, and `package.json` fallback. Resolved lockfile versions are preferred over manifest ranges. OSV enrichment is disabled by default and must be explicitly enabled. When enabled, ScopeForge sends only normalized npm package identity and exact version to the fixed OSV API. Repository source text, arbitrary files, and detected secrets are not sent to OSV. OSV lookup failures are returned as scanner errors and never represented as a clean vulnerability result.

CycloneDX SBOM generation is fully local and independent of OSV. `scopeforge scan . --sbom scopeforge.cdx.json` emits a CycloneDX 1.7 JSON artifact containing the root application, discovered npm dependencies, Package URLs, direct dependency relationships where the local dependency inventory can establish them, ScopeForge tool metadata, a timestamp, and a serial number. SBOM generation uses the same bounded dependency inventory as SCA and does not execute package scripts or require network access.

IaC rules, baselines, and SARIF are still Phase 3 work.

Remote DAST, API fuzzing, exploit validation, credential attacks, persistence, and destructive behavior remain outside Phase 3.

## Local scanner

```bash
npm install
npm run scopeforge -- version
npm run scopeforge -- rules list
npm run scopeforge -- scan .
npm run scopeforge -- scan . --format json
npm run scopeforge -- scan . --format json --output scopeforge-results.json
npm run scopeforge -- scan . --sbom scopeforge.cdx.json
npm run scopeforge -- scan . --format json --output scopeforge-results.json --sbom scopeforge.cdx.json
npm run scopeforge -- scan . --fail-on high
```

Repository configuration is read from the explicit scan root as `.scopeforge.json`. The current schema is version `1`. Repository configuration may tighten scan budgets but cannot raise ScopeForge's safe defaults.

The CLI is report-only unless `--fail-on` or valid root configuration enables a severity gate. Findings alone do not produce a non-zero exit code in report-only mode. Scanner execution, dependency parsing, or requested SBOM generation errors remain distinct from policy failures and do not masquerade as a clean result.

Example scanner configuration:

```json
{
  "version": 1,
  "scanners": ["secrets", "jsts", "sca"],
  "rules": {
    "exclude": ["secrets/high-entropy-assignment"]
  },
  "secrets": {
    "allowFingerprints": []
  },
  "sca": {
    "osv": {
      "enabled": false
    }
  }
}
```

Set `sca.osv.enabled` to `true` only when you want online vulnerability enrichment. The setting enables ScopeForge's fixed OSV integration only. Repository configuration cannot provide an alternate OSV endpoint, custom outbound URL, or request headers. SBOM generation does not depend on this setting and remains available offline.

SBOM output uses the same no-follow file-writing boundary as normal scan artifacts. Existing symlinks are refused, and the CLI will not allow `--sbom` and `--output` to point to the same destination.

Use `scopeforge:allow-secret` only for an intentional fixture on the same line or on a standalone immediately preceding comment line. Prefer fingerprint allowlisting for reviewed long-lived exceptions.

## What ScopeForge is becoming

### Security Story

Important findings should explain what was observed, how confident ScopeForge is, what assets or data may be affected, and what plausible consequence chain could follow. Observed evidence and inferred risk are kept distinct.

### Explain Mode

Security information should be progressively disclosed in plain language, developer detail, and security detail.

### Prepare Mode

Findings should lead to practical preparation: what to fix now, what related systems to review, what logs to inspect, whether credentials may need rotation, what controls to add, and how to verify remediation.

### Community Security Packs

ScopeForge is planned to support versioned, machine-validated community packs containing safe detection logic, mappings, explainers, remediation recipes, preparedness guidance, test fixtures, and false-positive notes.

## Community

ScopeForge is a community project. Useful contributions include scanner rules, fixtures, vulnerability explainers, remediation recipes, preparedness checklists, security mappings, documentation, accessibility, UX, security architecture, and testing.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a contribution.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Validation commands:

```bash
npm test
npm run typecheck
npm run build:cli
npm run build
```

## Architecture

ScopeForge separates the web control plane from local scanner execution. Phase 3 scanning is local and passive.

```text
Repository
  |
  v
ScopeForge CLI
  +--> bounded inventory
  +--> safe content-read boundary
  +--> secret scanner
  +--> JS/TS parser + structural SAST + bounded taint scanner
  +--> dependency inventory + optional fixed-endpoint OSV enrichment
  +--> local CycloneDX 1.7 SBOM generator
  +--> scanner coordinator
  +--> normalized findings + explicit scanner errors
  +--> terminal / JSON output + CycloneDX artifact

Browser
  |
  v
Next.js / Vercel control plane
  +--> Supabase Auth + PostgreSQL
  +--> future isolated scan queue
```

## Documentation and resuming development

Start with:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. the active plan under `docs/superpowers/plans/`

Long-term architecture is documented in `docs/superpowers/specs/2026-08-24-community-platform-design.md`. Phase 3 scanner architecture is documented in `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`.

## Security and safety

ScopeForge treats scanned repositories as hostile input. Local scanning does not execute repository code, lifecycle scripts, imported modules, Dockerfiles, Terraform, Kubernetes manifests, or workflows. JS/TS analysis builds syntax trees only, with bounded traversal and no target module resolution. Secret values must not be emitted in terminal or JSON findings, scanner reads remain behind bounded filesystem checks, optional OSV enrichment receives only normalized package identity and exact version, and CycloneDX SBOM generation remains local and network-independent.

Please report ScopeForge vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

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

See `docs/PHASES.md` and the approved design documents for details.

## License

MIT. See [LICENSE](LICENSE).

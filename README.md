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
- safe bounded inventory-entry reads for future detector engines
- strict root-only `.scopeforge.json` configuration
- report-only default policy with explicit `--fail-on` severity enforcement
- distinct success, policy, usage/configuration, and scanner-error exit codes
- local CLI shell with terminal and JSON output

The local CLI can currently inventory a repository and exercise the scanner contracts, but detector families are intentionally not registered yet. Secret scanning, JS/TS SAST, SCA/SBOM, and IaC rules are the next Phase 3 work.

Remote DAST, API fuzzing, exploit validation, credential attacks, persistence, and destructive behavior remain outside Phase 3.

## Local scanner foundation

```bash
npm install
npm run scopeforge -- version
npm run scopeforge -- rules list
npm run scopeforge -- scan .
npm run scopeforge -- scan . --format json
npm run scopeforge -- scan . --format json --output scopeforge-results.json
npm run scopeforge -- scan . --fail-on high
```

Repository configuration is read only from the explicit scan root as `.scopeforge.json`. The current schema is version `1`. Repository configuration may tighten scan budgets but cannot raise ScopeForge's safe defaults.

The CLI is report-only unless `--fail-on` or a valid root configuration enables a severity gate. Findings alone do not produce a non-zero exit code in report-only mode.

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

ScopeForge separates the web control plane from scanner execution. Phase 3 scanning is local and passive.

```text
Repository
  |
  v
ScopeForge CLI
  +--> bounded inventory
  +--> safe content-read boundary
  +--> scanner coordinator
  +--> normalized findings
  +--> terminal / JSON outputs

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

ScopeForge treats scanned repositories as hostile input. Local scanning does not execute repository code, lifecycle scripts, Dockerfiles, Terraform, Kubernetes manifests, or workflows. Scanner output and repository configuration are bounded by explicit filesystem safety checks.

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

# ScopeForge

**Open-source application security that helps you discover vulnerabilities, understand what they could lead to, and prepare before they become incidents.**

ScopeForge is built for developers first, while making security findings understandable to anyone responsible for an application. It combines practical security testing, evidence, risk context, remediation, retesting, and community-maintained security knowledge in one workflow.

> ScopeForge is for systems you own or are explicitly authorized to assess.

## Why ScopeForge

Most security tools stop at "we found a vulnerability." ScopeForge is designed around a longer loop:

**Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify**

The goal is not only to surface technical weaknesses, but also to help people understand what they could affect, what to prioritize, what to prepare for, how to fix them, and how to verify that the risk is actually gone.

ScopeForge takes inspiration from modern application-security platforms, practical open-source pentesting tools, and structured community security knowledge, but its core direction is its own: make security findings evidence-first, explainable, connected to realistic consequence paths, and useful to both technical and non-security users.

## Current status

**Phase 2 - Asset Control is in development.**

Shipped today:

- Next.js application shell and responsive design system
- Supabase authentication and server-side session handling
- Multi-tenant workspaces and roles
- Row Level Security for exposed workspace data
- Automatic profile and workspace onboarding
- Baseline response security headers
- Dedicated ScopeForge Supabase project in Singapore
- Architecture, security, delivery-plan, and session-handoff documentation

Phase 2 is adding:

- workspace-scoped asset registration
- proof-of-control verification
- audit events
- quota-aware public-trial foundations
- scan-job metadata without active scanning

Not enabled yet:

- repository scanning
- SAST, secrets, SCA, SBOM, or IaC analysis
- remote DAST or API fuzzing
- isolated scanner workers
- exploit validation

Those capabilities are intentionally introduced in later phases only after their safety boundaries are in place.

## What ScopeForge is becoming

The long-term platform is designed around several connected ideas:

### Security Story

Important findings should explain what was observed, how confident ScopeForge is, what assets or data may be affected, and what plausible consequence chain could follow. Observed evidence and inferred risk are kept distinct.

### Explain Mode

Security information should be progressively disclosed in three layers:

- plain language for anyone responsible for the application
- developer detail for remediation and regression testing
- security detail for evidence, mappings, confidence, validation, and retesting

### Prepare Mode

Findings should lead to practical preparation: what to fix now, what related systems to review, what logs to inspect, whether credentials may need rotation, what controls to add, and how to verify the remediation.

### Community Security Packs

ScopeForge is planned to support versioned, machine-validated community packs containing safe detection logic, mappings, explainers, remediation recipes, preparedness guidance, test fixtures, and false-positive notes.

## Community

ScopeForge is a community project. Useful contributions are not limited to application code. We welcome work on:

- static and infrastructure security rules
- test fixtures and benchmark cases
- vulnerability explainers
- remediation recipes
- preparedness checklists
- CWE, OWASP, MITRE, and defensive-framework mappings
- documentation
- accessibility and UX
- security architecture and testing

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a contribution.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

Validation commands:

```bash
npm test
npm run typecheck
npm run build
```

## Architecture

ScopeForge separates the public control plane from scanner execution so the hosted web application never needs to become an unrestricted scanning proxy.

```text
Browser
  |
  v
Next.js / Vercel control plane
  |
  +--> Supabase Auth + PostgreSQL
  +--> future scan queue
           |
           +--> isolated workers
           +--> private artifact storage
```

Large scanner artifacts are planned for Cloudflare R2 rather than PostgreSQL. Active scanning remains disabled until target verification, quotas, network restrictions, and worker isolation are implemented.

## Documentation and resuming development

The repository is designed so development can continue across sessions without rediscovering the whole codebase.

Start with:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. the active plan under `docs/superpowers/plans/`

Long-term architecture is documented in `docs/superpowers/specs/2026-08-24-community-platform-design.md`.

## Security and safety

ScopeForge is intended for owned systems, security labs, and explicitly authorized assessments. Hosted features must preserve authorization, rate limits, bounded execution, and network safety controls.

Please report ScopeForge vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Roadmap

The project is delivered in deliberate phases:

1. Foundation
2. Asset control and authorization
3. Code and supply-chain security
4. Verified runtime and API security
5. Findings, Security Stories, and remediation
6. Isolated workers and scanner scale
7. Community Security Packs
8. Validation, benchmarks, and public methodology
9. Production hardening and public release

See `docs/PHASES.md` and the approved community-platform design for details.

## License

MIT. See [LICENSE](LICENSE).

# ScopeForge

ScopeForge is a portfolio-grade application security platform inspired by modern code-to-runtime products such as Aikido. It combines an authorized web control plane, safe dynamic checks, API surface discovery, a transparent repository scanner, evidence-first triage and a roadmap toward a distributed scanning architecture.

## Why this exists

Commercial application security platforms are excellent references for how security teams unify SAST, SCA, secrets, IaC, DAST and vulnerability management. ScopeForge is an independent learning and engineering project that explores those ideas without copying proprietary code, branding, rules or implementation details.

The project is intentionally designed around two principles:

1. Security tooling should produce evidence and actionable remediation, not just alert volume.
2. Hosted active testing must be constrained so the platform cannot become an arbitrary scanning proxy.

## Current capabilities

- Responsive security dashboard and asset inventory
- HTTPS ownership verification using a well-known token
- SSRF-resistant target validation with DNS resolution checks
- Bounded redirects, timeouts and response-size limits
- Safe DAST checks for browser security headers, cookies and information exposure
- Discovery checks for selected sensitive public files and OpenAPI documents
- Benign input reflection detection without executing script payloads
- Transparent local repository scanner for secrets, injection sinks, unsafe TLS, weak crypto and IaC risks
- CWE, CVSS, severity, confidence, evidence and remediation fields
- Supabase schema with RLS for workspaces, assets, scans and findings
- GitHub Actions CI and self-scanning workflow
- Architecture, threat model, methodology and roadmap documentation

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The application works in demo mode without a database. To enable persistent workspace data, create a Supabase project, apply `supabase/migrations/001_initial.sql`, then configure the public URL and publishable key from `.env.example`.

## Run the repository scanner

```bash
npm run scanner -- scan .
```

The scanner exits non-zero when it identifies high or critical findings, which makes it suitable as a CI quality gate.

## Authorized scanning only

The hosted web scanner requires the target to serve a generated token at:

```text
https://target.example/.well-known/scopeforge-verification.txt
```

The server re-verifies that token before every scan. Private, loopback, link-local and cloud metadata destinations are blocked. The hosted profile intentionally excludes destructive payloads, brute force, exploit chaining and persistence.

## Documentation

- `docs/PRODUCT_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY_MODEL.md`
- `docs/METHODOLOGY.md`
- `docs/ROADMAP.md`
- `docs/DEPLOYMENT.md`

## Status

This is the first production-shaped MVP. The UI and core safety architecture are implemented. Deeper capabilities such as full SCA via OSV, Semgrep-compatible SAST, authenticated crawling, isolated scan workers, SBOM generation, container scanning, IaC policy packs and attack-path correlation are laid out in the roadmap.

## License

MIT. See `LICENSE`.

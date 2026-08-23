# Security Model

ScopeForge is intended for defensive testing of systems that the user owns or is explicitly authorized to assess.

## Control-plane guarantees

- A separate Supabase project isolates ScopeForge from unrelated applications.
- Public database tables use Row Level Security.
- Workspace membership is the authorization boundary.
- Browser code receives only a publishable Supabase key.
- Private credentials remain server-side and are never committed.
- Security-sensitive asset mutations use trusted server paths.
- Hosted proof-of-control validates bounded public HTTPS targets and does not claim ownership.
- Remote active scanning remains disabled.

## Phase 3 local scanner guarantees

Phase 3 code and supply-chain scanning is local and passive. Repository content is treated as hostile input.

- Scanner packages are independent from Next.js, Supabase, and Vercel.
- Repository inventory is bounded by file-count, per-file-size, and total-byte limits.
- Generated and vendor directories are excluded by default.
- Filesystem symlinks are not followed during inventory.
- Detector code must consume inventory entries through the shared safe read boundary, which revalidates containment, regular-file status, symlink state, and size before reading.
- Repository code and package lifecycle scripts are never executed as part of analysis.
- Project dependencies are not installed as part of analysis.
- Dockerfiles, Terraform configurations, Kubernetes manifests, GitHub Actions workflows, and configuration files are parsed as data and never executed.
- Root scanner configuration is strict and versioned. Nested repository configuration cannot silently alter scanner behavior.
- Repository configuration may tighten scan budgets but cannot raise safe defaults.
- Unknown configured scanner families fail closed rather than producing an apparently clean scan.
- Repository-configured output paths must remain inside the scan root and are written with no-follow protections where the platform supports them.
- Existing output symlinks are rejected.
- Scanner failures are represented explicitly and must not be reported as a clean scan.
- Finding fingerprints use structural identity and do not require raw secret values.
- Detected secret values must remain redacted in every future output and ingestion path.
- Phase 3 does not perform remote DAST, authenticated crawling, API fuzzing, credential attacks, exploit validation, persistence, or destructive actions.

## Planned hosted active-test guardrails

Remote active testing is outside Phase 3. Before it is introduced, the hosted execution plane must preserve explicit scope validation, isolated workers, bounded egress, execution budgets, cancellation, quotas, auditability, and separation from the web control plane.

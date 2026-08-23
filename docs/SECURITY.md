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
- Detector code consumes inventory entries through the shared safe read boundary.
- Safe reads revalidate containment, regular-file status, symlink state, inode/device identity, and size, and enforce the byte ceiling during the actual read.
- Repository code and package lifecycle scripts are never executed as part of analysis.
- Project dependencies are not installed as part of analysis.
- Dockerfiles, Terraform configurations, Kubernetes manifests, GitHub Actions workflows, and configuration files are parsed as data and never executed.
- Root scanner configuration is strict and versioned. Nested repository configuration cannot silently alter scanner behavior.
- Repository configuration may tighten scan budgets but cannot raise safe defaults.
- Unknown configured scanner families and unknown built-in rule IDs fail closed.
- Repository-configured output paths must remain inside the scan root and existing output symlinks are rejected.
- Scanner failures are represented explicitly and must not be reported as a clean scan.

## Secret scanner guarantees

The built-in `secrets` scanner is the first Phase 3 detector family.

- Provider patterns are deliberately small and high-confidence: GitHub tokens, Stripe live secret keys, Slack tokens, and recognized private-key headers.
- Contextual entropy detection is limited to security-relevant assignments, bounded value lengths, and a conservative entropy threshold.
- Obvious placeholders, test-mode Stripe keys, and low-diversity repeated fixtures are suppressed.
- `scopeforge:allow-secret` applies only to the same line or immediately preceding fixture comment.
- Stable secret fingerprints use one-way SHA-256 derivation and never contain the raw secret.
- Fingerprint allowlisting stores only `sfs1:<64 hex>` identifiers.
- Raw detected values are not stored in finding titles, descriptions, evidence, metadata, remediation text, or scanner errors.
- Terminal and native JSON regression tests assert detected credentials are not serialized.
- Private-key findings anchor location metadata to the public header span rather than the private key body.
- Secret scanning performs no network requests and no credential validation against providers.

## Planned hosted active-test guardrails

Remote active testing is outside Phase 3. Before it is introduced, the hosted execution plane must preserve explicit scope validation, isolated workers, bounded egress, execution budgets, cancellation, quotas, auditability, and separation from the web control plane.

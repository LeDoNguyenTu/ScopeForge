# Security Model

ScopeForge is intended for defensive testing of systems that the user owns or is explicitly authorized to assess.

## Control-plane guarantees

- A separate Supabase project isolates ScopeForge from unrelated applications.
- Public database tables use Row Level Security.
- Workspace membership is the authorization boundary.
- Browser code receives only a publishable Supabase key.
- Private credentials remain server-side and are never committed.
- Security-sensitive Phase 2 asset mutations use trusted server paths rather than direct authenticated table writes.
- Hosted proof-of-control validates public HTTPS targets with private/special-use address rejection, DNS validation, IP-pinned HTTPS requests, manual redirects, bounded response size, timeout controls, and quotas.
- Proof-of-control demonstrates control at verification time. It is not an ownership claim.
- Security headers are emitted by the application.
- Remote active scanning remains disabled.

## Phase 3 local scanner guarantees

Phase 3 code and supply-chain scanning is local and passive. Repository content is treated as hostile input.

- Scanner packages are independent from Next.js, Supabase, and Vercel.
- The repository inventory is bounded by file-count, per-file-size, and total-byte limits.
- Generated and vendor directories are excluded by default.
- Filesystem symlinks are not followed by the scanner inventory.
- Scanner modules consume the shared bounded inventory rather than performing unrestricted filesystem traversal.
- Repository code and package lifecycle scripts are never executed as part of analysis.
- Project dependencies are not installed as part of analysis.
- Dockerfiles, Terraform configurations, Kubernetes manifests, GitHub Actions workflows, and configuration files are parsed as data and are never executed.
- Scanner failures are represented explicitly and must not be reported as a clean scan.
- Finding fingerprints use structural identity and do not require raw secret values.
- Detected secret values must remain redacted in all future terminal, JSON, SARIF, log, audit, and hosted-ingestion paths.
- Future OSV enrichment may send only normalized package identifiers and versions. Source code and detected secret values must not be sent to OSV.
- Phase 3 does not perform remote DAST, authenticated crawling, API fuzzing, credential attacks, exploit validation, persistence, or destructive actions.

## Planned hosted active-test guardrails

Remote active testing is outside Phase 3. Before it is introduced, the hosted execution plane must preserve at least these controls:

- explicit target proof-of-control and scope validation
- DNS and IP validation that blocks private, loopback, link-local, metadata, and other prohibited destinations
- isolated workers with bounded egress
- bounded redirects, response sizes, concurrency, execution time, and cancellation
- non-destructive scan profiles by default
- per-user and per-workspace quotas
- audit events for scope changes and scan execution
- clear separation between the web control plane and scanner execution plane

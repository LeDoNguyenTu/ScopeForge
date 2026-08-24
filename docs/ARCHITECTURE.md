# ScopeForge Architecture

ScopeForge separates the web control plane from scanner execution so the public application does not become an unrestricted scanning proxy.

## Control plane

```text
Browser
  |
  v
Vercel / Next.js control plane
  |
  +--> Supabase Auth
  +--> Supabase PostgreSQL
  |
  +--> future scan queue
           |
           +--> isolated workers
           +--> private artifact storage
```

### Tenancy

Every authenticated user belongs to one or more workspaces through `workspace_members`. Exposed tables use Row Level Security and workspace membership helpers. The `private` schema contains security-definer helpers and is not intended to be exposed through PostgREST.

### Domain and edge

`scopeforge.dev` should use Cloudflare as authoritative DNS while the Vercel application records remain DNS-only. This avoids placing an unsupported reverse proxy in front of Vercel while retaining Cloudflare DNS, R2, and Turnstile. Vercel provisions application TLS after DNS verification.

### Abuse protection

Supabase Auth rate limits provide the authentication baseline. Before opening a public trial, high-value authentication and application endpoints require explicit abuse controls. Future scanner jobs also require per-user and per-workspace quotas independent of authentication rate limits.

## Phase 3 local scanner

The Phase 3 scanner is a separate local execution path. It does not require the web control plane or a ScopeForge account.

```text
Target repository
  |
  v
scanner-core
  +--> bounded inventory
  +--> safe no-follow reads
  +--> normalized finding model
  +--> coordinator
  +--> config and policy
  +--> baseline model
  |
  +--> scanner-secrets
  +--> scanner-jsts
  +--> scanner-sca
  +--> scanner-iac
  |
  v
scanner-output
  +--> native JSON
  +--> SARIF
  |
  v
cli composition root
  +--> terminal presentation
  +--> safe artifact writing
  +--> CycloneDX request orchestration
  +--> process exit semantics
```

### Module responsibilities

`packages/scanner-core` owns shared scanner contracts and safety primitives. Repository inventory, bounded file reads, findings, fingerprints, configuration, coordination, policy, and baselines live here because detector families need them without depending on a user interface.

`packages/scanner-secrets` owns secret-specific matching, redaction, suppression, and secret finding construction. Raw detected values must not cross its normalized finding boundary.

`packages/scanner-jsts` owns JavaScript and TypeScript parsing, structural rules, and bounded taint analysis. It parses syntax only and does not resolve or execute target modules.

`packages/scanner-sca` owns npm dependency inventory, optional OSV enrichment, vulnerability normalization, and CycloneDX generation. Network access is opt-in and isolated behind the OSV client.

`packages/scanner-iac` owns Docker, Kubernetes, Terraform, GitHub Actions, and recognized generic configuration analyzers. Each format keeps a parser/rule boundary instead of sharing broad text heuristics.

`packages/scanner-output` owns serialization adapters over normalized `ScanResult` data. Output modules must not rerun detectors or reach back into repository files.

`packages/cli` is the composition root and presentation layer. It selects built-ins, coordinates user options, writes artifacts safely, renders terminal output, and maps scan state to process exit codes. Detector packages must not depend on the CLI.

### Dependency direction

The maintainable dependency direction is intentionally one-way:

```text
scanner-core <- detector packages <- CLI composition
      ^
      |
scanner-output reads normalized core results
```

Rules for future work:

- detector packages may depend on `scanner-core`, not on `packages/cli`
- output adapters consume normalized findings/results and must not call scanners
- format-specific parsers stay inside their detector package
- shared safety behavior belongs in `scanner-core` only when at least two consumers genuinely need the same contract
- the CLI should orchestrate behavior rather than contain detector logic
- hosted workers should reuse scanner packages instead of copying CLI internals
- active runtime scanning belongs in a separate later execution boundary rather than being inserted into passive repository detector packages

This keeps modules independently testable, reduces circular dependencies, and allows later workers, APIs, or packaged distributions to reuse the scanner engines behind different front ends.

### Passive execution boundary

Phase 3 treats repository content as hostile data. The local scanner does not execute target repository code, lifecycle scripts, Dockerfiles, Terraform, Kubernetes manifests, GitHub Actions workflows, package managers, or cloud tooling.

OSV enrichment is the only Phase 3 scanner network path and is disabled by default. When explicitly enabled, it sends normalized npm package identity and exact version only.

Remote DAST and API testing are Phase 4 concerns and require a separate authorization, isolation, egress, quota, timeout, cancellation, and audit model.
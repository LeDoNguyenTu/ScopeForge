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

Remote DAST and API testing are later concerns and require a separate authorization, isolation, egress, quota, timeout, cancellation, and audit model.

## Phase 4A product security domain

Phase 4A adds a framework-independent product domain above individual scanner implementations. The purpose is to let repository scanners, passive runtime scanners, hosted application services, UI, and optional advisory systems share stable security concepts without coupling those concepts to one execution engine or infrastructure provider.

```text
scanner-core / detector packages
          |
          v
security-domain-adapters/phase3
          |
          v
     security-domain
          ^
          |
 application services
    ^      ^      ^
    |      |      |
  UI/API  workers  provider adapters
```

The dependency rule is one-way. `packages/security-domain` contains only pure product contracts and helpers. It must not import scanner packages, the CLI, Next.js, React, Supabase, worker code, database adapters, or model-provider SDKs. `tests/architecture/security-domain-dependencies.test.ts` makes this boundary executable in CI.

`packages/security-domain-adapters/phase3` is an edge adapter. It may consume Phase 3 scanner findings and map them into the product domain, but the product domain must never import that adapter or scanner types. The adapter maps only normalized, explicitly selected fields. Scanner `metadata`, baseline state, source snippets, and data-flow internals are not copied into the product finding contract by default.

### Product security concepts

The domain separates concepts that were previously scanner-specific:

- source identifies where a finding came from
- provenance distinguishes observed, scanner-derived, user-confirmed, and inferred information
- evidence has an explicit content classification
- validation state records what level of confirmation exists
- lifecycle tracks remediation and review independently from validation
- relationships model typed security connections between product entities
- remediation is structured data rather than an infrastructure-specific blob

This separation allows passive runtime/API scanners to produce the same product finding shape without pretending to be Phase 3 repository scanners.

### Advisory and future model boundary

Optional model assistance is downstream from normalized product data:

```text
normalized domain records
        |
        v
advisory context policy
        |
        v
provider-neutral AdvisoryService
        |
        v
future local or remote provider adapter
```

`AdvisoryService` accepts domain requests rather than provider prompts or SDK message types. Advisory results are typed as inferred provenance. Advisory authority cannot promote validation state. Secret-classified context is always removed, and sensitive context cannot reach a remote provider unless a future caller explicitly opts in through the context policy.

Future provider adapters may support hosted or local models without changing scanner packages or the security domain. Models do not receive direct scanner authority, direct network-scanning authority, or an implicit path to repository content. Core scanning, validation, lifecycle, and remediation workflows must remain usable when no model integration is configured.

## Phase 4B verified passive runtime observations

Phase 4B introduces a separate remote observation path without turning the web application into a general-purpose scanner. The approved design and implementation plan were merged through PR #24 before runtime behavior was added.

```text
verified web/API asset
        |
        v
application service
  +--> enqueue authorization snapshot
  +--> execution-time reauthorization
  +--> cancellation and audit
        |
        v
runtime-observer
  +--> target and redirect policy
  +--> explicit budgets
  +--> fresh DNS classification
  +--> DNS-pinned HTTPS transport
  +--> redacted HTTP/TLS observations
  +--> deterministic runtime rules
        |
        +--> network-safety
        |
        +--> security-domain mapping
        |
        v
trusted repository adapter
  +--> scan_jobs
  +--> runtime_observations
```

### Pure network-safety boundary

`packages/network-safety` owns reusable public-IP classification and resolution-result validation. It is deliberately pure: no DNS lookup, HTTP client, TLS socket, database call, framework dependency, or application behavior belongs there. Phase 2 verification and Phase 4B runtime execution can therefore share deny rules without sharing transport code.

### Runtime execution boundary

`packages/runtime-observer` owns the bounded network behavior. Its policy is intentionally narrow:

- verified `web_application` and `api` assets only
- HTTPS only on port 443
- GET requests only
- no request body
- fresh DNS resolution and public-IP classification for every outbound connection
- connection pinned to an IP that passed classification
- same-host redirects only, with the same validation repeated before the next connection
- explicit request-count, redirect-count, response-size, observation-size, request-timeout, and total-time budgets
- no crawling, generalized endpoint discovery, fuzzing, exploit payloads, authentication replay, credential attacks, persistence, or destructive actions

The runtime package may depend on `network-safety` and `security-domain`, but it must not depend on Next.js, React, Supabase, application/component code, or model-provider SDKs. `tests/architecture/runtime-observer-dependencies.test.ts` enforces this direction together with the purity boundary for `network-safety`.

### Observation and persistence boundary

Runtime collection stores normalized observations rather than raw responses. Response bodies are not persisted. Cookie values are not persisted. Only bounded selected header state, cookie security attributes, redirect/status information, and TLS metadata cross the observation boundary.

`lib/runtime-observations` is the trusted application layer. It owns workspace/role checks, proof-of-control continuity, immutable authorization snapshots, execution-time reauthorization immediately before networking, state transitions, cancellation semantics, stable failure codes, persistence ordering, and bounded audit events. Database writes use the trusted server client; browser-facing code does not write scan jobs or observations directly.

Authorization is checked twice by design. A job is authorized when enqueued and reauthorized against the current asset state immediately before network execution. A changed workspace, asset target, asset kind, verification state, or cancellation request blocks network behavior instead of trusting a stale queue decision.

### Product finding mapping

Passive observations are evaluated deterministically and mapped into the Phase 4A `security-domain`. Runtime evidence is typed as observed runtime evidence and uses stable deterministic identifiers. No model is needed to decide whether an observed security header or TLS property exists.

### Current orchestration and future isolation

The Phase 4B implementation exposes the bounded service through trusted Next.js server actions for the minimal asset workflow. This is not the long-term worker-scale topology. Queue-backed isolated workers, dedicated egress controls, concurrency/backpressure, private artifacts, and operational worker isolation remain later delivery work. Moving execution behind that worker boundary must reuse the same authorization, runtime-observer, budget, cancellation, audit, and persistence contracts rather than widening network policy.

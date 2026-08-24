# ScopeForge Architecture

ScopeForge separates control-plane authorization from scanner execution so the public application cannot become an unrestricted scanning proxy. Safety boundaries are expressed both in package dependency direction and in executable runtime policy.

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
  +--> trusted server actions
  |
  +--> future scan queue
           |
           +--> isolated workers
           +--> private artifact storage
           +--> dedicated egress controls
```

Every authenticated user belongs to one or more workspaces through `workspace_members`. Exposed tables use Row Level Security and workspace membership helpers. Security-sensitive runtime writes use trusted server adapters; browser roles receive read access only where required.

`scopeforge.dev` should use Cloudflare as authoritative DNS while Vercel application records remain DNS-only. Supabase Auth rate limits provide the authentication baseline, while public scanner workflows require separate product quotas and abuse controls.

## Phase 3 local scanner

The Phase 3 scanner is a separate local execution path and does not require the hosted control plane.

```text
Target repository
  |
  v
scanner-core
  +--> bounded inventory and safe reads
  +--> normalized findings
  +--> coordination, policy, baseline
  |
  +--> scanner-secrets
  +--> scanner-jsts
  +--> scanner-sca
  +--> scanner-iac
  |
  v
scanner-output -> JSON / SARIF
  |
  v
CLI composition root
```

Repository content is hostile data. Phase 3 does not execute target modules, lifecycle scripts, Dockerfiles, Terraform, Kubernetes, GitHub Actions, package managers, or cloud tooling. OSV enrichment is opt-in and sends only normalized npm package identity/version data.

Dependency direction remains one-way: detector packages may depend on `scanner-core`, output adapters consume normalized results, and the CLI orchestrates rather than owning detector logic.

## Product security domain

`packages/security-domain` is the framework-independent product domain for findings, evidence, provenance, validation, lifecycle, remediation, relationships, and provider-neutral advisory contracts.

```text
scanner packages -> security-domain-adapters/phase3 -> security-domain
                                                    ^
                                                    |
                                             runtime mappings
```

The domain must not import scanners, CLI, Next.js, React, Supabase, database adapters, workers, or model-provider SDKs. Advisory/model systems are downstream consumers of normalized domain records and cannot independently promote security validation state.

## Runtime security architecture

Phase 4 runtime work is intentionally split into four layers:

```text
trusted application services
        |
        +----------------------+----------------------+
        |                                             |
        v                                             v
runtime-observer                               runtime-validator
(passive authority)                           (bounded active authority)
        |                                             |
        +----------------------+----------------------+
                               |
                               v
                         runtime-network
                    DNS + HTTPS + pinning + deadlines
                               |
                               v
                         network-safety
                       pure IP/DNS policy
```

`packages/network-safety` is pure policy. It validates public IP addresses and complete DNS resolution sets, but performs no DNS lookup, HTTP/TLS I/O, database work, framework work, or application behavior.

`packages/runtime-network` is the shared low-level network implementation. It performs fresh DNS resolution, rejects unsafe or mixed resolution sets, pins HTTPS connections to a validated IP while retaining the authorized hostname for Host/SNI/certificate verification, destroys response bodies, and includes DNS plus HTTPS inside one absolute request deadline. It does not know about findings, UI, database state, passive redirects, or active validation profiles.

### Phase 4B passive runtime observer

`packages/runtime-observer` remains passive-only. It owns:

- verified web/API target and same-host redirect policy
- HTTPS port 443 and GET-only passive behavior
- request-count, redirect-count, observation-size, request-timeout, and total-time budgets
- same-host redirect decisions with fresh network validation on every connection
- bounded/redacted HTTP status, selected-header, cookie-attribute, redirect, and TLS observations
- deterministic passive runtime rules and security-domain mapping

It delegates DNS/TLS/IP-pinning/deadline mechanics to `runtime-network`. It does not expose arbitrary headers, methods, bodies, credentials, crawling, fuzzing, exploit payloads, or active-validation authority.

`lib/runtime-observations` owns trusted enqueue authorization, immutable target/verification snapshots, execution-time reauthorization, job transitions, database-backed asynchronous cancellation, persistence ordering, stable failure codes, and bounded audit events.

Phase 4B merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.

### Phase 4C-1 bounded active validator

The Phase 4C design merged through PR #26 as `3f0e46c61944976a4ddfd6ef039487498a19f839`. PR #27 implements only `cors-origin-policy@1`.

`packages/runtime-validator` owns the built-in active profile and deterministic CORS policy interpretation. It may depend on `runtime-network` and `security-domain`, but it must not depend on `runtime-observer`, Next.js, React, Supabase, application/component code, or model-provider SDKs.

The fixed Phase 4C-1 authority is:

- verified `web_application` or `api` asset only
- separate explicit owner/admin authorization; verification alone is insufficient
- immutable canonical target, asset kind, verification timestamp, profile/version, consent timestamp, and budget snapshot
- execution-time reauthorization before DNS/network
- exact verified HTTPS hostname on port 443
- exactly one unauthenticated GET
- fixed `Origin: https://scopeforge.invalid`
- fixed safe request headers only
- zero redirect following and zero retries
- zero request body
- zero cookies, Authorization, credential replay, or caller-provided headers
- DNS-inclusive 5-second request deadline and 10-second total bound
- no response-body capture or persistence
- one bounded normalized `cors-policy` observation
- deterministic `runtime_validated` security-domain findings

The validator is deliberately not a generic HTTP API. Callers cannot choose URL, path, method, Origin, headers, body, credentials, redirect policy, profile, or budget.

`lib/active-validation` owns the trusted application boundary: owner/admin authorization, immutable snapshot persistence, execution reauthorization, stable audit/failure semantics, DB-backed cancellation, and active-only repository mutations. Active observations reuse `scan_jobs` and `runtime_observations`; no parallel finding/job schema is introduced.

The database guards `cors-policy` observations so they can only be attached to a running, uncancelled `active_validation` job, while passive observation kinds remain limited to `passive_runtime` jobs. The final active success transition also requires the job to remain running and uncancelled atomically.

The asset UI keeps passive and active controls separate. The active panel shows the fixed request contract and requires an explicit consent checkbox before calling the dedicated server action. Browser input is limited to asset identity plus consent; cancellation is scoped to job identity.

### Evidence and secret boundary

Runtime persistence stores normalized observations, not raw responses. Response bodies and cookie values are never persisted. Persisted runtime URLs remove query strings, fragments, and credentials. Active CORS persistence keeps only URL, status, Access-Control-Allow-Origin, credential allowance, and Vary-on-Origin state. Raw Set-Cookie values, arbitrary response headers, exception text, and upstream bodies do not cross the persistence boundary.

## Executable dependency boundaries

CI guards the following directions:

- `security-domain` remains independent of scanner/infrastructure/provider layers
- `network-safety` remains pure and free of DNS/HTTP/TLS/database/framework dependencies
- `runtime-network` stays below observers/validators and outside application/domain layers
- `runtime-observer` stays independent of web/database/provider layers and imports no active validator authority
- `runtime-validator` stays independent of passive/web/database/provider layers and does not re-export shared generic transport authority

These tests are security controls, not style checks: they prevent later refactors from silently turning a narrow validator into a generic scanning proxy.

## Current orchestration and future isolation

Phase 4B and the initial Phase 4C-1 slice execute through trusted server-side control-plane services. This is deliberately bounded but is not the final worker-scale topology.

Phase 6 remains responsible for queue-backed isolated workers, dedicated egress infrastructure, concurrency/backpressure, private artifacts, operational scanner isolation, and abuse controls. Moving runtime execution behind that boundary must reuse the existing target, authorization, budget, cancellation, network, evidence, and audit contracts rather than widening them.

## Active-testing non-goals

The current architecture does not authorize broad crawling, generalized endpoint discovery, OPTIONS/preflight probing, user-supplied origins, SQL injection, XSS, SSRF payloads, file discovery, arbitrary methods/headers/bodies, authenticated testing, cookie replay, browser automation, JavaScript execution, fuzzing, credential attacks, exploit confirmation, denial-of-service behavior, persistence, cross-host redirects, generalized DAST, or automatic remediation.

# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

Primary design references:

- `docs/superpowers/specs/2026-08-24-community-platform-design.md`
- `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`
- `docs/superpowers/specs/2026-08-24-phase-4a-security-domain-contracts-design.md`

## Completed foundations

### Phase 1 - Foundation

- Next.js and React application shell
- Supabase authentication and workspace tenancy
- Row Level Security and server session handling
- security headers and CI baseline

### Phase 2 - Asset control and authorization

- workspace-scoped web, API, and public-GitHub assets
- canonical target normalization
- proof-of-control challenges
- public HTTPS verification with DNS, IP, and SSRF boundaries
- trusted server writes, roles, quotas, audit events, and asset UI

### Phase 3 - Code and supply-chain security

Phase 3 is complete and merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.

The local scanner remains a separate passive execution path and includes:

- bounded hostile-repository inventory and no-follow reads
- normalized findings, stable fingerprints, policy, baselines, and deterministic output
- redacted secret detection
- JavaScript/TypeScript structural SAST and bounded command taint analysis
- npm dependency inventory, optional OSV enrichment, and CycloneDX 1.7 SBOM
- Docker, Kubernetes, Terraform, GitHub Actions, `.npmrc`, and `vercel.json` analysis
- terminal, native JSON, and SARIF 2.1.0 output
- integration, hostile-input, golden-output, and 700-file benchmark coverage

Canonical scanner coverage and limits are documented in `docs/scanner/LIMITATIONS.md`, `docs/scanner/PERFORMANCE.md`, and `docs/scanner/RELEASE_READINESS.md`.

## Phase 4A - Security domain contracts

PR #23 implements the approved Phase 4A architecture. Its implementation is complete and is in the final documentation and exact-head merge gate.

### Framework-independent domain

`packages/security-domain` owns product-level contracts that do not depend on scanners, UI, database, workers, or provider SDKs:

- versioned contract and branded identifiers
- security severity and confidence vocabulary
- explicit finding source and provenance
- typed evidence with public/internal/sensitive/secret classification
- product finding, location, taxonomy, remediation, and lifecycle contracts
- validation states and authority-aware transitions
- typed risk relationships
- provider-neutral advisory requests/results/service contract
- deterministic advisory context privacy and size policy

The domain contains no network access, filesystem access, environment reads, process control, database calls, UI behavior, or model-provider code.

### One-way Phase 3 adapter

`packages/security-domain-adapters/phase3` translates normalized Phase 3 findings into the product domain without changing Phase 3 scanner behavior.

The adapter:

- derives stable product identity from the existing Phase 3 fingerprint
- maps severity and confidence explicitly
- maps static/dependency confirmation conservatively to product validation
- emits scanner-derived provenance
- maps repository location, taxonomy, and deterministic remediation
- creates a typed internal evidence record from the normalized evidence summary
- does not copy scanner `metadata`, baseline state, redacted snippets, or data-flow internals
- performs no filesystem, environment, process, or network work

### Maintainability boundary

`tests/architecture/security-domain-dependencies.test.ts` recursively enforces that `packages/security-domain` cannot import scanner packages, CLI code, Next.js, React, Supabase, application/component layers, or named model-provider SDKs.

The intended dependency direction is:

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

### Future AI integration boundary

Phase 4A deliberately makes future AI integration possible without making AI a core dependency.

Future model integrations must sit behind the provider-neutral `AdvisoryService` and the advisory context policy. Advisory results are typed as inferred provenance, advisory authority cannot promote validation state, secret-classified context is always removed, and remote sensitive context requires explicit opt-in. Local-model and hosted-provider adapters can therefore be added later without rewriting scanners or the product security domain.

No model runtime, SDK, provider call, prompt store, vector store, autonomous agent, or model-driven scanner authority exists in Phase 4A.

## Supporting Phase 4A verification

CI #375 passed on supporting implementation head `c0e93ac0408a01a8c2b1ec513e38286a7f102cef`:

- reproducible `npm ci --ignore-scripts --no-audit --no-fund`
- 93 test files and 350 tests
- strict TypeScript typecheck
- CLI build and compiled `ScopeForge 0.1.0` smoke
- 700-file benchmark with 0 findings and 0 errors
- benchmark observation: 919 ms wall, 860 ms scanner duration, 28,692,480 bytes RSS delta
- Next.js production build

This is supporting implementation evidence. Permanent state documentation changes the PR head after CI #375, so PR #23 still requires a fresh complete CI run on its exact final documentation head before merge.

## Database status

Phase 4A contains no Supabase migration, schema, RLS, RPC, storage, queue, worker, or hosted-ingestion change. Database advisor checks are therefore not a merge dependency for PR #23.

## Safety boundary and next phase

Phase 4A introduces contracts only. It adds no remote DAST, crawler, fuzzing, exploit validation, credential attack, persistence, destructive behavior, remote worker fleet, or active scanner execution.

After PR #23 passes its exact final gate and merges, Phase 4B is the next boundary: design and implement verified passive runtime/API observations while reusing `security-domain` and preserving Phase 2 authorization and network-safety controls. Bounded active validation remains Phase 4C.

# ScopeForge Implementation Log

This log records major delivery boundaries and merge evidence. Detailed implementation contracts live in the corresponding design, plan, architecture, scanner, and test documentation.

## 2026-08-24 - Community platform direction

- Approved the open-source application-security platform direction and `Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify` product loop.

## Phase 1 - Foundation

- Added the Next.js application foundation, Supabase authentication/workspaces, tenancy controls, Row Level Security, security headers, CI, and deployment baseline.

## Phase 2 - Asset control and authorization

- Added workspace-scoped assets, canonical target normalization, proof-of-control, SSRF-safe verification, roles, quotas, audit records, and asset UI.
- Merged through PR #4.

## Phase 3 - Code and supply-chain security

### Design and scanner foundation

- PR #5 defined the local/passive scanner architecture and trust boundary.
- PR #6 added normalized findings, stable fingerprints, bounded hostile-repository inventory, coordination, and deterministic JSON.
- PR #7 added identity-checked safe reads, strict root configuration, policy/exit semantics, safe output, and the compiled CLI.

### Detector families and supply chain

- PR #8 added redacted secret detection and one-way secret fingerprints.
- PR #9 added execution-free JavaScript/TypeScript structural SAST.
- PR #10 added bounded Express-to-child-process command taint analysis.
- PR #11 added npm dependency inventory and optional OSV enrichment.
- PR #12 added CycloneDX 1.7 SBOM output.
- PR #13 added Dockerfile analysis.
- PR #15 added Kubernetes analysis.
- PR #16 added Terraform analysis.
- PR #17 added GitHub Actions workflow analysis.
- PR #19 added `.npmrc` and `vercel.json` configuration security and merged as `474bd82a1cad014e796a7faf83369c09f0d3dfc5`.

### Output, baselines, and release hardening

- PR #14 reduced CI noise by skipping full validation while implementation PRs are draft.
- PR #18 added deterministic safe baselines and merged as `6b349b9a07a060d371f5ccf9fccb670e8ddbc1eb`.
- PR #20 added deterministic SARIF 2.1.0 and merged as `f2859f5028965276c9dc69ddf10398740a6f9ec7`.
- PR #21 completed Phase 3 release hardening with mixed-repository integration, hostile-input/no-execution/no-default-network coverage, byte-for-byte JSON/SARIF/terminal goldens, a deterministic 700-file benchmark, GitHub Code Scanning guidance, limitations/performance documentation, reproducible lockfile installs, current GitHub Actions, and whole-phase trust-boundary review.
- PR #21 exact final head `5d1fa820eda4bbc660f92950bbee6568e820f2a9` passed CI #353 with 86 test files / 331 tests, strict typecheck, CLI build/runtime, 700 clean benchmark files, and production build.
- Phase 3 merged as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.

Phase 3 remains local/passive. Repository content is treated as hostile data and is not executed by the scanner. OSV remains the only optional scanner network path and receives normalized npm identity/version only when explicitly enabled.

## Phase 4A - Security domain contracts

### Design

- PR #22 approved the framework-independent security-domain architecture and implementation plan.
- PR #22 exact design/plan head passed CI #358 and merged as `13fb2c3e914181d44f9e6957f9fe66eea2069eb4`.
- Phase 4 was split into 4A contracts, 4B verified passive runtime/API observations, and 4C bounded active validation so later active behavior cannot bypass authorization and network-safety design.

### Task 1 - Domain primitives

- Added `packages/security-domain` contract versioning, branded identifiers, severity/confidence, finding-source types, and provenance types.
- Intentional RED preserved all 331 existing tests; only the missing new domain module failed.
- CI #363 passed the complete GREEN gate.

### Task 2 - Findings, evidence, validation, lifecycle, remediation

- Added typed evidence with content classification, product finding contracts, structured remediation, validation states, authority-aware validation transitions, and explicit finding lifecycle transitions.
- Product evidence/findings intentionally have no arbitrary scanner metadata escape hatch.

### Task 3 - Relationships and future advisory boundary

- Added typed risk relationships.
- Added provider-neutral `AdvisoryRequest`, `AdvisoryResult`, and `AdvisoryService` contracts.
- Advisory results are type-level inferred provenance.
- Advisory authority cannot promote validation state.
- Added a pure advisory context policy that always removes secret-classified context, requires explicit opt-in for remote sensitive context, and applies deterministic size budgets.
- CI #367 passed the complete Tasks 2/3 GREEN gate.

### Task 4 - Phase 3 source adapter

- Added `packages/security-domain-adapters/phase3` as a one-way adapter from normalized Phase 3 findings into the product domain.
- Adapter identity derives from the existing Phase 3 fingerprint and maps severity, confidence, validation, source, location, taxonomy, remediation, and normalized evidence explicitly.
- Scanner `metadata`, baseline state, redacted snippets, and data-flow internals are not copied.
- The mapper performs no filesystem, environment, process, scanner-rerun, or network work.
- CI #370 established the intentional RED while 91 existing test files / 346 existing tests remained green.
- CI #373 passed the complete adapter GREEN gate.

### Task 5 - Executable architecture boundary

- Added `tests/architecture/security-domain-dependencies.test.ts` to block scanner, CLI, Next.js, React, Supabase, application/component, and named model-provider imports from `packages/security-domain`.
- Updated `docs/ARCHITECTURE.md` with the one-way source-adapter/domain/application dependency direction.
- Updated `docs/roadmap/FUTURE_AI_ASSISTANCE.md` so future local or hosted models integrate only behind the advisory context policy and provider-neutral service contract.
- No AI SDK, provider runtime, model call, database migration, worker, queue, or active remote scanner was added.
- CI #375 passed on supporting head `c0e93ac0408a01a8c2b1ec513e38286a7f102cef`:
  - 93 test files / 350 tests
  - strict TypeScript typecheck
  - CLI build and compiled `ScopeForge 0.1.0` smoke
  - benchmark: 700 files, 0 findings, 0 errors, 860 ms scan duration, 919 ms wall time, 28,692,480-byte RSS delta
  - Next.js production build

### Phase 4A final gate

PR #23 is the active implementation PR. The permanent project-state documentation changes the head after CI #375, so CI #375 is supporting evidence only.

Before Phase 4A is complete:

1. commit final state documentation
2. review the complete changed-file set and security boundary
3. confirm no unresolved blocking review thread
4. require complete CI on the exact final PR head
5. squash merge with expected-head protection
6. verify merged content and `main` CI when exposed by available tooling
7. clean merged historical branches that are no longer needed

## Current boundary

Phase 4A implementation is complete pending its final exact-head merge gate. Phase 4B is next and must reuse `security-domain` while designing verified passive runtime/API observations and authorization/network safety before Phase 4C introduces any bounded active validation.

# Phase 5C Hosted Phase 3 Finding Import Design

## Status

Approved for implementation on 2026-08-26.

## Goal

Bring existing ScopeForge Phase 3 local/CI code, dependency, secret, and IaC findings into the hosted canonical finding ledger without adding hosted repository execution, generic filesystem authority, package execution, or new runtime-network authority.

## Product boundary

Phase 5C is a trusted data-import boundary only.

- Local/CI ScopeForge continues to perform Phase 3 scanning.
- The hosted app accepts only a privacy-reduced, versioned ScopeForge envelope.
- `security_findings` remains the only canonical finding state.
- Repository assets use the existing `assets.kind = 'repository'` subject model.
- Runtime execution remains limited to web/API assets and the existing passive/active services.
- No repository clone, shell command, package manager invocation, filesystem traversal, arbitrary URL fetch, active validation, or model-provider authority is added.

## Chosen approach

Use a dedicated local `hosted-json` export plus a separate hosted import RPC.

Rejected alternatives:

1. Upload the existing generic JSON result. It includes the complete Phase 3 `Finding` shape and therefore exposes more scanner-private structure than the hosted ledger needs.
2. Clone and scan repositories in Vercel. That would widen execution and network authority before Phase 6 isolated workers.

## Local hosted-export contract

Introduce a versioned hosted envelope generated from Phase 3 results after privacy reduction.

The envelope contains only:

- schema version
- ScopeForge tool version
- canonical GitHub repository URL
- scan timestamp and duration
- scanner name/version list
- bounded inventory summary
- deterministic run reference
- bounded normalized findings
- bounded normalized evidence summaries

The hosted envelope MUST NOT contain:

- local absolute scan roots
- arbitrary scanner metadata
- raw or redacted source snippets
- taint/data-flow steps
- raw scanner diagnostics/messages
- secret values
- secret hashes or secret-adjacent metadata
- cookies, credentials, request headers, or runtime observations
- SBOM document bodies
- arbitrary artifact contents

### Secret-location privacy

Secret findings may retain repository-relative file path and line number. Exact start/end columns are omitted because the current scanner span can encode credential length.

## Repository binding

Every import targets one existing workspace asset with `kind = 'repository'`.

The envelope repository URL must canonicalize to the selected asset's `canonical_target`.

Repository verification status is not changed by import. HTTP proof-of-control is not reused because Phase 5C does not contact the repository from the hosted control plane.

## Job and run identity

Add `phase3_import` to `scan_job_kind` in its own enum migration.

Each accepted import creates or resolves one terminal `scan_jobs` row with:

- workspace ID
- repository asset ID
- job kind `phase3_import`
- status `succeeded`
- requester
- zero runtime request/redirect counts
- imported finding count

Add `security_phase3_import_runs` with immutable provenance:

- `id`
- workspace ID
- repository asset ID
- scan job ID
- requested-by user ID
- run reference
- hosted schema version
- ScopeForge version
- source repository URL snapshot
- scan started-at / duration
- scanner versions
- files analyzed
- scanner error count
- finding count
- created-at

Browser roles receive RLS-protected SELECT only. Mutations are service-role-only.

## Stable identity

The existing Phase 3 fingerprint alone is not sufficient as a hosted identity because it does not include rule version and can appear in more than one repository asset.

Hosted finding ID is derived from a canonical hash of:

- repository asset identity
- Phase 3 fingerprint
- scanner/source ID
- rule ID
- rule/source version

Hosted evidence ID is derived from:

- hosted finding identity
- evidence kind
- content classification
- normalized evidence summary

This guarantees:

- no cross-repository collisions
- scanner/rule version upgrades do not conflict with immutable source version
- immutable evidence rows can coexist when safe summaries change

## Trusted source registry

Hosted import accepts only ScopeForge built-in Phase 3 scanners/rules known by the current application build.

Caller-supplied `source_kind`, source ID, provenance, validation state, or evidence kind is not trusted directly. The server maps imported scanner/rule descriptors through a closed registry and rejects unknown scanner/rule/version combinations.

Allowed hosted source properties:

- source kind: `deterministic-passive-scanner`
- provenance: `scanner-derived`
- validation: `static_confirmed` or `unvalidated`
- evidence kind: `static-analysis` or `dependency`
- classification: `internal`
- artifact reference: null

## Import transaction

Add a separate service-role-only `persist_phase3_import_result` RPC. Do not weaken or reuse runtime-only ingestion RPCs.

The transaction must:

1. lock and validate workspace, actor membership, repository asset, canonical repository target, import job and run identity
2. enforce JSON array/object types and hard row/field bounds
3. reject unknown source/rule/version combinations
4. reject malformed or absolute/traversing paths
5. validate evidence references
6. insert immutable evidence or verify exact identity/content on conflict
7. insert new canonical findings or verify immutable identity fields on conflict
8. append one occurrence per finding/import job idempotently
9. append created/reobserved/reopened events using existing lifecycle semantics
10. update mutable finding presentation fields only for a fresh occurrence
11. mark import job/run successful atomically

## Lifecycle semantics

Fresh imported deterministic findings use existing recurrence semantics:

- new finding -> `open`
- existing open/acknowledged/in-progress -> retain state and append recurrence
- `resolved` -> `in_progress`
- `retest_pending` -> `in_progress`
- `verified_fixed` -> `open`
- `accepted_risk` -> retain
- `false_positive` -> retain

Absence from a later Phase 3 scan does NOT verify a fix in Phase 5C v1. Scanner completeness, configuration changes, skipped files, and partial scans make absence insufficient evidence.

## Idempotency

The hosted envelope contains a deterministic `runRef` derived from the canonical privacy-reduced payload.

- Same workspace + repository asset + runRef + same payload -> return existing import result without duplicate occurrence/history.
- Same identity reused with different canonical payload -> reject with an import identity conflict.

## Limits

Initial hard limits:

- maximum request body: 3.5 MB
- maximum imported findings: 500
- maximum evidence rows: 500
- maximum scanner descriptors: 32
- maximum evidence summary: 4096 chars
- maximum finding title: 240 chars
- maximum description: 8192 chars
- taxonomy and remediation remain within existing database size checks
- import history reads are bounded

Oversized imports fail explicitly and are never truncated.

## Hosted API and UX

Add an authenticated repository-asset import route/action that:

- derives user/workspace from server auth
- accepts selected repository asset ID plus one `application/json` file
- enforces request size before parsing
- parses and validates the hosted envelope
- delegates all mutation to the trusted admin client / database RPC
- never accepts arbitrary URL, command, request headers/body, scan budget, filesystem path, or desired lifecycle state

Repository asset detail gets a Phase 3 import panel with:

- CLI command example
- privacy disclosure
- file upload
- latest import status/history
- finding count
- link into canonical findings

Global finding reads remain the canonical presentation surface.

## Threat model and invariants

The implementation MUST test and enforce:

- cross-workspace import rejection
- repository asset kind enforcement
- repository URL/asset mismatch rejection
- path traversal and absolute-path rejection
- secret-value and secret-length leakage prevention
- unknown scanner/rule/version rejection
- forged source/provenance/validation/evidence kind cannot widen authority
- duplicate run retry is idempotent
- conflicting run reuse is rejected
- cross-repository fingerprint collision is impossible
- rule-version identity drift is safe
- immutable evidence conflict is rejected
- browser writes remain impossible
- service-role RPCs use `SECURITY DEFINER` with `search_path = ''` and are revoked from public/anon/authenticated
- Phase 5C modules cannot import runtime-network or repository-execution authority

## Non-goals

Not part of Phase 5C:

- hosted Git clone or repository checkout
- GitHub App repository authorization
- private repository acquisition
- package installation/execution
- arbitrary command execution
- remote active testing
- generalized DAST
- worker queues/leases/fleet orchestration
- auto-resolving missing static findings
- storing raw source, snippets, secret values, or full SBOMs
- model-based severity/lifecycle mutation

Those remain separate future architecture boundaries, principally Phase 6 for isolated execution.

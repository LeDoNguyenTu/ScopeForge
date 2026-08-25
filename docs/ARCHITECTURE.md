# ScopeForge Architecture

ScopeForge separates control-plane authorization from scanner/runtime execution so the public application cannot become an unrestricted scanning proxy. Safety boundaries are expressed in package dependency direction, database authority, target policy, privacy contracts, and executable regression tests.

## Control plane

```text
Browser
  |
  v
Vercel / Next.js control plane
  |
  +--> Supabase Auth
  +--> authenticated SELECTs protected by RLS
  +--> narrow trusted server actions / API routes
  |      |
  |      +--> service-role finding/workflow/import RPCs
  |
  +--> future scan queue
           |
           +--> isolated workers
           +--> private artifacts
           +--> dedicated egress controls
```

Authenticated users belong to workspaces through `workspace_members`. Exposed hosted security tables are member-readable through RLS. Browser roles do not receive INSERT, UPDATE, DELETE, or direct mutation-RPC authority for the canonical security ledger, remediation/retest workflow, or Phase 5C import provenance.

## Phase 3 local scanner

The Phase 3 scanner is a separate local execution path. Repository content is hostile data. Phase 3 performs bounded inventory and safe reads and does not execute target modules, package lifecycle scripts, Dockerfiles, Terraform, Kubernetes, GitHub Actions, package managers, or cloud tooling.

Detector packages flow into normalized scanner results and CLI outputs. Phase 5C adds a dedicated privacy-reduced output:

```text
local/CI repository
      |
      v
bounded Phase 3 scanner
      |
      v
hosted-json privacy reducer
      |
      v
versioned normalized envelope
```

The hosted control plane still does not clone, fetch, checkout, build, install, or execute repository content. Hosted execution remains a future Phase 6 worker boundary.

## Product security domain

`packages/security-domain` is the framework-independent domain for findings, evidence, provenance, validation, lifecycle, remediation, relationships, and provider-neutral advisory contracts.

```text
scanner packages -> security-domain-adapters/phase3 -> security-domain
                                                    ^
                                                    |
                                             runtime mappings
```

The domain does not import Next.js, React, Supabase, database adapters, workers, scanners, CLI composition, or model-provider SDKs. Advisory/model output is downstream and cannot independently promote validation or lifecycle state.

## Runtime security architecture

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

`packages/network-safety` is pure policy with no DNS, HTTP/TLS, database, framework, or application I/O.

`packages/runtime-network` owns fresh DNS resolution, complete public-address-set validation, deterministic socket pinning, Host/SNI/certificate preservation, body destruction, and DNS-inclusive request deadlines. It does not own findings, UI, database state, passive redirect policy, or active profiles.

`packages/runtime-observer` remains passive-only. It owns verified web/API target policy, same-host redirect decisions, bounded/redacted status/header/cookie-attribute/TLS observations, passive budgets, and deterministic `runtime_observed` findings.

`packages/runtime-validator` contains only the approved `cors-origin-policy@1` active profile: verified web/API targets, separate owner/admin consent, exact verified HTTPS/443 target, exactly one unauthenticated GET, fixed `Origin: https://scopeforge.invalid`, zero redirect following/retries/request body/credentials/caller headers, bounded time/observation budgets, no response-body capture, and deterministic `runtime_validated` findings.

Repository assets are not valid targets for either runtime authority.

## Canonical hosted finding ledger

Phase 5A established one hosted persistence model shared by trusted deterministic sources.

```text
passive runtime result ----+
                           |
active validation result --+--> dedicated trusted atomic RPCs
                           |      |
hosted Phase 3 import -----+      +--> security_evidence
                                  +--> security_findings
                                  +--> security_finding_evidence
                                  +--> security_finding_occurrences
                                  +--> security_finding_events
```

- `security_findings` stores current canonical state keyed by `(workspace_id, finding_id)`.
- `security_evidence` stores immutable normalized evidence keyed by `(workspace_id, evidence_id)`.
- `security_finding_evidence` links canonical findings to evidence and is append-only.
- `security_finding_occurrences` records trusted reobservation per scan job and is append-only.
- `security_finding_events` records creation, recurrence, reopening, operator lifecycle changes, remediation workflow, and retest events and is append-only.

Finding identity is semantic and stable across recurrence. Evidence identity additionally fingerprints bounded normalized evidence content so changed evidence creates a new immutable record instead of overwriting an older fact.

Runtime persistence remains on its separate passive/active RPCs. Phase 5C does not widen or reuse those runtime-only contracts.

## Phase 5B remediation and deterministic retest

`security_finding_work` stores assignment and bounded remediation notes beside the canonical finding. `security_finding_retests` stores immutable retest execution/source/profile snapshots.

Retest sources remain closed to the existing passive runtime observer and `cors-origin-policy@1` active validator. Active retests require owner/admin plus explicit consent. Callers cannot choose target URLs, methods, headers, bodies, budgets, source/profile snapshots, scan jobs, or desired terminal results.

`verified_fixed` requires fresh authoritative retest evidence. Failed, blocked, cancelled, stale, mismatched, or still-present results cannot verify a fix.

Security Story v1 is a pure bounded projection over canonical finding/evidence/history, remediation work, and retest state. It has no model-provider, network, or mutation authority.

## Phase 5C hosted Phase 3 import

Phase 5C is a normalized-data ingestion boundary, not hosted scanner execution.

```text
local/CI ScopeForge scanner
        |
        v
hosted-json privacy reducer
        |
        v
POST /api/phase3-import?assetId=<repository-asset>
        |
        +--> authenticated server context
        +--> 3.5 MB streaming cap
        +--> strict envelope validation
        +--> closed scanner/rule/version registry
        +--> exact repository binding
        |
        v
trusted Phase 3 import service
        |
        +--> server-derived finding/evidence identities
        +--> deterministic-passive-scanner provenance
        +--> static-analysis/dependency evidence only
        |
        v
service-role-only persist_phase3_import_result
        |
        +--> terminal phase3_import scan job
        +--> immutable security_phase3_import_runs
        +--> canonical finding ledger
```

### Hosted export privacy contract

The export intentionally omits:

- local absolute root
- arbitrary scanner metadata
- source code
- snippets, including redacted snippets
- data-flow traces
- raw scanner diagnostics/errors
- credentials
- raw secrets
- full SBOM bodies/artifacts

Secret findings receive stronger handling:

- exact columns are removed to avoid leaking secret length
- local secret `sfs1` fingerprints are not uploaded because their local identity contains secret-derived hash material
- a hosted-safe `sfs1` is derived only from reviewed rule ID/version, repository-relative path, and line
- secret evidence summaries are regenerated as reviewed rule metadata rather than copied from scanner output

The hosted file therefore contains no raw secret and no direct secret-derived digest.

### Validation and request authority

`lib/phase3-import/validation.ts` accepts exact versioned JSON shapes only. It canonicalizes repository/path/text/count fields, verifies a closed scanner/rule/version registry, sorts safe collections/findings, reconstructs the canonical payload, and recomputes runRef before acceptance.

The route accepts only `assetId` as request-side authority. Actor/workspace/role come from authenticated server context. The body must be `application/json` and is bounded to 3.5 MB both by declared length and while streaming.

The route cannot accept lifecycle, source kind, arbitrary repository URL to fetch, request method/headers/body, runtime target, scan budget, shell command, checkout options, package-manager configuration, or model-provider input.

### Persistence authority

`security_phase3_import_runs` records immutable safe scan provenance. Authenticated workspace members receive SELECT only through RLS.

`persist_phase3_import_result`:

- is `SECURITY DEFINER`
- pins `search_path = ''`
- is executable only by `service_role`
- independently re-checks actor membership and owner/admin/member role
- locks and validates the exact repository asset/workspace binding
- permits only the closed Phase 3 scanner descriptors
- permits only deterministic passive scanner provenance
- permits only `static-analysis` or `dependency` evidence classified `internal` with no artifact reference
- caps findings and evidence at 500 each
- serializes retry identity with an advisory transaction lock
- returns an existing run only for an exact idempotent replay
- rejects conflicting run/finding/evidence identity reuse
- appends canonical occurrences/events
- reopens recurrence according to existing lifecycle policy
- never treats absence in a later static scan as a verified fix

The `phase3_import` scan-job constraint requires a terminal succeeded repository snapshot with zero runtime requests/redirects, empty runtime budget, no verification/active profile authority, and no runtime cancellation state.

### Import read model

Repository asset detail shows a bounded 20-run import history. Canonical finding lists use 100-row pagination with one-row lookahead and stable `last_seen_at DESC, finding_id ASC` ordering.

Three covering indexes support the Phase 5C foreign keys in addition to the history indexes.

## Lifecycle authority

Human workflow remains intentionally narrow. Browser-exposed lifecycle actions are limited to the existing approved transitions.

Trusted deterministic recurrence can reopen canonical state according to domain policy: resolved/retest-pending return to in-progress and verified-fixed returns to open. Accepted-risk and false-positive remain unchanged by automated recurrence.

Phase 5C does not infer `verified_fixed` from a finding being absent in a later local scan.

## Evidence and secret boundary

Runtime persistence stores normalized observations rather than raw responses. Response bodies and cookie values are never persisted. Runtime URLs remove query strings, fragments, and credentials.

Phase 5C stores only privacy-reduced local/CI facts. No arbitrary source fragments or full local artifacts cross the hosted boundary. Evidence is immutable and provenance-attributed.

## Executable dependency boundaries

Repository regression guards enforce these directions:

- `security-domain` remains framework/infrastructure/provider independent.
- `network-safety` remains pure and I/O-free.
- `runtime-network` remains below observer/validator/application/domain layers.
- application/component code cannot import generic runtime-network authority.
- passive and active runtime packages remain separated.
- hosted finding/remediation code cannot acquire generic scanner or network execution authority.
- Phase 5C trusted import modules cannot import runtime packages or scanner filesystem/inventory/coordinator execution.
- Phase 5C import modules cannot acquire Node child-process, filesystem, socket/network, HTTP/TLS, VM, or worker-thread authority.
- Phase 5C import modules cannot directly fetch repositories, clone/checkout code, run package-manager installation, or import model-provider/advisory-inference authority.
- the browser uploader is same-origin and pinned to the Phase 3 import endpoint.
- hosted workflow/import mutation RPCs remain service-role-only while browser roles stay SELECT-only.

These are security controls, not formatting rules.

## Future isolation and non-goals

Phase 6 is responsible for queue-backed isolated workers, leases, dedicated egress, concurrency/backpressure, CPU/memory/time budgets, cancellation, private artifacts, fleet isolation, observability, and abuse controls.

Moving repository scanning or runtime execution to workers must not widen the target, authorization, request, evidence, lifecycle, or privacy contracts established in Phases 2-5.

The current architecture does not authorize generalized crawling, endpoint discovery, user-supplied origins, arbitrary methods/headers/bodies, authenticated testing, credential/cookie replay, browser automation, exploit probes, fuzzing, credential attacks, denial-of-service behavior, generalized DAST, or automatic remediation.
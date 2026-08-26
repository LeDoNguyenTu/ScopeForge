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
  |      +--> service-role worker broker RPCs
  |
  +--> private worker queue / broker
           |
           +--> provider-neutral supervisor
                    |
                    +--> zero-egress executor
```

Authenticated users belong to workspaces through `workspace_members`. Exposed hosted security tables are member-readable through RLS. Browser roles do not receive INSERT, UPDATE, DELETE, or direct mutation-RPC authority for the canonical security ledger, remediation/retest workflow, Phase 5C import provenance, or Phase 6A worker state.

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

The hosted control plane still does not clone, fetch, checkout, build, install, or execute repository content. Phase 6A establishes only the worker execution foundation; repository acquisition remains a later Phase 6B boundary.

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

The export intentionally omits local absolute roots, arbitrary scanner metadata, source code, snippets, data-flow traces, raw scanner diagnostics/errors, credentials, raw secrets, and full SBOM bodies/artifacts.

Secret findings remove exact columns, do not upload local secret-derived `sfs1` fingerprints, derive hosted-safe identity from reviewed rule/version plus repository-relative location, and regenerate secret evidence summaries from reviewed rule metadata.

### Validation, request, and persistence authority

`lib/phase3-import/validation.ts` accepts exact versioned JSON shapes only. The route accepts only `assetId` as request-side authority, derives actor/workspace/role from authenticated server context, requires `application/json`, and enforces a 3.5 MB streamed cap.

`persist_phase3_import_result` is `SECURITY DEFINER`, pins `search_path = ''`, is executable only by `service_role`, independently re-checks actor membership and repository binding, admits only closed deterministic passive scanner provenance, makes exact retries idempotent, rejects conflicting identity reuse, and never treats absence from a later static scan as a verified fix.

## Phase 6A zero-egress worker foundation

Phase 6A creates an execution-plane foundation without moving any product scanner/runtime job onto it.

```text
trusted server composition
        |
        v
service-role worker RPC surface
        |
        v
private.worker_tasks / private.worker_attempts
        |
        v
worker-authenticated broker routes
        |
        v
provider-neutral supervisor
        |
        +--> keeps worker secret + lease token
        |
        v
zero-egress executor contract
        |
        v
foundation_probe only
```

### Queue and lease authority

PostgreSQL is authoritative for worker scheduling. `scan_jobs` remains the canonical product lifecycle while private worker tables store scheduling detail.

- `private.worker_nodes` stores only a SHA-256 credential digest, fixed execution class, software version, and health timestamps.
- `private.worker_tasks` binds exactly one task to `(scan_job_id, workspace_id, asset_id)` and a closed execution class.
- `private.worker_attempts` binds task, attempt number, worker, and lease-token digest.
- `private.worker_events` contains bounded operational metadata only.
- browser roles cannot read private worker tables.

`claim_worker_task` serializes global capacity, uses deterministic ordering with `FOR UPDATE SKIP LOCKED`, permits at most one leased task per workspace and four globally, generates a 32-byte lease token, stores only its SHA-256 digest, and issues a lease bounded to 90 seconds and the absolute task deadline.

Retries are bounded to 15 seconds then 60 seconds with at most three attempts. Recovery owns lease-expiry provenance. Cancellation is evaluated before deadline dead-lettering and wins finalization/recovery races.

### Broker and credential boundary

Worker credentials are generated server-side, returned once, and persisted only as SHA-256 digests. Worker routes use `Authorization: Bearer <64-hex-secret>` plus a canonical worker UUID. Browser user sessions do not satisfy worker authentication.

Claim accepts no body. Heartbeat and finalize accept strict JSON only and enforce a 64 KiB body cap both by declared size and streaming byte count. Caller-supplied commands, images, environment variables, URLs, headers/body, package-manager options, network policy, lifecycle state, validation state, and execution budgets are not part of the route contract.

### Executor isolation

The supervisor retains the lease token and never puts it into the executor contract. The executor receives only task/attempt IDs, the closed execution class, absolute deadline, fixed budget, and `foundation_probe` input.

The sole Phase 6A profile is `foundation_no_egress_v1` with `networkPolicy: "none"`. Dependency guards forbid the supervisor from importing runtime-network, runtime observer/validator, generic HTTP/socket/DNS/TLS, child-process/worker-thread, Supabase/admin, or global fetch authority.

The supervisor validates terminal IDs, execution class, closed failure codes, bounded metrics, exact output shape, and the expected SHA-256 probe digest. Its outer wall-time boundary stops awaiting an executor even if the executor ignores `AbortSignal`; later concrete sandbox adapters must additionally kill underlying resources.

### Database authority and fleet view

Intended public worker RPCs are `SECURITY DEFINER`, use an empty `search_path`, deny `anon`/`authenticated`, and grant execute only to `service_role`. Internal recovery helpers and private trigger/event helpers have direct execute revoked even from `service_role` and are reachable only from their reviewed parent functions/triggers.

`get_worker_fleet_snapshot` is bounded to 100 nodes and exposes only worker ID, execution class, software version, health timestamps, task-state counts, and active lease count. It never returns credential/lease hashes, tokens, terminal payloads, repository/source content, or environment data.

The internal `worker_foundation_probe` job constraint fixes the zero-egress budget, requires all runtime authorization/profile fields to remain null, fixes request/redirect/finding counts at zero, and permits only the reviewed lifecycle. Existing passive runtime, active validation, and Phase 3 import code cannot import the worker path.

## Lifecycle authority

Human workflow remains intentionally narrow. Browser-exposed lifecycle actions are limited to the existing approved transitions.

Trusted deterministic recurrence can reopen canonical state according to domain policy: resolved/retest-pending return to in-progress and verified-fixed returns to open. Accepted-risk and false-positive remain unchanged by automated recurrence.

Phase 5C does not infer `verified_fixed` from a finding being absent in a later local scan.

## Evidence and secret boundary

Runtime persistence stores normalized observations rather than raw responses. Response bodies and cookie values are never persisted. Runtime URLs remove query strings, fragments, and credentials.

Phase 5C stores only privacy-reduced local/CI facts. No arbitrary source fragments or full local artifacts cross the hosted boundary. Evidence is immutable and provenance-attributed.

Phase 6A stores no repository artifact or scanner output at all; its only executable result is a deterministic probe digest.

## Executable dependency boundaries

Repository regression guards enforce these directions:

- `security-domain` remains framework/infrastructure/provider independent.
- `network-safety` remains pure and I/O-free.
- `runtime-network` remains below observer/validator/application/domain layers.
- application/component code cannot import generic runtime-network authority.
- passive and active runtime packages remain separated.
- hosted finding/remediation code cannot acquire generic scanner or network execution authority.
- Phase 5C trusted import modules cannot import worker-control/supervisor, runtime packages, or scanner execution authority.
- Phase 5C import modules cannot acquire Node process/filesystem/socket/HTTP/TLS/VM/worker authority, repository checkout/package execution, or model-provider authority.
- `worker-contracts` remains a pure closed contract layer.
- `worker-supervisor` has no target-network, application service-role, database, or generic process authority.
- browser/components cannot import the worker supervisor.
- existing passive runtime, active validation, and Phase 3 import paths do not route through Phase 6A workers.
- service-role composition remains server-only.
- trial worker concurrency remains disabled in product quota configuration.

These are security controls, not formatting rules.

## Next isolation boundary and non-goals

Phase 6B is responsible for separately reviewed repository acquisition and private input artifacts. Phase 6A is not permission to clone repositories or execute scanners over hosted source.

Any future repository acquisition must preserve existing asset/workspace binding, use a bounded trusted acquisition stage, create classified private immutable inputs, keep package lifecycle scripts disabled, and avoid caller-selected commands/network policy.

Network-enabled runtime/active execution remains a later separately approved Phase 6C/6D boundary with dedicated egress and preserved target authorization.

The architecture does not authorize generalized crawling, endpoint discovery, user-supplied origins, arbitrary methods/headers/bodies, authenticated testing, credential/cookie replay, browser automation, exploit probes, fuzzing, credential attacks, denial-of-service behavior, generalized DAST, or automatic remediation.
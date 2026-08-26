# ScopeForge Delivery Phases

ScopeForge follows the approved community-platform roadmap. Phase boundaries are safety and architecture boundaries, not only feature groupings.

1. **Foundation - complete**
   Identity, workspaces, tenancy, Row Level Security, application shell, security headers, CI, and deployment baseline.

2. **Asset control and authorization - complete**
   Workspace-scoped assets, canonical targets, proof of control, authorization boundaries, SSRF-safe verification, quotas, audit events, and asset UX.

3. **Code and supply-chain security - complete**
   Local/passive repository inventory, safe reads, normalized findings, policy, secrets, JavaScript/TypeScript SAST, bounded command taint analysis, npm SCA with optional OSV, CycloneDX SBOM, Docker/Kubernetes/Terraform/GitHub Actions/configuration analysis, baselines, JSON/SARIF, hostile-input tests, golden outputs, benchmark evidence, and release hardening. Final Phase 3 implementation merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.

4. **Verified runtime and API security - complete for the approved 4A/4B/4C-1 scope**
   - **4A Security domain contracts - complete.** Framework-independent findings, evidence, provenance, validation, lifecycle, remediation, relationships, and provider-neutral advisory contracts. Merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
   - **4B Verified passive runtime observations - complete.** Verified targets, immutable authorization snapshots, reauthorization, DNS/IP safety, pinned HTTPS, bounded/redacted observations, cancellation, deterministic runtime findings, and trusted persistence. Merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
   - **4C-1 Bounded CORS origin-policy validation - complete.** Separate active authority with owner/admin consent, exactly one fixed synthetic-Origin unauthenticated GET to the exact verified HTTPS target, zero redirect following, no request/response body capture, no credentials or caller request configuration, fixed budgets, cancellation-safe persistence, and deterministic `runtime_validated` findings. Design merged through PR #26 and implementation through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.

5. **Findings, Security Stories, remediation, and hosted scanner ingestion - complete through 5C**
   - **5A Hosted finding foundation - complete.** One workspace-scoped canonical finding ledger, immutable evidence, append-only occurrences/events, atomic passive/active result ingestion, recurrence-aware deterministic identities, bounded authenticated read models, service-role-only mutations, limited audited lifecycle actions, and findings UI.
   - **5B Security Stories, remediation, and deterministic retest - complete.** Workspace-scoped remediation assignment and notes, immutable retest source/profile snapshots, atomic `resolved -> retest_pending`, deterministic passive and bounded active-CORS retest orchestration through existing runtime authorities, failed-start recovery, authoritative fresh-evidence-only `verified_fixed`, bounded retest history, and deterministic Security Story v1. Merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a`.
   - **5C Hosted Phase 3 finding import - complete.** Merged through PR #37 as `2867e603df3e2430a78aaca8ba9cb6d09f6bdccb`. Adds privacy-reduced `hosted-json` local/CI export, closed scanner/rule/version validation, repository-bound `phase3_import` provenance, service-role-only atomic persistence, RLS-protected immutable import history, repository-only upload UX, stable paginated hosted findings, and architecture guards that keep repository execution/runtime networking/model providers outside the trusted import boundary.

6. **Isolated workers and scanner scale - in progress, 6A complete, 6B review candidate complete**
   - **6A Zero-egress worker foundation - complete.** Merged directly to `main` as `91f856f53fb57a4b9cd6710ee767361f473cea45`. Adds a private PostgreSQL-backed worker queue, internal `worker_foundation_probe` jobs, closed `foundation_no_egress_v1` contracts, scoped worker credentials, 90-second leases, bounded retries, cancellation-wins recovery/finalization, hard supervisor wall-time enforcement, private audit events, bounded fleet health, and permanent authority guards. Workers never receive Supabase `service_role`, executor contracts never receive lease credentials, and no existing passive-runtime, active-validation, or Phase 3 import job is routed through workers in 6A.
   - **6B Public GitHub repository acquisition and private immutable snapshots - implementation/deployment complete, pending merge.** The feature branch implements closed `repository_snapshot_github_public_v1` acquisition from the stored canonical repository asset only. It resolves the public GitHub default branch to an immutable commit SHA, permits only `api.github.com`, one reviewed `codeload.github.com` redirect, and one attempt R2 PUT, validates the complete DNS address set and pins TLS sockets, parses hostile tar/gzip without process/package execution, normalizes retained source deterministically, and publishes private seven-day R2 artifacts through an exact HEAD-size-gated atomic RPC. The R2 PUT is create-only via signed `If-None-Match: *`, so a stale bearer URL cannot overwrite an existing object. Browser users receive safe provenance only, never source/object locators. Cleanup is bounded and idempotent. Live production hardening removed default direct service-role snapshot-table authority, repaired cancellation-first publication, and added missing actor FK indexes. Security advisor is clean, performance advisor has no Phase 6B missing-FK-index notices, live generated types match the public boundary, and rollback-only enqueue/claim/publication/replay/cancellation/cleanup smoke passed. The branch still requires exact-head PR review/merge before this slice is considered merged.
   - **6C Isolated zero-egress Phase 3 scanning over immutable snapshots - next.** Consume only a broker-selected Phase 6B snapshot under a new closed execution class and a concrete sandbox with enforceable CPU/memory/process/input/scratch/output/wall-time limits. No target network, GitHub/R2 acquisition authority, package lifecycle scripts, project commands, scanners selected by callers, or arbitrary environment/configuration may be introduced. Scanner output must pass the existing deterministic normalization/ingestion boundary before hosted findings change.
   - **6D Dedicated network-enabled worker execution - deferred.** Existing authorized runtime/active operations may move behind isolated workers only after separate threat-model/design approval, target-policy preservation, quotas/backpressure, sandbox enforcement, cancellation, artifact privacy, and fleet operational controls are demonstrated. Phase 6B GitHub acquisition networking is not a generic egress capability and must not be reused by convenience.

7. **Community Security Packs**
   Versioned community detection metadata, safe declarative/static extensions, mappings, explainers, remediation guidance, preparedness content, fixtures, validation, and contribution governance without arbitrary plugin execution.

8. **Validation, benchmarks, and public methodology**
   Vulnerable labs, precision/recall and false-positive tracking where measurable, scanner benchmarks, regression methodology, transparent limitations, and technical reports.

9. **Production hardening and public release**
   Threat review, observability, abuse prevention, domain/security hardening, accessibility/responsive QA, incident readiness, release engineering, and public production launch.

## Safety rule

Do not widen active, acquisition, scanner, or hosted mutation authority merely because lower-level infrastructure exists. Remote active behavior requires explicit authorization, strict target controls, separated execution authority, egress/network policy, resource budgets, cancellation, auditability, and testable failure semantics. Browser roles remain read-only for the hosted security ledger and snapshot provenance. Trusted mutation paths must stay narrow and independently authorized.

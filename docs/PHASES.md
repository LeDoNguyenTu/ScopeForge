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
   - **5A Hosted finding foundation - complete.** One workspace-scoped canonical finding ledger, immutable evidence, append-only occurrences/events, atomic passive/active result ingestion, recurrence-aware deterministic identities, bounded authenticated read models, service-role-only mutations, limited audited lifecycle actions, and findings UI. Delivered through PR #30.
   - **5B Security Stories, remediation, and deterministic retest - complete.** Workspace-scoped remediation assignment and notes, immutable retest source/profile snapshots, atomic `resolved -> retest_pending`, deterministic passive and bounded active-CORS retest orchestration through existing runtime authorities, failed-start recovery, authoritative fresh-evidence-only `verified_fixed`, bounded retest history, and deterministic Security Story v1. Merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a`.
   - **5C Hosted Phase 3 finding import - complete.** Merged through PR #37 as `2867e603df3e2430a78aaca8ba9cb6d09f6bdccb`. Adds privacy-reduced `hosted-json` local/CI export, closed scanner/rule/version validation, repository-bound `phase3_import` provenance, service-role-only atomic persistence, RLS-protected immutable import history, repository-only upload UX, stable paginated hosted findings, and architecture guards that keep repository execution/runtime networking/model providers outside the trusted import boundary. Secret exports remove exact columns, re-key secret-derived local fingerprints using safe rule/location identity, regenerate secret evidence summaries from reviewed rule metadata, and never upload raw secret/source/snippet/data-flow/scanner diagnostic/SBOM content. Production Supabase contains the three Phase 5C migrations and has a clean security advisor with no missing-FK-index notices.

6. **Isolated workers and scanner scale - in progress, 6A complete**
   - **6A Zero-egress worker foundation - complete.** Merged directly to `main` as `91f856f53fb57a4b9cd6710ee767361f473cea45` without opening a pull request or running GitHub Actions. Adds a private PostgreSQL-backed worker queue, internal `worker_foundation_probe` jobs, closed `foundation_no_egress_v1` execution contracts, service-role broker RPCs, scoped worker credentials, 90-second leases, bounded retries, cancellation-wins recovery/finalization, hard supervisor wall-time enforcement, private audit events, bounded fleet health, and permanent architecture guards. Workers never receive Supabase `service_role`, executor contracts never receive lease credentials, and no existing passive-runtime, active-validation, or Phase 3 import job is routed to workers in 6A. Production Supabase is reconciled through `phase_6a_worker_private_helper_privileges`; security advisor is clean and performance advisor has no Phase 6A missing-FK-index notices.
   - **6B Repository acquisition and private input artifacts - next.** Introduce a separately reviewed acquisition/input boundary for hosted repository work. The worker executor must still not receive arbitrary caller commands, package-manager configuration, credentials, repository URLs, or network policy. Acquisition must produce immutable private artifacts through a bounded control-plane workflow before any scanner execution is enabled.
   - **6C/6D Network-enabled execution - deferred.** Dedicated egress and existing authorized runtime/active operations move behind isolated workers only after separate threat-model/design approval, target-policy preservation, quotas/backpressure, sandbox enforcement, cancellation, artifact privacy, and fleet operational controls are demonstrated.

7. **Community Security Packs**
   Versioned community detection metadata, safe declarative/static extensions, mappings, explainers, remediation guidance, preparedness content, fixtures, validation, and contribution governance without arbitrary plugin execution.

8. **Validation, benchmarks, and public methodology**
   Vulnerable labs, precision/recall and false-positive tracking where measurable, scanner benchmarks, regression methodology, transparent limitations, and technical reports.

9. **Production hardening and public release**
   Threat review, observability, abuse prevention, domain/security hardening, accessibility/responsive QA, incident readiness, release engineering, and public production launch.

## Safety rule

Do not widen active or hosted mutation authority merely because lower-level infrastructure exists. Remote active behavior requires explicit authorization, strict target controls, separated execution authority, egress/network policy, resource budgets, cancellation, auditability, and testable failure semantics. Browser roles remain read-only for the hosted security ledger. Trusted mutation paths must stay narrow and independently authorized.
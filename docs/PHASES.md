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

6. **Isolated workers and scanner scale - code complete through 6D; production enablement separately gated**
   - **6A Zero-egress worker foundation - complete.** Merged directly to `main` as `91f856f53fb57a4b9cd6710ee767361f473cea45`. Adds a private PostgreSQL-backed worker queue, internal `worker_foundation_probe` jobs, closed `foundation_no_egress_v1` contracts, scoped worker credentials, bounded leases/retries/recovery, private audit events, fleet health, and permanent authority guards.
   - **6B Public GitHub repository acquisition and private immutable snapshots - code complete.** Merged through PR #38 as `79c5ac30c38e91081a7bd6256e2b77f2a0cb25dc`. Hosted acquisition remains disabled until its separate operational acceptance, monitoring, rollback, and canary gate is complete.
   - **6C Isolated zero-egress Phase 3 scanning over immutable snapshots - code complete.** Merged through PR #39 as `7a329dc2796a142102af2392ee461f205daa1b78`. Hosted scanning remains disabled until its own real Linux execution-boundary acceptance proves zero egress, read-only boundaries, resource enforcement, and cancellation/container termination.
   - **6D Dedicated network-enabled workers - code and release acceptance complete, runtime enablement still gated.** Threat model/design merged through PR #51 and implementation through PR #52 into `main` at `4ec80199ed922a5d9c92041e5432a8355f4a4277`. Task 14 software acceptance, the 31-check real Linux rootless-Podman/cgroup-v2 Task 15 containment matrix, Task 16 source/security review, Supabase reconciliation, and exact-head CI were completed before merge. Passive and active worker capabilities remain disabled until separate operational canary/rollback gates authorize them.

7. **Community Security Packs - complete for local-only v1**
   Phase 7 merged through PR #54 as squash commit `1e9a72e0c4a526b064d6d3729981b405fac6b2b1`. V1 adds strict bounded pack manifests, exactly `static_literal_v1`, safe identity-checked repository reads, bounded non-backtracking path matching, deterministic findings, hostile-safe fixture validation, explicit `pack validate` / `pack inspect` / repeated `scan --pack` CLI workflows, local JSON/SARIF/terminal/baseline compatibility, permanent hosted-export rejection, one first-party Node TLS example pack, and contributor/reviewer governance. Final CI #756 on exact PR head `b10f04f87ff06a81106b585973c3e7872571bfa6` passed 299 test files / 1,282 tests, typecheck, CLI build/version, benchmark, and production Next.js build on Ubuntu 24.04. Target repositories cannot auto-discover packs. Hosted pack distribution/activation, executable plugins, active/network-capable rules, browser authority, and worker authority remain outside v1.

8. **Validation, benchmarks, and public methodology - foundation merged, broader implementation next**
   PR #50 merged the methodology foundation. Remaining work includes vulnerable/ground-truth labs, measurable precision/recall and false-positive tracking where valid, scanner benchmarks, regression methodology, transparent limitations, and technical reports.

9. **Production hardening and public release - incomplete**
   Threat review, observability, abuse prevention, domain/security hardening, accessibility/responsive QA after dashboard V5 stabilizes, incident readiness, release engineering, and public production launch. The Vercel control plane may remain live while worker runtimes are disabled because gated worker capabilities fail closed.

## Safety rule

Do not widen active, acquisition, scanner, or hosted mutation authority merely because lower-level infrastructure exists. Remote active behavior requires explicit authorization, strict target controls, separated execution authority, egress/network policy, resource budgets, cancellation, auditability, and testable failure semantics. Browser roles remain read-only for the hosted security ledger and snapshot provenance. Trusted mutation paths must stay narrow and independently authorized.

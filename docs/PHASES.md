# ScopeForge Delivery Phases

ScopeForge follows the approved community-platform roadmap. Phase boundaries are safety and architecture boundaries, not only feature groupings.

1. **Foundation - complete**
   Identity, workspaces, tenancy, Row Level Security, application shell, security headers, CI, and deployment baseline.

2. **Asset control and authorization - complete**
   Workspace-scoped assets, canonical targets, proof of control, authorization boundaries, SSRF-safe verification, quotas, audit events, and asset UX.

3. **Code and supply-chain security - complete**
   Local/passive repository inventory, safe reads, normalized findings, policy, secrets, JavaScript/TypeScript SAST, bounded command taint analysis, npm SCA with optional OSV, CycloneDX SBOM, Docker/Kubernetes/Terraform/GitHub Actions/configuration analysis, baselines, native JSON, SARIF, CI integration, hostile-input tests, golden outputs, benchmark evidence, and release hardening. Final Phase 3 implementation merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.

4. **Verified runtime and API security - in progress**
   Phase 4 is deliberately split so active behavior cannot bypass authorization and network-safety design.

   - **4A Security domain contracts - complete.** Framework-independent findings, evidence, provenance, validation, lifecycle, remediation, risk relationships, a one-way Phase 3 adapter, provider-neutral advisory contracts, advisory privacy policy, and an executable dependency-direction guard. Phase 4A merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
   - **4B Verified passive runtime observations - complete.** Phase 4B merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`. It provides verified web/API authorization, immutable enqueue snapshots, execution-time reauthorization, fresh DNS classification, DNS-pinned HTTPS transport, same-host redirects, end-to-end deadlines, asynchronous cancellation, bounded redacted observations, deterministic runtime findings, trusted persistence/audit, and minimal asset UI. Crawling, fuzzing, exploit payloads, credential behavior, response-body persistence, and destructive actions remain disabled.
   - **4C-1 Bounded CORS origin-policy validation - implemented in PR #27, exact-head completion gate pending.** The approved design merged through PR #26 as `3f0e46c61944976a4ddfd6ef039487498a19f839`. The implementation keeps `runtime-observer` passive, extracts shared low-level DNS/TLS/pinning/deadline behavior into `runtime-network`, and adds separate `runtime-validator` authority. The only active profile is `cors-origin-policy@1`: owner/admin explicit authorization, one fixed synthetic-Origin unauthenticated GET to the exact verified HTTPS target, zero redirect following, zero request/response body capture, no cookies/credentials/user headers, fixed budgets, cancellation-safe trusted persistence, profile-versioned deterministic `runtime_validated` findings, and executable dependency guards. Persistence and cancellation are serialized so cancellation before evidence prevents persistence, while a late cancellation cannot relabel a job after active evidence has committed. Broader active testing remains out of scope.

5. **Findings, Security Stories, and remediation**
   Hosted normalized finding lifecycle, evidence/inference separation, risk relationships, Security Story explanations, remediation workflows, retesting, and developer/security views. This phase builds on the Phase 4A `security-domain` contracts rather than defining a second finding model.

6. **Isolated workers and scanner scale**
   Production scan orchestration, isolated workers, queues, concurrency budgets, backpressure, cancellation, artifact boundaries, dedicated egress controls, and operational controls. Phase 4 runtime contracts should move behind this execution boundary without widening target policy.

7. **Community Security Packs**
   Versioned community detection metadata, safe declarative/static extensions, mappings, explainers, remediation guidance, preparedness content, fixtures, validation, and contribution governance without arbitrary plugin execution.

8. **Validation, benchmarks, and public methodology**
   Vulnerable labs, precision/recall and false-positive tracking where measurable, scanner benchmarks, regression methodology, transparent limitations, and technical reports.

9. **Production hardening and public release**
   Threat review, observability, abuse prevention, domain/security hardening, accessibility/responsive QA, incident readiness, release engineering, and public production launch.

## Safety rule

Do not pull later-phase active behavior into an earlier phase merely because implementation is technically possible. Remote active behavior requires explicit authorization, strict target controls, separated execution authority, egress/network policy, resource budgets, cancellation, auditability, and testable failure semantics. Worker-fleet isolation, dedicated egress infrastructure, concurrency/backpressure, and production scanner scale remain Phase 6 concerns and must reuse the narrow runtime contracts rather than widening them.

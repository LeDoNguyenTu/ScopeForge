# ScopeForge Delivery Phases

ScopeForge follows the approved community-platform roadmap. Phase boundaries are safety and architecture boundaries, not just feature groupings.

1. **Foundation - complete**  
   Identity, workspaces, tenancy, Row Level Security, application shell, security headers, CI, and deployment baseline.

2. **Asset control and authorization - complete**  
   Workspace-scoped assets, canonical targets, proof of control, authorization boundaries, SSRF-safe verification, quotas, audit events, and asset UX.

3. **Code and supply-chain security - feature set implemented, final completion gate in PR #21**  
   Local/passive repository inventory, safe reads, normalized findings, policy, secrets, JavaScript/TypeScript SAST, bounded command taint analysis, npm SCA with optional OSV, CycloneDX SBOM, Docker/Kubernetes/Terraform/GitHub Actions/configuration analysis, baselines, native JSON, SARIF, CI integration, hostile-input tests, golden outputs, benchmark evidence, and release-readiness review. Phase 3 is complete only after PR #21 exact-head CI and merged `main` CI are green.

4. **Verified runtime and API security - next**  
   Authorized remote web/API testing with explicit proof-of-control checks, worker isolation, DNS/IP/redirect/egress controls, strict budgets, cancellation, auditability, and narrow non-destructive runtime validation.

5. **Findings, Security Stories, and remediation**  
   Hosted normalized finding lifecycle, evidence/inference separation, risk relationships, Security Story explanations, remediation workflows, retesting, and developer/security views.

6. **Isolated workers and scanner scale**  
   Production scan orchestration, isolated workers, queues, concurrency budgets, backpressure, cancellation, artifact boundaries, and operational controls.

7. **Community Security Packs**  
   Versioned community detection metadata, safe declarative/static extensions, mappings, explainers, remediation guidance, preparedness content, fixtures, validation, and contribution governance without arbitrary plugin execution.

8. **Validation, benchmarks, and public methodology**  
   Vulnerable labs, precision/recall and false-positive tracking where measurable, scanner benchmarks, regression methodology, transparent limitations, and technical reports.

9. **Production hardening and public release**  
   Threat review, observability, abuse prevention, domain/security hardening, accessibility/responsive QA, incident readiness, release engineering, and public production launch.

## Safety rule

Do not pull later-phase active behavior into an earlier phase just because an implementation is technically possible. Active scanning requires its own authorization, isolation, egress, quota, cancellation, and audit boundaries.

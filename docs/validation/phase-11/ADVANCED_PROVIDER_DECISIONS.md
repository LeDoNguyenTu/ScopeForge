# Phase 11 advanced provider decisions

Status: Phase 11 Task 16 gate decision
Last reconciled: 2026-09-21, Asia/Singapore

Task 16 is capability-gap driven. It does not require ScopeForge to embed every candidate security product. A provider is added only when measured coverage shows a material gap and the new execution boundary passes licensing, supply-chain, adapter, containment, and runtime-cost review.

## Initial Phase 11 release decisions

| Provider family | Phase 11 decision | Reason |
| --- | --- | --- |
| Prowler | defer | No released cloud-credential execution boundary or measured cloud-posture gap justifies widening authority in the initial autonomous-validation release. |
| Kubescape | defer | ScopeForge already performs repository-side Kubernetes configuration analysis. Live-cluster authority needs its own credential and containment design before it can be justified. |
| CodeQL | defer as execution provider | ScopeForge already has first-party source analysis and SARIF integration. Add semantic CodeQL execution only if the validation corpus demonstrates a material recall gap worth the extra runtime/supply-chain cost. |
| TruffleHog | defer | ScopeForge already has a first-party secrets scanner. Integration requires measured incremental recall and acceptable duplicate/correlation cost. |
| MobSF | defer | There is no released mobile application workflow or mobile legal-lab corpus in Phase 11. |
| Amass / BBOT | defer | Broader attack-surface discovery can create new targets. It requires a separately reviewed discovery-authority model before use beyond the current exact authorized target set. |
| Specialist reverse-engineering providers | defer | No current Phase 11 workflow demonstrates a capability gap requiring this authority. |

## Providers retained in Phase 11

Phase 11 keeps the existing bounded provider-neutral contracts for Nmap, Nuclei, and HTTP discovery.

- ScopeForge HTTP discovery has a first-party bounded execution path and dedicated worker containment.
- Nuclei remains adapter/contract complete but runtime-disabled until an exact reviewed template snapshot, artifact checksum, immutable worker image, and Linux containment acceptance exist.
- Nmap remains adapter/contract complete but runtime-disabled pending its separate licensing/distribution decision and containment gate.
- External httpx remains a candidate execution engine, not a release requirement. The first-party HTTP provider already proves the core adaptive control path without exposing generic scanner flags.

## Re-entry criteria

A deferred provider can re-enter only when all of the following are recorded:

1. a specific missing capability or measured reliability/coverage deficit
2. incremental corpus coverage expected from the provider
3. exact version, license, acquisition method, and immutable artifact identity
4. closed adapter schema with no provider-native unrestricted flags
5. hostile-output and cancellation tests
6. real Linux containment acceptance for any process with network or target execution authority
7. measured runtime/resource cost and duplicate/correlation impact

This completes the Task 16 evaluation gate for the initial Phase 11 release. No advanced provider is justified merely to increase the provider count.

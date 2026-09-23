# Phase 12 - external provider runtime and automated pentest expansion

Status: active post-v1 roadmap
Started: 2026-09-23, Asia/Singapore

## Goal

Move ScopeForge from the completed bounded v1 orchestration baseline toward the broader automated-pentesting product vision by enabling carefully isolated external security engines behind the existing authorization, policy, budget, evidence, and worker boundaries.

The approved v1 roadmap remains complete. Phase 12 is new scope.

## Progress model

Initial estimated automated-pentest vision completion: approximately 75%.

Phase 12 is divided into independently releasable gates:

| Slice | Scope | Initial status |
| --- | --- | --- |
| 12A | external ProjectDiscovery httpx provider and target-bound runtime | source/runtime preparation complete; Linux containment and production acceptance pending |
| 12B | Nuclei safe-active runtime with pinned reviewed templates | source preparation in progress; production disabled |
| 12C | network/service discovery with Nmap or reviewed alternative | planned |
| 12D | hosted authenticated browser/API runtime | planned |
| 12E | bounded web/API DAST provider | planned |
| 12F | expanded proof-only vulnerability validation | planned |
| 12G | adaptive multi-provider planner loop and correlation | planned |
| 12H | production acceptance, benchmarks, rollback and operational hardening | planned |

## Storage rule

Supabase/Postgres remains the structured system of record for identities, authorization, run state, normalized observations, findings, indexes, and compact metadata.

Cloudflare R2 is the artifact plane for large or unstructured material such as provider raw result bundles, reproducibility artifacts, SBOMs, repository snapshots, and larger evidence files.

Do not store raw scanner output, response bodies, binaries, template bundles, large screenshots, or equivalent blobs directly in Postgres merely for convenience. Persist only privacy-reduced normalized facts and immutable artifact references.

All R2 access remains private and server/worker mediated with short-lived presigned operations or an equivalently reviewed boundary. Browser clients and scanner sandboxes never receive long-lived R2 credentials.

## 12A - external httpx

Reviewed engine: ProjectDiscovery httpx v1.12.0.

The source adapter is introduced default-off first. It accepts only:

- trusted target-node identity
- reviewed http/https scheme
- exactly one port
- 0-3 redirects
- a closed set of metadata probes

It rejects arbitrary URLs, paths, methods, headers, proxy settings, files, screenshots/headless execution, arbitrary port ranges, and provider-native flags.

The adapter, fixed runner, container entry, artifact pins and image source are implemented. Runtime enablement still requires:

1. exact artifact or source pin and SHA-256
2. reproducible immutable worker image
3. closed runner argument profile
4. target-bound DNS/IP/redirect mediation
5. cancellation and child-process termination tests
6. CPU/memory/PID/disk/runtime/output ceilings
7. hostile-output and secret-leak tests
8. real Linux containment acceptance
9. exact-head CI
10. a separately authorized bounded production canary

Artifact staging and networkless image preflight are scripted in `scripts/phase12-stage-provider-assets.sh` and `scripts/phase12-provider-host-preflight.sh`; they are preparation evidence only and do not satisfy the target-bound egress or production acceptance gates.

## 12B - Nuclei

Use the existing `provider-nuclei` contract. Engine v3.11.1 and templates v10.4.7 are now pinned to exact upstream commits and Linux artifact digests. The initial source runtime allowlist contains only `http-missing-security-headers`; all other Nuclei profiles remain disabled. Runtime remains blocked on dedicated target-bound containment and operational acceptance.

Initial production profile is allowlist-only and excludes code, JavaScript, headless execution, fuzzing/DAST mutation, local-file access, arbitrary helpers/processes, state-changing templates, and unreviewed out-of-band callbacks.

## 12C - network/service discovery

The existing Nmap provider contract remains useful, but runtime selection is gated by the NPSL deployment/distribution decision.

Before implementation, compare:

- operator/system-installed Nmap under an accepted licensing model
- a reviewed permissively licensed alternative such as RustScan, while retaining ScopeForge's provider-neutral capability IDs

No generic scanner flags may be exposed.

## 12D-12G

Productionize existing source contracts for browser/API authority and proof-only validation, then add one bounded DAST engine and finally close the adaptive loop:

recon -> graph -> hypotheses -> authorized provider actions -> evidence -> validation/correlation -> new hypotheses -> bounded stop conditions.

No unrestricted shell, arbitrary payload runner, brute-force credential attack, persistence, lateral movement, or general post-exploitation session is required for Phase 12 completion.

## Completion definition

Phase 12 reaches 100% only when each adopted slice has source tests plus its required operational acceptance. A source-only or default-off provider is not counted as operationally complete.

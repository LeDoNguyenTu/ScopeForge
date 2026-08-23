# ScopeForge Next Steps

## Current phase: Phase 3B - Safe reads, configuration, policy, and CLI

PR #7 implements the Phase 3B contract layer and has passed its implementation review checkpoint. Merge only after the exact final documentation head passes all CI gates.

Immediate actions:

1. Confirm final PR #7 CI passes tests, typecheck, CLI build/runtime smoke, and Next.js production build.
2. Confirm no unresolved Critical or Important review findings remain.
3. Mark PR #7 ready and squash merge it into `main`.

## Next slice: Phase 3C - Secret scanning and redaction

Implement test-first:

- mandatory redaction primitives before any secret detector can emit findings
- provider-aware high-confidence credential patterns
- private-key material detection
- bounded entropy heuristics with contextual filtering
- placeholder/test-fixture suppression
- secret fingerprints that never contain raw secret values
- allowlisting by fingerprint or explicit safe fixture annotation
- terminal and JSON regression tests proving raw secrets never appear
- hostile-input and large-file tests through the shared safe content reader

The secret scanner must consume `RepositoryInventory` and `readInventoryEntry`. It must not walk or open repository paths independently.

## Remaining approved Phase 3 sequence

1. JavaScript/TypeScript AST parser and structural SAST rules.
2. Limited high-confidence JS/TS taint analysis.
3. Dependency inventory and OSV enrichment.
4. CycloneDX SBOM generation independent of OSV availability.
5. Docker, Kubernetes, Terraform, GitHub Actions, and generic configuration rules.
6. Baseline engine.
7. SARIF 2.1.0 adapter and GitHub Code Scanning example.
8. Integration, golden-output, hostile-input security, and benchmark suites.
9. Documentation and release-readiness review.
10. Optional hosted ingestion only after the local contract is stable.

## Phase boundary

Do not begin remote DAST, authenticated crawling, API fuzzing, exploit validation, generalized network scanning, credential attacks, persistence, or destructive behavior during Phase 3.

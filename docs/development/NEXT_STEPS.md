# ScopeForge Next Steps

## Current phase: Phase 3D - JavaScript/TypeScript structural SAST

PR #9 implements the syntax-aware JavaScript/TypeScript scanner and is in its final exact-head verification cycle after security hardening. The shipped structural scope intentionally remains small: direct dynamic-code execution and explicit TLS verification disablement with strong binding evidence. Framework-sensitive cookie/session checks are deferred rather than inferred from variable names.

Immediate actions:

1. Verify the exact final PR #9 head passes tests, strict typecheck, CLI build/runtime smoke, and Next.js production build.
2. Confirm no unresolved Critical or Important review findings remain.
3. Mark PR #9 ready and squash merge it into `main` using expected-head protection.

## Next slice: Phase 3E - Limited high-confidence JavaScript/TypeScript taint analysis

Implement test-first after PR #9 merges:

- extend the existing `scanner-jsts` package rather than creating a second JavaScript scanner
- model a deliberately small source vocabulary for recognized Node.js/Next.js request query, route/path, body, and selected header access
- model a deliberately small sink vocabulary for command execution, SQL execution, filesystem paths, server-side outbound requests, and unsafe HTML APIs
- start with bounded intra-file propagation and explicitly modeled aliases/assignments
- model recognized sanitizers and safe APIs before broadening a vulnerability class
- produce data-flow evidence only from normalized source/sink steps, not arbitrary repository lines
- distinguish direct structural findings from source-to-sink findings by rule ID and evidence
- preserve the per-file AST budget and introduce an explicit taint-state/propagation budget
- discard partial taint findings and report an analysis error when a resource budget is exceeded
- add strong negative fixtures so variable names alone cannot create attacker-controlled-flow claims
- only add framework-sensitive cookie/session rules when framework identity can be established structurally rather than guessed from receiver names

Do not attempt whole-program cross-repository data flow in this slice. Add narrow interprocedural-light handling only after direct intra-file flows are stable and tested.

## Remaining approved Phase 3 sequence

1. Dependency inventory and OSV enrichment.
2. CycloneDX SBOM generation independent of OSV availability.
3. Docker, Kubernetes, Terraform, GitHub Actions, and generic configuration rules.
4. Baseline engine.
5. SARIF 2.1.0 adapter and GitHub Code Scanning example.
6. Integration, golden-output, hostile-input security, and benchmark suites.
7. Documentation and release-readiness review.
8. Optional hosted ingestion only after the local contract is stable.

## Phase boundary

Do not begin remote DAST, authenticated crawling, API fuzzing, exploit validation, generalized network scanning, credential attacks, persistence, or destructive behavior during Phase 3.

# ScopeForge Next Steps

## Current phase: Phase 3C - Secret scanner

PR #8 implements the first built-in detector family. Final merge requires the exact documentation head to pass the complete CI gate.

Immediate actions:

1. Verify the private-key location regression remains green after the fix.
2. Verify final PR #8 CI passes tests, typecheck, CLI build/runtime smoke, and Next.js production build.
3. Confirm no unresolved Critical or Important review findings remain.
4. Mark PR #8 ready and squash merge it into `main`.

## Next slice: Phase 3D - JavaScript/TypeScript structural SAST

Implement test-first after PR #8 merges:

- parser boundary for JavaScript, TypeScript, JSX, and TSX without executing repository code
- syntax-error isolation so one malformed file does not produce a false clean scanner result
- rule registry that reuses Phase 3 normalized findings and rule selection
- first small high-confidence structural rules
- source/sink evidence that contains code structure but no unrelated file content
- deterministic fingerprints stable across line movement where structural identity is unchanged
- hostile-input and parser resource-limit tests
- CLI registration and fail-closed rule validation

Do not start taint propagation until the structural AST boundary and first direct rules are stable.

## Remaining approved Phase 3 sequence

1. Limited high-confidence JS/TS taint analysis.
2. Dependency inventory and OSV enrichment.
3. CycloneDX SBOM generation independent of OSV availability.
4. Docker, Kubernetes, Terraform, GitHub Actions, and generic configuration rules.
5. Baseline engine.
6. SARIF 2.1.0 adapter and GitHub Code Scanning example.
7. Integration, golden-output, hostile-input security, and benchmark suites.
8. Documentation and release-readiness review.
9. Optional hosted ingestion only after the local contract is stable.

## Phase boundary

Do not begin remote DAST, authenticated crawling, API fuzzing, exploit validation, generalized network scanning, credential attacks, persistence, or destructive behavior during Phase 3.

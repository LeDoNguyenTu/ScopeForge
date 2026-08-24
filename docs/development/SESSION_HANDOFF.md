# ScopeForge Session Handoff

## Current phase

Phase 3O - release hardening and Phase 3 completion gate.

Active branch: `feat/phase-3o-release-hardening`

Active PR: #21 `Complete Phase 3 release hardening`

PR #21 should remain draft while documentation or implementation changes are still being pushed. Mark it ready only for the exact-head final gate.

## Completed before Phase 3O

- Phase 1 foundation merged.
- Phase 2 asset control and authorization merged through PR #4.
- Phase 3 scanner architecture merged through PR #5.
- Phase 3A scanner foundation merged through PR #6.
- Phase 3B safe reads, configuration, policy, and CLI merged through PR #7.
- Phase 3C secret scanner merged through PR #8.
- Phase 3D JavaScript/TypeScript structural SAST merged through PR #9.
- Phase 3E bounded command taint analysis merged through PR #10.
- Phase 3F dependency inventory and optional OSV enrichment merged through PR #11.
- Phase 3G CycloneDX SBOM merged through PR #12.
- Phase 3H Docker IaC merged through PR #13.
- CI noise reduction merged through PR #14.
- Phase 3I Kubernetes IaC merged through PR #15.
- Phase 3J Terraform IaC merged through PR #16.
- Phase 3K GitHub Actions IaC merged through PR #17.
- Phase 3L baseline model merged through PR #18.
- Phase 3M generic configuration security merged through PR #19 as `474bd82a1cad014e796a7faf83369c09f0d3dfc5`.
- Phase 3N SARIF output merged through PR #20 as `f2859f5028965276c9dc69ddf10398740a6f9ec7`.

## Phase 3 shipped scanner contract

### Safety and orchestration

- bounded deterministic repository inventory
- safe no-follow content reads with containment and identity revalidation
- repository symlink non-following
- normalized findings and explicit scanner errors
- stable fingerprints and deterministic ordering
- strict root `.scopeforge.json` version 1
- repository budgets may tighten but not raise safe defaults
- report-only default policy
- explicit `--fail-on`
- distinct exit codes 0, 1, 2, and 3
- safe normal output and baseline file handling

### Built-in scanner families

`secrets`

- GitHub tokens
- Stripe live secret keys
- Slack tokens
- complete private-key blocks
- contextual high-entropy assignments
- mandatory redaction and one-way secret fingerprints

`jsts`

- syntax-aware JS/TS parsing without target module resolution or execution
- direct dynamic-code execution constructs
- explicit TLS verification disablement with strong Node binding evidence
- bounded Express request-field to `child_process.exec` / `execSync` command taint analysis

`sca`

- npm dependency inventory from package-lock, npm-shrinkwrap, pnpm-lock, yarn.lock, and package.json fallback
- resolved versions preferred
- npm purls
- optional fixed-endpoint OSV enrichment, disabled by default
- OSV lookup failure reported as scanner error

`iac`

- Dockerfiles
- Kubernetes YAML
- selected Terraform AWS patterns
- GitHub Actions workflows
- `.npmrc`
- `vercel.json`

### Artifacts and policy

- CycloneDX 1.7 JSON SBOM independent of OSV/network availability
- version 1 baseline files with new/existing classification
- default baseline gate on new findings
- explicit all-findings baseline gate
- terminal output
- deterministic native ScopeForge JSON
- deterministic SARIF 2.1.0 for GitHub Code Scanning

## Phase 3O work completed on PR #21

- mixed-repository end-to-end integration test across all scanner families, baseline behavior, SARIF, and CycloneDX
- hostile-repository completion test covering no target execution, no default network access, symlink skipping, tightened file budgets, malformed supported input, and sentinel non-leakage
- byte-for-byte native JSON golden output
- byte-for-byte SARIF golden output
- byte-for-byte terminal golden output
- deterministic 700-file medium benchmark harness
- CI benchmark gate with a 20-second catastrophic-regression ceiling
- GitHub Actions and Code Scanning documentation
- performance methodology and measured evidence
- scanner limitations documentation
- permanent state refresh and release-readiness record

## Diagnostic verification evidence

CI #311 ran on PR head `4d7dbc43a41e15a26d6dd634e29eb1a96a299ea0` before the final documentation updates.

It passed:

- 85 test files
- 329 tests
- strict TypeScript typecheck
- `npm run build:cli`
- compiled CLI runtime smoke printing `ScopeForge 0.1.0`
- `npm run benchmark:scanner`
- `npm run build`

Benchmark line from CI #311:

```text
SCOPEFORGE_BENCHMARK {"fixture":"scanner-medium-v1","filesAnalyzed":700,"findings":0,"errors":0,"wallMs":928,"scanDurationMs":859,"rssDeltaBytes":22900736,"maxWallMs":20000}
```

Because documentation commits changed the PR head after CI #311, that run is supporting evidence only. It is not the final merge gate.

## Trust boundary

Repository contents are hostile input.

The Phase 3 local scanner must continue to preserve all of these properties:

- no target repository code execution
- no target lifecycle-script execution
- no target dependency installation
- no import/module execution during JS/TS analysis
- no Dockerfile or RUN execution
- no Terraform CLI, provider, module, provisioner, external data-source, state, or cloud API execution
- no Kubernetes cluster access, kubectl, Helm, Kustomize, or schema-download execution
- no GitHub Actions workflow or action execution
- no default scanner network access
- OSV network access only when explicitly enabled
- only normalized npm package identity and exact version sent to OSV
- no detected secret value sent to OSV or emitted in findings/artifacts
- bounded inventory and parser/analysis budgets
- repository symlink non-following
- safe no-follow output and baseline writes
- scanner errors distinct from clean results and policy failures
- SARIF fixed property allowlist and unsafe-path omission

## Phase 3O database status

No Phase 3O file changes Supabase schema, migrations, RLS, RPCs, storage, or hosted ingestion. Database advisor checks are not a merge dependency for this local-scanner-only PR.

## Known limitations

Read `docs/scanner/LIMITATIONS.md` before widening claims.

Important boundaries:

- JS/TS is the only syntax-aware application SAST language family
- taint analysis is intentionally narrow and not whole-program
- SCA is npm ecosystem only
- infrastructure rules are conservative local syntax checks, not deployed-state analysis
- no arbitrary executable community plugins
- no remote DAST, crawling, API fuzzing, exploit validation, credential attacks, persistence, destructive behavior, or worker fleet in Phase 3
- ScopeForge is source-installed and has no standalone package/reusable Action release yet

## Exact remaining actions

1. Finish any remaining permanent documentation and release-readiness edits on PR #21.
2. Review every PR #21 changed file.
3. Perform the whole-Phase-3 trust-boundary/security review.
4. Confirm there are no unresolved blocking review threads.
5. Mark PR #21 ready for review.
6. Require a fresh CI run on that exact immutable head.
7. Confirm tests, typecheck, CLI build/runtime, benchmark, and production build all pass.
8. Update PR metadata only, without changing the head, with final evidence.
9. Squash merge PR #21 using `expected_head_sha`.
10. Verify the resulting `main` CI run succeeds.
11. Only after step 10, declare Phase 3 complete.
12. Begin Phase 4 with architecture/design work, not active scanner implementation.

## Resume protocol

Read in this order:

1. this file
2. `docs/development/CURRENT_STATE.md`
3. `docs/scanner/RELEASE_READINESS.md`
4. `docs/scanner/LIMITATIONS.md`
5. `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`
6. PR #21 status and exact-head CI

Do not infer Phase 3 completion from an older green run. The exact final PR head and merged `main` must both be green.

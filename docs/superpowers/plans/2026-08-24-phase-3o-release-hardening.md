# Phase 3O Release Hardening and Phase 3 Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the approved Phase 3 definition of done with end-to-end integration, hostile-repository safety coverage, deterministic golden outputs, measured performance evidence, documented GitHub CI usage, current permanent handoff state, and a final release/security gate.

**Architecture:** Keep scanner behavior unchanged unless a completion test exposes a real defect. Add synthetic repository integration tests around the existing CLI and built-in scanner registry, fixed normalized-result golden fixtures around existing output adapters, and a standalone benchmark harness that invokes the compiled CLI against a generated medium synthetic repository. Documentation becomes the canonical user/release surface for local CLI, CI, safety boundaries, limitations, performance evidence, and Phase 4 handoff. The existing CI gate gains the benchmark harness after the CLI build with a deliberately generous catastrophic-regression ceiling rather than a marketing performance claim.

**Tech Stack:** TypeScript, Vitest, Node.js filesystem/process APIs, existing ScopeForge CLI/scanners/output adapters, GitHub Actions, Markdown.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Do not add remote DAST, crawling, API fuzzing, exploit validation, credential attacks, persistence, destructive behavior, or hosted scan orchestration.
- Do not execute target repository code, lifecycle scripts, workflows, Dockerfiles, Terraform, Kubernetes manifests, or package-manager commands as part of scanning.
- OSV remains opt-in and is disabled in deterministic integration/benchmark fixtures.
- Synthetic hostile fixtures may contain executable-looking text but the test must prove it is treated only as data.
- No raw detected secret value may appear in terminal, JSON, SARIF, benchmark logs, or committed golden fixtures.
- Performance numbers are evidence from a documented synthetic benchmark, not general production claims.
- Benchmark gating uses a broad upper bound intended only to catch catastrophic regressions on CI runners.
- Existing output schemas, finding fingerprints, policy exit codes, and scanner rule semantics remain backward compatible.
- Phase 3 is not declared complete until the exact final pull-request head and merged `main` both pass the required validation gates.

---

### Task 1: Mixed-repository end-to-end contract

**Files:**
- Create: `tests/scanner/integration/phase3-e2e.test.ts`

**Contract:**
Build a temporary repository containing representative inputs for secrets, JS/TS SAST/taint, SCA inventory, Docker, Kubernetes, Terraform, GitHub Actions, npm configuration, and Vercel configuration. Run the real CLI with built-ins and OSV disabled.

- [ ] Write RED integration coverage for a single native JSON scan that proves all scanner families can coexist, produces expected representative rule IDs, keeps scanner errors empty, and keeps a raw secret sentinel out of serialized output.
- [ ] Cover report-only success and explicit `--fail-on high` policy failure against the same mixed repository.
- [ ] Create a baseline from the mixed repository, add one new high-severity finding, and prove baseline-aware gating treats old findings as existing and the new finding as new.
- [ ] Generate SARIF and CycloneDX outputs from the same repository and prove they are parseable, use their expected standard versions, and do not contain the raw secret sentinel.
- [ ] Run the focused integration test and verify RED only if existing behavior has an uncovered integration defect. If the existing implementation already satisfies the contract, record that the contract arrives GREEN and do not manufacture a failure.

### Task 2: Hostile-repository completion contract

**Files:**
- Create: `tests/scanner/integration/phase3-hostile-repository.test.ts`

**Contract:**
Use one synthetic repository to combine hostile input boundaries already tested independently.

- [ ] Add target JS/TS and package metadata containing code that would create a marker file if executed; scan and assert the marker is absent.
- [ ] Add a symlink to an external file and assert it is skipped and never read into findings/output.
- [ ] Add an oversized file under a tightened safe budget and assert bounded skip/error behavior rather than unbounded reading.
- [ ] Add malformed supported structured inputs and assert scanner errors are present, so incomplete coverage cannot look clean.
- [ ] Stub/guard global network access for the default offline scan and prove no scanner-initiated fetch occurs.
- [ ] Assert terminal, JSON, and SARIF output do not contain unique hostile source/config/secret sentinels except normalized evidence explicitly allowed by the finding contract.

### Task 3: Golden output continuity

**Files:**
- Create: `tests/scanner/output/golden-output.test.ts`
- Create: `tests/fixtures/scanner/golden/scan-result.json`
- Create: `tests/fixtures/scanner/golden/scan-result.sarif`
- Create: `tests/fixtures/scanner/golden/scan-result.txt`

**Contract:**
Use one fixed normalized `ScanResult` fixture with fixed scan timestamps/duration and safe findings. Serialize it through native JSON, SARIF, and terminal adapters and compare byte-for-byte against committed golden artifacts.

- [ ] Include multiple severities, two rule families, one existing baseline finding, one new finding, and one scanner diagnostic.
- [ ] Ensure golden fixtures contain no real or fixture secret value.
- [ ] Add a test proving repeated serialization is byte-for-byte identical.
- [ ] Treat any future golden change as an explicit output-contract review event.

### Task 4: Measured scanner benchmark

**Files:**
- Create: `benchmarks/scanner-medium.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/scanner/PERFORMANCE.md`

**Contract:**
Generate a deterministic medium synthetic repository in the runner temp directory and invoke the compiled CLI in-process with OSV disabled.

- [ ] Generate a documented mixture of source, configuration, Docker, Kubernetes, Terraform, and GitHub Actions files without detected findings.
- [ ] Measure total CLI wall-clock duration, analyzed file count, serialized finding/error counts, and process RSS delta.
- [ ] Print one machine-readable `SCOPEFORGE_BENCHMARK` JSON line so CI evidence can be copied accurately.
- [ ] Fail only if the scan itself fails, output is invalid, analyzed-file count differs from the fixture contract, or wall time exceeds a broad 20-second catastrophic-regression ceiling.
- [ ] Add `npm run benchmark:scanner` and run it in CI after `build:cli`.
- [ ] Document hardware variability, fixture composition, what the benchmark measures, what it does not prove, and the latest observed CI measurement before merge.

### Task 5: GitHub CI and local user documentation

**Files:**
- Create: `docs/scanner/CI.md`
- Create: `docs/scanner/LIMITATIONS.md`
- Modify: `README.md`

**Contract:**
Document the completed local scanner as it actually exists.

- [ ] Add terminal, JSON, SARIF, SBOM, baseline-create/use, rule listing, `--fail-on`, and root configuration examples.
- [ ] Add a documented GitHub Actions workflow that runs report-only by default, writes SARIF, uploads it with GitHub's standard CodeQL SARIF upload action when `security-events: write` is available, and shows optional severity enforcement separately.
- [ ] Explain current source-install status honestly: until a standalone package/release exists, CI should install/build ScopeForge in an isolated tool directory outside the target workspace and use `--ignore-scripts` for the tool install.
- [ ] Explain OSV opt-in behavior and that only normalized package identity/version is sent to the fixed endpoint.
- [ ] Document exit codes, scanner-error versus policy-failure semantics, safe output/baseline behavior, and unsupported/deferred analysis.
- [ ] Document known false-negative boundaries: intentionally narrow JS/TS taint, no whole-program type/module resolution, conservative infrastructure semantics, supported JS package ecosystems only for SCA, no arbitrary community plugins, no remote scanning.

### Task 6: Permanent project state and release-readiness record

**Files:**
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`
- Modify: `docs/PHASES.md`
- Create: `docs/scanner/RELEASE_READINESS.md`

**Contract:**
All permanent state files must agree that Phase 3 is complete only after final verification and identify Phase 4 as the next boundary.

- [ ] Replace stale Phase 3D-era state with a concise shipped Phase 3 capability inventory.
- [ ] Record exact final test, typecheck, CLI, build, benchmark, and security-review evidence.
- [ ] Record no-database-change status for Phase 3O and whether database/advisor checks are applicable.
- [ ] Record known limitations without hiding unsupported languages, package ecosystems, network enrichment, or active-testing boundaries.
- [ ] Set the next implementation boundary to the approved Phase 4 verified runtime/API security work, without starting it in this PR.

### Task 7: Whole-Phase-3 release/security gate

**Files:**
- Review all Phase 3 production paths and final Phase 3O diff.

**Contract:**
No merge until all completion evidence is green on the exact head.

- [ ] Run `npm test` and record test-file/test counts.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build:cli` and `node .scopeforge-build/packages/cli/index.js version`.
- [ ] Run `npm run benchmark:scanner` and record the emitted benchmark JSON line.
- [ ] Run `npm run build`.
- [ ] Review Phase 3 scanner trust boundaries: filesystem containment/no-follow reads, secret redaction, no target execution, OSV outbound-data restriction, parser budgets, safe outputs, baselines, SARIF allowlist, and scanner-error semantics.
- [ ] Review every Phase 3O changed file and resolve all blocking review threads.
- [ ] Confirm no Phase 3O database migration/schema change. If none exists, database advisor checks are not a merge dependency for this local-scanner-only diff; record that explicitly.
- [ ] Mark the PR ready only for the exact-head final gate and squash merge with expected-head protection.
- [ ] After merge, verify `main` CI passes before declaring Phase 3 complete.

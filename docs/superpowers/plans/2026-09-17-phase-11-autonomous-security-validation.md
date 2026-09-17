# Phase 11 Autonomous Security Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stateful, evidence-driven, policy-gated automated pentesting and continuous security validation architecture to ScopeForge without weakening existing authorization, worker isolation, canonical evidence, or runtime safety boundaries.

**Architecture:** Extend the existing `Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify` lifecycle with a bounded inner loop: `Observe -> Hypothesize -> Plan -> Authorize -> Execute -> Validate -> Update Graph -> Replan`. ScopeForge owns graph state, hypotheses, policy, evidence normalization, correlation, coverage, and lifecycle state. External security tools are capability providers behind closed adapters rather than planner-visible executables.

**Tech Stack:** TypeScript 5.8, Node 24, Next.js 15, Supabase/PostgreSQL, Vitest, existing worker queue/broker/sandbox infrastructure, existing `security-domain`, `network-safety`, `runtime-network`, `runtime-observer`, and `runtime-validator` packages.

**Spec:** `docs/superpowers/specs/2026-09-17-phase-11-autonomous-security-validation-design.md`

## Global Constraints

- Preserve all current authorization, RLS, CSP, evidence, worker isolation, network-safety, and runtime capability-gate invariants.
- Do not apply production migrations or enable hosted capability flags merely because code is present or tests pass.
- Keep Node runtime contract at `>=24 <25` unless repository configuration is intentionally changed first.
- Use TDD for each implementation task: failing test first, minimal implementation second, focused validation third, full validation before merge.
- Do not expose provider-native arbitrary flags, shell commands, arbitrary URLs, arbitrary headers, arbitrary payload paths, or unrestricted browser scripting to the planner or browser client.
- External provider output never directly confirms a canonical finding. Normalization and deterministic validators own evidence promotion.
- Model output remains advisory and cannot authorize actions, confirm findings, mutate canonical lifecycle state, or mark remediation verified.
- Every new runtime authority stays default-off until its own containment, rollback, observability, and operational acceptance is complete.
- Phase 10A2 and Phase 10A3 are released on `main`. Phase 11 pure-domain work may proceed from the released post-10A3 baseline; hosted execution and production schema changes remain separately gated.
- Every external tool or data source requires version, license, redistribution, integrity, and adapter-method review before hosted distribution.
- No AI co-author attribution in commits.

---

## File Structure

The implementation should introduce focused packages rather than adding planner behavior to existing UI or worker modules.

### New pure-domain packages

- `packages/security-planning/types.ts` - execution modes, observations, hypotheses, capabilities, action intents, authorization, action results, coverage, and run-state contracts.
- `packages/security-planning/hypothesis.ts` - deterministic hypothesis lifecycle and confidence transitions.
- `packages/security-planning/coverage.ts` - coverage accounting and stop-condition evaluation.
- `packages/security-planning/graph.ts` - provider-neutral asset/attack graph types and pure graph operations.
- `packages/security-planning/index.ts` - public exports.
- `packages/security-planning/*.test.ts` - pure-domain tests.

### New policy and planner packages

- `packages/pentest-policy/policy.ts` - deterministic action authorization rules.
- `packages/pentest-policy/index.ts` - policy exports.
- `packages/pentest-planner/planner.ts` - bounded next-iteration planning.
- `packages/pentest-planner/scoring.ts` - explainable action scoring.
- `packages/pentest-planner/index.ts` - planner exports.
- matching `*.test.ts` files.

### New capability-provider packages

- `packages/capability-registry/types.ts` - provider adapter interfaces and registry contracts.
- `packages/capability-registry/registry.ts` - closed provider registration and selection.
- `packages/capability-registry/index.ts` - exports.
- `packages/provider-native-scopeforge/` - adapters that convert existing Phase 3/runtime results into normalized observations.
- `packages/provider-nmap/` - bounded Nmap adapter, introduced only after worker containment design is approved.
- `packages/provider-nuclei/` - reviewed-template Nuclei adapter, introduced only after template policy and worker containment design are approved.
- `packages/provider-http-discovery/` - first bounded HTTP discovery provider.

### New trusted application services

- `lib/pentest-runs/` - workspace authorization, run creation, orchestration, read models, cancellation, approvals, and persistence boundaries.
- `lib/pentest-graph/` - trusted graph persistence mapping and privacy-reduced read models.
- `lib/pentest-observations/` - observation persistence and provider provenance mapping.

### Database and migration work

Use forward-only migrations under `supabase/migrations/` after Phase 10 release reconciliation. Expected concepts:

- `pentest_runs`
- `pentest_run_authorization_snapshots`
- `pentest_graph_nodes`
- `pentest_graph_edges`
- `pentest_observations`
- `pentest_hypotheses`
- `pentest_actions`
- `pentest_action_attempts`
- `pentest_coverage`
- `pentest_approval_events`

Credential/session tables are deliberately deferred to the authenticated-testing subphase.

### Evaluation

- `packages/security-planning/fixtures/`
- `tests/pentest/`
- `benchmarks/pentest/`
- `docs/validation/phase-11/`

---

### Task 1: Lock Phase 11 domain contracts

**Files:**
- Create: `packages/security-planning/types.ts`
- Create: `packages/security-planning/index.ts`
- Test: `packages/security-planning/types.test.ts`
- Modify: `tsconfig.cli.json` only if the package is not already covered by current package globs.

**Interfaces:**
- Produces: `ExecutionMode`, `AssetNode`, `Observation`, `Hypothesis`, `CapabilityDescriptor`, `ActionIntent`, `ActionAuthorization`, `ActionResult`, `CoverageState`, `RunStopReason`.
- Consumes: stable IDs and finding/evidence concepts from `packages/security-domain` where reusable without creating infrastructure dependencies.

- [ ] **Step 1: Write failing domain-construction tests**

Cover these invariants:

```ts
expect(makeCapabilityDescriptor({ mode: "passive", capabilityId: "network.port.discover.v1" }).ok).toBe(true)
expect(makeActionIntent({ providerNativeArgs: ["-A"] } as never).ok).toBe(false)
expect(makeActionAuthorization({ expiresAt: pastTime }).ok).toBe(false)
expect(makeObservation({ evidence: [] }).ok).toBe(false)
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
npm test -- packages/security-planning/types.test.ts
```

Expected: failures because Phase 11 domain constructors do not exist.

- [ ] **Step 3: Implement minimal closed schemas**

Implement strict discriminated unions and constructors with no generic command, URL, raw-header, or arbitrary-provider-argument fields.

Required mode type:

```ts
export type ExecutionMode = "passive" | "safe_active" | "intrusive" | "validation";
```

Required action boundary:

```ts
export interface ActionIntent {
  actionId: string;
  hypothesisId: string;
  capabilityId: string;
  targetNodeIds: readonly string[];
  requestedMode: ExecutionMode;
  closedParameters: Readonly<Record<string, string | number | boolean>>;
  expectedEvidenceTypes: readonly string[];
  requestedCredentialClass?: string;
  requestedSessionClass?: string;
}
```

- [ ] **Step 4: Run focused tests and typecheck**

```bash
npm test -- packages/security-planning/types.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/security-planning tsconfig.cli.json
git commit -m "feat: add Phase 11 planning domain contracts [skip ci]"
```

---

### Task 2: Add pure asset and attack graph operations

**Files:**
- Create: `packages/security-planning/graph.ts`
- Test: `packages/security-planning/graph.test.ts`
- Modify: `packages/security-planning/index.ts`

**Interfaces:**
- Consumes: `AssetNode`, `Observation` from Task 1.
- Produces: `AssetEdge`, `SecurityGraph`, `addObservedNode`, `addObservedEdge`, `deriveAttackPaths`, `graphFingerprint`.

- [ ] **Step 1: Write failing graph tests**

Test deterministic identity, duplicate collapse, provenance preservation, stale-edge handling, and path derivation only across evidence-backed edges.

```ts
const g1 = addObservedEdge(emptyGraph(), edgeA)
const g2 = addObservedEdge(g1, edgeA)
expect(g2.edges).toHaveLength(1)
expect(graphFingerprint(g1)).toBe(graphFingerprint(g2))
```

- [ ] **Step 2: Confirm RED**

```bash
npm test -- packages/security-planning/graph.test.ts
```

- [ ] **Step 3: Implement deterministic graph operations**

Rules:

- graph node and edge identity must be stable for equivalent normalized facts
- unsupported planner guesses cannot be inserted as trusted edges
- every trusted edge requires provenance references
- graph functions remain pure and infrastructure-free

- [ ] **Step 4: Run focused and package tests**

```bash
npm test -- packages/security-planning
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/security-planning
git commit -m "feat: add deterministic security graph domain [skip ci]"
```

---

### Task 3: Add hypothesis lifecycle and coverage engine

**Files:**
- Create: `packages/security-planning/hypothesis.ts`
- Create: `packages/security-planning/coverage.ts`
- Test: `packages/security-planning/hypothesis.test.ts`
- Test: `packages/security-planning/coverage.test.ts`
- Modify: `packages/security-planning/index.ts`

**Interfaces:**
- Produces: `deriveHypotheses`, `transitionHypothesis`, `updateCoverage`, `evaluateStopConditions`.
- Consumes: graph, observations, action results.

- [ ] **Step 1: Write failing hypothesis-state tests**

Ensure only valid transitions occur:

```text
proposed -> eligible -> testing -> supported
proposed -> blocked
eligible -> exhausted
 testing -> refuted
```

Reject direct `proposed -> supported` without evidence.

- [ ] **Step 2: Write failing coverage/stop tests**

Cover cancellation, deadline, request budget, graph-expansion ceiling, provider-failure threshold, no eligible hypotheses, approval wait, authorization expiry, and coverage completion.

- [ ] **Step 3: Confirm RED**

```bash
npm test -- packages/security-planning/hypothesis.test.ts packages/security-planning/coverage.test.ts
```

- [ ] **Step 4: Implement minimal deterministic engines**

No model dependency. Initial hypothesis generators are rule functions registered explicitly by code.

- [ ] **Step 5: Validate and commit**

```bash
npm test -- packages/security-planning
npm run typecheck
git add packages/security-planning
git commit -m "feat: add hypothesis and coverage engines [skip ci]"
```

---

### Task 4: Implement deterministic policy gate

**Files:**
- Create: `packages/pentest-policy/policy.ts`
- Create: `packages/pentest-policy/index.ts`
- Test: `packages/pentest-policy/policy.test.ts`
- Modify: architecture dependency guard tests where package direction is enforced.

**Interfaces:**
- Consumes: `ActionIntent`, authorization snapshot, workspace policy, capability descriptor.
- Produces:

```ts
export type PolicyDecision =
  | { status: "approved"; authorization: ActionAuthorization }
  | { status: "narrowed"; authorization: ActionAuthorization; reasons: readonly string[] }
  | { status: "approval_required"; reasons: readonly string[] }
  | { status: "rejected"; reasons: readonly string[] };
```

- [ ] **Step 1: Write failing policy tests**

Required cases:

- expired target authorization rejects
- requested mode above workspace ceiling rejects
- intrusive action without owner/admin approval rejects
- validation action requires explicit approval unless the target is a configured lab policy
- budget request above capability maximum is narrowed or rejected
- target node outside authorization snapshot rejects
- unknown capability rejects

- [ ] **Step 2: Confirm RED**

```bash
npm test -- packages/pentest-policy/policy.test.ts
```

- [ ] **Step 3: Implement policy engine as a pure package**

Do not import Supabase, worker credentials, process execution, provider SDKs, or network clients.

- [ ] **Step 4: Add architecture guard**

Extend existing import-boundary tests so `pentest-policy` and future `pentest-planner` cannot import infrastructure authority.

- [ ] **Step 5: Validate and commit**

```bash
npm test -- packages/pentest-policy
npm run typecheck
git add packages/pentest-policy packages/*/*guard* tests 2>/dev/null || true
git commit -m "feat: add Phase 11 deterministic policy gate [skip ci]"
```

---

### Task 5: Implement capability registry

**Files:**
- Create: `packages/capability-registry/types.ts`
- Create: `packages/capability-registry/registry.ts`
- Create: `packages/capability-registry/index.ts`
- Test: `packages/capability-registry/registry.test.ts`

**Interfaces:**

```ts
export interface CapabilityProvider<Req, Raw, Obs> {
  readonly providerId: string;
  readonly version: string;
  readonly capabilityIds: readonly string[];
  validateRequest(request: Req, context: ProviderPolicyContext): ProviderValidationResult;
  execute(request: Req, context: ProviderExecutionContext, signal: AbortSignal): Promise<Raw>;
  normalize(raw: Raw, context: ProviderNormalizationContext): Promise<readonly Obs[]>;
  cleanup(context: CleanupContext): Promise<CleanupResult>;
}
```

- [ ] **Step 1: Write failing registry tests**

Cover duplicate provider rejection, unregistered capability rejection, mode mismatch, disabled provider rejection, deterministic provider selection, and provider-health fallback.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- packages/capability-registry/registry.test.ts
```

- [ ] **Step 3: Implement closed registry**

Provider registration must happen from trusted application configuration. Target-controlled input cannot load packages, binaries, templates, or providers dynamically.

- [ ] **Step 4: Validate and commit**

```bash
npm test -- packages/capability-registry
npm run typecheck
git add packages/capability-registry
git commit -m "feat: add capability provider registry [skip ci]"
```

---

### Task 6: Add native ScopeForge observation adapters

**Files:**
- Create: `packages/provider-native-scopeforge/phase3.ts`
- Create: `packages/provider-native-scopeforge/runtime.ts`
- Create: `packages/provider-native-scopeforge/index.ts`
- Test: `packages/provider-native-scopeforge/*.test.ts`
- Reuse existing Phase 3 and runtime result contracts rather than changing their trust boundaries.

**Interfaces:**
- Consumes existing Phase 3 hosted-normalized output and runtime observation/validation results.
- Produces Phase 11 `Observation[]` only.

- [ ] **Step 1: Write failing normalization tests using existing fixtures**

Verify stable observation identity, evidence links, provider provenance, no raw secrets, and no authority widening.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- packages/provider-native-scopeforge
```

- [ ] **Step 3: Implement adapters**

Adapters must be pure transformations. They must not rerun scans or issue network requests.

- [ ] **Step 4: Validate and commit**

```bash
npm test -- packages/provider-native-scopeforge packages/security-planning
npm run typecheck
git add packages/provider-native-scopeforge
git commit -m "feat: normalize native ScopeForge evidence for Phase 11 [skip ci]"
```

---

### Task 7: Implement deterministic planner v1

**Files:**
- Create: `packages/pentest-planner/scoring.ts`
- Create: `packages/pentest-planner/planner.ts`
- Create: `packages/pentest-planner/index.ts`
- Test: `packages/pentest-planner/scoring.test.ts`
- Test: `packages/pentest-planner/planner.test.ts`

**Interfaces:**

```ts
export interface PlannerInput {
  graph: SecurityGraph;
  observations: readonly Observation[];
  hypotheses: readonly Hypothesis[];
  capabilities: readonly CapabilityDescriptor[];
  coverage: CoverageState;
  runPolicy: RunPolicySnapshot;
}

export interface PlannerOutput {
  intents: readonly ActionIntent[];
  deferredHypothesisIds: readonly string[];
  stopReason?: RunStopReason;
  decisionTrace: readonly PlannerDecision[];
}
```

- [ ] **Step 1: Write failing adaptive-planning tests**

Use a fixture where HTTP discovery creates a new API-operation node and makes an API-specific hypothesis eligible only on iteration 2.

Assert the planner does not schedule the API action before the evidence exists.

- [ ] **Step 2: Write scoring tests**

Scoring factors must be visible in the decision trace: information gain, confidence, validation value, reliability, normalized cost, and policy weight.

- [ ] **Step 3: Confirm RED**

```bash
npm test -- packages/pentest-planner
```

- [ ] **Step 4: Implement deterministic next-iteration planner**

The planner emits a bounded batch only. It does not execute actions or authorize them.

- [ ] **Step 5: Validate and commit**

```bash
npm test -- packages/pentest-planner packages/pentest-policy packages/security-planning
npm run typecheck
git add packages/pentest-planner
git commit -m "feat: add deterministic adaptive planner v1 [skip ci]"
```

---

### Task 8: Add persistence schema and trusted graph/observation boundaries

**Files:**
- Create forward-only migration after live Phase 10 migration reconciliation, for example: `supabase/migrations/<timestamp>_phase_11a_planning_graph.sql`
- Create: `lib/database.phase11.types.ts`
- Create: `lib/pentest-graph/persistence.ts`
- Create: `lib/pentest-observations/persistence.ts`
- Test: matching database and service tests using the repository's existing PGlite/Supabase test pattern.

**Interfaces:**
- Trusted writes for graph nodes/edges, observations, hypotheses, coverage, and run events.
- Member-readable privacy-reduced read models only.
- No browser DML on authoritative Phase 11 tables.

- [ ] **Step 1: Reconcile live Phase 10 schema state before choosing migration timestamp**

Do not edit or supersede deployed migrations.

- [ ] **Step 2: Write failing database privilege tests**

Required assertions:

- `anon` cannot read workspace Phase 11 state
- authenticated non-member cannot read
- workspace member can read only privacy-reduced rows in their workspace
- authenticated browser role cannot insert/update/delete canonical graph/observation rows
- trusted mutation function validates workspace/run/authorization binding

- [ ] **Step 3: Implement migration and trusted persistence services**

Use the repository's current `SECURITY DEFINER`, pinned `search_path`, explicit grant/revoke, RLS, and private-table conventions.

- [ ] **Step 4: Run database tests, typecheck, and existing security guards**

```bash
npm test
npm run typecheck
```

- [ ] **Step 5: Commit without applying production migration**

```bash
git add supabase/migrations lib/pentest-graph lib/pentest-observations lib/database.phase11.types.ts
git commit -m "feat: add Phase 11 graph and observation persistence [skip ci]"
```

---

### Task 9: Add trusted pentest-run orchestration service

**Files:**
- Create: `lib/pentest-runs/create-run.ts`
- Create: `lib/pentest-runs/advance-run.ts`
- Create: `lib/pentest-runs/cancel-run.ts`
- Create: `lib/pentest-runs/read-model.ts`
- Test: `lib/pentest-runs/*.test.ts`

**Interfaces:**
- `createPentestRun(input)` creates an immutable authorization/run-policy snapshot.
- `advancePentestRun(runId)` loads trusted state, asks planner for intents, asks policy engine for decisions, and enqueues only approved actions.
- `cancelPentestRun(runId)` marks cancellation and propagates through existing worker semantics.

- [ ] **Step 1: Write failing orchestration tests**

Test authorization snapshot creation, stale authorization rejection, duplicate advance idempotency, cancellation, policy-required approval, and no direct provider invocation from control-plane code.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- lib/pentest-runs
```

- [ ] **Step 3: Implement trusted service using existing worker/broker patterns**

Do not introduce service-role or worker credentials into planner packages.

- [ ] **Step 4: Validate and commit**

```bash
npm test -- lib/pentest-runs packages/pentest-planner packages/pentest-policy
npm run typecheck
git add lib/pentest-runs
git commit -m "feat: add trusted Phase 11 run orchestrator [skip ci]"
```

---

### Task 10: Design and implement the first external provider slice

This task should be split into separate PRs if the containment review shows materially different execution boundaries.

**Files:**
- Create: `docs/superpowers/specs/<date>-phase-11c-provider-execution-design.md`
- Create after approval: `packages/provider-nmap/`
- Create after approval: `packages/provider-nuclei/`
- Create after approval: `packages/provider-http-discovery/`
- Add worker execution-class code only after the provider-specific containment design is approved.

**Interfaces:**
- `network.port.discover.v1`
- `network.service.fingerprint.v1`
- `web.template.validate.v1`
- `web.http.probe.v1`
- `web.route.discover.v1`

- [ ] **Step 1: Complete per-provider license and distribution review**

Record exact version/tag, license, distribution mode, templates/data license, checksums, and update process in `docs/dependencies/security-providers.md`.

- [ ] **Step 2: Write adapter contract tests before process execution code**

Test closed arguments, exact target binding, output byte limits, parser failure, timeout, cancellation, and normalization.

- [ ] **Step 3: Implement adapters with no arbitrary provider flags**

Provider commands are constructed entirely from reviewed code and closed capability inputs.

- [ ] **Step 4: Add containment tests**

Require real Linux acceptance for network-enabled execution classes. Test egress scope, CPU/memory/PID/disk/runtime limits, cancellation, child-process termination, artifact bounds, and secret/log leakage.

- [ ] **Step 5: Keep runtime flags default-off and commit code only after exact-candidate validation**

Suggested commits per provider:

```bash
git commit -m "feat: add bounded Nmap capability provider [skip ci]"
git commit -m "feat: add reviewed Nuclei capability provider [skip ci]"
git commit -m "feat: add bounded HTTP discovery provider [skip ci]"
```

---

### Task 11: Build the adaptive end-to-end evaluation harness

**Files:**
- Create: `tests/pentest/fixtures/`
- Create: `tests/pentest/adaptive-planner.e2e.test.ts`
- Create: `benchmarks/pentest/run-suite.mjs`
- Create: `docs/validation/phase-11/METHODOLOGY.md`
- Create: `docs/validation/phase-11/RESULTS.md` only from measured evidence.

**Interfaces:**
- Produces reproducible corpus results and run manifests.

- [ ] **Step 1: Add a purpose-built two-stage fixture**

The fixture must require discovery before a second capability becomes eligible. A fixed scanner sequence should not receive credit for adaptive behavior.

- [ ] **Step 2: Add legal lab harnesses**

Support reproducible local/containerized targets such as OWASP Juice Shop, DVWA, and a ScopeForge test API. Pin versions.

- [ ] **Step 3: Measure required metrics**

Record:

- vulnerability-class recall on the committed corpus
- precision and false-positive rate
- validated-finding rate
- duplicate/correlation rate
- attack-path correctness on labeled fixtures
- reproducibility
- runtime and resource budgets
- cancellation latency
- cleanup success rate
- out-of-scope request count
- secret/log leakage checks
- remediation retest accuracy
- provider failure containment

- [ ] **Step 4: Add catastrophic regression ceilings**

Follow Phase 8 methodology: block severe performance, safety, or accuracy regressions while clearly labeling corpus scope.

- [ ] **Step 5: Commit measured methodology and fixtures**

```bash
git add tests/pentest benchmarks/pentest docs/validation/phase-11
git commit -m "test: add Phase 11 adaptive validation corpus [skip ci]"
```

---

### Task 12: Add web/API stateful discovery subphase

**Files:**
- New design first: `docs/superpowers/specs/<date>-phase-11e-web-api-discovery-design.md`
- Provider package after approval: `packages/provider-web-dast/`
- Add graph node/edge schemas only if Task 1 does not already include route/API operation nodes.

**Required capabilities:**

- `web.route.discover.v1`
- `api.schema.discover.v1`
- `api.operation.observe.v1`
- safe unauthenticated parameter inventory

- [ ] **Step 1: Write a separate threat model and design**

Bound crawl depth, origin scope, redirects, methods, content types, request count, concurrency, body sizes, robots handling policy, and evidence retention.

- [ ] **Step 2: Integrate a reviewed web engine through closed capabilities**

ZAP or equivalent may be wrapped, but generic spider/active-scan configuration must not be exposed to the planner.

- [ ] **Step 3: Prove graph-driven adaptive flow**

A discovered API schema must create operation nodes that unlock operation-specific hypotheses in the next planner iteration.

- [ ] **Step 4: Run legal-lab acceptance**

Require zero requests to origins outside the authorized target set.

- [ ] **Step 5: Commit only after focused security review**

---

### Task 13: Add credential/session authority and browser testing

**Files:**
- New design first: `docs/superpowers/specs/<date>-phase-11f-authenticated-browser-design.md`
- Create after approval: `lib/pentest-sessions/`
- Create after approval: `packages/browser-security-runner/`
- Add forward-only database migration for opaque secret/session references.

**Required capabilities:**

- `browser.login.perform.v1`
- `browser.route.discover.v1`
- `browser.session.compare_roles.v1`
- `api.authorization.compare.v1`

- [ ] **Step 1: Design secret ingestion and short-lived lease model**

Secrets are encrypted, never browser-readable after ingestion, and never included in model prompts, findings, ordinary logs, or evidence payloads.

- [ ] **Step 2: Write failing session-isolation and leak tests**

Test workspace isolation, target binding, identity binding, expiry, revocation, log redaction, screenshot/DOM secret reduction, and cancellation.

- [ ] **Step 3: Implement browser runtime with closed semantic actions**

Reject arbitrary JavaScript, external origins, unrestricted downloads, and unrestricted file uploads.

- [ ] **Step 4: Add cross-identity authorization fixture**

Use two explicitly configured lab identities and verify the planner can schedule a comparison only when both identities are authorized for that test.

- [ ] **Step 5: Complete real-browser containment acceptance before enabling any hosted flag**

---

### Task 14: Add controlled exploit-validation subphase

**Files:**
- New design first: `docs/superpowers/specs/<date>-phase-11g-exploit-validation-design.md`
- New policy rules under `packages/pentest-policy/`
- New execution class only after design and threat-model approval.

**Interfaces:**
- Validation actions require exact finding/hypothesis, exact target, exact proof objective, explicit cleanup contract, and explicit authorization.

- [ ] **Step 1: Define first-party proof-only validators before integrating broad exploit frameworks**

Start with narrow cases where evidence can be generated safely and reproducibly.

- [ ] **Step 2: Add mandatory approval tests**

Non-lab validation must fail closed without approval. Approval expiry or scope drift must reject execution.

- [ ] **Step 3: Implement cleanup-first terminal semantics**

A successful proof that cannot complete mandatory cleanup must be surfaced as an operational incident state, not a normal successful run.

- [ ] **Step 4: Evaluate any future Metasploit/sqlmap/Hydra-style integration separately**

Do not expose general modules, shell sessions, arbitrary payload generation, or unrestricted credential attack features through the Phase 11 planner.

- [ ] **Step 5: Require independent security review and real Linux containment acceptance**

---

### Task 15: Add continuous validation and remediation feedback

**Files:**
- Create or extend trusted scheduling/orchestration services after Phase 10A3 is released.
- Modify existing remediation/retest services rather than creating a second finding lifecycle.
- Add `docs/validation/phase-11/CONTINUOUS_VALIDATION.md`.

**Interfaces:**
- Trigger sources: verified repository updates, deployment/runtime changes, explicit schedules, remediation retest requests.
- Outputs: bounded planner runs tied to fresh authorization and prior graph state.

- [ ] **Step 1: Write failing change-trigger tests**

A repository update should invalidate only evidence tied to changed source state and schedule relevant hypotheses, not blindly repeat every capability.

- [ ] **Step 2: Implement historical comparison**

Track newly introduced, persistent, remediated, recurrent, and untested states separately.

- [ ] **Step 3: Connect remediation verification to Phase 11 observations**

Preserve the existing rule that `verified_fixed` requires fresh authoritative retest evidence.

- [ ] **Step 4: Add run-diff and coverage-diff read models**

Expose what changed and what was not retested.

- [ ] **Step 5: Validate and commit**

---

### Task 16: Expand advanced providers only after the core loop proves value

**Files:**
- Add one provider-specific design/spec per materially different execution boundary.
- Extend `docs/dependencies/security-providers.md`.

**Provider families to evaluate in order:**

1. Prowler for cloud posture
2. Kubescape for Kubernetes posture
3. CodeQL for semantic source analysis
4. TruffleHog for secret detection
5. MobSF for mobile analysis
6. Amass/BBOT for broader attack-surface discovery
7. specialist reverse-engineering providers only when a real ScopeForge workflow requires them

**Do not integrate all repositories from the research list.** Curated knowledge collections, training repositories, payload corpora, red-team frameworks, wireless tools, credential tools, and post-exploitation projects are reference material or future separately reviewed providers, not automatic Phase 11 dependencies.

- [ ] **Step 1: Require a capability gap before adding a provider**

Every new provider must map to a missing capability or materially improve coverage/reliability of an existing one.

- [ ] **Step 2: Require license and supply-chain review**

- [ ] **Step 3: Require adapter contract and containment tests**

- [ ] **Step 4: Measure incremental coverage and runtime cost**

- [ ] **Step 5: Keep providers removable**

No canonical finding identity, graph identity, or planner rule may depend on one provider's proprietary output format.

---

## Release Gates

Phase 11A through 11D may merge progressively if they remain pure or default-off and preserve existing release ordering. Hosted execution must remain disabled until each execution class passes its own acceptance.

Before calling the supported flow `automated pentesting`, require all of these on an exact release candidate:

- stateful graph and observation persistence
- deterministic hypothesis generation
- adaptive evidence-dependent planning across at least two capability families
- deterministic policy enforcement
- bounded iterative execution
- normalized evidence validation and correlation
- explicit coverage reporting
- cancellation and stop conditions
- reproducible run manifest
- successful remediation retest path
- zero out-of-scope requests in the committed acceptance corpus
- zero known secret leakage in browser/log/evidence checks

Before using the stronger `autonomous security validation` positioning, additionally require authenticated/stateful testing, attack-path reasoning, continuous triggers, remediation verification, historical comparison, confidence calibration, broader code/runtime/cloud coverage, and human approval policy for high-risk actions.

## Recommended Execution Order

1. Tasks 1 to 7: pure architecture foundation and deterministic planner.
2. Task 8: persistence after live Phase 10 migration reconciliation.
3. Task 9: trusted run orchestration.
4. Task 11: adaptive evaluation harness before external provider expansion.
5. Task 10: first external provider slice with Nmap, Nuclei, and bounded HTTP discovery.
6. Task 12: web/API discovery.
7. Task 13: credentials, sessions, and browser workflows.
8. Task 14: controlled exploit validation.
9. Task 15: continuous validation.
10. Task 16: advanced provider expansion based on measured capability gaps.

This order intentionally prioritizes the reasoning, evidence, and safety architecture before broad tool integration.

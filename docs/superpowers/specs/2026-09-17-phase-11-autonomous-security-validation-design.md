# Phase 11 Autonomous Security Validation Design

Status: proposed design based on user-approved architecture direction on 2026-09-17
Date: 2026-09-17
Branch baseline: `1b23dc8e5aa4c130d7ff6174cbf9444879b88bae`

## Goal

Evolve ScopeForge from deterministic scanning plus bounded validation into a stateful automated pentesting and autonomous security validation platform without weakening the existing authorization, evidence, worker-isolation, network-safety, and retest boundaries.

The target product loop becomes:

```text
Authorize
  -> Discover
  -> Build asset graph
  -> Observe
  -> Generate hypotheses
  -> Plan
  -> Policy gate
  -> Execute capabilities
  -> Validate evidence
  -> Correlate and deduplicate
  -> Update attack graph
  -> Re-plan until coverage or stop condition
  -> Explain
  -> Remediate
  -> Retest
```

The central architectural rule is that ScopeForge owns reasoning, safety, evidence, and lifecycle state. External security tools are capability providers underneath ScopeForge. ScopeForge must not become a shell script that chains scanners.

## Why this phase exists

ScopeForge already contains strong foundations:

- workspace and asset authorization
- proof-of-control and canonical targets
- pure network-safety policy
- runtime observation and bounded active validation
- normalized findings, evidence, provenance, and lifecycle state
- deterministic retest semantics
- repository snapshot acquisition and isolated worker execution
- provider-neutral security-domain contracts
- strict browser and database authority boundaries
- benchmark and release evidence

The current architecture deliberately excludes generalized crawling, authenticated testing, browser automation, stateful multi-step testing, fuzzing, exploit probes, and autonomous attack-path reasoning. Those exclusions are appropriate for the current release but prevent ScopeForge from truthfully positioning itself as a broad automated pentesting system.

Phase 11 adds the missing reasoning and orchestration layer while preserving the current trust model.

## Current release ordering

Phase 11 must not destabilize active Phase 10 work.

At the baseline used for this design:

- Phase 10A2 private repository acquisition is still unreleased
- Phase 10A3 continuous GitHub scanning is stacked after 10A2
- hosted runtime and scan capability flags remain separately gated

Implementation of Phase 11 should therefore follow these rules:

1. Design and pure domain work may proceed independently.
2. No Phase 11 production migration may be applied while it would conflict with unreleased 10A2 or 10A3 schema work.
3. Runtime-enabled Phase 11 work should be based on the released post-10A3 `main`, unless an isolated pure-library task has no dependency on those branches.
4. Every new execution class remains default-off until separate operational acceptance.
5. No Phase 11 feature may widen an existing worker class in place when a new authority boundary is required.

## Product positioning threshold

### Automated security testing

ScopeForge may use this label when it runs deterministic or policy-selected scanners and validators against authorized assets and normalizes their results.

### Automated pentesting

ScopeForge should use this label only after all of the following are implemented and validated:

- stateful asset and attack graph
- hypothesis generation from observed evidence
- adaptive action selection based on preconditions and prior results
- authenticated and unauthenticated web/API coverage
- multi-step testing with bounded session state
- safe validation that distinguishes suspected from confirmed findings
- evidence-backed correlation across multiple tools and observations
- explicit coverage and stop conditions
- reproducible run manifests
- deterministic scope and authorization enforcement

### Autonomous security validation

Use this stronger positioning only after automated pentesting plus:

- continuous code, cloud, runtime, and deployment signal ingestion
- attack-path reasoning across related assets
- historical confidence calibration
- automated remediation retest scheduling
- reliable rollback and cleanup semantics
- policy-governed human approval for high-risk actions
- measurable longitudinal coverage and false-positive performance

## Core architectural principle

The planner requests capabilities, not executables.

Bad abstraction:

```text
run nmap
run nuclei
run zap
```

Required abstraction:

```text
network.port.discover
web.endpoint.discover
web.known-vulnerability.validate
api.schema.discover
source.semantic.analyse
cloud.aws.posture
mobile.static.analyse
```

A capability can have one or more providers:

```text
network.port.discover
  providers:
    - native
    - nmap
    - rustscan
```

The planner only reasons about capability descriptors, preconditions, effects, expected evidence, risk class, and cost. Provider selection is delegated to the capability router.

## Phase 11 execution modes

Every action belongs to exactly one execution mode.

### Passive

Examples:

- repository analysis
- certificate and DNS intelligence
- public metadata
- passive HTTP observation
- cloud inventory from explicitly connected read-only accounts

No target state mutation is allowed.

### Safe active

Examples:

- bounded HTTP probing
- endpoint discovery under rate and depth limits
- API schema retrieval from authorized targets
- safe vulnerability templates
- protocol and service fingerprinting

Safe-active actions must be designed not to intentionally change target state.

### Intrusive

Examples:

- parameter mutation
- bounded fuzzing
- authenticated authorization testing
- controlled workflow manipulation
- higher-volume directory or API exploration

Intrusive mode requires explicit owner/admin consent, a fresh authorization snapshot, strict budgets, and stronger observability.

### Validation

Examples:

- controlled exploitability confirmation
- bounded state-changing proof of impact
- cross-identity authorization validation
- destructive-risk checks where a safe equivalent does not exist

Validation is separately authorized from discovery. High-impact actions require human approval unless the target is an explicitly configured lab workspace.

Credential attacks, denial-of-service behavior, persistence, destructive payloads, lateral movement outside declared scope, and unrestricted command execution remain excluded unless a future separately reviewed design explicitly adds a tightly bounded research mode.

## New domain model

Phase 11 adds a provider-neutral domain package rather than embedding planner state inside UI or worker code.

Recommended package boundary:

`packages/security-planning`

It may depend on stable security-domain contracts but must not depend on Next.js, Supabase clients, provider SDKs, browser code, or concrete scanner implementations.

### AssetNode

Represents a known security-relevant entity.

Minimum fields:

- stable asset node ID
- workspace ID reference at persistence boundary
- asset type
- canonical locator or provider identity
- parent and ownership relationships
- authorization state reference
- observed technologies and services
- confidence and provenance references

Example types:

- repository
- domain
- hostname
- IP endpoint
- HTTP service
- API
- API operation
- cloud account
- cloud resource
- container image
- Kubernetes workload
- mobile application
- identity or test principal

### Observation

Immutable normalized evidence emitted by a capability provider.

Minimum fields:

- observation ID
- run ID
- provider and provider version
- capability ID
- asset node IDs
- evidence references
- normalized facts
- timestamp
- confidence
- authorization snapshot reference
- execution-mode reference

### Hypothesis

A testable security proposition.

Minimum fields:

- hypothesis ID
- rule or reasoning source
- target asset nodes
- statement
- preconditions
- candidate capabilities
- expected evidence
- base confidence
- current confidence
- status

Statuses:

- proposed
- eligible
- blocked
- testing
- supported
- refuted
- exhausted

### CapabilityDescriptor

Provider-neutral action contract.

Minimum fields:

- stable capability ID
- semantic version
- supported asset types
- required observations or preconditions
- execution mode
- expected effects
- evidence schema
- maximum request budget
- maximum runtime
- state mutation class
- credential/session requirements
- cleanup requirements
- provider compatibility list

### ActionIntent

Planner output before authority is granted.

It contains:

- selected hypothesis
- requested capability
- target nodes
- bounded parameters from a closed schema
- risk class
- cost estimate
- expected evidence
- requested credential/session class

It never contains unrestricted shell commands, arbitrary URLs, arbitrary headers, arbitrary payload files, or provider-native command strings.

### ActionAuthorization

Trusted policy output that converts an ActionIntent into an executable bounded action.

It binds:

- exact workspace
- exact asset nodes
- exact authorization snapshot
- exact capability and version
- exact execution mode
- exact budgets
- exact credential/session handle class
- expiry
- cancellation semantics

### ActionResult

Normalized terminal state from a provider adapter.

Statuses:

- succeeded
- no_signal
- blocked
- cancelled
- timed_out
- provider_failed
- policy_rejected

ActionResult never directly promotes a finding to confirmed. Evidence validation owns that transition.

### AttackEdge

Represents a supported relationship in the attack graph.

Examples:

- exposes
- depends_on
- authenticates_to
- trusts
- deploys_to
- contains
- reachable_from
- affected_by
- enables

Each edge has provenance, confidence, freshness, and authorization scope.

## Stateful planner loop

The planner is deterministic-first and model-optional.

A run follows:

```text
1. Load authorized asset graph and immutable run policy.
2. Ingest observations from existing scanners and runtime sources.
3. Generate hypotheses from deterministic rules.
4. Optionally ask an advisory model for additional candidate hypotheses.
5. Normalize and deduplicate hypotheses.
6. Evaluate preconditions.
7. Score eligible actions.
8. Submit ActionIntent to the trusted policy engine.
9. Execute only policy-approved actions through the capability router.
10. Validate returned evidence.
11. Update observations, graph edges, findings, and hypothesis confidence.
12. Recompute eligible actions.
13. Stop when coverage, budget, risk, policy, cancellation, or exhaustion conditions are met.
14. Persist a reproducible run manifest and final coverage report.
```

Model output remains advisory. It may propose hypotheses or explain reasoning, but it cannot grant authorization, construct unrestricted executable commands, change evidence, confirm a vulnerability, or bypass deterministic policy.

## Action scoring

V1 should use an explainable score rather than opaque model ranking.

Suggested factors:

```text
score =
  information_gain
  * hypothesis_confidence
  * expected_validation_value
  * provider_reliability
  / normalized_cost
  * policy_weight
```

Hard policy rejection always overrides score.

The planner should prefer actions that:

- validate high-impact hypotheses
- unlock multiple downstream hypotheses
- reduce uncertainty
- reuse already authorized sessions
- have strong provider reliability
- are cheaper and safer than equivalent alternatives

## Coverage model and stop conditions

A pentest run must report what it did not test.

Coverage dimensions include:

- discovered asset classes
- reachable service classes
- web route coverage
- API operation coverage
- authenticated role coverage
- vulnerability class coverage
- code/supply-chain coverage
- cloud/Kubernetes/container coverage
- provider failures and blocked actions

Stop conditions include:

- user cancellation
- run deadline
- request budget
- per-target rate budget
- maximum graph expansion
- no eligible hypotheses
- required approval not granted
- authorization expiry
- provider failure threshold
- safety circuit breaker
- configured coverage target reached

## Credential and session architecture

Credentials and browser sessions must not be stored in planner state.

Use opaque handles managed by a dedicated trusted session authority.

Recommended separation:

```text
planner
  -> requests session class
  -> policy authorizes use
  -> session broker resolves opaque handle
  -> execution worker receives only the minimum short-lived material
  -> result returns normalized evidence
```

Session classes may include:

- anonymous
- API token test principal
- browser test principal
- low-privilege role
- high-privilege role

Secrets remain server-side, encrypted at rest, excluded from browser-readable tables, logs, evidence payloads, model prompts, and normalized findings.

## Browser runtime

Browser-driven testing should be introduced as a new execution authority rather than attached to the existing bounded HTTP validator.

The browser runtime must provide:

- exact authorized origin allowlist
- navigation interception
- DNS/IP safety checks
- request and response redaction
- storage isolation per run
- bounded cookies and local storage
- screenshot and DOM evidence with secret reduction
- deterministic timeout and cancellation
- download and file-upload policy
- pop-up and external-origin rejection
- per-action network budget

The planner should request semantic browser capabilities such as:

- `browser.login.perform`
- `browser.route.discover`
- `browser.form.submit_safe`
- `browser.session.compare_roles`

It should not submit arbitrary JavaScript for execution.

## Evidence validation

Findings remain evidence-first.

A finding may be:

- suspected
- observed
- validated
- confirmed

Promotion requires explicit evidence rules.

Examples:

- one heuristic scanner match may produce suspected
- deterministic response behavior may produce observed
- an independent safe validation may produce validated
- a bounded proof of security impact may produce confirmed

Every validated or confirmed finding must preserve:

- capability and provider identity
- provider version
- immutable action authorization reference
- target identity
- normalized request description
- normalized response or execution evidence
- timestamps
- evidence digest
- run ID
- reproducibility metadata

## Capability provider strategy

Do not copy large external projects into ScopeForge.

Use three integration classes.

### Native

Build natively when the capability is central to ScopeForge safety or reasoning.

Native responsibilities:

- authorization and scope enforcement
- asset graph
- attack graph
- hypothesis engine
- planner
- policy engine
- evidence normalization
- confidence and lifecycle rules
- deduplication and correlation
- session authority
- run manifests
- cleanup orchestration
- retest logic

### Adapter or subprocess/API wrapper

Use an adapter when a mature project already implements a specialized engine.

Initial high-value candidates, subject to individual license and sandbox review:

- Nmap or RustScan for network and service discovery
- Nuclei for template-based checks
- ZAP for web/API DAST capabilities
- sqlmap for narrowly authorized SQL injection validation
- Subfinder, httpx, Amass, or BBOT for recon and asset discovery
- MobSF for mobile static and dynamic analysis
- Prowler for cloud posture
- Kubescape for Kubernetes posture
- CodeQL for semantic source analysis
- TruffleHog for secret detection

Each adapter must emit ScopeForge-normalized observations and must not expose provider-native unrestricted flags to end users or the planner.

### Knowledge or data source

Consume curated data without importing execution authority.

Useful sources include:

- Nuclei templates
- SecLists
- PayloadsAllTheThings
- OWASP Cheat Sheet Series
- OWASP MASTG
- GTFOBins reference data
- HackTricks and other reviewed knowledge sources

Knowledge ingestion must track source version, license, provenance, and update mechanism. Knowledge text must not become executable instructions without a reviewed capability implementation.

## External tool licensing rule

Every adapter or data source requires a dependency review before inclusion.

The review records:

- repository and exact release/tag
- license and redistribution terms
- whether ScopeForge links, embeds, copies, invokes, or downloads it
- whether templates/data have a separate license
- commercial-use constraints if any
- attribution requirements
- update and integrity-verification strategy

Default preference:

1. Native implementation for ScopeForge trust boundaries.
2. CLI/API/subprocess adapter for mature specialized engines.
3. Versioned data consumption for knowledge/templates.
4. Copy external source code only when the license, maintenance burden, and security review clearly justify it.

GPL/AGPL and other copyleft dependencies require explicit legal/architecture review before code reuse or distribution decisions. The design must not assume that subprocess separation automatically resolves every licensing question.

## Capability router

Recommended provider API:

```ts
interface CapabilityProvider {
  readonly providerId: string;
  readonly version: string;
  supports(capabilityId: string): boolean;
  prepare(input: AuthorizedCapabilityInput): Promise<PreparedExecution>;
  execute(prepared: PreparedExecution, signal: AbortSignal): Promise<ProviderResult>;
  normalize(result: ProviderResult): Promise<ActionResult>;
  cleanup(context: CleanupContext): Promise<CleanupResult>;
}
```

Provider-specific flags remain internal to adapters.

The router selects a provider using:

- capability support
- execution-mode compatibility
- platform/runtime availability
- provider health
- historical reliability
- licensing/configuration availability
- run policy

## Safety policy engine

The policy engine remains separate from the planner.

It evaluates:

- workspace role
- target proof-of-control
- authorization freshness
- target scope
- execution mode
- capability risk class
- credential/session class
- request/rate budgets
- data handling rules
- time window
- approval state
- worker class availability

The planner cannot override policy.

A model cannot override policy.

A provider cannot widen policy.

## Worker isolation

Each high-level authority remains an independent execution class.

Recommended classes over the Phase 11 program:

- `planner_no_egress_v1`
- `recon_network_bounded_v1`
- `web_safe_active_v1`
- `browser_authorized_v1`
- `authenticated_api_test_v1`
- `validation_bounded_v1`

The names are design-level placeholders for reviewed execution contracts, not permission to create generic shell workers.

No worker receives broad cross-provider credentials. Network-enabled workers receive only exact target and policy material required for an authorized action.

## Data persistence

Recommended new hosted records:

- `security_runs`
- `security_run_policies`
- `asset_graph_nodes`
- `asset_graph_edges`
- `security_observations`
- `security_hypotheses`
- `security_action_intents`
- `security_action_authorizations`
- `security_action_results`
- `security_run_coverage`
- `security_run_manifests`

Persisted planner state should be append-oriented where practical so decisions can be audited and replayed.

Do not store raw credentials, unrestricted response bodies, provider command lines containing secrets, or arbitrary model context in these tables.

## Correlation and deduplication

Correlation must happen above individual scanners.

A correlation engine should combine:

- asset identity
- endpoint identity
- vulnerability taxonomy
- source location
- normalized parameter/path
- evidence similarity
- attack-graph relationships
- temporal recurrence

Multiple provider observations may support one canonical finding.

A provider disagreement should remain visible in evidence instead of silently choosing one provider as authoritative.

## Phase decomposition

Phase 11 is too large for one implementation PR. It should be delivered as independently reviewable subphases.

### Phase 11A - planning domain and graph foundation

Build:

- provider-neutral asset graph contracts
- observation contracts
- hypothesis contracts
- capability descriptors
- ActionIntent and ActionAuthorization contracts
- deterministic hypothesis rules
- deterministic planner scoring
- run coverage model
- reproducible run-manifest format

No new network authority.

This is the first implementation target.

### Phase 11B - capability registry and adapter framework

Build:

- provider registry
- health and version reporting
- adapter lifecycle
- provider result normalization
- cleanup contract
- licensing metadata registry
- first low-risk adapters

Recommended first adapters:

- existing ScopeForge Phase 3 scanner
- existing passive runtime observer
- existing bounded active validator
- Nuclei in safe-active mode behind default-off worker execution

### Phase 11C - recon and attack-surface graph expansion

Build:

- network/service discovery capability
- DNS/subdomain discovery
- HTTP service classification
- endpoint and API schema discovery
- graph expansion budgets
- correlation between repository, deployment, hostname, and service nodes

### Phase 11D - authenticated API and browser sessions

Build:

- encrypted credential/session authority
- test-principal model
- browser execution class
- API token sessions
- role-comparison primitives
- stateful multi-step workflows
- DOM/request evidence normalization

### Phase 11E - adaptive web/API pentesting

Build:

- hypothesis rules for common web/API classes
- precondition/effect modeling
- safe parameter mutation
- authorization/BOLA role comparison
- state-aware action branching
- independent validation rules
- provider fallback and disagreement handling

At completion of the accepted Phase 11E benchmark, ScopeForge may be positioned as an automated pentesting platform for the supported target classes.

### Phase 11F - bounded exploit validation

Build only after 11E safety and evidence acceptance:

- separately authorized validation actions
- explicit impact classes
- approval workflow
- state-change ledger
- cleanup and rollback hooks
- safe proof-of-impact templates

No unrestricted Metasploit session, arbitrary payload execution, persistence, or post-exploitation shell is introduced by default.

### Phase 11G - autonomous security validation

Build:

- continuous run scheduling from code/deployment/runtime changes
- historical confidence calibration
- attack-path prioritization
- remediation-aware retest planning
- longitudinal coverage analytics
- planner quality metrics
- human approval queue for high-risk actions

## First implementation plan scope

The first detailed implementation plan should cover Phase 11A only.

Reason:

- it creates useful software without widening network authority
- it gives later adapters stable contracts
- it can be tested offline
- it preserves current Phase 10 release work
- it prevents tool integrations from defining the architecture accidentally

Phase 11B and later should receive separate design/implementation plans after 11A contracts are accepted.

## Evaluation environment

Initial validation uses intentionally vulnerable and locally controlled targets.

Recommended corpus:

- OWASP Juice Shop
- DVWA
- WebGoat
- intentionally vulnerable API labs
- ScopeForge-owned synthetic services with known expected findings
- mobile test applications for MobSF integration later
- local container/Kubernetes fixtures

External third-party targets are never used for release benchmarks without explicit authorization.

## Measurable release gates

### Safety

- 100 percent of out-of-scope action attempts rejected in the authorization corpus
- zero provider invocation after authorization expiry
- zero unapproved validation-mode action in non-lab workspaces
- cancellation terminates underlying execution and cleanup within defined per-class deadlines
- no raw secret appears in normalized evidence, logs, browser payloads, or model prompts in the secret-leak corpus

### Reproducibility

Under fixed inputs, tool versions, policy, and random seed:

- at least 99 percent identical normalized action graph across repeated benchmark runs
- 100 percent of validated/confirmed findings include reproducibility metadata and immutable evidence references

### Precision

For the supported benchmark corpus:

- confirmed-finding false-positive rate no greater than 5 percent
- suspected findings are reported separately and do not count as confirmed
- independent validation result disagreement is preserved, not hidden

### Validation effectiveness

For supported known-positive benchmark cases:

- at least 90 percent successful confirmation when required preconditions are available
- failures classified as policy-blocked, provider-failed, unsupported, or refuted rather than silently omitted

### Retest

- at least 95 percent correct fixed/still-present classification on the reviewed remediation corpus
- no finding becomes `verified_fixed` solely because a later scan omitted it

### Coverage

Every completed pentest run reports:

- tested capability classes
- untested capability classes
- blocked actions
- provider failures
- role/session coverage
- endpoint/API coverage where measurable
- remaining eligible hypotheses at termination

### Runtime and resilience

- hard run and per-action deadlines enforced
- provider failure does not corrupt canonical run state
- planner resumes safely after process restart using persisted state
- cleanup is idempotent

## Testing strategy

Phase 11 uses TDD for domain and execution behavior.

Required layers:

1. Pure unit tests for graph, hypothesis, planner, scoring, policy contracts, deduplication, and coverage.
2. Property tests for graph identity, deterministic ordering, budget monotonicity, and scope constraints.
3. Adapter contract tests using recorded/synthetic provider outputs.
4. Hostile-input tests for malformed provider data and untrusted target content.
5. Integration tests with local intentionally vulnerable services.
6. Real Linux containment tests for every new worker class before enablement.
7. Golden run-manifest tests for reproducibility.
8. Red-team tests against prompt injection and malicious content attempting to influence advisory models.

## UI implications

The UI should expose the reasoning process without pretending model output is proof.

Recommended run view:

```text
Scope
  -> Assets
  -> Observations
  -> Hypotheses
  -> Planned actions
  -> Executed actions
  -> Evidence
  -> Findings
  -> Coverage gaps
  -> Retest
```

Users should be able to answer:

- What did ScopeForge test?
- Why did it test that?
- What evidence supports the result?
- What did it refuse or skip?
- What remains untested?
- Which action requires approval?

## Non-goals for Phase 11A

Phase 11A does not add:

- generalized crawling
- browser automation
- authenticated target credentials
- exploit payload execution
- unrestricted shell commands
- Metasploit sessions
- arbitrary fuzzing
- brute-force credential attacks
- denial-of-service testing
- lateral movement
- persistence
- automatic remediation

Those capabilities, where appropriate at all, require later separately approved designs.

## Documentation updates during implementation

Each subphase must update as appropriate:

- `docs/ARCHITECTURE.md`
- `docs/PHASES.md`
- `docs/AUTHORIZATION.md`
- `docs/OBSERVABILITY.md`
- `docs/DEPENDENCY_POLICY.md`
- `docs/development/CURRENT_STATE.md`
- `docs/development/NEXT_STEPS.md`
- `docs/development/LATEST_SESSION.md`
- `docs/development/SESSION_HANDOFF.md`

Operational state documents must describe reality, not planned capability.

## Recommended decision

Proceed with the layered planner architecture and start implementation with Phase 11A only.

Do not start by integrating every repository from the research list. The highest-value sequence is:

```text
ScopeForge-native planning contracts
  -> existing ScopeForge capabilities as providers
  -> safe adapter framework
  -> recon providers
  -> authenticated browser/API testing
  -> adaptive pentesting
  -> bounded exploit validation
  -> continuous autonomous validation
```

This sequence preserves ScopeForge's strongest differentiator: deterministic authorization and evidence boundaries around increasingly capable security automation.

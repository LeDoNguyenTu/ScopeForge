# Phase 4A Security Domain Contracts Design

Date: 2026-08-24
Status: Approved architecture, implementation not started

## 1. Purpose

Phase 4A establishes the stable security-domain contracts that later ScopeForge subsystems will share before active runtime scanning or AI-assisted workflows are introduced.

The goal is not to add another scanner. The goal is to prevent the growing system from coupling passive scanners, runtime scanners, hosted findings, risk intelligence, remediation, UI code, workers, and future AI providers directly to each other.

Phase 4A makes later integrations achievable without requiring a rewrite of the Phase 3 scanner foundation.

The design is result-first:

- human developers must be able to understand, test, maintain, and extend the codebase without model assistance
- deterministic scanners remain authoritative for observed scanner evidence
- future AI assistance is optional, provider-neutral, removable, and downstream of normalized security facts
- future runtime scanning can reuse the same security-domain model without depending on the CLI or passive scanner implementation details
- infrastructure details stay at the edges of the system
- module boundaries should remain small enough to understand independently

## 2. Problem statement

Phase 3 correctly separates passive scanner responsibilities:

```text
scanner-core <- detector packages <- CLI composition
      ^
      |
scanner-output reads normalized core results
```

That architecture should remain unchanged for repository scanning.

The next product capabilities introduce additional sources and consumers of security information:

- verified HTTP and API observations
- bounded active runtime validation
- hosted finding lifecycle
- evidence storage
- retesting
- Security Stories and risk relationships
- Explain Mode and Prepare Mode
- future optional AI assistance
- APIs, workers, and UI consumers

If those capabilities import scanner-specific types directly, use database rows as business-domain objects, or allow model-provider SDK types into core logic, ScopeForge will become difficult to maintain and expensive to evolve.

Phase 4A therefore introduces a neutral domain boundary above individual scanners.

## 3. Architecture decision

ScopeForge will use a layered architecture with dependency direction toward stable domain contracts.

```text
Adapters and delivery
UI / CLI / API / Worker / AI provider adapters
                    |
                    v
Application services and orchestration
                    |
                    v
Security domain contracts
                    ^
                    |
          source adapters / mappers
                    ^
                    |
Passive scanners    Runtime scanners    User-confirmed facts
```

The security-domain layer does not know about:

- Next.js
- React
- Supabase
- PostgreSQL
- Vercel
- Cloudflare
- GitHub Actions
- CLI argument parsing
- a particular scanner package
- OpenAI, Anthropic, Gemini, Ollama, or any other model SDK
- HTTP worker implementation details

The application layer may coordinate domain operations but must depend on interfaces rather than concrete infrastructure clients.

Infrastructure adapters implement ports owned by the application/domain side.

## 4. Phase naming and roadmap resolution

An older platform design described Phase 4 as Risk Intelligence while the current roadmap describes Phase 4 as Verified Runtime and API Security.

Both directions remain valid, but they share foundational contracts.

The roadmap is resolved as follows:

### Phase 4A - Security domain and extension contracts

Establish neutral findings, evidence, provenance, validation, relationship, remediation, advisory, and source-adapter contracts.

No active remote scanner and no AI runtime is introduced in Phase 4A.

### Phase 4B - Verified passive runtime and API security

Add safe observations against verified assets, such as HTTP security posture, TLS posture, cookies, selected metadata, and endpoint inventory, behind authorization and network safety boundaries.

### Phase 4C - Bounded active runtime validation

Add carefully selected non-destructive active checks only after worker isolation, authorization, DNS/IP/redirect/egress controls, quotas, cancellation, and auditability are enforced.

### Later risk-intelligence work

Security Stories, Explain Mode, Prepare Mode, prioritization, and optional AI assistance consume the same Phase 4A contracts instead of inventing parallel data models.

This sequence preserves both roadmap goals without forcing one subsystem to own the other.

## 5. Non-goals

Phase 4A does not implement:

- remote DAST
- crawling
- API fuzzing
- exploit validation
- credential attacks
- authenticated testing
- hosted scanner workers
- queue infrastructure
- R2 artifact upload
- production finding persistence
- Security Story generation
- automated prioritization
- AI model calls
- provider SDK integration
- prompt templates
- embeddings or vector databases
- autonomous remediation
- arbitrary executable plugins

Those capabilities may use the contracts created here later.

## 6. Package boundaries

Phase 4A should introduce a small framework-independent package rather than expand `scanner-core` into a general application domain package.

Recommended package:

```text
packages/security-domain/
  findings/
  evidence/
  provenance/
  validation/
  relationships/
  remediation/
  advisory/
  sources/
  common/
  index.ts
```

`scanner-core` remains focused on passive scanner execution concerns such as inventory, safe reads, scanning coordination, scan policy, baselines, and scanner result serialization inputs.

`security-domain` owns cross-product security concepts that may originate from passive scanners, runtime scanners, users, imported tools, or future integrations.

This prevents `scanner-core` from becoming a catch-all package.

## 7. Dependency rules

The following rules are architectural invariants.

### 7.1 Security domain

`packages/security-domain`:

- may depend only on standard library utilities or narrowly justified pure utility packages
- must not depend on scanner packages
- must not depend on CLI, UI, database, HTTP, worker, or AI packages
- must not perform network or filesystem I/O
- must not read environment variables
- must not own process exit behavior
- must expose data contracts and pure domain helpers only

### 7.2 Scanner source adapter

A scanner-to-domain adapter may depend on:

- `scanner-core`
- the relevant detector output contract
- `security-domain`

The domain package must never depend back on that adapter.

### 7.3 Application services

Application services may depend on domain interfaces and source adapters. They should orchestrate use cases such as ingesting normalized findings, applying lifecycle transitions, preparing advisory context, or requesting a runtime validation job.

They must not embed provider-specific infrastructure logic.

### 7.4 Infrastructure

Database repositories, HTTP clients, queues, artifact stores, and future AI provider clients implement application-facing ports.

Provider-specific SDK types must stop at the adapter boundary.

### 7.5 UI and CLI

UI and CLI code consume application/domain view models. Business rules must not be duplicated inside React components or argument handlers.

## 8. Core identifiers and versioning

Cross-product security records need stable opaque identifiers that do not encode infrastructure details.

Phase 4A contracts should define branded or strongly named string types for concepts such as:

- `SecurityFindingId`
- `EvidenceId`
- `AssetRef`
- `ScanRunRef`
- `RuleRef`
- `RelationshipId`
- `AdvisoryRecordId`

The in-memory contracts must not require database UUID generation directly. Persistence adapters may map opaque identifiers to UUID columns later.

Every externally serialized cross-product contract should have an explicit schema or contract version before it is used as a durable artifact or API payload.

## 9. Finding contract

The Phase 3 `Finding` remains the scanner-native result used during local scans.

Phase 4A adds a product-level security finding contract rather than replacing the scanner contract.

A product-level finding should represent a normalized security issue independent of its source.

Conceptual shape:

```ts
type SecurityFinding = {
  id: SecurityFindingId;
  source: FindingSourceRef;
  rule: RuleRef;
  title: string;
  description: string;
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  validation: ValidationState;
  provenance: ProvenanceRecord;
  evidenceRefs: EvidenceId[];
  assetRef?: AssetRef;
  location?: SecurityLocation;
  taxonomy: TaxonomyReferences;
  lifecycle: FindingLifecycleState;
  remediation?: RemediationSummary;
};
```

The exact implementation may refine field names, but these semantic boundaries must remain.

Scanner-specific arbitrary metadata must not be copied into the product domain without an explicit typed field or source-specific extension boundary.

## 10. Finding sources

Every product-level finding must identify how it was produced.

The source model should support at least:

- deterministic passive scanner
- deterministic runtime scanner
- imported external scanner
- user-confirmed security fact
- future advisory inference

Source information must be separate from validation and provenance.

A finding being produced by a scanner does not automatically mean exploitation was validated.

## 11. Evidence model

Evidence is first-class and distinct from findings.

A finding states a security conclusion. Evidence records what was actually observed.

Evidence must have a typed kind and safe payload contract. Initial kinds should be small and extensible, for example:

- repository location evidence
- normalized static-analysis evidence
- dependency evidence
- HTTP observation evidence
- TLS observation evidence
- user-confirmed evidence
- artifact reference evidence

Evidence records should support:

- source provenance
- collection timestamp where applicable
- safe display summary
- optional private artifact reference
- content classification
- redaction state

Raw secrets must never be stored inside generic evidence payloads.

Large binary or sensitive evidence should be represented by an opaque artifact reference rather than embedded into product records.

## 12. Provenance model

Observed facts and inferred conclusions must never be conflated.

Phase 4A defines explicit provenance categories:

```text
observed
scanner-derived
user-confirmed
inferred
```

`observed` means directly captured evidence such as an HTTP response property or repository construct.

`scanner-derived` means a deterministic conclusion produced by a defined scanner rule from observed input.

`user-confirmed` means a human explicitly confirmed the fact.

`inferred` means the statement is a reasoned conclusion rather than directly observed evidence.

Any future AI-produced explanation, correlation, relationship, or prioritization suggestion must use inferred provenance unless a human or deterministic validator independently confirms it.

## 13. Validation state

Validation describes how strongly the security condition has been verified, not who produced it.

Recommended initial states:

```text
unvalidated
static_confirmed
runtime_observed
runtime_validated
user_confirmed
```

A future active validator may promote a finding from `static_confirmed` to `runtime_validated` when safe validation evidence supports it.

The state transition must be explicit and auditable. An advisory model cannot promote validation state by itself.

## 14. Confidence

Confidence remains separate from severity and validation.

A high-severity issue may have medium confidence. A runtime-observed issue may still require additional validation to prove exploitability.

Phase 4A should reuse or map the existing Phase 3 confidence vocabulary rather than introducing incompatible labels without need.

## 15. Risk relationship model

Risk relationships connect security entities without claiming that every edge is observed.

Initial relationship types may include:

- `exposes`
- `reaches`
- `depends_on`
- `authenticates_to`
- `can_lead_to`
- `affects`
- `mitigated_by`

Each relationship must contain its own provenance and confidence.

This allows a future Security Story to mix observed and inferred edges while the UI can clearly distinguish them.

A relationship should reference typed entity references instead of embedding arbitrary source objects.

## 16. Remediation model

Remediation guidance should be structured enough to support multiple consumers but remain human-readable without AI.

Phase 4A should distinguish:

- remediation summary
- recommended actions
- verification guidance
- references

Future model-generated suggestions may add advisory recommendations, but deterministic rule remediation and model suggestions must remain distinguishable.

No model-generated remediation should overwrite first-party rule guidance silently.

## 17. Advisory boundary for future AI

Phase 4A introduces only provider-neutral advisory contracts. It does not integrate a model.

Recommended conceptual port:

```ts
interface AdvisoryService {
  analyze(request: AdvisoryRequest): Promise<AdvisoryResult>;
}
```

The contract must describe security-domain inputs and outputs rather than prompt text or provider messages.

Possible future request purposes:

- explain a finding
- correlate related findings
- draft a Security Story
- propose remediation clarification
- suggest authorized follow-up checks for human review
- assist rule authors with test ideas

Possible future result kinds:

- explanation
- inference
- relationship suggestion
- remediation suggestion
- follow-up-check suggestion

Every result must be marked advisory and carry inferred provenance unless independently confirmed.

## 18. AI provider adapters

Future providers should be implemented behind separate adapters, for example:

```text
packages/advisory-core/          optional application-facing orchestration
packages/advisory-provider-local/
packages/advisory-provider-openai/
packages/advisory-provider-anthropic/
packages/advisory-provider-gemini/
```

These names are illustrative, not Phase 4A implementation requirements.

A provider adapter may translate `AdvisoryRequest` into provider-specific messages and translate provider output back into `AdvisoryResult`.

No provider-specific message, tool, token, model, or SDK type may appear in `security-domain`.

The system must be able to run with no advisory provider installed or enabled.

## 19. AI privacy boundary

Future AI assistance must not receive arbitrary repository or security data by default.

A dedicated context-assembly boundary must decide what may leave the product domain.

Conceptual flow:

```text
Security domain records
       |
       v
Advisory context policy
       |
       +--> allowlisted fields
       +--> redaction
       +--> size/token budget
       +--> sensitivity classification
       +--> local-only restrictions
       |
       v
Advisory provider adapter
```

Provider adapters must not independently crawl repositories, read arbitrary files, query databases, or collect extra context.

Remote providers require explicit privacy controls and user opt-in for sensitive content.

Local model providers should remain possible so sensitive repositories can stay on-device.

Raw detected secrets are never valid advisory context.

## 20. AI authority boundary

Future AI output has no direct scanner or network authority.

A model may suggest a follow-up check, but the suggestion must pass through normal application authorization and safety policy before any scanner executes it.

AI must not be able to:

- expand asset scope
- bypass proof of control
- change egress policy
- increase request budgets
- disable scanner safety limits
- execute credential attacks
- create persistence
- trigger destructive validation
- alter confirmed evidence silently

This keeps model compromise, prompt injection, hallucination, or provider failure from becoming scanner authority.

## 21. Human-first behavior

All important product functions must work without AI.

The following must remain deterministic or human-operable:

- scanning
- finding creation
- evidence display
- policy enforcement
- baselines
- severity and validation state
- finding lifecycle
- remediation supplied by first-party rules
- reports
- retesting
- audit records

AI may improve explanation, correlation, prioritization suggestions, or authoring assistance, but it must never become a hidden prerequisite for normal operation.

## 22. Application service boundaries

Phase 4A should define narrow use-case-oriented services rather than one large security manager class.

Likely future service responsibilities include:

- map source finding to domain finding
- register evidence
- transition finding lifecycle
- validate allowed validation-state transition
- create relationship proposal
- accept/reject inferred relationship
- build advisory-safe context

Each service should have one primary reason to change.

Persistence, queueing, network, and provider implementations belong behind ports.

## 23. Source mapping

Phase 3 findings should enter the product domain through an explicit mapper.

Example boundary:

```text
scanner-core Finding
       |
       v
Phase3FindingMapper
       |
       v
SecurityFinding + Evidence records
```

The mapper is responsible for semantic translation and must be fully deterministic.

It must not:

- rerun scanners
- read repository files
- call a network service
- invent validation evidence
- copy secret values
- expose arbitrary scanner metadata

This creates a reusable integration path for a future hosted scanner ingestion service without coupling the domain to CLI output JSON.

## 24. Runtime scanner integration

Future runtime scanners should produce source-specific observations and then map them into the same domain.

```text
Runtime observation
      |
      v
RuntimeFindingMapper
      |
      v
SecurityFinding + Evidence records
```

Passive and runtime scanner implementations therefore remain independent while consumers share the product-level contracts.

## 25. Persistence boundary

Phase 4A contracts are in-memory domain contracts. They are not database row schemas.

When persistence is added, repository interfaces should be defined by the application/domain side, with Supabase/PostgreSQL adapters implementing them.

This prevents database column changes from propagating through scanners, UI components, or AI provider code.

RLS and workspace tenancy remain mandatory for persisted user-owned security records.

## 26. Serialization boundary

Domain contracts should not accidentally become permanent public API formats merely because TypeScript objects can be serialized.

Any durable API, artifact, queue message, or storage payload must define:

- explicit schema version
- validation at the trust boundary
- compatibility policy
- bounded sizes
- safe unknown-field behavior

Internal domain objects may evolve more freely than durable wire formats.

## 27. Error model

Errors should be classified rather than represented by arbitrary thrown strings across layers.

The design should support categories such as:

- validation error
- unsupported source mapping
- malformed external input
- authorization error
- safety policy rejection
- infrastructure unavailable
- advisory provider unavailable
- advisory response invalid

Domain validation errors must remain deterministic and independent of provider/infrastructure failures.

Infrastructure adapters should translate provider-specific errors into application-level categories at their boundary.

## 28. Clean-code requirements

Phase 4A and later phases follow these permanent rules:

1. Modules have one clear responsibility.
2. Public interfaces are smaller than implementations.
3. Business rules do not live in controllers, React components, CLI parsing, database adapters, or provider SDK wrappers.
4. Dependencies point toward stable contracts.
5. Shared abstractions are introduced only for real shared behavior.
6. Prefer explicit composition over hidden global state.
7. Avoid catch-all utility, manager, service, or helpers modules.
8. Keep I/O at system edges.
9. Domain helpers should be pure where practical.
10. Use meaningful domain names instead of generic data bags.
11. Avoid Boolean parameter combinations that hide behavior; prefer explicit option objects or distinct operations.
12. Avoid broad `Record<string, unknown>` metadata in domain contracts unless contained inside a source-specific validated extension boundary.
13. Keep files focused; split modules when independent responsibilities emerge.
14. Preserve deterministic behavior where inputs are deterministic.
15. Every safety-sensitive boundary requires dedicated regression coverage.

## 29. Scalability requirements

Scalability here means both engineering scalability and runtime scalability.

Engineering scalability:

- new scanner sources can map into the domain without changing existing scanners
- new consumers can use normalized domain contracts without importing scanner internals
- new AI providers can be swapped behind one advisory interface
- a local-only deployment can omit hosted provider adapters
- future workers can use application/domain packages without importing Next.js

Runtime scalability:

- domain contracts remain serializable through explicitly versioned wire adapters
- application services do not assume in-process execution
- source mappings do not assume one worker or one database transaction
- large evidence is referenced rather than embedded
- future queue and artifact boundaries can be added without changing detector semantics

## 30. Testing strategy

Phase 4A should be implemented test-first.

### Domain unit tests

Cover:

- finding validation
- provenance constraints
- validation-state transitions
- relationship validation
- remediation structure
- identifier and reference validation where applicable
- deterministic ordering/serialization helpers if introduced

### Architecture tests

Add automated dependency-boundary checks or focused import-regression tests proving:

- `security-domain` does not import scanner, CLI, UI, database, network, or AI provider packages
- scanner packages do not import application/UI/provider code
- provider adapters cannot leak provider-specific types into domain exports

### Mapping tests

Phase 3 finding mapping tests must verify:

- stable semantic mapping
- no raw secret leakage
- scanner evidence provenance retained
- validation state is not overstated
- arbitrary scanner metadata is not copied

### Contract tests

Future adapters should be testable against shared interface contract suites.

For AI adapters, normal CI must use deterministic fake providers. Live model calls must never be required for the standard test suite.

## 31. Security requirements

Phase 4A introduces no active network path, but its contracts must preserve security boundaries for later use.

Required properties:

- raw secrets cannot enter generic domain evidence or advisory context
- inferred content cannot masquerade as observed evidence
- advisory output cannot mutate confirmed facts directly
- validation promotion requires an explicit trusted operation
- source mappings fail closed on unsupported or malformed durable input
- durable serialized inputs are validated and bounded
- no arbitrary executable extension mechanism
- no hidden filesystem or network behavior in domain packages
- no provider credential handling in domain packages

## 32. Observability and audit readiness

Domain operations that may later be persisted should expose enough structured context for application-level audit events without embedding an audit backend into the domain.

Examples of future auditable transitions:

- finding state changed
- validation state promoted
- inferred relationship accepted or rejected
- advisory request initiated
- advisory suggestion accepted
- runtime validation requested

The domain should return structured transition results so application services can emit audit events consistently.

## 33. Compatibility with Phase 3

Phase 4A must not force Phase 3 CLI users to adopt the hosted product domain.

The local CLI remains independently usable.

No existing terminal, JSON, SARIF, baseline, policy, SBOM, scanner rule, fingerprint, or exit-code contract should change merely to create the product-domain layer.

The initial scanner-to-domain mapper is additive.

## 34. Definition of done

Phase 4A is complete when:

- `packages/security-domain` exists with focused modules and no infrastructure dependencies
- product-level findings, evidence, provenance, validation, relationships, remediation, advisory, and source-reference contracts are defined
- validation and transition helpers are deterministic and tested
- the Phase 3 finding mapper exists and cannot leak raw secret values or overstate validation
- provider-neutral advisory request/result contracts exist without any model SDK dependency
- an explicit advisory context policy contract exists for future redaction/allowlisting
- import/dependency architecture regressions are tested
- the architecture documentation records the dependency direction and AI authority/privacy boundaries
- roadmap documentation consistently describes Phase 4A, 4B, and 4C
- no active remote scanning is introduced
- no live AI/model integration is introduced
- full existing Phase 3 tests, typecheck, CLI build/runtime, benchmark, and production build remain green

## 35. Follow-on implementation order

Implementation order is not a product requirement, but the lowest-risk engineering sequence is:

1. create the security-domain package and core value contracts
2. add provenance and validation rules
3. add evidence and relationship contracts
4. add remediation and advisory contracts
5. add the deterministic Phase 3 finding mapper
6. add architecture dependency tests
7. update architecture and roadmap documentation
8. run the complete repository validation gate

After Phase 4A is merged, Phase 4B may design the verified runtime observation boundary against these contracts.

## 36. Long-term result

The intended end state is that ScopeForge can add scanners, hosted workers, APIs, databases, risk intelligence, local models, hosted models, and new UI experiences without turning any one integration into the system architecture.

A human maintainer should be able to understand the security truth model without reading provider-specific code.

A future AI integration should be able to consume normalized facts and return clearly labeled advisory output without modifying deterministic scanners.

A future provider change should require replacing an adapter, not rewriting security logic.

That is the compatibility target Phase 4A exists to establish.
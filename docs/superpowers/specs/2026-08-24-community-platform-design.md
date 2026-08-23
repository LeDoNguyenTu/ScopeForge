# ScopeForge Community Platform Design

Date: 2026-08-24
Status: Proposed for implementation

## 1. Product mission

ScopeForge is an open-source application security and cyber-risk awareness platform for developers first, while making every result understandable to people without a security background.

The product should help users answer seven questions in order:

1. What assets do I have?
2. What security weaknesses exist?
3. Which findings are real and reachable?
4. What could realistically happen next?
5. What should I do first?
6. How do I fix and verify it?
7. What can I learn so I am better prepared next time?

The core product loop is:

Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify

This is the central differentiation of ScopeForge.

ScopeForge is not intended to be only a scanner dashboard. It should become a community security platform that combines practical testing, risk context, remediation, education, repeatable security knowledge, and measurable verification.

## 2. Primary audience

The first audience is developers and open-source maintainers who need security feedback without requiring a dedicated application security team.

The same findings must also be useful to:

- junior security practitioners
- students and people learning application security
- small engineering teams
- founders and maintainers without a security specialist
- security engineers who want evidence, context, mappings, and reproducible retesting

The interface should expose technical depth progressively. A developer should be able to see the evidence and remediation. A non-security user should be able to understand the likely consequence and priority. A security practitioner should be able to inspect the underlying request, response, rule, mapping, confidence, and validation state.

## 3. Inspirations and what ScopeForge should inherit

ScopeForge should learn from established open-source and commercial security projects without copying proprietary source code, branding, detection content, or product implementation.

### 3.1 Strix strengths to inherit

Strix demonstrates the value of a direct promise, fast onboarding, practical validated findings, automation, CI integration, and community-friendly documentation.

ScopeForge should inherit these product principles:

- one clear job-to-be-done
- quick path from setup to a meaningful security result
- evidence-first findings
- validation and retesting instead of alert-only scanning
- local and CI-friendly workflows where appropriate
- high-quality developer documentation
- benchmarking against known vulnerable applications
- contribution paths that are useful to security practitioners

ScopeForge should not position itself as a Strix clone. Its distinct layer is risk explanation, consequence modeling, preparedness, and community security knowledge.

### 3.2 Aikido strengths to inherit

Aikido demonstrates the value of consolidating application security signals instead of forcing teams to operate many disconnected scanners.

ScopeForge should inherit these principles:

- code-to-runtime visibility
- unified findings model across multiple scanner types
- deduplication
- exploitability and reachability context
- low-noise prioritization
- remediation guidance
- development workflow integration
- one coherent product experience rather than a collection of unrelated tools

ScopeForge should remain open, explainable, community-extensible, and transparent about how findings are produced.

### 3.3 Anthropic Cybersecurity Skills strengths to inherit

Anthropic Cybersecurity Skills demonstrates how structured security knowledge, framework mapping, standards, reusable content, and community contributions can become a platform rather than a single tool.

ScopeForge should inherit these principles:

- a stable contribution format
- structured metadata
- recognized framework mappings
- reusable security knowledge packs
- validation of contributed metadata and identifiers
- clear documentation for contributors
- broad compatibility over time
- community ownership of useful security knowledge

ScopeForge should not become a generic repository of security prompts. Its knowledge should be tied directly to observable assets, findings, validation, remediation, and preparedness.

## 4. ScopeForge-specific differentiation

### 4.1 Security Story

Every important finding should be capable of producing a Security Story.

A Security Story explains:

- what was found
- where it exists
- whether it was validated
- whether it is externally reachable
- what preconditions an attacker would need
- what systems or data it could affect
- what plausible consequence chain could follow
- how confident ScopeForge is in that chain
- what should be done immediately
- what should be checked for similar exposure
- how to verify the remediation

Example conceptual graph:

Internet
  -> Public API
  -> SQL injection
  -> Application database
  -> Customer records
  -> Privacy and account risk

The graph must distinguish observed facts from inferred consequences. ScopeForge must never present a speculative consequence as a confirmed compromise.

### 4.2 Prepare Mode

Prepare Mode turns a technical finding into a practical preparedness checklist.

Depending on the finding, it may include:

- immediate remediation
- credential or key rotation considerations
- log sources to review
- related assets to inspect
- regression tests to add
- monitoring controls to enable
- secure coding references
- incident-response considerations if exploitation is suspected

Prepare Mode should make the platform useful even to teams that are not ready for advanced pentesting.

### 4.3 Explain Mode

Each finding should have layered explanations:

- Plain language - what this means and why it matters
- Developer view - vulnerable behavior, affected component, remediation pattern
- Security view - evidence, CWE, CVSS, OWASP, attack prerequisites, validation details

This progressive disclosure is a core UX requirement.

### 4.4 ScopeForge Security Packs

ScopeForge should eventually support community-contributed Security Packs.

A pack is a versioned collection of security knowledge and optional detection logic. A pack may contain:

- detector metadata
- safe detection rules
- classification and confidence guidance
- CWE mappings
- OWASP mappings
- MITRE ATT&CK mappings where relevant
- NIST CSF or control mappings where relevant
- remediation recipes
- educational explanations
- preparedness guidance
- test fixtures
- false-positive notes
- safety classification

The format should be machine-validated and human-readable.

The first versions should support only low-risk static or passive rules. Active rules require a stricter review and sandbox model before they are accepted from the community.

## 5. Product architecture

ScopeForge remains separated into a control plane and an execution plane.

### 5.1 Control plane

Hosted primarily on Vercel with Next.js.

Responsibilities:

- authentication
- workspace management
- asset management
- scan requests
- findings UI
- risk stories
- remediation workflow
- community pack discovery
- reporting
- quotas
- audit events
- API surface for trusted clients

The control plane must never become an unrestricted arbitrary-request proxy.

### 5.2 Data plane

Supabase PostgreSQL remains the system of record for structured application data.

Core domains over time:

- profiles
- workspaces
- workspace memberships
- assets
- asset verification challenges
- repositories
- scan jobs
- scan runs
- findings
- finding instances
- finding evidence references
- risk relationships
- remediation states
- retest results
- audit events
- usage quotas
- security pack metadata

All user-owned records must be workspace-scoped and protected by RLS where exposed through Supabase APIs.

### 5.3 Artifact plane

Cloudflare R2 stores large or unstructured artifacts:

- raw scanner result files
- SBOMs
- report exports
- screenshots
- HTTP evidence bundles
- generated archives
- benchmark artifacts

Postgres stores metadata and opaque object keys, not large result bodies.

Artifacts are private by default and accessed through short-lived authorized URLs or server-side retrieval.

### 5.4 Scanner execution plane

Active or resource-heavy security testing must run outside the public Vercel request lifecycle.

The execution model should evolve toward isolated workers with:

- job queue
- worker leases
- concurrency controls
- per-workspace budgets
- bounded execution time
- CPU and memory limits
- network egress policy
- artifact upload
- heartbeat and cancellation
- retry policy
- deterministic scan profiles

The first implementation may use simpler worker infrastructure, but the interfaces should anticipate this separation.

## 6. Scanner capability roadmap

Capability should be added in increasing order of operational risk.

### Level 1 - passive and code-local

- dependency inventory
- OSV-backed dependency vulnerability checks
- SBOM generation
- secret detection
- static security rules
- Dockerfile checks
- Kubernetes checks
- Terraform checks
- configuration analysis

### Level 2 - verified remote passive checks

Only against verified assets:

- HTTP security headers
- TLS posture
- cookie configuration
- exposed metadata and selected public files
- technology fingerprinting
- OpenAPI discovery
- endpoint inventory

### Level 3 - bounded active application checks

Only after explicit target verification and safe execution controls:

- benign input reflection
- safe parameter mutation
- non-destructive injection indicators
- API schema fuzzing with strict budgets
- authenticated crawling using explicitly supplied test identities
- authorization comparison using configured test accounts

### Level 4 - advanced validation

Requires stronger isolation, policy, and review:

- controlled proof-of-concept validation
- exploitability confirmation
- multi-step attack-path validation
- richer authenticated business-logic tests

No phase should add destructive exploitation, persistence, uncontrolled credential attacks, malware deployment, or features designed to bypass authorization boundaries.

## 7. Finding model

All scanner types normalize into one finding model.

Minimum finding fields:

- finding ID
- workspace ID
- asset ID
- scanner source
- rule ID
- title
- description
- severity
- confidence
- validation status
- reachability status
- CVSS score and vector where valid
- CWE identifiers
- OWASP mappings
- evidence references
- first seen
- last seen
- current lifecycle state
- remediation guidance
- retest status

Finding states should support:

open -> acknowledged -> in_progress -> resolved -> retest_pending -> verified_fixed

Additional states may include accepted_risk and false_positive with explicit audit metadata.

## 8. Risk relationship model

ScopeForge should support typed relationships between findings, assets, identities, data stores, and consequences.

Examples:

- exposes
- reaches
- depends_on
- authenticates_to
- can_lead_to
- affects
- mitigated_by

Relationships have a provenance type:

- observed
- scanner-derived
- user-confirmed
- inferred

Inferred edges require a confidence score and explanatory rationale.

This provenance model prevents the UI from presenting a hypothetical attack chain as an observed breach.

## 9. Prioritization model

ScopeForge should not sort only by CVSS.

Priority should eventually consider:

- technical severity
- validation state
- external exposure
- authentication requirement
- asset criticality
- reachability
- sensitive-data relationship
- exploit maturity where known
- recurrence across assets
- user-defined business context

The model must remain explainable. The UI should show why a finding was raised or lowered in priority.

## 10. Community model

ScopeForge should become useful to contributors even if they never deploy the hosted application.

Community contribution categories:

- static rules
- infrastructure rules
- detection test fixtures
- vulnerability explainers
- remediation recipes
- preparedness checklists
- framework mappings
- benchmark cases
- documentation
- UX and accessibility improvements

The repository should eventually provide:

- CONTRIBUTING.md with contribution types
- CODE_OF_CONDUCT.md
- SECURITY.md
- pack schema documentation
- pack validation CLI
- issue templates
- pull request template
- good-first-issue labels
- benchmark expectations
- rule quality criteria

The project should prefer evidence-backed contributions over rule-count inflation.

## 11. Trust and safety principles

ScopeForge should be useful for authorized security testing while making abuse harder by design.

Core principles:

1. Remote active testing requires ownership or explicit authorization verification.
2. Private, loopback, link-local, metadata, and restricted address ranges are blocked from hosted scan targets.
3. Redirects are revalidated.
4. Scanner profiles have request, time, and concurrency budgets.
5. High-risk features require stronger isolation than the web control plane.
6. Community active rules are not executed automatically without review and safety classification.
7. Audit logs record target registration, verification, scan creation, cancellation, and sensitive configuration changes.
8. Rate limits and quotas exist independently of CAPTCHA and login controls.
9. Findings distinguish evidence from inference.
10. ScopeForge never claims compromise unless it has evidence supporting that statement.

## 12. UX principles

The visual product should feel like a professional security platform, not a school project.

Principles:

- immediate understanding of risk
- progressive disclosure
- evidence before alarm
- meaningful empty states
- no decorative severity noise
- mobile and desktop support
- keyboard accessibility
- clear scan state and progress
- understandable error messages
- dark theme optimized for long security review sessions, with future light theme support
- consistent component hierarchy

Finding detail should be organized around:

1. Risk summary
2. Security Story
3. Evidence
4. Remediation
5. Prepare Mode
6. Technical details
7. References and learning
8. History and retests

## 13. CLI and CI direction

A future ScopeForge CLI should make the platform useful without requiring the web UI for every workflow.

Candidate commands:

- scopeforge auth
- scopeforge scan repo
- scopeforge scan sbom
- scopeforge findings
- scopeforge report
- scopeforge verify

CI use should support:

- pull request scanning
- SARIF export where appropriate
- configurable severity gates
- baseline support to avoid blocking on legacy findings
- machine-readable output
- links to hosted evidence when a workspace is configured

CLI and CI are not required in Phase 2, but the data model and APIs should avoid blocking them later.

## 14. Benchmarks and credibility

ScopeForge should measure itself publicly instead of relying on marketing claims.

Benchmark targets may include intentionally vulnerable applications and APIs such as:

- OWASP Juice Shop
- WebGoat
- crAPI
- intentionally vulnerable repository fixtures maintained by ScopeForge

Metrics should eventually include:

- true-positive coverage by supported rule category
- false-positive rate on selected clean fixtures
- scan duration
- duplicate finding rate
- retest accuracy
- rule regression history

Results should include known limitations.

## 15. Documentation as project memory

ScopeForge must be resumable across development sessions without rediscovering the entire codebase.

The repository will maintain this documentation hierarchy:

```text
docs/
  vision/
    PRODUCT_VISION.md
    PRINCIPLES.md
    DIFFERENTIATION.md
  architecture/
    SYSTEM_ARCHITECTURE.md
    DATA_MODEL.md
    SECURITY_MODEL.md
    DECISIONS/
  product/
    ROADMAP.md
    CAPABILITIES.md
    UX_PRINCIPLES.md
  research/
    STRIX_NOTES.md
    AIKIDO_NOTES.md
    COMMUNITY_PROJECT_PATTERNS.md
  development/
    CURRENT_STATE.md
    IMPLEMENTATION_LOG.md
    NEXT_STEPS.md
    SESSION_HANDOFF.md
    TEST_STATUS.md
  superpowers/
    specs/
```

### SESSION_HANDOFF.md contract

At the end of every meaningful implementation session, update this file with:

- current phase
- current branch
- last merged commit
- completed work
- active work
- exact next task
- relevant files
- migrations applied
- infrastructure state
- environment assumptions
- open bugs
- security concerns
- tests run and outcomes
- decisions that should not be rediscovered

A future development session should start by reading, in order:

1. docs/development/SESSION_HANDOFF.md
2. docs/development/CURRENT_STATE.md
3. the active phase design or implementation plan
4. relevant architecture decision records
5. only the files needed for the current task

This is specifically intended to avoid rescanning or rereading the full repository when context is resumed in another session.

## 16. Architecture decision records

Important decisions must be persisted as ADRs.

ADR examples:

- why Supabase is used for structured data
- why R2 stores artifacts
- why Vercel is the control plane rather than the scanner runtime
- why active scans require target verification
- why findings distinguish observed and inferred graph edges
- why community active rules require stronger review

ADRs should be short and immutable after acceptance. Superseded decisions receive a new ADR rather than silently rewriting history.

## 17. Revised implementation phases

### Phase 1 - Foundation - complete

- application shell
- Supabase project
- authentication wiring
- workspaces and roles
- RLS
- baseline security headers
- CI build validation

### Phase 2 - Asset Trust and Project Memory

- create permanent documentation hierarchy
- revise public README and community positioning
- add current-state and session-handoff documents
- add asset model
- add asset registration UX
- add ownership verification challenges
- add audit events
- add quota foundation
- add target safety validation library

Success condition: a user can register an asset and ScopeForge can prove that the hosted platform is allowed to operate on it before any active scan is accepted.

### Phase 3 - Code Security Foundation

- repository registration
- SCA through OSV
- SBOM generation
- secrets scanning
- first-party static security rules
- IaC checks
- normalized findings
- R2 artifact abstraction

Success condition: a repository can be analyzed without active network exploitation and findings appear through one normalized model.

### Phase 4 - Risk Intelligence

- Security Story model
- risk relationships
- explanation layers
- Prepare Mode
- finding priority model
- remediation states
- retest workflow

Success condition: ScopeForge explains not only what is wrong but why it matters, what may follow, and what to do next.

### Phase 5 - Verified Runtime Security

- passive verified-target checks
- OpenAPI discovery
- endpoint inventory
- bounded DAST profiles
- safe API mutation
- authenticated test identities
- strict SSRF and redirect controls

Success condition: verified assets can receive bounded runtime testing with auditable authorization and reproducible evidence.

### Phase 6 - Worker Isolation and Scale

- queue
- worker leases
- isolated scanner runtime
- cancellation
- backpressure
- per-workspace concurrency
- scan budgets
- artifacts pipeline

Success condition: public trial traffic cannot directly turn the control plane into an unrestricted scanning proxy or exhaust shared compute without quotas.

### Phase 7 - Community Security Packs

- pack schema
- validation tool
- static/passive rule contribution workflow
- metadata validation
- test fixture requirement
- mapping validation
- community docs

Success condition: contributors can extend useful security knowledge through a stable format without editing core application logic.

### Phase 8 - CLI, CI, Reports, and Benchmarks

- CLI foundation
- pull request integration
- SARIF where applicable
- reports
- benchmark suite
- public detection metrics
- release automation

Success condition: ScopeForge is useful in local development, CI, and hosted workflows with measurable credibility.

### Phase 9 - Public Product Polish

- scopeforge.dev production rollout
- responsive QA
- accessibility pass
- observability
- Turnstile on abuse-sensitive flows
- production quotas
- onboarding polish
- public community launch material

Success condition: a new user can understand the product, safely obtain a meaningful result, and know how to contribute.

## 18. Non-goals for the near term

ScopeForge will not attempt to immediately reproduce every Aikido module, every offensive capability in Strix, or every security domain represented by large knowledge repositories.

Near-term non-goals:

- full red-team command and control
- autonomous post-exploitation
- malware execution
- credential spraying as a hosted feature
- arbitrary Internet scanning
- hundreds of low-quality detection rules for marketing counts
- opaque AI scoring without explainable evidence
- enterprise billing and procurement features

The project should earn breadth through tested modules rather than claiming breadth early.

## 19. Product language

Recommended public positioning:

**ScopeForge - Find the weakness. Understand the risk. Prepare before it becomes an incident.**

Supporting description:

ScopeForge is an open-source application security platform that discovers vulnerabilities, validates what matters, connects technical findings to realistic risk, and guides developers through remediation and verification.

Community message:

Security findings should teach, not just alert. ScopeForge is being built in the open so developers, security practitioners, researchers, and learners can improve the rules, explanations, mappings, remediation guidance, and benchmarks together.

## 20. Acceptance criteria for this design

The design is successful when future implementation follows these constraints:

- developer-first workflow with non-security-friendly explanations
- unified finding model
- evidence and inference clearly separated
- Security Story and Prepare Mode remain first-class differentiators
- scanner control plane and execution plane remain separated
- active remote testing requires verified authorization
- community contributions use structured, testable formats
- roadmap favors measurable quality over rule count
- every meaningful development session leaves a repository handoff
- architecture decisions are recorded rather than rediscovered
- project messaging describes a community security platform, not a personal portfolio project

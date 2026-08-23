# ScopeForge Phase 3 - Code and Supply-Chain Security Design

Date: 2026-08-24
Status: Approved direction, implementation design

## 1. Objective

Phase 3 turns ScopeForge from a control-plane foundation into a useful developer security tool that can run locally and in CI without requiring the hosted application.

The phase must establish the complete low-risk scanner foundation that later web, worker, Security Story, remediation, and community-pack features can build on.

The first language-specific analysis targets JavaScript and TypeScript deeply. Language-independent analysis is included from the beginning for secrets, dependencies, Dockerfiles, Kubernetes, Terraform, GitHub Actions, and common configuration files. The architecture must allow Python, Java/Kotlin, C#, Go, Rust, and other languages to be added without redesigning findings, outputs, baselines, or the hosted platform.

The default CI behavior is report-only. Teams may opt into enforcement using an explicit severity gate such as `--fail-on high`.

## 2. Product promise for this phase

A developer should be able to clone ScopeForge, point it at a repository, and receive one coherent security result set that answers:

1. What code, dependencies, infrastructure, and configuration were analyzed?
2. What weaknesses were found?
3. Why does each result matter?
4. What evidence caused the finding?
5. How confident is ScopeForge?
6. What standard classification applies?
7. How should the developer remediate it?
8. Is this a new finding or an accepted legacy baseline finding?
9. Can the same result be consumed by a terminal, CI system, GitHub Code Scanning, or later the ScopeForge web platform?

Phase 3 does not perform remote exploitation, remote DAST, credential attacks, persistence, or destructive actions.

## 3. Design principles

### 3.1 Useful without an account

Local and CI scanning must work without signing into ScopeForge. A hosted workspace becomes an optional enhancement for persistence, collaboration, Security Stories, and artifact history.

### 3.2 Evidence first

Every finding must include the location and evidence necessary to understand why it exists. Secret values are always redacted. Findings must not claim exploitability unless evidence supports that conclusion.

### 3.3 One finding contract

SAST, secrets, dependency vulnerabilities, Docker, Kubernetes, Terraform, GitHub Actions, and future scanners normalize into the same model.

### 3.4 Low noise over rule count

ScopeForge should prefer a smaller number of well-tested, explainable rules over a large catalogue of weak regexes. Rules require positive fixtures, negative fixtures, severity reasoning, and false-positive notes.

### 3.5 Deterministic core

Static scans should be reproducible given the same repository contents, rule-pack version, configuration, and vulnerability data snapshot. Network-backed enrichment is clearly distinguished from deterministic local analysis.

### 3.6 Extensible by design

Scanner engines and rule packs communicate through stable interfaces. Adding another language or pack must not require changes to terminal formatting, SARIF generation, baselines, finding fingerprints, or hosted ingestion.

## 4. High-level architecture

```text
Repository
   |
   v
ScopeForge CLI
   |
   +--> Repository inventory
   |      +-- files
   |      +-- languages
   |      +-- manifests / lockfiles
   |      +-- infrastructure files
   |      +-- ignore rules
   |
   +--> Scanner coordinator
   |      |
   |      +-- JS/TS SAST engine
   |      +-- Secret scanner
   |      +-- Dependency / OSV scanner
   |      +-- Docker scanner
   |      +-- Kubernetes scanner
   |      +-- Terraform scanner
   |      +-- GitHub Actions / configuration scanner
   |
   +--> Finding normalizer
   |      +-- stable fingerprint
   |      +-- severity
   |      +-- confidence
   |      +-- evidence
   |      +-- CWE / OWASP
   |      +-- remediation
   |      +-- provenance
   |
   +--> Deduplication / baseline engine
   |
   +--> Output adapters
          +-- human terminal
          +-- ScopeForge JSON
          +-- SARIF 2.1.0
          +-- CycloneDX SBOM
          +-- later hosted ingestion
```

The scanner package must not depend on Next.js, Supabase, or Vercel. The web application may depend on scanner contracts, but not the other way around.

## 5. Repository layout

The implementation should evolve toward the following boundaries:

```text
packages/
  scanner-core/
    inventory/
    coordinator/
    findings/
    baseline/
    config/
    filesystem/

  scanner-jsts/
    parser/
    rules/
    taint/
    fixtures/

  scanner-secrets/
    detectors/
    entropy/
    redaction/
    fixtures/

  scanner-sca/
    manifests/
    lockfiles/
    osv/
    sbom/
    fixtures/

  scanner-iac/
    docker/
    kubernetes/
    terraform/
    github-actions/
    config/
    fixtures/

  scanner-output/
    terminal/
    json/
    sarif/

  cli/

packs/
  builtin/

tests/
  scanner/
  integration/
  fixtures/
```

This may initially live within the existing repository workspace rather than being published as independent npm packages. The module boundaries are required even if package publication is deferred.

## 6. CLI contract

The first stable command family is:

```text
scopeforge scan [path]
scopeforge scan [path] --format terminal
scopeforge scan [path] --format json --output scopeforge-results.json
scopeforge scan [path] --format sarif --output scopeforge.sarif
scopeforge scan [path] --sbom scopeforge.cdx.json
scopeforge scan [path] --fail-on high
scopeforge scan [path] --baseline .scopeforge-baseline.json
scopeforge baseline create [path]
scopeforge rules list
scopeforge version
```

Behavior:

- default path is the current working directory
- default output is a concise human terminal report
- default policy is report-only
- `--fail-on` accepts an explicit minimum severity
- invalid configuration is a CLI error and returns non-zero
- scan findings alone do not return non-zero unless an enforcement gate is configured
- scanner execution errors are distinct from policy-gate failures
- JSON and SARIF output are deterministic in ordering

Exit-code semantics should be documented and stable.

## 7. Repository inventory

Before any detector runs, ScopeForge builds a bounded repository inventory.

Requirements:

- honor `.gitignore` where practical
- support a `.scopeforgeignore` file for explicit scanner exclusions
- ignore obvious generated/vendor paths by default, including `.git`, `node_modules`, `.next`, `dist`, `build`, `coverage`, and common vendored dependency directories
- do not follow filesystem symlinks outside the requested scan root
- impose configurable file-count, file-size, and total-byte limits
- classify files by extension, filename, manifest type, and lightweight content signals
- inventory manifest and lockfile presence before SCA starts
- record skipped files with reason counters without flooding normal terminal output

This boundary prevents unbounded local scans and prepares the same coordinator for future isolated workers.

## 8. Unified finding model

Every scanner returns a normalized `Finding` object with at least:

```text
id
fingerprint
scanner
ruleId
ruleVersion
title
description
severity
confidence
category
validation
provenance
location
  file
  startLine
  startColumn
  endLine
  endColumn
evidence
  summary
  redactedSnippet
  dataFlow[] optional
cwe[]
owasp[]
references[]
remediation
  summary
  guidance
  verification
metadata
firstSeen optional
baselineState
```

Severity values:

```text
critical | high | medium | low | info
```

Confidence values:

```text
high | medium | low
```

Validation values for Phase 3:

```text
static_confirmed | dependency_confirmed | heuristic | informational
```

Provenance distinguishes observed scanner evidence from enrichment or inference.

The local model intentionally contains fields that later map into the hosted finding model without forcing the CLI to know about workspace or asset IDs.

## 9. Stable fingerprints and deduplication

Fingerprints are critical for baselines, SARIF continuity, hosted history, and future retesting.

Fingerprints should combine stable properties such as:

- scanner namespace
- rule ID
- normalized repository-relative path
- stable semantic or structural context
- normalized sink/source identifiers when relevant

Line numbers must not be the only identity input because harmless edits above a finding would otherwise create false new findings.

Secret fingerprints must never contain the secret itself. Use keyed or one-way hashing of a normalized detector identity and secret digest where needed.

## 10. JavaScript and TypeScript SAST

The JS/TS engine is the first language-specific deep scanner.

It uses three complementary detection classes.

### 10.1 Syntax-aware structural rules

AST-based checks identify security-sensitive constructs without relying on raw regex matching.

Initial categories should include:

- dynamic code execution such as `eval` and `new Function`
- unsafe child-process execution patterns
- shell interpolation into command execution
- dangerous TLS verification disablement
- weak cryptographic primitives in security-sensitive use
- dangerous deserialization patterns where supported libraries are recognized
- permissive CORS configurations
- insecure cookie/session configuration patterns where statically visible
- path construction patterns relevant to traversal risk
- unsafe SQL query construction patterns
- obvious insecure randomness in token/session/security contexts

### 10.2 Framework-aware rules

Recognize high-value patterns in commonly used JS/TS web frameworks, starting with Node.js and Next.js-compatible server code.

Examples include:

- untrusted request data reaching command execution
- request data concatenated into SQL APIs
- filesystem access built from request-controlled path values
- open redirect construction from request parameters
- server-side fetch/HTTP destinations influenced by untrusted URL input
- unsafe HTML generation where framework escaping is bypassed

Framework recognition must be narrow and tested rather than guessing from variable names alone.

### 10.3 Limited taint analysis

Phase 3 introduces a bounded intra-file/interprocedural-light taint engine for selected vulnerability classes.

Initial source classes:

- HTTP query parameters
- route/path parameters
- request bodies
- selected headers
- environment-derived externally controlled values only when semantically appropriate

Initial sink classes:

- command execution
- SQL query execution
- filesystem paths
- server-side outbound requests
- unsafe HTML execution/rendering APIs

Sanitizers and safe APIs must be modeled explicitly.

The engine should prefer high-confidence flows over broad speculative propagation. Cross-repository whole-program data flow is not required in the first Phase 3 release.

## 11. Secret detection

Secret scanning combines deterministic token patterns with bounded entropy heuristics.

Requirements:

- provider-aware patterns for common cloud, source-control, payment, messaging, and service credentials
- private key material detection
- generic high-entropy assignment detection with contextual filtering
- exclude obvious example/test placeholders when confidence is low
- redact all values from terminal, JSON, SARIF, logs, and audit records
- evidence may reveal only safe prefixes/suffixes when needed for developer identification
- never upload detected secret values to the hosted service
- support allowlisting by fingerprint or explicit safe test-fixture annotation

The scanner should distinguish a likely real credential from a generic high-entropy string using confidence rather than exaggerating severity.

## 12. Software composition analysis

The SCA engine inventories dependency versions from supported manifests and lockfiles, normalizes packages to ecosystems and Package URLs where possible, and queries OSV for known vulnerabilities.

Initial JavaScript package sources:

- `package-lock.json`
- `npm-shrinkwrap.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `package.json` as a fallback with lower version certainty when no lockfile provides an installed resolution

Design requirements:

- prefer resolved lockfile versions over manifest ranges
- batch OSV queries
- support pagination when OSV returns paginated query-batch results
- cache vulnerability records within a scan
- clearly mark vulnerability-data lookup failures separately from a clean scan
- preserve OSV aliases such as CVE/GHSA identifiers
- normalize severity only when upstream scoring data supports it
- do not invent a CVSS score when none is available

The scanner must be useful offline for inventory and SBOM generation even if OSV enrichment is unavailable.

## 13. CycloneDX SBOM

ScopeForge emits a standards-compliant CycloneDX JSON SBOM using the maintained JavaScript library rather than implementing the specification manually.

SBOM contents should include:

- application/root component
- discovered dependencies
- versions
- package URLs where available
- dependency relationships where lockfile data provides them
- hashes where reliably available
- ScopeForge tool metadata
- timestamp and serial number

SBOM generation is independent of vulnerability lookup. A network outage must not prevent a user from creating an SBOM.

## 14. Docker security analysis

Initial Dockerfile checks include:

- root/default-user risks
- floating `latest` tags
- privileged or risky runtime assumptions where statically visible
- secrets passed through `ENV`/`ARG` patterns with appropriate confidence
- unnecessary package-manager cache persistence
- insecure download/execution patterns
- missing healthcheck only as informational where appropriate, not a vulnerability by default
- dangerous file permissions
- remote ADD usage where relevant

Rules distinguish hard security issues from hardening recommendations.

## 15. Kubernetes analysis

Initial Kubernetes checks include:

- privileged containers
- privilege escalation
- hostPath mounts
- host networking / PID / IPC exposure
- broad Linux capabilities
- running as root / missing non-root constraints where meaningful
- writable root filesystem hardening
- sensitive host namespace exposure
- risky service-account token mounting
- overly broad RBAC patterns where local manifests provide enough evidence
- plaintext secret objects as a warning with careful messaging

The engine parses YAML structurally and handles multi-document manifests.

## 16. Terraform analysis

Initial Terraform checks focus on high-value cloud and infrastructure misconfiguration patterns that can be determined without cloud credentials.

Categories:

- public storage exposure
- overly broad network ingress
- insecure security-group patterns
- unencrypted storage where the resource semantics are known
- public database exposure
- weak logging/audit configurations where deterministic
- hardcoded credentials/secrets delegated to the secret scanner
- risky IAM wildcard patterns

Provider-specific rules should be versioned and tested independently.

## 17. GitHub Actions and configuration analysis

Initial checks include:

- unsafe interpolation of untrusted event data into shell steps
- dangerous `pull_request_target` patterns
- overly broad workflow permissions
- unpinned third-party actions as supply-chain risk
- credential persistence where unnecessary
- risky self-hosted runner assumptions where inferable
- known dangerous checkout/execution patterns

Additional generic configuration rules may cover exposed debug modes, wildcard CORS, disabled TLS validation, and insecure defaults where the file format is understood.

## 18. Baseline model

ScopeForge must support adoption in repositories that already contain findings.

A baseline stores stable finding fingerprints and metadata, never secret values.

Behavior:

- findings matching baseline entries are labeled `existing`
- newly introduced findings are labeled `new`
- resolved baseline entries can be surfaced in verbose output
- `--fail-on` applies to new findings by default when a baseline is configured
- an explicit option may gate on all findings
- baseline format is versioned
- malformed or incompatible baselines fail closed with a clear configuration error rather than silently ignoring entries

This supports gradual adoption without weakening visibility.

## 19. Configuration

Repository configuration lives in a versioned file such as `.scopeforge.yml`.

Configuration may include:

- enabled scanner families
- rule include/exclude lists
- severity overrides only where explicitly permitted
- path excludes
- file and scan budgets
- baseline path
- `fail-on` policy
- output configuration
- OSV network policy/cache settings

Security-sensitive rules cannot be silently disabled by an untrusted nested configuration file. ScopeForge reads configuration only from the explicit scan root unless the user supplies another path.

## 20. Terminal experience

The terminal output must be concise enough for developers but provide drill-down when requested.

Default output:

```text
ScopeForge scan

Repository  ./my-app
Files       327 analyzed, 41 skipped
Duration    4.2s

HIGH    Command injection           src/api/export.ts:44
HIGH    GitHub token exposed        scripts/release.ts:12
MEDIUM  Vulnerable dependency       lodash@4.17.20
LOW     Container runs as root      Dockerfile:1

4 findings: 2 high, 1 medium, 1 low
Policy: report-only
```

Verbose output provides evidence and remediation. Secret output remains redacted in every mode.

## 21. ScopeForge JSON output

The native JSON schema is versioned and is the canonical scanner interchange format for ScopeForge itself.

It contains:

- schema version
- tool version
- scan metadata
- repository inventory summary
- scanner versions
- findings
- errors/warnings
- policy result
- artifact metadata

Future hosted ingestion accepts this schema rather than parsing terminal output.

## 22. SARIF output

ScopeForge emits SARIF 2.1.0 compatible with GitHub Code Scanning's supported subset.

Requirements:

- stable `ruleId`
- rule metadata with severity, help, CWE/OWASP tags where supported
- precise repository-relative locations
- fingerprints suitable for alert continuity
- redacted evidence only
- deterministic ordering
- one ScopeForge tool run with clearly namespaced rule IDs
- validate generated SARIF in automated tests

The GitHub Action integration can later upload the SARIF using GitHub's standard code-scanning upload action. ScopeForge itself does not require GitHub credentials merely to generate SARIF.

## 23. CI integration

The repository provides a documented GitHub Actions example and, later, a reusable action.

Default behavior:

- run ScopeForge
- generate human logs and SARIF
- do not fail on findings
- upload SARIF when permissions allow
- optionally upload SBOM/result artifacts

Enforcement is opt-in:

```text
scopeforge scan . --fail-on high
```

CI differentiates:

- scanner execution failure
- configuration failure
- policy-gate failure
- successful scan with findings

## 24. Testing strategy

Phase 3 is test-driven.

Each scanner rule requires:

- at least one positive fixture
- at least one negative fixture
- expected severity and confidence
- stable finding fingerprint assertion where relevant
- no secret leakage assertion for credential tests

Test layers:

### Unit tests

Parsers, normalization, fingerprints, redaction, severity mapping, baseline logic, output adapters.

### Rule tests

Small fixtures exercising individual detections and non-detections.

### Integration tests

Synthetic repositories combining package managers, JS/TS code, Docker, Kubernetes, Terraform, GitHub Actions, and baselines.

### Golden-output tests

Versioned JSON, SARIF, and terminal snapshots for deterministic output.

### Security tests

Symlink escape prevention, oversized-file limits, malicious YAML/manifest inputs, secret redaction, path normalization, malformed lockfiles, hostile SARIF strings, and configuration boundary tests.

## 25. Performance budgets

The scanner is designed for typical CI repositories rather than unrestricted filesystem traversal.

Initial goals, measured and adjusted with benchmarks:

- stream or bound large-file reads instead of loading arbitrary files fully into memory
- parallelize independent scanner families with a controlled concurrency limit
- parse each source file once per language engine where possible
- share repository inventory across scanners
- batch OSV lookups
- avoid spawning one process per file/rule

Performance measurements are documented, not marketed without benchmark evidence.

## 26. Security boundary

Phase 3 code scanning is local and passive.

The scanner:

- reads only within the authorized local scan root
- does not execute repository code
- does not run package lifecycle scripts
- does not install project dependencies as part of analysis
- does not execute Dockerfiles, Terraform, Kubernetes manifests, or workflows
- does not send source code to OSV; only normalized package identifiers/versions are queried
- never sends detected secret values anywhere
- does not perform remote application testing

Repository content is always treated as hostile input.

## 27. Community rule direction

Built-in scanners use the same conceptual metadata that future Security Packs will expose.

A rule definition includes:

- namespaced ID
- version
- title
- category
- default severity
- confidence model
- safety class
- supported file/language types
- CWE/OWASP mappings
- explanation
- remediation
- verification guidance
- false-positive notes
- fixtures

Phase 3 does not yet execute arbitrary community JavaScript plugins. Community-extensible detection starts with declarative/static formats or reviewed built-in contributions so installing a rule pack cannot become arbitrary code execution.

## 28. Hosted integration boundary

Phase 3 prioritizes local/CI usefulness. Hosted ingestion is added only after the local result model stabilizes.

When connected to ScopeForge later:

- repository identity is workspace-scoped
- scan metadata and normalized findings are stored in Supabase
- large result files and SBOMs go to private Cloudflare R2
- no raw secrets are uploaded
- finding fingerprints deduplicate repeated scans
- hosted Security Stories and Explain Mode consume normalized results rather than scanner-specific payloads

This preserves the control-plane/execution-plane separation established in earlier phases.

## 29. Implementation sequence

The implementation order is chosen to minimize rework and establish contracts before detectors depend on them.

1. Scanner workspace/module boundaries and test harness
2. Repository inventory and filesystem safety
3. Unified finding model, fingerprints, configuration, and policy engine
4. CLI skeleton and native JSON output
5. Secret scanner and redaction primitives
6. JS/TS AST parser and first structural SAST rules
7. Limited JS/TS taint analysis
8. Dependency inventory and OSV integration
9. CycloneDX SBOM generation
10. Docker, Kubernetes, Terraform, GitHub Actions, and configuration rules
11. Baseline engine
12. SARIF adapter and GitHub Actions example
13. Integration, golden-output, security, and benchmark suites
14. Documentation, handoff state, and release-readiness review
15. Optional hosted ingestion/R2 handoff only after the local contract is stable

This sequence is an engineering decision, not a reduction of scope. All components above remain Phase 3 deliverables unless a dependency or safety issue requires them to move to a documented later sub-phase.

## 30. Definition of done

Phase 3 is complete only when:

- the CLI scans a repository without requiring a ScopeForge account
- report-only is the default and explicit severity gating works
- JS/TS structural SAST is syntax-aware
- selected high-value JS/TS source-to-sink flows have bounded taint analysis
- secrets are detected and always redacted
- dependency versions are inventoried from supported lockfiles
- OSV vulnerability lookup works and network failures are distinguishable from clean results
- CycloneDX SBOM generation works independently of OSV
- Docker, Kubernetes, Terraform, GitHub Actions, and generic configuration checks are implemented
- baselines distinguish new from existing findings
- native JSON and SARIF outputs are stable and validated
- GitHub CI usage is documented
- tests cover positive, negative, malformed, and hostile fixtures
- scanner execution never runs target repository code
- performance and known limitations are documented
- permanent ScopeForge session-handoff documents identify exact current state and next work
- CI, security review, and relevant database/advisor checks are green before merge

## 31. Deferred beyond Phase 3

The following are intentionally not part of this phase:

- remote DAST
- authenticated crawling
- API fuzzing
- exploit validation
- cloud-account posture connectors
- isolated remote worker fleet
- full hosted scan orchestration
- risk-relationship graph
- Security Story UI
- Prepare Mode UI
- arbitrary executable community plugins

The Phase 3 finding contract is designed so these later capabilities can reuse the same evidence, prioritization, remediation, and reporting foundations.

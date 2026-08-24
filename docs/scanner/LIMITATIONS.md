# ScopeForge Phase 3 Limitations

ScopeForge Phase 3 is intentionally conservative. The scanner favors bounded, explainable local analysis over broad heuristics that would overstate certainty.

This document describes current false-negative boundaries and unsupported behavior. A clean ScopeForge scan is not proof that a repository is secure.

## Language coverage

JavaScript and TypeScript analysis currently supports these syntax families:

- `.js`
- `.jsx`
- `.mjs`
- `.cjs`
- `.ts`
- `.tsx`
- `.mts`
- `.cts`

ScopeForge parses these files as syntax only. It does not build a TypeScript `Program`, run a type checker over the target repository, resolve target imports, execute `require`, execute dynamic imports, compile target code, or install target dependencies.

Other programming languages do not currently have syntax-aware SAST engines in Phase 3. The secret scanner can still inspect bounded text files independently of language-specific SAST support.

## JavaScript and TypeScript SAST scope

Structural SAST intentionally contains a small high-confidence rule set. Current direct structural checks include:

- direct `eval` and `new Function` dynamic code execution constructs
- explicit Node.js TLS certificate-verification disablement in statically recognized runtime binding shapes

Framework identity and module identity are not inferred from variable names alone. This reduces false positives but means aliased, wrapped, dynamically resolved, generated, or unusual framework/module patterns can be missed.

There is no whole-program call graph, cross-file value flow, generalized interprocedural analysis, target type inference, or package-resolution model.

## Bounded taint analysis

Phase 3 taint analysis is deliberately limited to one high-confidence command-injection family.

The current model recognizes:

- statically established Express route handlers
- request field access under `req.query`, `req.params`, or `req.body`
- statically established Node `child_process.exec` and `execSync` sinks
- a small set of local assignments, string construction operations, and modeled transformations
- selected numeric conversion functions as sanitizers only when the corresponding runtime global is not shadowed

It does not claim generalized command injection across arbitrary frameworks or wrappers. It does not currently provide taint rules for SQL injection, path traversal, SSRF, unsafe HTML, template injection, header injection, NoSQL injection, or other vulnerability classes.

Unsupported control flow is handled conservatively. Branches, loops, nested helper functions, closures, complex destructuring, callbacks, cross-file flows, object field mutation, custom sanitizers, and unmodeled transformations can cause real flows to be missed.

A fixed taint step budget prevents unbounded analysis. When that budget is exceeded, partial taint findings are discarded and the affected file receives a scanner diagnostic rather than being treated as fully analyzed.

## Secret detection

The built-in secret scanner currently focuses on:

- GitHub token patterns
- Stripe live secret keys
- Slack tokens
- complete private-key blocks
- contextual high-entropy secret assignments

This is not an exhaustive credential catalog. Provider formats not represented by built-in rules can be missed. Generic entropy detection is intentionally filtered to reduce placeholder and random-data noise.

Detected values are redacted before they enter normalized findings. Safe-fixture annotations and fingerprint allowlisting can suppress findings, so those mechanisms require review.

## Software composition analysis

Phase 3 SCA supports the npm package ecosystem through:

- `npm-shrinkwrap.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `package.json` fallback when no supported resolved lockfile supplies an installed version

Other ecosystems such as Maven, Gradle, NuGet, Cargo, Go modules, Python package managers, RubyGems, Composer, and operating-system packages are not inventoried yet.

Manifest fallback has lower version certainty than resolved lockfile data. Complex workspace or lockfile semantics that are outside the supported parsers can be incomplete.

OSV enrichment is disabled by default. When enabled, lookup failures are scanner errors rather than clean results. Vulnerabilities missing from OSV or lacking supported package/version identity cannot be reported.

ScopeForge does not invent CVSS scores when upstream data does not provide reliable scoring information.

## CycloneDX SBOM

The Phase 3 SBOM reflects the dependency inventory ScopeForge can establish locally. It is not a complete software bill of materials for ecosystems or components that the current dependency inventory does not support.

SBOM generation does not execute package managers or inspect a built container/image. It therefore cannot discover dependencies that exist only after target build scripts, image construction, runtime downloads, or unsupported package-manager resolution.

## Docker analysis

Dockerfile checks are structural and local. Current checks include floating base-image references, explicitly effective root `USER` in the final stage, remote `ADD`, direct download-to-shell patterns, and world-writable permission patterns.

ScopeForge does not pull images or inspect inherited image metadata. A missing `USER` is therefore not automatically reported because the effective inherited user cannot be proven locally.

Dynamic build arguments, shell semantics, multi-step generated commands, image contents, package vulnerabilities, runtime capabilities, and daemon configuration are outside this Dockerfile-only model unless a dedicated rule can establish the condition from local syntax.

## Kubernetes analysis

Kubernetes YAML is parsed structurally with document and alias limits. Current rules focus on explicit privilege, host namespace/path, capability, UID 0, writable root filesystem, service-account token, and wildcard RBAC conditions.

ScopeForge does not contact a cluster, apply manifests, download schemas, resolve admission policies, inspect effective RBAC from multiple deployed sources, execute Helm, run Kustomize, or invoke kubectl.

Missing hardening fields are generally not treated as vulnerabilities because cluster defaults, admission controls, and inherited settings are not known from a single local manifest.

## Terraform analysis

Terraform scanning parses local HCL without invoking the Terraform CLI. Current checks focus on selected AWS security-group, RDS, EBS/storage, S3 public-access, and IAM policy-document patterns.

ScopeForge does not load providers or modules, evaluate remote state, execute provisioners, execute external data sources, resolve variables across a full Terraform graph, call cloud APIs, or determine effective deployed configuration.

Dynamic expressions are treated conservatively. A value that cannot be resolved locally is generally not converted into a vulnerability claim.

Provider coverage is not comprehensive and currently emphasizes selected AWS patterns.

## GitHub Actions analysis

Workflow analysis is limited to `.github/workflows/*.yml` and `.yaml` files. Current checks cover selected unsafe shell interpolation, broad write permissions, mutable third-party action references, dangerous `pull_request_target` checkout-and-execute chains, self-hosted pull-request execution patterns, and persisted broad write credentials.

ScopeForge does not execute workflows, evaluate every expression at runtime, resolve reusable workflows across repositories, inspect organization policy, or query GitHub for action provenance.

Some trusted or special-cased action behavior is modeled narrowly. New GitHub Actions platform behavior can require rule updates.

## Generic configuration analysis

Current generic configuration checks are intentionally narrow:

- effective `strict-ssl=false` in `.npmrc`
- wildcard `Access-Control-Allow-Origin: *` headers in structurally valid `vercel.json`

Other framework, cloud, web-server, package-manager, and application configuration formats are not covered unless they have a specific built-in parser and rule.

The scanner reads `.scopeforge.json` only from the explicit scan root. Nested repository configuration cannot silently weaken security behavior.

## Filesystem and resource budgets

Repositories are treated as hostile input. ScopeForge applies file-count, per-file byte, total-byte, parser, AST, taint, YAML alias/document, Terraform block, and other bounded-analysis limits.

Files can be skipped when limits are reached. Skips are visible in the repository inventory summary, and parser/scanner coverage failures use structured diagnostics where applicable. This protects the scanner but creates an intentional false-negative boundary for content that cannot be safely analyzed within configured limits.

Repository configuration can tighten safe inventory budgets but cannot raise ScopeForge's built-in safe ceilings.

Symlinks are not followed for repository content reads.

## Output and baseline limitations

Native JSON is ScopeForge's canonical local interchange format. SARIF targets GitHub Code Scanning's supported SARIF 2.1.0 subset and intentionally omits arbitrary finding metadata, raw source snippets, raw secret material, and internal data-flow labels that could expose repository content.

Baseline matching uses stable finding fingerprints. Material code/configuration changes can legitimately change a fingerprint and cause a finding to appear `new` again.

A baseline is an adoption tool, not a risk acceptance system. Existing findings remain visible even when the default baseline policy gates only on new findings.

## Community extension

Phase 3 does not execute arbitrary community JavaScript plugins or rule-pack code. Built-in contributions and future declarative/static pack formats require review and tests so scanner extensibility does not become a target-code execution path.

## Remote and active security testing

Phase 3 does not perform:

- remote DAST
- authenticated crawling
- API fuzzing
- exploit validation
- generalized network scanning
- cloud-account posture queries
- credential attacks
- persistence
- destructive actions
- isolated remote worker execution

Those capabilities require separate authorization, target verification, isolation, egress, quota, cancellation, logging, and abuse-prevention boundaries and belong to later phases.

## Distribution limitation

ScopeForge is currently source-installed and built from this repository. A standalone versioned package and reusable GitHub Action are not yet published. CI users should pin a reviewed ScopeForge revision and install the tool in an isolated directory as documented in `CI.md`.

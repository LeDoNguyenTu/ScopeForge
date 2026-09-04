# Phase 7 Community Security Packs Design

Status: approved - implementation candidate pending final acceptance
Date: 2026-09-01
Scope: non-UI Phase 7 v1

## 1. Purpose

Phase 7 lets contributors extend ScopeForge's security knowledge and a narrow
class of static detection behavior through a stable, reviewable pack format.
It must not turn repository content or community contributions into executable
code.

The v1 success condition is:

> A contributor can submit a versioned pack containing bounded static literal
> rules, mappings, layered explanations, remediation and preparedness guidance,
> positive and negative fixtures, and governance metadata. ScopeForge can
> validate and run that pack deterministically without JavaScript plugins,
> dynamic imports, shell commands, package installation, network access, or
> hosted mutation authority.

This design is intentionally non-UI. It adds no dashboard, visual, Supabase,
RLS, Vercel, worker, or production capability behavior.

## 2. Existing state and duplicate-work audit

The following were checked before this design was written:

- all local and remote branch names and their reachable content
- all open, merged, and closed pull requests
- all GitHub issues
- repository commit subjects and content history
- current roadmap, README, contribution guidance, specs, plans, packages,
  tests, benchmark files, and validation methodology
- a fresh GitNexus index plus direct source search when the index's full-text
  warning persisted

No Phase 7 implementation, pack schema, validator, registry, pack runner,
fixture protocol, or contribution workflow exists. The only Phase 7 material is
future-facing roadmap and architecture text in `README.md`, `CONTRIBUTING.md`,
`docs/PHASES.md`, and the community-platform design.

Phase 8 is not part of this implementation. Its methodology foundation is
already merged through PR #50; its labeled corpus and evaluator remain future
Phase 8 work.

A clean non-root Linux test run of current `main` found one pre-existing
read-only snapshot cleanup failure. The exact fix already exists and passed in
Phase 6D PR #52 as `removeMaterializedRepositorySnapshot`. Phase 7 must not
reimplement it. Phase 7 implementation should begin from a `main` that contains
that accepted fix, or wait until PR #52 is merged.

## 3. Chosen approach

### 3.1 Considered approaches

1. **Metadata-only packs.** Lowest risk, but contributors cannot add any new
   detection behavior. This does not fully satisfy the Phase 7 roadmap.
2. **Closed declarative packs with one bounded static matcher.** Contributors
   can add useful rules while the engine retains all authority. This is the
   chosen v1.
3. **General rule DSL or executable plugins.** More expressive, but creates
   parser complexity, denial-of-service risk, and an unacceptable code-execution
   boundary. This is prohibited.

### 3.2 V1 boundary

V1 supports exactly one contributed detection kind:

`static_literal_v1`

It searches bounded, already-inventoried text files for fixed UTF-8 literals.
It has no regular expressions, glob library extensions, callbacks, expressions,
templates, scripts, imports, subprocesses, package hooks, or network operations.

Pack knowledge may also describe existing built-in rule IDs. Such knowledge can
enrich documentation and reports, but it cannot replace built-in severity,
confidence, evidence, or execution logic during v1.

## 4. Trust and authority model

### 4.1 Packs are untrusted data

Every pack field, path, fixture, and literal is hostile input. Validation occurs
before any pack rule is registered or run.

Pack processing may depend only on:

- the safe repository inventory and identity-checked read APIs
- scanner finding contracts and deterministic fingerprint helpers
- the dedicated pack schema, validator, registry, and literal matcher
- Node.js data, path, and crypto primitives required for bounded local parsing

Pack processing must not import:

- Next.js, React, Supabase, application actions, or browser components
- worker control, worker supervisor, runtime networking, repository acquisition,
  or active validation
- `node:child_process`, `node:vm`, `node:http`, `node:https`, DNS, sockets, or
  dynamic module loading
- package managers, build systems, template evaluators, or user-provided code

Permanent architecture tests enforce these restrictions.

### 4.2 Explicit pack selection

The CLI never discovers packs inside the repository being scanned. A target
repository therefore cannot grant itself detector authority by committing a pack
file.

Local use requires an explicit trusted operator argument:

```text
scopeforge scan <repository> --pack <pack-directory>
```

The same canonical pack directory cannot be supplied twice. Multiple packs are
ordered by raw UTF-8 pack ID and version bytes, not locale.

Hosted use is excluded from v1. A future hosted release may use only packs baked
into a reviewed worker image or selected from a digest-pinned allowlist. It must
not accept arbitrary pack uploads from browser or repository content.

### 4.3 No active or passive network rules

Pack safety classification is fixed to `static`. Values such as `passive`,
`active`, `network`, `runtime`, or `dual_use` are rejected in v1. Phase 7 does
not inherit Phase 6B or Phase 6D network authority.

## 5. Pack layout

A pack is one real directory with this layout:

```text
example-pack/
  scopeforge-pack.json
  fixtures/
    <case-id>/
      case.json
      repository/
        <fixture files>
```

Rules may not name arbitrary fixture paths. Each `case.json` binds one stable
case ID to a rule ID, an expected finding count, and a positive or negative
classification. Its repository is always the sibling `repository/` directory.

The loader rejects:

- a symlinked pack root, manifest, case file, fixture directory, or fixture file
- paths that escape the real pack root
- duplicate normalized paths or case-insensitive path collisions
- device files, sockets, named pipes, hard links, and unsupported file types
- hidden package-manager/vendor trees and nested pack manifests
- manifests or fixture trees that exceed the fixed budgets below

## 6. Manifest contract

The manifest is UTF-8 JSON parsed through the repository's existing `yaml`
dependency in JSON-schema mode with unique keys required. Aliases, anchors,
custom tags, merge keys, comments, and non-JSON scalar types are rejected.

The top-level v1 object has exact keys:

```ts
interface SecurityPackManifestV1 {
  schemaVersion: 1;
  packId: string;
  version: string;
  name: string;
  summary: string;
  license: "Apache-2.0" | "BSD-3-Clause" | "CC-BY-4.0" | "MIT";
  repository: string;
  maintainers: readonly string[];
  safety: "static";
  minimumScopeForgeVersion: string;
  rules: readonly SecurityPackRuleV1[];
}
```

Unknown fields fail closed at every nesting level.

### 6.1 Identity and version rules

- `packId`: lowercase reverse-domain-style identity matching
  `^[a-z0-9]+(?:[.-][a-z0-9]+)*$`, 3-100 bytes
- rule ID: lowercase slash-separated identity matching
  `^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$`,
  3-120 bytes
- published finding rule ID: `pack/<packId>/<ruleId>`
- pack and rule versions: strict `MAJOR.MINOR.PATCH`, with no prerelease or build
  metadata in v1
- `minimumScopeForgeVersion`: strict `MAJOR.MINOR.PATCH`
- rule IDs are unique within a pack; published rule IDs are unique across all
  selected packs and built-ins
- a rule has its own version so knowledge-only pack releases do not silently
  change detection identity

### 6.2 Text rules

- all strings must be valid UTF-8 with no NUL, C0 controls except newline, or
  bidirectional override/isolate controls
- single-line identity and title fields reject newlines
- human guidance is normalized to LF and bounded by field-specific byte limits
- rendered output treats contributor strings as text, never HTML or template
  source
- repository URLs must be canonical public HTTPS GitHub repository URLs with no
  credentials, query, or fragment; validation performs no network request
- maintainers are 1-10 GitHub handles, not email addresses or credentials

## 7. Rule contract

```ts
interface SecurityPackRuleV1 {
  id: string;
  version: string;
  kind: "static_literal_v1";
  title: string;
  summary: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: "high" | "medium" | "low";
  category: string;
  mappings: {
    cwe: readonly string[];
    owasp: readonly string[];
    attack: readonly string[];
    nistCsf: readonly string[];
  };
  explanations: {
    plain: string;
    developer: string;
    security: string;
  };
  remediation: {
    summary: string;
    guidance: string;
    verification: string;
  };
  preparedness: readonly string[];
  falsePositiveNotes: readonly string[];
  matcher: StaticLiteralMatcherV1;
}
```

Mapping formats are syntactically validated:

- CWE: `CWE-` plus 1-5 digits
- OWASP: the existing ScopeForge mapping form, such as `A03:2021`
- ATT&CK: `T` plus four digits and optional three-digit sub-technique
- NIST CSF: uppercase function/category/subcategory identifiers with dots and
  hyphens only

Mappings do not assert that a referenced external taxonomy entry is semantically
correct. Contribution review owns that judgment and documents its evidence.

### 7.1 Literal matcher

```ts
interface StaticLiteralMatcherV1 {
  include: readonly string[];
  exclude: readonly string[];
  mode: "any" | "all";
  literals: readonly string[];
  absentLiterals: readonly string[];
  caseSensitive: boolean;
}
```

The path matcher supports only this closed subset:

- literal path segments
- `*` within one segment
- `**` as a complete segment
- `?` for one non-separator character
- `/` as the only separator

Character classes, braces, extglobs, escapes, drive letters, absolute paths,
leading `../`, trailing separators, and empty segments are rejected. Patterns
are compiled by a dedicated linear-time matcher, not `RegExp`.

Literal behavior:

- 1-16 required literals, each 1-256 UTF-8 bytes
- 0-16 absent literals, each 1-256 UTF-8 bytes
- no NUL or line-ending normalization of scanned bytes
- case-insensitive matching is ASCII-only; non-ASCII folding is rejected
- `any` emits one finding at the earliest byte location of the earliest matching
  required literal
- `all` emits one finding only when every required literal exists; its location
  is the earliest required-literal occurrence
- any absent literal suppresses the finding for that file
- one rule emits at most one finding per file
- evidence states only the rule and matched literal ordinal; it never stores the
  literal, line text, neighboring source, or contributed free-form evidence

The engine scans only files already admitted by the standard repository
inventory. It reads through the identity-checked bounded file reader, so pack
rules cannot expand file, byte, symlink, or traversal authority.

## 8. Resource budgets

V1 fixed limits:

| Resource | Limit |
| --- | ---: |
| Manifest bytes | 256 KiB |
| Rules per pack | 100 |
| Selected packs per scan | 10 |
| Total selected pack rules | 500 |
| Include patterns per rule | 16 |
| Exclude patterns per rule | 16 |
| Fixture cases per rule | 20 |
| Fixture files per case | 100 |
| Fixture bytes per case | 1 MiB |
| Findings per pack per scan | 1,000 |
| Human-guidance field | 8 KiB |

Budget exhaustion is a scanner error and cannot be reported as a clean result.
No pack field can raise a budget.

## 9. Validation and fixture protocol

The validator has two layers:

1. **Structural validation:** layout, real paths, exact schema, identities,
   versions, mappings, budgets, duplicate detection, and dependency rules.
2. **Behavior validation:** run each rule only against its declared fixtures and
   compare exact finding count, rule identity, file, and location.

Every rule requires at least:

- one positive case with exactly one expected finding
- one negative case with zero expected findings
- one negative case that contains at least one required literal but is suppressed
  by an absent literal or path exclusion

`case.json` exact contract:

```ts
interface SecurityPackFixtureCaseV1 {
  schemaVersion: 1;
  caseId: string;
  ruleId: string;
  classification: "positive" | "negative";
  expected: readonly {
    file: string;
    startLine: number;
    startColumn: number;
  }[];
  rationale: string;
}
```

Ground truth remains separate from scanner output. The validator never rewrites
case files or accepts update-snapshot behavior. Phase 8 may consume these cases,
but Phase 7 does not publish precision, recall, F1, or false-positive rates.

## 10. CLI surface

V1 adds:

```text
scopeforge pack validate <pack-directory>
scopeforge pack inspect <pack-directory> --json
scopeforge scan <repository> --pack <pack-directory>
```

`pack validate` emits deterministic human-readable errors and exits with usage
semantics for malformed input. `pack inspect --json` emits normalized metadata
only after full validation; it never includes fixture source. `scan --pack`
performs validation before inventory scanning and fails closed if any selected
pack is invalid.

No command downloads, installs, updates, resolves, or publishes packs. Registry
distribution is a later separately designed boundary.

## 11. Finding and output behavior

Pack findings use existing `Finding` contracts:

- `scanner`: `security-pack`
- `ruleId`: `pack/<packId>/<ruleId>`
- `ruleVersion`: the contributed rule version
- `validation`: `static_confirmed`
- `provenance`: `observed`
- `metadata.packId` and `metadata.packVersion`: normalized identities only
- `metadata.matcher`: `static_literal_v1`

Fingerprints include pack ID, rule ID, rule version, normalized repository path,
and location using the existing deterministic fingerprint boundary. They do not
include contributor descriptions, matched literal bytes, or source text.

JSON, SARIF, terminal, baseline, policy, and hosted-json serializers receive pack
findings only through the existing normalized `Finding` interface. Hosted import
must reject `security-pack` until a later migration and trusted source registry
explicitly allow reviewed pack identities; Phase 7 v1 does not widen it.

## 12. Module boundaries

Planned modules:

- `packages/security-packs/contracts.ts` — closed v1 types and limits
- `packages/security-packs/parse.ts` — bounded JSON-mode parse and exact schema
- `packages/security-packs/path-pattern.ts` — linear-time closed path matcher
- `packages/security-packs/literal-matcher.ts` — bounded byte/text matching
- `packages/security-packs/fixtures.ts` — safe fixture discovery and validation
- `packages/security-packs/registry.ts` — deterministic selected-pack rule registry
- `packages/security-packs/scanner.ts` — standard scanner-family adapter
- `packages/security-packs/index.ts` — reviewed public exports only
- `packages/cli/security-packs.ts` — CLI argument and output adapter

The coordinator receives an optional already-validated pack scanner. Built-in
scanner behavior is unchanged when no `--pack` argument exists.

## 13. Error handling

Errors use stable pack codes without reflecting hostile content:

- `PACK_PATH_INVALID`
- `PACK_MANIFEST_TOO_LARGE`
- `PACK_MANIFEST_INVALID`
- `PACK_IDENTITY_INVALID`
- `PACK_DUPLICATE_RULE`
- `PACK_BUDGET_EXCEEDED`
- `PACK_FIXTURE_INVALID`
- `PACK_FIXTURE_MISMATCH`
- `PACK_RULE_COLLISION`
- `PACK_SCAN_LIMIT_EXCEEDED`

Terminal messages may include a normalized relative manifest/case path and a
stable field name. They must not echo literals, fixture content, raw parser
exceptions, absolute operator paths, or unbounded contributed text.

## 14. Contribution governance

Repository documentation defines:

- pack directory and naming rules
- required license and maintainer identity
- positive/negative fixture expectations
- severity, confidence, mapping, remediation, and false-positive rationale
- prohibition on active behavior, secrets, real credentials, exploit payloads,
  external targets, network dependencies, generated/vendor fixtures, and
  executable content
- review checklist for schema validity, deterministic results, privacy, budgets,
  mapping evidence, and license compatibility
- semantic-versioning rules for rule logic versus knowledge-only changes

The repository includes one small first-party example pack. It demonstrates the
format and fixture protocol; it is not described as representative accuracy
evidence.

## 15. Verification strategy

Implementation follows RED/GREEN cycles for:

- exact schema and unknown-field rejection
- duplicate JSON keys and hostile Unicode/control characters
- semver, ID, mapping, and URL validation
- path traversal, symlink, hard-link, special-file, and case-collision rejection
- glob-subset correctness and worst-case linear behavior
- literal any/all/absent and ASCII case behavior
- deterministic ordering, fingerprints, JSON, SARIF, terminal, and baselines
- fixture positive/negative enforcement and anti-self-rewrite behavior
- resource ceilings and fail-closed scanner errors
- no target-repository pack auto-discovery
- no network/process/dynamic-code imports or hosted authority expansion
- Windows path handling plus non-root Linux exact-head verification

Final acceptance requires:

```text
npm test -- --run
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
npm run benchmark:scanner
npm audit --audit-level=info
npm run build
```

The existing scanner benchmark must remain within its committed catastrophic
ceiling. Phase 7 adds a separate bounded pack benchmark only if measurements
show the new scanner family is not represented meaningfully by existing tests;
it must not silently redefine `scanner-medium-v1`.

## 16. Rollout and compatibility

- Phase 7 v1 is local CLI only and opt-in by explicit pack directory.
- No database migration or production deployment is required.
- No existing configuration file gains implicit pack discovery.
- No production worker image or capability flag changes.
- Built-in rules retain their current IDs, versions, severity, confidence, and
  execution logic.
- Invalid packs fail before scanning; absence of packs preserves byte-for-byte
  existing behavior.

## 17. Explicit non-goals

V1 does not include:

- JavaScript, TypeScript, WASM, native, shell, template, or expression plugins
- regular expressions or user-defined parsers
- package installation or dependency resolution
- pack download, marketplace, publishing service, signatures, or trust scores
- browser/dashboard pack management
- hosted pack upload or arbitrary hosted execution
- passive runtime, active validation, HTTP, DNS, sockets, or credentials
- AST, taint, IaC, archive, or dependency matcher DSLs
- automatic severity overrides for built-in findings
- global accuracy claims or Phase 8 metric publication

More expressive static matcher types require their own versioned design and
security review. Active community rules remain prohibited until a future design
defines authority stricter than the current Phase 4/6D boundaries.

## 18. Completion criteria

Phase 7 v1 is complete only when:

1. the v1 contracts, parser, matcher, registry, scanner adapter, fixture validator,
   and CLI surface are implemented
2. one first-party example pack passes the same public validator contributors use
3. architecture tests prove no execution, network, hosted, or browser authority
4. positive, negative, hostile-path, privacy, determinism, and budget tests pass
5. contribution and pack-author documentation are complete
6. exact-head Linux verification passes every required command
7. the security diff review finds no reportable unresolved issue
8. the dedicated PR is merged with exact-head protection while production worker
   capabilities remain unchanged


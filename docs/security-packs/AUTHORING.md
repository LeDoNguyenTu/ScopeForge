# Authoring ScopeForge Security Packs

ScopeForge Security Packs v1 are local-only, explicitly selected, data-only extensions for the local scanner. They do not add executable plugins, dynamic code, network access, active probing, hosted ingestion authority, browser authority, subprocesses, package hooks, or target-repository auto-discovery.

A v1 pack is accepted only through an explicit local CLI path such as `scopeforge scan . --pack ./my-pack` or the pack validation/inspection commands documented below.

## Required layout

A pack root contains exactly one root manifest named `scopeforge-pack.json` and a `fixtures/` directory with reviewed behavioral cases.

```text
my-pack/
  scopeforge-pack.json
  fixtures/
    positive/
      case.json
      repository/
        ...
    negative-safe/
      case.json
      repository/
        ...
    negative-suppressed/
      case.json
      repository/
        ...
```

Nested `scopeforge-pack.json` files are rejected. Fixture trees must remain regular, in-root, case-unique files and directories. Symlinks, hard links, special files, traversal, case-colliding paths, hidden fixture directories, package-manager/vendor trees, and identity-changing filesystem entries are rejected by validation.

## Manifest fields

The root manifest is strict JSON. Unknown keys, duplicate keys, unsupported values, or resource-limit violations fail closed.

### Pack fields

| Field | Required value/meaning |
| --- | --- |
| `schemaVersion` | Must be `1`. |
| `packId` | Stable globally namespaced pack identity, for example `org.scopeforge.node-tls`. |
| `version` | Semantic version for the pack content release. |
| `name` | Human-readable pack name. |
| `summary` | Short pack-level purpose statement. |
| `license` | One of `Apache-2.0`, `BSD-3-Clause`, `CC-BY-4.0`, or `MIT`. |
| `repository` | Repository URL for the maintained pack source. |
| `maintainers` | Non-empty reviewed maintainer identities. |
| `safety` | Must be `static`. |
| `minimumScopeForgeVersion` | Minimum compatible ScopeForge semantic version. |
| `rules` | One or more reviewed v1 rules, subject to the fixed rule limit. |

### Rule fields

| Field | Required value/meaning |
| --- | --- |
| `id` | Stable rule identity within the pack. Published identity becomes `pack/<packId>/<ruleId>`. |
| `version` | Semantic version for the rule logic. |
| `kind` | Must be `static_literal_v1`. |
| `title` | Concise finding title. |
| `summary` | Short description of what is detected. |
| `description` | Security meaning and impact without embedding matcher source. |
| `severity` | A ScopeForge-supported severity. |
| `confidence` | A ScopeForge-supported confidence. |
| `category` | Reviewed category label. |
| `mappings.cwe` | CWE identifiers where applicable. |
| `mappings.owasp` | OWASP identifiers where applicable. |
| `mappings.attack` | MITRE ATT&CK identifiers where applicable. |
| `mappings.nistCsf` | NIST CSF identifiers where applicable. |
| `explanations.plain` | Non-specialist explanation. |
| `explanations.developer` | Developer-focused explanation. |
| `explanations.security` | Security-review explanation. |
| `remediation.summary` | Concise remediation objective. |
| `remediation.guidance` | Concrete safe remediation guidance. |
| `remediation.verification` | How to verify the fix. |
| `preparedness` | Defensive follow-up/preparedness guidance. |
| `falsePositiveNotes` | Known reviewed false-positive conditions. |
| `matcher` | Closed `static_literal_v1` matcher described below. |

## `static_literal_v1` matcher

The matcher is deliberately small and non-executable.

| Field | Meaning |
| --- | --- |
| `include` | Repository-relative path patterns eligible for evaluation. |
| `exclude` | Repository-relative path patterns excluded after inclusion. |
| `mode` | `any` or `all` for the configured literals. |
| `literals` | Static byte literals to match. |
| `absentLiterals` | Static byte literals that suppress the rule when present. |
| `caseSensitive` | Whether literal comparison is case-sensitive. Case-insensitive matching is ASCII-only. |

Supported path tokens are the bounded Security Pack pattern language implemented by ScopeForge: literal path text, `*` within one path segment, and `**` for reviewed multi-segment matching. Patterns are repository-relative. Absolute paths, drive-relative paths, traversal segments, unsupported wildcard constructs, regex syntax, and ambiguous path forms are rejected.

Security Packs do not support regular expressions, scripts, callbacks, imports, template execution, shell commands, VM evaluation, network requests, active checks, package lifecycle hooks, or arbitrary scanner code.

## Fixed resource limits

Security Pack authors cannot raise these ceilings from a manifest or fixture:

| Limit | Maximum |
| --- | ---: |
| Manifest size | 256 KiB |
| Rules per pack | 100 |
| Explicitly selected packs per scan | 10 |
| Explicitly selected rules per scan | 500 |
| Include patterns per rule | 16 |
| Exclude patterns per rule | 16 |
| Literals per rule | 16 |
| Literal size | 256 bytes |
| Fixture cases per rule | 20 |
| Fixture files per case | 100 |
| Fixture bytes per case | 1 MiB |
| Findings per pack | 1,000 |
| Individual guidance field | 8 KiB |

Validation fails closed when a fixed ceiling is exceeded.

## Fixture case schema

Every `case.json` is strict JSON and contains:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Must be `1`. |
| `caseId` | Stable case identity within the pack. |
| `ruleId` | Rule under test. |
| `classification` | `positive` or `negative`. |
| `expected` | Exact expected finding locations. Negative cases use an empty array. |
| `rationale` | Why the case proves useful behavior and is safe to keep. |

Each expected location contains the repository-relative `file`, `startLine`, and `startColumn`.

Every rule must have all three behavioral classes:

1. A positive case proving the intended finding appears at the exact reviewed location.
2. A clean negative case proving ordinary safe input does not match.
3. A suppressed near-miss or exclusion case proving the reviewed suppression/exclusion boundary does not produce a finding.

Fixtures must be minimal, deterministic, offline, and contain no real credential or external dependency.

## Validation and inspection

From a ScopeForge source checkout after building the CLI:

```bash
npm run build:cli
node .scopeforge-build/packages/cli/index.js pack validate ./my-pack
node .scopeforge-build/packages/cli/index.js pack inspect ./my-pack --json
```

Scan a repository with one or more explicitly selected packs:

```bash
node .scopeforge-build/packages/cli/index.js scan ./target --pack ./my-pack
node .scopeforge-build/packages/cli/index.js scan ./target --pack ./pack-a --pack ./pack-b
```

Pack paths resolve from the CLI working directory, not from the scanned repository. A target repository cannot activate a pack by containing `scopeforge-pack.json` or `fixtures/`.

`baseline create` is intentionally pack-free in v1. Hosted JSON rejects Security Pack findings. Hosted distribution and hosted activation do not exist in v1.

## Versioning rules

- Increment the **rule version** whenever detection logic, matcher behavior, finding identity semantics, or rule meaning changes.
- Increment the **pack version** whenever reviewed pack content is released, including rule additions/removals/updates or governance-relevant metadata changes.
- Do not reuse an existing version for materially different content.
- Raising `minimumScopeForgeVersion` is a compatibility change and requires an appropriate pack release.

## Author checklist

Before requesting review:

- Validate the pack from a clean checkout.
- Confirm every rule has positive, clean-negative, and suppressed/excluded near-miss coverage.
- Confirm expected locations are exact.
- Confirm fixture trees contain only minimal synthetic content.
- Confirm no real secrets, tokens, credentials, personal data, or private source are present.
- Confirm the pack needs no network, subprocess, dynamic import, target execution, package hook, or active behavior.
- Confirm severity, confidence, mappings, remediation, preparedness, and false-positive notes are evidence-based.
- Inspect JSON output and ensure matcher literals, fixture source, and absolute pack paths are not exposed.

The first-party reference implementation is `security-packs/first-party/node-tls-verification`.

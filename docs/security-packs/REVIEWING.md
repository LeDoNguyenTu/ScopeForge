# Reviewing ScopeForge Security Packs

Security Pack review is a security boundary review, not only a content review. A v1 pack must remain local-only, explicitly selected, deterministic, bounded, data-only, and restricted to `static_literal_v1`.

Use this checklist for every new pack and every rule-logic change.

## Required review checklist

- [ ] Manifest and every case pass `scopeforge pack validate` without modification.
- [ ] Rule uses only `static_literal_v1`; no executable, network, active, or hosted authority is introduced.
- [ ] Positive, clean-negative, and suppressed near-miss fixtures are minimal and contain no real secret.
- [ ] Severity, confidence, CWE/OWASP/ATT&CK/NIST mappings, remediation, and false-positive rationale have cited review evidence in the PR.
- [ ] Pack and fixture paths are regular, in-root, case-unique, and within fixed budgets.
- [ ] JSON/SARIF/terminal/baseline output contains no literal, fixture source, or absolute pack path.
- [ ] A rule-logic change increments the rule version; a pack-content release increments the pack version.

## Safety and authority review

Confirm all of the following:

- The pack is activated only by an explicit local CLI `--pack` path or pack validation/inspection command.
- The scanned repository cannot auto-discover or auto-activate a pack.
- The pack adds no regular-expression execution, JavaScript/TypeScript execution, callbacks, dynamic imports, shell commands, child processes, VM evaluation, worker threads, package hooks, or repository module loading.
- The pack adds no HTTP, HTTPS, DNS, socket, TLS, browser, cloud-provider, Supabase, worker, or other network authority.
- The pack adds no active validation, target probing, authentication, credential use, request shaping, or runtime observation authority.
- The pack is not added to hosted source registries, hosted database types, migrations, trusted import paths, browser actions, or worker job classes.
- Hosted JSON continues to reject any `security-pack` finding directly at the serializer boundary.
- Baseline creation remains pack-free in v1.
- No configuration file inside the scanned repository can select a pack or raise Security Pack limits.

Any violation of these points requires a separate reviewed architecture/design change rather than a pack contribution.

## Filesystem and hostile-input review

Review the fixture and manifest boundaries for:

- path traversal, absolute paths, drive-relative paths, ambiguous separators, and case collisions
- symlinks, hard links, special files, devices, FIFOs, sockets, and unexpected link counts
- directory/file identity changes during validation
- nested manifests and hidden/package-manager/vendor fixture trees
- duplicate JSON keys, unknown keys, hostile Unicode, oversized strings, and malformed UTF-8/JSON behavior
- exact fixed byte/file/case/rule/pack/finding ceilings
- bounded wildcard and literal matching behavior

The validator must fail closed with privacy-safe errors. Raw fixture content, matcher literals, absolute pack paths, and arbitrary system error text must not be reflected to output.

## Detection-quality review

For each rule, verify:

1. **Positive behavior** - the minimal intended condition produces exactly the reviewed finding/location.
2. **Clean negative behavior** - safe content produces no finding.
3. **Suppressed near-miss behavior** - the intended exclusion or suppression condition produces no finding.
4. **One finding per rule/file** - repeated matching text does not create unbounded duplicate findings.
5. **Determinism** - repeated validation/scanning produces the same finding identity, ordering, and inspection output.
6. **Narrowness** - include/exclude paths and literals are no broader than necessary.

Reject rules that rely on contextual execution, target code evaluation, package installation, external state, network lookups, timing, or nondeterministic environment behavior.

## Security-content review

Check that:

- title, summary, and description accurately describe the static evidence actually proven
- severity is proportionate to the concrete condition, not the worst imaginable downstream scenario
- confidence reflects the matcher’s precision
- mappings are applicable and not decorative
- remediation guidance removes the insecure condition without recommending unsafe bypasses
- verification guidance is concrete and reproducible
- preparedness guidance is defensive and proportionate
- false-positive notes identify reviewed limitations rather than weakening the matcher silently

For material security claims, include evidence links or references in the PR discussion/review record even when the runtime pack schema itself intentionally keeps references out of matcher execution.

## Output/privacy review

Run a representative pack-enabled scan and inspect:

- terminal output
- native JSON
- SARIF
- baseline serialization
- `pack inspect --json`
- error output for a deliberately invalid fixture copy

Confirm none contains:

- raw matcher literals where not required for the public finding
- fixture repository source
- real credentials or secrets
- absolute local pack paths
- raw filesystem/system exception details

Hosted JSON must reject Security Pack findings instead of mapping them.

## Versioning review

- Rule logic or identity semantics changed: increment `rule.version`.
- Any released pack content changed: increment top-level `version`.
- New rule: increment pack version and assign a new stable rule ID/version.
- Removed rule: increment pack version and document compatibility impact.
- Changed minimum ScopeForge version: increment pack version and verify compatibility behavior.
- Never publish materially different reviewed content under an already-used version.

## Suggested verification commands

```bash
npm ci
npm run build:cli
node .scopeforge-build/packages/cli/index.js pack validate ./path/to/pack
node .scopeforge-build/packages/cli/index.js pack inspect ./path/to/pack --json
npm test -- --run
npm run typecheck
```

For first-party changes, also run the Phase 7 focused suite and the exact-head release acceptance described in `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.

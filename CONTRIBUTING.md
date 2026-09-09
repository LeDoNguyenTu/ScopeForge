# Contributing to ScopeForge

ScopeForge is an open-source application-security and cyber-risk awareness project. Contributions are welcome from software developers, security practitioners, students, researchers, technical writers, designers, and maintainers.

## What you can contribute

Useful contributions include:

- application and platform code
- static security rules
- reviewed local Security Packs
- infrastructure and configuration rules
- safe test fixtures
- vulnerability explainers
- remediation recipes
- preparedness checklists
- CWE, OWASP, MITRE, NIST, and defensive-framework mappings
- benchmark cases and validation data
- documentation
- UX and accessibility improvements

You do not need to contribute exploit code to make ScopeForge better. Clear explanations, reproducible safe tests, high-quality remediation guidance, and false-positive improvements are equally valuable.

## Development principles

ScopeForge is built phase by phase. Keep changes focused, explain security-sensitive behavior, and include validation steps for database, authorization, network, scanner, or cryptographic changes.

Before starting implementation work, read:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. the active plan under `docs/superpowers/plans/`

For architectural changes, read the approved design under `docs/superpowers/specs/` and open an issue or design PR before changing security boundaries.

## Safety requirements

ScopeForge is intended only for systems the tester owns or is explicitly authorized to assess.

Do not contribute:

- destructive scan defaults
- uncontrolled credential attacks or brute force
- persistence mechanisms
- malware deployment
- arbitrary proxy features that bypass target-verification controls
- features intended to defeat authorization boundaries
- payload collections whose primary purpose is operational abuse rather than safe validation

Active or dual-use functionality requires stricter review, bounded execution, test fixtures, and documented safety controls.

## Pull requests

Keep each PR cohesive. A strong PR should include:

- a clear problem statement
- the intended behavior
- tests or another reproducible verification method
- migration notes when database structures change
- security considerations when authorization, network access, secrets, or scanners are involved
- documentation updates when public behavior changes

The repository uses CI for tests, TypeScript validation, and production builds. A PR should not be merged while required checks are failing.

## Security Pack contributions

The Phase 7 local Security Pack v1 candidate uses a machine-validated schema and the closed `static_literal_v1` matcher. Packs are local-only and activated only by an explicit CLI path. Target repositories cannot auto-discover packs.

Before proposing a pack or changing pack rule logic, read:

1. `docs/security-packs/AUTHORING.md`
2. `docs/security-packs/REVIEWING.md`
3. `security-packs/first-party/node-tls-verification` as the first-party reference pack

Every proposed rule must include enough evidence to review:

- what the rule detects
- expected true-positive conditions
- clean-negative conditions
- suppressed/excluded near-miss conditions
- severity and confidence rationale
- relevant CWE, OWASP, MITRE ATT&CK, or NIST mapping when applicable
- minimal synthetic fixtures with exact expected locations
- remediation and verification guidance
- preparedness and false-positive notes where relevant

A v1 Security Pack contribution must not introduce regular-expression execution, scripts, dynamic imports, callbacks, subprocesses, package hooks, network requests, active probing, browser authority, hosted source registration, or worker authority. Those are architecture changes and require a separate approved design rather than a pack PR.

Rule-logic changes increment the rule version. Pack-content releases increment the pack version. Do not reuse a version for materially different reviewed content.

## Community conduct

Be respectful, evidence-driven, and constructive. See `CODE_OF_CONDUCT.md`.

## Reporting vulnerabilities in ScopeForge

Do not publish a newly discovered vulnerability in ScopeForge as a public issue before maintainers have had an opportunity to assess it. Follow `SECURITY.md` for responsible reporting guidance.

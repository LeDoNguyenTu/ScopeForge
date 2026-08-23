# Contributing to ScopeForge

ScopeForge is an open-source application-security and cyber-risk awareness project. Contributions are welcome from software developers, security practitioners, students, researchers, technical writers, designers, and maintainers.

## What you can contribute

Useful contributions include:

- application and platform code
- static security rules
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

## Security rules and knowledge contributions

Future ScopeForge Security Packs will use machine-validated schemas. Until the pack format ships, proposed rules or knowledge content should include enough metadata to review:

- what the rule or guidance detects or explains
- expected true-positive conditions
- known false-positive conditions
- severity and confidence rationale
- relevant CWE or OWASP mapping when applicable
- safe fixtures or examples
- remediation guidance
- whether the contribution performs passive, static, or active behavior

## Community conduct

Be respectful, evidence-driven, and constructive. See `CODE_OF_CONDUCT.md`.

## Reporting vulnerabilities in ScopeForge

Do not publish a newly discovered vulnerability in ScopeForge as a public issue before maintainers have had an opportunity to assess it. Follow `SECURITY.md` for responsible reporting guidance.

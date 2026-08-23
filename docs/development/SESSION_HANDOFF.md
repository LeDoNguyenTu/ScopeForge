# ScopeForge Session Handoff

## Current phase
Phase 3B - Safe reads, configuration, policy, and CLI implemented on PR #7, pending final exact-head CI and merge

## Completed before this PR
- Phase 1 foundation merged.
- Phase 2 Asset Control merged through PR #4.
- Phase 3 scanner design merged through PR #5.
- Phase 3A scanner foundation merged through PR #6 as `44304860926929f8505da5036bec235fe4ce2c37`.

## Phase 3B implementation
- isolated branch: `feat/phase-3b-safe-config-cli`
- PR: #7 `Build Phase 3B safe config and CLI`
- safe inventory-entry reader added before detector implementation
- strict root-only `.scopeforge.json` version 1 configuration
- repository config can only tighten scan budgets
- report-only policy remains the default; explicit severity gates supported
- exit codes separate policy, usage/configuration, and scanner execution failures
- local CLI shell supports scan, terminal/JSON output, rules list, and version
- CLI is compiled separately and its emitted entrypoint is smoke-tested in CI

## Security review hardening
- CI #83: initial RED, only the four new Phase 3B suites failed because modules were absent
- CI #84: all 86 tests passed; strict typecheck exposed and led to a TypeScript narrowing fix
- CI #87: RED reproduced unsafe repository-configured output traversal and symlink overwrite behavior
- CI #90: GREEN after configured-path containment and no-follow output writing, with 88 tests plus typecheck, CLI build, and production build passing
- CI #92: RED reproduced silent acceptance of an unknown configured scanner family
- CI #93: GREEN after unknown scanner families were changed to fail closed; tests, typecheck, CLI build, compiled CLI runtime smoke, and production build passed

## Trust boundary
- repository contents remain hostile input
- detector code must use `readInventoryEntry`
- no repository code or lifecycle script execution
- no dependency installation
- no remote scanner network behavior
- root configuration only; nested configuration is ignored
- untrusted config cannot raise scanner resource budgets
- configured output cannot escape the scan root or follow an existing output symlink
- scanner errors cannot be mistaken for a clean result

## Known limitations
- no detector rules are registered yet
- `.scopeforge.json` is the first implemented configuration format; YAML is not implemented
- rule include/exclude values are parsed but detector rule registries are not present yet
- baseline files, SARIF, SBOM, OSV, SAST, secrets, and IaC remain future Phase 3 slices

## Next action
1. Verify CI on the final documentation head of PR #7.
2. Mark PR #7 ready and squash merge if no blockers remain.
3. Begin Phase 3C with redaction primitives first, then the secret scanner.

## Resume protocol
Read this file, `CURRENT_STATE.md`, the Phase 3 design, and the active implementation plan before changing scanner behavior. Update this handoff whenever a scanner trust boundary changes.

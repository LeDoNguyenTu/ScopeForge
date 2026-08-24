# Phase 3H Docker IaC Scanning Implementation Plan

**Goal:** Start ScopeForge's IaC scanner with bounded, high-confidence Dockerfile security rules that reuse the existing hostile-repository inventory and normalized finding contracts.

**Architecture:** Add a dedicated `scanner-iac` family. The first parser is a bounded Dockerfile logical-instruction parser that treats Dockerfiles as hostile text, joins backslash continuations without executing shell content, ignores comments, and records source line spans. Docker rules operate only on parsed instruction structure and conservative command patterns. The scanner reads only inventory entries already classified as Docker infrastructure through `readInventoryEntry`.

## Constraints

- Never execute Dockerfiles, RUN commands, shell fragments, images, or build stages.
- Never contact registries or resolve image metadata.
- Read only bounded inventory entries through `readInventoryEntry`.
- Reject NUL-containing Dockerfiles as unsupported input.
- Cap logical instruction count and logical instruction length.
- Dynamic image references such as `${BASE_IMAGE}` are unknown, not automatically vulnerable.
- Avoid a missing-USER rule because inherited base-image USER metadata is not available locally. Only explicit effective root USER state is reported.
- Findings use stable ScopeForge fingerprints, exact source locations, redacted evidence, rule selection, deterministic ordering, and scanner diagnostics.

## Initial rules

1. `iac/docker-floating-base-image`
   - Flag `FROM` references that are explicitly `:latest` or have no tag/digest.
   - Skip `scratch`, digest-pinned images, explicit non-latest tags, and dynamic references.

2. `iac/docker-root-user`
   - Flag the final build stage only when its effective explicit `USER` is `root`, `0`, `root:*`, or `0:*`.
   - Do not flag intermediate-stage root use or a final stage with no explicit USER.

3. `iac/docker-remote-add`
   - Flag remote URL/Git sources used by `ADD`.

4. `iac/docker-download-pipe-shell`
   - Flag `RUN` instructions that pipe `curl` or `wget` output directly into `sh` or `bash`.

5. `iac/docker-world-writable-permissions`
   - Flag `RUN chmod 777` or `chmod 0777` patterns, including `chmod -R`.

## Task 1: Docker parser and rule unit tests

Files:
- Create: `packages/scanner-iac/docker/types.ts`
- Create: `packages/scanner-iac/docker/parse.ts`
- Create: `packages/scanner-iac/rules/types.ts`
- Create: `packages/scanner-iac/rules/builtin.ts`
- Create: `packages/scanner-iac/docker/scan.ts`
- Test: `tests/scanner/iac/docker-parser.test.ts`
- Test: `tests/scanner/iac/docker-rules.test.ts`

Coverage:
- comments and blank lines
- CRLF/LF
- backslash continuations
- stage aliases and `--platform`
- tagged, untagged, latest, digest, scratch, registry-port, and dynamic FROM references
- final-stage explicit root vs later non-root USER
- remote ADD
- curl/wget pipe-to-shell
- chmod 777
- false-positive controls in comments and unrelated instructions
- parser budgets

## Task 2: Scanner integration and built-in registration

Files:
- Create: `packages/scanner-iac/findings/create-finding.ts`
- Create: `packages/scanner-iac/scanner.ts`
- Create: `packages/scanner-iac/index.ts`
- Modify: `packages/cli/builtins.ts`
- Test: `tests/scanner/iac/scanner.test.ts`
- Test: `tests/scanner/iac/builtins.test.ts`

Coverage:
- inventory-only Dockerfile reads
- malformed/binary/budget diagnostics
- rule include/exclude behavior
- deterministic stable fingerprints
- built-in `iac` scanner selection and rule listing

## Task 3: CLI/security regression coverage and documentation

Files:
- Test: `tests/scanner/iac/cli-integration.test.ts`
- Test: `tests/scanner/iac/security-regressions.test.ts`
- Modify: `README.md`

Coverage:
- CLI detects Docker findings without executing RUN commands
- scanner remains network-free
- comments and quoted lookalikes do not create findings
- findings never include arbitrary command output or secrets

## Verification gate

- `npm test`
- `npm run typecheck`
- `npm run build:cli`
- `node .scopeforge-build/packages/cli/index.js version`
- `npm run build`

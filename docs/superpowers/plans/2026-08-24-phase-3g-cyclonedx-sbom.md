# Phase 3G CycloneDX SBOM Implementation Plan

**Goal:** Add standards-compliant CycloneDX 1.7 JSON SBOM generation to the local ScopeForge CLI without depending on OSV or any network lookup.

**Architecture:** Reuse the normalized JavaScript dependency inventory introduced in Phase 3F. Build CycloneDX data models with the maintained `@cyclonedx/cyclonedx-library`, serialize through its JSON normalizer/serializer, and expose the artifact through `scopeforge scan [path] --sbom <file>`. Repository reads remain behind the bounded inventory/read boundary and artifact writes remain behind the safe output boundary.

## Constraints

- Use the official maintained CycloneDX JavaScript library rather than hand-implementing the specification.
- Emit CycloneDX JSON using specification 1.7.
- SBOM generation must work with OSV disabled and must never require network access.
- Include an application/root component, discovered dependency components, versions, purls, ScopeForge tool metadata, timestamp, serial number, and root-to-direct-dependency relationships.
- Preserve deterministic component/dependency ordering. Time and serial generation must be injectable so tests can verify byte-stable output.
- Reuse `collectNpmDependencies`; do not create another dependency parser.
- Malformed supported dependency files must make SBOM generation fail safely rather than silently emit an incomplete clean artifact.
- `--sbom` output paths must use the existing no-follow safe output boundary.
- Do not execute repository code, package scripts, manifests, or lockfiles.

## Task 1: Add CycloneDX library and SBOM model builder

Files:
- Modify: `package.json`
- Create: `packages/scanner-sca/sbom/generate.ts`
- Create: `packages/scanner-sca/sbom/types.ts`
- Test: `tests/scanner/sca/sbom.test.ts`

Coverage:
- CycloneDX 1.7 envelope
- root application component from root `package.json` with safe fallback to repository directory name
- npm dependency components with version and purl
- root dependency relationships for direct dependencies
- ScopeForge tool metadata
- injectable fixed timestamp and serial number
- deterministic ordering
- malformed dependency metadata returns structured errors and no SBOM

## Task 2: Add CLI `--sbom` artifact output

Files:
- Modify: `packages/cli/run-cli.ts`
- Test: `tests/scanner/sca/sbom-cli.test.ts`

Coverage:
- `scopeforge scan . --sbom scopeforge.cdx.json`
- SBOM generation works with default offline OSV policy
- normal terminal/JSON finding output remains unchanged
- safe output refuses symlinks and repository-config traversal
- SBOM generation errors produce scanner-error exit semantics

## Task 3: Documentation and verification

Files:
- Modify: `README.md`

Document:
- supported package sources
- CycloneDX 1.7 output command
- independence from OSV/network enrichment
- artifact safety boundary

Verification gate:
- `npm test`
- `npm run typecheck`
- `npm run build:cli`
- `node .scopeforge-build/packages/cli/index.js version`
- `npm run build`

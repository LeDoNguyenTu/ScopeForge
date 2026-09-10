# Phase 10A1 GitHub Connected Projects Working State

Date: 2026-09-10
Branch: `feat/phase-10a-github-connected-projects`
PR: #74
Status: Tasks 1-3 implemented, production unchanged

## Completed in branch

- Shared strict boolean runtime-capability parser for hosted repository snapshot and repository scan gates.
- GitHub App server-only configuration loader with no `NEXT_PUBLIC_` secret fallback.
- Ten-minute HMAC-signed user/workspace connection state with constant-time signature verification.
- RS256 GitHub App JWT signing using Node crypto.
- Fixed-endpoint GitHub provider client for OAuth code exchange, authenticated-user installation discovery, installation token minting, installation repository listing, and immutable repository-ID lookup.
- Installation tokens can be restricted to a single repository ID and request only `contents: read` plus `metadata: read`.
- GitHub provider responses are normalized and bounded; provider error bodies are not surfaced.
- REST requests pin GitHub API version `2026-03-10`.
- Forward-only `github_connections` and `github_repository_links` schema with one installation per workspace in v1.
- Same-workspace composite foreign keys bind repository links to their exact connection and repository asset.
- Authenticated workspace members receive read-only RLS visibility; browser roles receive no integration-table mutation authority.
- GitHub connection/link rows contain safe provider metadata only and no secret/token fields.
- Narrow Phase 10A1 database type overlay for both integration tables.

## Validation history

The current environment cannot clone GitHub directly, so intermediate commits use `[skip ci]` and no local-test claim is made.

Checkpoint `c290bb69f6ad572a6419eab6754ec29d3a2d94b5` failed only in the JWT verification test helper. The helper was corrected to verify with the already-public Node key object.

Checkpoint `b1d3c587ede2f9f1a7955661592609a4574a3ffa` then passed all 1,596 tests. Typecheck exposed two overly broad environment parameter types: the hosted capability helper and GitHub App config loader accepted this repository's augmented `NodeJS.ProcessEnv`, which requires unrelated `NODE_ENV`. Both now accept narrow read-only environment maps while defaulting safely to `process.env`.

Task 3 schema/type contract tests were written before the migration/type implementation. This commit intentionally starts one consolidated exact-head validation for Tasks 1-3 and the TypeScript fixes.

## Production state

No Phase 10A1 database migration has been applied to the ScopeForge production Supabase project. The verified production migration head remains `20260908084554_phase_9c_function_acl_hardening` at this checkpoint. No GitHub App secrets or ephemeral tokens are stored in the repository or Phase 10A1 schema.

## Next tasks

1. Resolve any exact-head Task 3 validation failure.
2. Implement owner/admin-only connection start and callback routes with same-user/same-workspace state validation.
3. Implement repository picker/import and safe asset linkage.
4. Wire automatic snapshot-to-scan continuation while retaining runtime gates default-off until release validation.
5. Add project-level read model/UI and complete release documentation.

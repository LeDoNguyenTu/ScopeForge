# Phase 10A1 GitHub Connected Projects Working State

Date: 2026-09-10
Branch: `feat/phase-10a-github-connected-projects`
PR: #74
Status: Task 1 and GitHub App security primitives implemented, production unchanged

## Completed in branch

- Shared strict boolean runtime-capability parser for hosted repository snapshot and repository scan gates.
- GitHub App server-only configuration loader with no `NEXT_PUBLIC_` secret fallback.
- Ten-minute HMAC-signed user/workspace connection state with constant-time signature verification.
- RS256 GitHub App JWT signing using Node crypto.
- Fixed-endpoint GitHub provider client for OAuth code exchange, authenticated-user installation discovery, installation token minting, installation repository listing, and immutable repository-ID lookup.
- Installation tokens can be restricted to a single repository ID and request only `contents: read` plus `metadata: read`.
- GitHub provider responses are normalized and bounded; provider error bodies are not surfaced.
- REST requests pin GitHub API version `2026-03-10`.
- Tests added for configuration, signed state, JWT signing, provider request boundaries, token scope, pagination, repository normalization, and error sanitization.

## Validation strategy

The current environment cannot clone GitHub directly, so intermediate commits use `[skip ci]` and no local-test claim is made. This commit intentionally starts one consolidated GitHub Actions validation checkpoint for the Task 2 implementation.

## Production state

No Phase 10A1 database migration has been applied to the ScopeForge production Supabase project. The verified production migration head remains `20260908084554_phase_9c_function_acl_hardening` at this checkpoint. No GitHub App credentials or installation tokens are stored in the repository.

## Next tasks

1. Resolve any exact-head Task 2 CI failures.
2. Add the forward-only GitHub connection and repository-link schema with tenant-scoped RLS.
3. Implement owner/admin-only connection and callback routes with same-user/same-workspace state validation.
4. Implement repository picker/import and safe asset linkage.
5. Wire automatic snapshot-to-scan continuation while retaining runtime gates default-off until release validation.

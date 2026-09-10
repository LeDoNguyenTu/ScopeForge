# Phase 10A1 GitHub Connected Projects Working State

Date: 2026-09-10
Branch: `feat/phase-10a-github-connected-projects`
PR: #74
Status: Tasks 1-5 implemented through repository import, production GitHub integration not enabled

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
- Owner/admin-only GitHub connection authorization service.
- Two-stage installation setup and GitHub user OAuth callback that does not trust `installation_id` by itself.
- The signed state is revalidated against the exact current ScopeForge user and workspace before OAuth and again before persistence.
- A pending installation is persisted only after it appears in the authenticated GitHub user's installation list.
- Temporary GitHub user OAuth tokens exist only inside the completion call and are never returned or stored.
- Secure HttpOnly, Secure, SameSite=Lax setup cookies are callback-scoped, bounded to ten minutes, and cleared on terminal success/failure.
- GitHub callback redirects expose only bounded status/error codes and never provider tokens or authorization codes.
- Provider configuration requirements are documented in `docs/development/PHASE_10A1_GITHUB_APP_SETUP.md`.
- Owner/admin-only connected repository discovery with bounded pagination and server-minted installation tokens.
- Repository import accepts only a numeric repository ID from the browser and re-fetches all authoritative repository metadata through a repository-scoped installation token.
- Exact same-workspace repository assets are reused; cross-workspace or mismatched linkage fails closed.
- Repository assets become verified only after fresh GitHub installation access succeeds.
- Duplicate repository imports are idempotent and refresh safe link metadata.
- Private repositories can be linked as projects but are explicitly reported as ineligible for the existing public Phase 6B acquisition path.
- Connected-project UI includes connected/disconnected states, repository visibility/default branch context, pagination, and a prominent GitHub import path while preserving manual web/API registration.

## Validation history

The current environment cannot clone GitHub directly, so intermediate commits use `[skip ci]` and no local-test claim is made.

Checkpoint `c290bb69f6ad572a6419eab6754ec29d3a2d94b5` failed only in the JWT verification test helper. The helper was corrected to verify with the already-public Node key object.

Checkpoint `b1d3c587ede2f9f1a7955661592609a4574a3ffa` passed all 1,596 tests and exposed only two overly broad environment parameter types during typecheck. Those were narrowed safely.

Checkpoint `f4020265f4d884588147f8f278370f1c4e2d35ab` passed the complete CI pipeline for Tasks 1-3, including unit tests, typecheck, build, benchmarks, CSP browser smoke, production diagnostic, and visual artifact upload.

Checkpoint `8cd1983b5b9d54fc2300bd1f27c288ef2f268793` passed the complete CI pipeline for Task 4, including the GitHub authorization/callback tests, full unit suite, typecheck, build, benchmarks, CSP browser smoke, production diagnostic, and visual artifact upload.

Phase 10C was subsequently merged to `main` at `1151af2dddb76737ee2f0a0d1a802f06a975d318`. GitHub currently reports PR #74 as mergeable; its cached PR base SHA has not yet refreshed to that merge in every API surface. Before release, the branch will be reconciled against the actual `main` head and revalidated.

Task 5 tests were committed before the repository discovery/import service and UI. This commit intentionally starts one consolidated exact-head validation for the completed repository-import checkpoint.

## Production state

No Phase 10A1 database migration has been applied to the ScopeForge production Supabase project. The production migration head now includes the merged Phase 10C migration set. No GitHub App secrets or ephemeral tokens are stored in the repository or Phase 10A1 schema.

The live GitHub App provider settings and six required server-only Vercel environment values are not yet claimed as configured. The Connect GitHub feature must not be considered production-enabled until provider configuration and live callback verification are completed.

Hosted repository snapshot and repository scan runtime gates remain independently default-off and are not bypassed by Phase 10A1.

## Next tasks

1. Resolve any exact-head Task 5 validation failure.
2. Reconcile the branch against the actual current `main` head before release validation.
3. Wire one-click project scan orchestration and automatic snapshot-to-scan continuation while retaining runtime gates.
4. Add project-level read model/UI and complete release documentation.
5. Apply the Phase 10A1 schema only when application/provider configuration is sufficiently ready for safe rollout.

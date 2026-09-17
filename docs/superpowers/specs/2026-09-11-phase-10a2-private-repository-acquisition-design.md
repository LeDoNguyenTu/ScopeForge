# Phase 10A2 Private Repository Acquisition Design

Status: approved by user on 2026-09-11
Date: 2026-09-11
Stacked baseline: Phase 10A1 PR #74 exact verified head `30e8b880fd7fd44e8ea40e59501c6565accdfb85`
Target integration order: Phase 10A1 -> Phase 10A2

## Goal

Phase 10A2 extends the connected-project workflow so a GitHub repository linked and verified through the ScopeForge GitHub App can be acquired and scanned even when the repository is private, without widening the existing public-repository execution class or exposing reusable GitHub credentials to workers.

The user-facing flow remains:

```text
Connect GitHub
  -> select repository
  -> verified ScopeForge project
  -> Scan project
  -> immutable source snapshot
  -> isolated repository scan
  -> findings
```

For a private repository, the control plane obtains a single short-lived source capability for the exact claimed worker attempt. The worker receives only that bounded source capability and never receives a GitHub App private key, App JWT, user OAuth token, installation access token, client secret, or state secret.

## Security decision

The original Phase 10A1 roadmap said Phase 10A2 could mint a repository-scoped installation token for an exact worker attempt. Phase 10A2 deliberately tightens that boundary further:

- the installation token is minted and consumed only by the trusted ScopeForge control plane
- the control plane uses it to revalidate the exact private repository and resolve the default-branch commit
- the control plane requests GitHub's repository archive endpoint and obtains the temporary redirect for that exact immutable commit
- the installation token is discarded before the worker response is produced
- the worker receives only an ephemeral archive lease containing the exact validated `codeload.github.com` URL plus non-secret immutable source identity
- the archive lease is never persisted in application tables, audit events, worker task history, findings, source snapshot provenance, or logs

GitHub documents repository archive redirects as temporary (five minutes) and allows GitHub App installation access tokens for private repository archive download when the App has `Contents: read`. This design treats the redirect URL itself as a secret bearer capability and applies a stricter application lifetime when possible.

## Why a separate execution class is mandatory

The existing Phase 6B class is intentionally public-only:

```text
repository_snapshot_github_public_v1
```

Its network client rejects repository metadata unless `private === false` and uses unauthenticated GitHub repository acquisition. That boundary must remain unchanged.

Phase 10A2 adds:

```text
repository_snapshot_github_private_v1
```

with a distinct network policy:

```text
github_private_archive_lease_and_attempt_artifact_put_v1
```

This prevents a future change to private acquisition from silently broadening the public class, its provider assumptions, or its network authority.

## Runtime capability boundary

Private acquisition carries stronger provider authority than public acquisition, so it gets its own server-only capability gate:

```text
HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED
```

The existing gates remain independent:

```text
HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED
HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED
HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED
HOSTED_ACTIVE_CORS_WORKER_ENABLED
```

Only the exact string `true` enables the new private gate. Missing, empty, malformed, or any other value is false.

Phase 10A2 implementation does not authorize enabling any hosted capability in production. The private flag must remain false/absent until a separate private-acquisition canary and rollback acceptance is completed.

## Private project request flow

When an owner/admin requests a scan for a connected private repository:

1. ScopeForge reauthorizes the current workspace and asset.
2. It loads the active GitHub repository link and connection.
3. It re-fetches the exact repository using a repository-scoped installation token.
4. It verifies repository ID, canonical owner/name URL, private visibility, installation scope, and active link state.
5. If the private runtime gate is off, it returns a truthful `private_snapshot_runtime_unavailable` state and creates no worker task.
6. If enabled, it creates an idempotent private snapshot intent containing only safe stable metadata.
7. The existing project-scan intent records the same high-level workflow state used by public connected projects.

No archive URL or GitHub token is generated during the browser action. This prevents a queued task from containing a capability that may expire before a worker is ready.

## Persisted private snapshot intent

A private snapshot task may persist only the metadata required to reconstruct authorization at claim time:

- workspace ID
- asset ID
- project scan intent ID
- GitHub connection ID
- GitHub repository link ID
- numeric GitHub repository ID
- canonical repository URL
- expected owner login
- expected repository name
- requested-by user ID
- timestamps, state, attempts, and worker-control identifiers

It must not persist:

- GitHub App private key
- App JWT
- client secret
- user OAuth code/token
- installation access token
- temporary archive redirect URL
- `Authorization` headers
- R2 secret credentials

The database and generated/type-overlay contracts must contain tests that explicitly reject token/credential-style columns in the new private-acquisition state.

## Claim-time source lease broker

The worker claim route remains authenticated and body-free.

After the worker-control layer atomically claims a `repository_snapshot_github_private_v1` task and issues its lease token, the trusted claim-response broker performs these steps:

1. Load the exact claimed task and private snapshot intent using the task ID and attempt/lease context.
2. Verify the linked repository still belongs to the same workspace and asset.
3. Verify the GitHub connection is still `active` and the repository link is still `active` and private.
4. Mint a short-lived installation token restricted to the exact GitHub repository ID with only `contents: read` and `metadata: read`.
5. Re-fetch repository metadata using the installation token; require exact repository ID, canonical URL and `private === true`.
6. Resolve the exact current default branch and immutable commit SHA.
7. Request GitHub's tarball archive endpoint for that commit using the installation token.
8. Require one expected temporary redirect and validate the redirect as HTTPS on `codeload.github.com` under the existing DNS/IP/TLS safety primitives.
9. Destroy/discard the installation token and provider authorization material.
10. Return a private source lease only inside this successful authenticated claim response.

The private source lease contains:

```ts
interface GitHubPrivateArchiveLease {
  kind: "github_private_archive_lease_v1";
  canonicalRepositoryUrl: string;
  defaultBranch: string;
  resolvedCommitSha: string;
  archiveUrl: string;
  expiresAt: string;
}
```

`archiveUrl` is secret-bearing. It must never be included in structured telemetry, audit metadata, exception messages, terminal result payloads, snapshot provenance, or persisted worker state.

The response must not contain the installation token or any raw GitHub authorization header.

## Lease lifetime and retry semantics

The broker accepts GitHub's provider lifetime as an outer bound but gives the worker a bounded application lease. The worker must start the archive request before `expiresAt` and fail closed if the lease is already expired.

If the private archive lease expires or cannot be used:

- the attempt fails with a bounded non-secret failure code
- no stale archive URL is reused
- a retry must claim a new attempt and obtain a fresh source lease after fresh repository authorization

A retry never refreshes the GitHub source lease inside an already-running executor. This keeps provider authorization centralized and attempt-bound.

## Private worker network authority

The private worker does not call `api.github.com`.

Its only external authorities are:

1. the exact claim-provided HTTPS `codeload.github.com` archive URL
2. the existing attempt-specific presigned private R2 `PUT`

The network policy validates:

- HTTPS only
- hostname exactly `codeload.github.com` for archive acquisition
- public-address DNS classification
- pinned HTTPS transport with Host/SNI/certificate identity retained
- no redirects from the codeload request
- no caller-controlled arbitrary host, port, method, headers, or request body
- bounded content length and streamed byte ceiling
- no provider authorization header on the codeload request

The source URL is not accepted from browser input or persisted task metadata. It is trusted only because the control plane generated and validated it for the exact claim.

## Worker contract

The private execution contract is separate from the public contract.

Conceptually:

```ts
interface PrivateRepositorySnapshotInput {
  kind: "repository_snapshot_github_private";
  owner: string;
  repository: string;
  canonicalRepositoryUrl: string;
  privateArchiveLease: GitHubPrivateArchiveLease;
  artifactUpload: RepositorySnapshotUploadDescriptor;
}
```

The worker-contract validator requires:

- execution class exactly `repository_snapshot_github_private_v1`
- input kind exactly `repository_snapshot_github_private`
- source lease kind exactly `github_private_archive_lease_v1`
- canonical URL and resolved commit consistency
- bounded URL/string sizes
- valid future expiry at validation/execution start
- no unknown keys, token fields, headers, credentials, or generic request options

The public execution class continues to accept only `repository_snapshot_github_public` and must reject the private input shape.

## Snapshot executor

The private snapshot executor reuses the hardened archive-processing and bundle-writing primitives from Phase 6B but has a distinct acquisition adapter.

Execution sequence:

1. validate private worker contract and source-lease lifetime
2. open the exact codeload archive URL under the private network policy
3. stream the archive under the existing compressed byte ceiling
4. parse hostile tar/gzip content under the existing path/type/count/size protections
5. produce the deterministic repository snapshot bundle
6. upload the bundle using the attempt-specific R2 descriptor
7. return non-secret immutable repository identity and digest metadata
8. destroy scratch state in `finally`

It does not run repository code, package managers, Git, hooks, LFS, submodules, build scripts, container builds, or repository-provided executables.

## Snapshot publication and provenance

Published private snapshots use the existing immutable snapshot table and scan boundary, but provenance must distinguish the source class.

The allowed source kind gains an explicit second value:

```text
github_public_archive
github_private_archive
```

Existing public rows remain unchanged. New private publication must derive `github_private_archive` from the trusted worker execution class, never from browser/task input.

The published record may contain safe immutable provenance:

- canonical repository URL
- default branch
- resolved commit SHA
- content/artifact digests
- retained file/byte counts
- source kind `github_private_archive`

It must never contain the temporary archive URL or GitHub credentials.

The existing repository scan execution remains zero-egress and consumes only the immutable snapshot artifact. Once a private snapshot publishes successfully, the Phase 10A1 continuation path can enqueue the same repository scan class when `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED` is enabled.

## Idempotency and race safety

Private scan request and publication follow existing project-scan idempotency rules:

- repeated user request while the same project intent is active must not create duplicate snapshot tasks
- replayed worker claim/finalization must not create duplicate published snapshots
- snapshot publication must remain cancellation-safe
- automatic continuation must remain exact-snapshot-bound
- if GitHub access changes between request and worker claim, claim-time source authorization fails closed
- if repository visibility changes from private to public or repository identity changes, the private broker fails closed instead of silently switching classes

A future request can explicitly take the public path after fresh provider metadata confirms the repository is public.

## Error model

Private provider errors are mapped to bounded product/worker codes. No raw provider body, URL query, token, or authorization header is surfaced.

Representative states:

- `PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_UNAVAILABLE`
- `PRIVATE_REPOSITORY_ACCESS_REVOKED`
- `PRIVATE_REPOSITORY_IDENTITY_CHANGED`
- `PRIVATE_REPOSITORY_VISIBILITY_CHANGED`
- `PRIVATE_REPOSITORY_SOURCE_LEASE_FAILED`
- `PRIVATE_REPOSITORY_SOURCE_LEASE_EXPIRED`
- `PRIVATE_REPOSITORY_ARCHIVE_UNAVAILABLE`
- existing archive safety/budget/upload failure codes where semantics are identical

Logs may contain task/attempt IDs and bounded failure codes, but never `archiveUrl` or credential material.

## UI behavior

Phase 10A2 removes the Phase 10A1 placeholder that says private scanning requires a future worker.

For a linked private repository:

- if private snapshot runtime is disabled, the project panel says private acquisition is connected but unavailable on the hosted runtime
- if private snapshot runtime is enabled and scan runtime is disabled, ScopeForge may acquire/publish the immutable snapshot and truthfully wait for scan runtime
- if both are enabled, `Scan project` uses the private snapshot class and then the existing zero-egress scanner
- public repository behavior is unchanged

The user still sees one project-level workflow; worker/source-lease internals remain hidden.

## Database and RPC security

All new schema is forward-only.

Any new `SECURITY DEFINER` function:

- sets `search_path = ''`
- fully qualifies table/function references
- revalidates workspace/asset/task relationships
- revokes default execution from `PUBLIC`, `anon`, and `authenticated`
- grants only the minimum intended `service_role` execution

Browser roles receive no direct mutation authority over private snapshot intent/task state. Any browser-readable state is limited to non-secret project status already authorized by workspace RLS.

No source lease or credential-bearing value is stored in an exposed schema.

## Testing strategy

TDD must prove each boundary before implementation is accepted.

Required tests include:

1. new private execution class and network policy are distinct from public
2. private runtime gate defaults off and requires exact `true`
3. public contract rejects private input and private contract rejects public input
4. private contract contains no installation-token/header/credential field
5. private request cannot enqueue when private runtime is off
6. private request revalidates exact repository identity/visibility
7. persisted private intent contains no credential/archive lease
8. claim broker mints a repository-restricted read-only installation token only after a successful private task claim
9. broker discards token and returns no token/header in the claim payload
10. broker rejects inactive connection/link, cross-workspace mapping, changed repository ID/URL, or changed visibility
11. broker validates only the expected codeload HTTPS redirect and rejects arbitrary hosts
12. private worker never calls `api.github.com`
13. private worker sends no GitHub authorization header to codeload
14. expired source lease fails before network execution
15. hostile archive/path/size protections remain identical to the public snapshot path
16. result/provenance contains no archive URL or credential
17. publication derives `github_private_archive` only from trusted private execution class
18. finalization replay and project continuation remain idempotent and exact-snapshot-bound
19. public repository acquisition regression tests remain unchanged and green
20. strict CSP, Phase 10C admin, dashboard/V5, worker authorization, and scanner gates remain green

## Release and operational gates

Phase 10A2 is stacked on Phase 10A1 and cannot release ahead of it.

Before merge/release:

1. Phase 10A1 must be safely merged after its production schema/provider gates are satisfied.
2. Phase 10A2 must be rebased/retargeted to released `main` and revalidated.
3. Exact-head unit tests, typecheck, CLI build/version, scanner benchmark matrix, Next.js production build, CSP browser smoke, and production diagnostics must pass.
4. Any Phase 10A2 migration must be freshly reconciled/applied to the ScopeForge Supabase project only, followed by targeted ACL/schema verification and Security Advisor.
5. GitHub App provider permission must remain read-only and sufficient for private archive access.
6. A private-repository canary must prove claim-time authorization, temporary source lease download, immutable publication, zero credential leakage, retry behavior, and rollback.
7. `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` remains false/absent until that canary passes.
8. Existing public snapshot, repository scan, passive runtime, and active CORS flags remain independently gated.
9. Full changed-file security review must find no reusable GitHub credential crossing the control-plane boundary.
10. Post-merge `main` and exact production deployment must be verified independently.

## Explicitly out of scope

Phase 10A2 does not add:

- GitHub webhooks or continuous scanning (Phase 10A3)
- deployment discovery or DAST authorization (Phase 10B)
- generic GitHub API worker access
- Personal Access Tokens
- repository write permissions
- browser-held GitHub tokens
- generic URL fetching
- arbitrary worker headers/methods/bodies
- repository code execution
- submodule/LFS acquisition
- package installation/build/test execution
- automatic hosted-runtime activation

## Success criteria

Phase 10A2 succeeds when a connected private GitHub repository can enter the same one-click ScopeForge project scan workflow as a public repository while preserving a stronger credential boundary: GitHub installation credentials remain control-plane-only, workers receive only an attempt-bound temporary archive capability, immutable snapshot provenance contains no secret capability, and the public acquisition execution class remains byte-for-byte semantically public-only.
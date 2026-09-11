# Phase 10A2 Private Repository Acquisition Working State

Last reconciled: 2026-09-11 (Asia/Singapore)

## Scope

Phase 10A2 extends the Phase 10A1 connected-project flow to private GitHub repositories without widening the existing public acquisition class.

Target product flow:

`connected private GitHub repository -> Scan project -> exact private snapshot -> existing zero-egress repository scan -> findings`

Active PR: #76

Active branch: `feat/phase-10a2-private-repository-acquisition`

The PR remains stacked on `feat/phase-10a-github-connected-projects` until Phase 10A1 is safely released. It must not be merged to `main` ahead of Phase 10A1.

## Implemented architecture

Phase 10A2 introduces the distinct execution class:

`repository_snapshot_github_private_v1`

The existing `repository_snapshot_github_public_v1` path remains fail-closed to public repositories. Public acquisition continues to require GitHub metadata with `private === false`.

Private acquisition uses a separate runtime capability:

`HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`

Like the other hosted capability flags, it is disabled unless the environment value is explicitly `true`.

## Credential boundary

Long-lived GitHub App material and installation access tokens remain control-plane-only.

The worker contract does not contain a GitHub installation token, Authorization header, GitHub App private key, OAuth credential or client secret.

After the authenticated worker claims the exact private snapshot task, trusted control-plane code revalidates the linked GitHub repository and resolves a temporary GitHub archive redirect. The worker receives only an attempt-bound `github_private_archive_lease_v1` capability containing bounded repository identity, immutable commit SHA, temporary codeload URL and expiry.

The private worker executor does not call `api.github.com` and cannot mint or refresh provider credentials.

## Network and execution boundary

The private snapshot worker may read only the exact validated `codeload.github.com` archive capability supplied for the claimed attempt and may write only through the existing attempt-scoped repository snapshot artifact upload descriptor.

Repository source remains hostile data. The private worker does not execute repository code, package managers, install hooks, Git hooks, Dockerfiles, workflows, submodules, Git LFS commands or project binaries.

The produced archive is normalized through the same bounded repository snapshot parser/bundle pipeline used by public acquisition.

## Connected-project orchestration

A private connected-project scan performs fresh GitHub provider revalidation before enqueueing.

Visibility is part of the stored and provider-revalidated repository identity. A public/private visibility change fails closed as a repository identity mismatch rather than silently switching acquisition classes.

When the private runtime gate is disabled, the project remains connected but no private acquisition task is queued.

When enabled, the control plane uses a dedicated private connected-project enqueue RPC that atomically creates the private snapshot task and records the project scan intent. It never falls back to the public snapshot enqueue RPC.

Successful private snapshot publication is recognized by the authenticated worker finalize route and enters the existing connected-project continuation path.

The continuation remains bound to the exact published `snapshotTaskId` and `snapshotId`. The repository scanner consumes that exact immutable snapshot. Recovery for `waiting_scan_runtime`, `retry_pending` and replayed `scan_queued` state reuses the published snapshot instead of reacquiring source.

## Database authority

Phase 10A2 uses forward migrations. Already-applied Phase 10A1 migrations are not rewritten.

Privileged orchestration RPCs remain `SECURITY DEFINER` with pinned search paths and explicit execute grants only to `service_role`. Browser roles do not receive direct authority over private snapshot task or scan-continuation persistence.

The Phase 10A2 database TypeScript overlay composes the Phase 10A1 connected-project surface with the Phase 6D worker-control RPC surface and the Phase 10A2 private repository RPCs.

## Permanent architecture guards

`tests/repository-snapshots/private-acquisition-architecture.test.ts` pins the following boundaries:

- provider credentials are absent from worker contracts, private execution and snapshot publication,
- the public GitHub acquirer still rejects private metadata,
- the private executor cannot call the GitHub API control plane,
- worker claim remains request-body-free and authenticated,
- hosted repository capability flags remain default-off unless explicitly `true`,
- new Phase 10A2 orchestration RPCs have explicit service-role ACLs.

## Current validation status

Task 1 through Task 5 implementation is present on PR #76, and Task 6 architecture guards/documentation are being reconciled.

Do not describe Phase 10A2 as release-ready until the exact candidate head has passed the complete repository validation matrix:

- `npm audit --audit-level=info`
- `npm test`
- `npm run typecheck`
- `npm run build:cli`
- CLI version execution
- scanner benchmark
- matrix benchmark
- production Next.js build
- CSP browser smoke and production diagnostic checks
- changed-file security review

## Production/provider gate

The implementation does not itself authorize the production private worker runtime.

Before production activation:

1. Reconcile PR #76 onto released Phase 10A1/main.
2. Read the exact ScopeForge Supabase production migration head through a supported management surface.
3. Apply only the reviewed forward Phase 10A2 migrations that are absent.
4. Verify function ACLs, RLS/private-table privileges and Security Advisor.
5. Verify the GitHub App installation has only the intended read-only repository permissions and can access the selected private repository.
6. Verify the dedicated private worker deployment and rollback procedure.
7. Enable `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` only for the accepted canary environment.
8. Run a private repository canary from GitHub connection through exact snapshot publication and zero-egress repository scan.
9. Confirm no token, source archive URL or private source content appears in browser state or ordinary application logs.
10. Roll back the flag immediately if identity, credential, network, publication or containment invariants fail.

## Known operational blockers

The latest work has not established a fresh supported Supabase production management session, so production migration state must not be inferred from repository files alone.

Vercel preview failures observed on this line of work have included Hobby-plan build-rate/quota conditions. Those external quota failures must not be misclassified as application build failures, but an independent successful build is still required for the exact release candidate.

## Release rule

Keep PR #76 stacked/draft or otherwise non-releasable until Phase 10A1 is safely released and the complete Phase 10A2 exact-head validation, production schema/provider checks and private canary are all satisfied.

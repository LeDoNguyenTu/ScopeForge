# Phase 10A2 Private Repository Acquisition Working State

## Continuation checkpoint - 2026-09-12

This checkpoint supersedes the older release status below.

- PR #74 merged as `33d21de652f3c04aa88ebd4f122348803e59b153` after final CI run `34678875883` succeeded (387 files, 1,726 tests, audit 0, typecheck, builds, benchmarks and browser acceptance).
- Vercel production deployment `dpl_BFbUfBRQKCbMgHViMhsXX5kvfTYk` is READY for that merge.
- Fresh production GET probes confirmed both GitHub connect and callback return HTTP 307 to `https://scopeforge.dev/dashboard/integrations/github?error=disabled`. Callback clears both transient cookies with Secure, HttpOnly and SameSite=Lax attributes.
- GitHub provider configuration and authenticated connection/import acceptance remain unverified. No integration or worker runtime flag was enabled.
- PR #76 now targets `main`. This reconciliation merges released main into Phase 10A2, retaining the Phase 10C admin console, GitHub release gate and private acquisition capability. The sole conflict in `docs/ENVIRONMENT.md` was resolved by retaining both the release-gate instructions and private archive lease secrecy rule.
- Local integrated validation: `npm test` passed 402 files / 1,787 tests; `npm run typecheck` exited 0; `git diff --check` passed.
- PR #76 remains draft. Provider/worker containment and private end-to-end canaries remain required before release. Phase 10A2/10A3 production migrations were not applied in this continuation.
- Next: propagate this reconciliation into PR #77, validate the combined candidate, then complete provider configuration and runtime acceptance in order. Earlier CI records below describe historical candidates only.


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

## Worker supervisor integration

The shared worker supervisor now recognizes the private repository execution class without widening the legacy public executor contract.

Private tasks are dispatched only to the dedicated private repository snapshot executor. Successful terminal output is validated against a closed private terminal schema and additionally bound by the supervisor to the claimed canonical repository URL, default branch and immutable commit SHA before trusted finalization.

The generic finalizer cannot publish a successful private snapshot. Success must pass through the repository snapshot publication service, including server-observed artifact size verification. Private failure and cancellation use the dedicated budget-aware failure path.

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

`tests/workers/private-supervisor-integration.test.ts` additionally pins private dispatcher routing and successful private terminal acceptance through the shared supervisor.

## Validation evidence

Exact executable candidate:

`3b1957871103885ac4fd26e3d3ff91f5d4a5a24f`

GitHub Actions CI #897 / run `34606962246`: SUCCESS.

That exact executable candidate passed:

- dependency installation,
- `npm audit --audit-level=info` with 0 vulnerabilities,
- 392 Vitest files and 1,731 tests,
- `npm run typecheck`,
- `npm run build:cli`,
- CLI version execution,
- scanner benchmark,
- matrix benchmark,
- production Next.js build,
- strict CSP browser smoke,
- production V5/Turnstile diagnostic,
- UI artifact upload step.

The Phase 10A2 changed-file security review also completed without an identified release-blocking code defect. The review covered provider credential leakage, archive-capability persistence/logging boundaries, arbitrary egress, public/private class separation, cross-workspace/task binding, lease expiry/retry handling, privileged RPC ACLs, exact-snapshot continuation and runtime-gate bypass.

Any executable change after the candidate above invalidates that executable evidence and requires a fresh complete validation run.

## Production/provider gate

The successful repository validation does not itself authorize the production private worker runtime or make PR #76 releasable.

Before production activation:

1. Safely release Phase 10A1 and reconcile PR #76 onto that released baseline.
2. Re-run the complete Phase 10A2 validation matrix after stack reconciliation.
3. Read the exact ScopeForge Supabase production migration head through a supported management surface.
4. Apply only the reviewed forward Phase 10A2 migrations that are absent.
5. Verify function ACLs, RLS/private-table privileges and Security Advisor.
6. Verify the GitHub App installation has only the intended read-only repository permissions and can access the selected private repository.
7. Verify the dedicated private worker deployment and rollback procedure.
8. Enable `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` only for the accepted canary environment.
9. Run a private repository canary from GitHub connection through exact snapshot publication and zero-egress repository scan.
10. Confirm no token, source archive URL or private source content appears in browser state or ordinary application logs.
11. Roll back the flag immediately if identity, credential, network, publication or containment invariants fail.

## Known operational blockers

The latest work has not established a fresh supported Supabase production management session, so production migration state must not be inferred from repository files alone.

Phase 10A1 remains unreleased and therefore PR #76 must remain stacked and non-releasable even with green Phase 10A2 executable validation.

Vercel preview failures observed on this line of work have included Hobby-plan build-rate/quota conditions. Those external quota failures must not be misclassified as application build failures. The repository-defined production build and browser diagnostics passed on CI #897.

## Release rule

Keep PR #76 stacked/draft or otherwise non-releasable until Phase 10A1 is safely released, PR #76 is reconciled and revalidated against that released baseline, and the production schema/provider/private-worker canary gates are all satisfied.

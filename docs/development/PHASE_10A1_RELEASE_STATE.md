# Phase 10A1 GitHub Connected Projects Release State

Last reconciled: 2026-09-11 (Asia/Singapore)

## Scope

Phase 10A1 implements the public-repository connected-project core:

1. connect a workspace to a GitHub App installation,
2. prove the signed-in GitHub user can access that installation,
3. browse repositories through short-lived installation credentials,
4. import a repository as a verified ScopeForge repository asset,
5. start one project-level scan action,
6. publish an immutable source snapshot,
7. continue to the repository scanner without exposing snapshot/worker internals as the primary UX,
8. safely resume an already-published snapshot when the scan runtime becomes available or a continuation retry is required.

Private repository source acquisition remains Phase 10A2 and is not routed through the public Phase 6B acquisition class.

## Release candidate

PR: #74
Branch: `feat/phase-10a-github-connected-projects`
Implementation candidate: `005504387cf29d65d6b297acb041b608f0416c1a`
Validation: CI #852 / run `34520609482` - SUCCESS

The exact candidate was validated as GitHub's PR merge result against current `main` (`1151af2dddb76737ee2f0a0d1a802f06a975d318`, Phase 10C included).

CI #852 passed:

- dependency audit with zero reported vulnerabilities,
- 386 test files / 1,719 tests,
- TypeScript typecheck,
- CLI build and version smoke,
- scanner benchmark,
- scanner matrix benchmark,
- Next.js production build,
- strict-CSP browser smoke,
- production V5 and Turnstile diagnostic,
- visual acceptance artifact upload.

## Security and correctness properties

- GitHub App configuration is server-only; no provider secret uses a `NEXT_PUBLIC_` variable.
- Connection state is signed, time-bounded, and bound to the exact ScopeForge user/workspace.
- GitHub's setup `installation_id` is not treated as proof of ownership. Persistence occurs only after the authenticated GitHub user lists the selected installation.
- Temporary GitHub user OAuth tokens and installation tokens are not persisted.
- Installation tokens are short-lived, read-only and repository-scoped when operating on one repository.
- Repository import accepts only a numeric repository ID from the browser and re-fetches authoritative metadata through GitHub.
- Integration mutations are owner/admin-only and server-side.
- Browser-visible connection/link tables are read-only through workspace-scoped RLS; worker identifiers remain in a private table.
- Every Phase 10A1 `SECURITY DEFINER` RPC explicitly revokes default execution and grants only the intended service role.
- Public and private repository execution classes remain separated. Phase 10A1 never sends private source to the public acquisition worker.
- Hosted snapshot and repository-scan runtime gates remain independently fail-closed.

## Recovery regression fixed before release

Pre-release review found that a published connected-project snapshot could become stranded in `waiting_scan_runtime` or `retry_pending`. The original continuation also delegated to the generic repository-scan enqueue RPC, which chooses the newest eligible snapshot. If a newer snapshot appeared before delayed recovery, a wrong-snapshot job could be created before the post-enqueue mismatch check rejected it.

The release candidate fixes this with:

- an owner/admin service-role recovery lookup,
- a bounded `Resume project scan` path for waiting/retry states,
- fresh GitHub access revalidation before recovery,
- no second snapshot creation during recovery,
- a dedicated exact-snapshot enqueue transaction that selects `s.id = target_snapshot_id` before creating scan work,
- idempotent replay for an already queued scan,
- regression tests covering waiting, retry, runtime-off, no-pending and newer-snapshot cases.

The recovery RED checkpoint preserved 1,711 passing existing tests while exactly eight new recovery assertions failed. The subsequent GREEN candidate passed all 1,719 tests.

## Released baseline and production truth

Current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
Current production deployment: `dpl_AueSXj9wWBDMkRTRLAb6x8nsH57z`
Production domain: `scopeforge.dev`
Production deployment state: READY

That released baseline includes Phase 10C platform administration. Phase 10A1 has not been merged or claimed as production-enabled by this document.

### Supabase

The last verified Phase 10C production migration state is documented in `PHASE_10C_WORKING_STATE.md`:

- `20260910153743_phase_10c_platform_admin`
- `20260910154017_phase_10c_explicit_browser_deny_policies`

The Phase 10A1 forward migrations are present in repository source but were **not applied during this release-candidate validation session**. The connected Supabase database action became unavailable when a fresh production migration read was attempted, so no schema mutation was attempted and no fresh Phase 10A1 production migration claim is made.

The four Phase 10A1 migration files must be applied in order only through a supported production database surface, then verified with migration history, targeted SQL checks and Security Advisor before merge/activation is declared complete.

### GitHub App / Vercel provider state

Provider setup requirements are documented in `PHASE_10A1_GITHUB_APP_SETUP.md`.

The current tool surface does not expose a trustworthy read of the required Vercel environment-variable values, so live GitHub App configuration is **NOT VERIFIED** in this release state.

Vercel previews for several intermediate Phase 10A1 commits reached READY. The final candidate's GitHub Vercel status is currently an external Hobby-plan build-rate-limit failure, not an application build failure. GitHub CI independently passed the exact candidate's production build and browser gates.

Do not classify Connect GitHub as production-active until the provider configuration, callback and repository-import flow are verified live.

### Hosted runtime flags

Do not enable these as part of Phase 10A1 merge alone:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Their existing independent canary/rollback acceptance remains mandatory.

## Remaining release gates

1. Restore a supported Supabase production management surface and read the fresh migration head.
2. Apply/reconcile the reviewed Phase 10A1 forward migrations in order and verify schema/RPC ACLs plus Security Advisor.
3. Verify the required GitHub App and Vercel server-only configuration without exposing secrets.
4. Perform a live provider callback/repository listing/import acceptance when configuration exists.
5. Keep hosted worker flags off until their separate canary and rollback acceptance passes.
6. Re-run exact-head CI if any executable code or migration changes after candidate `005504387cf29d65d6b297acb041b608f0416c1a`.
7. Merge PR #74 only when the production schema/provider state is safe and the final merge candidate is green.

## Next product boundary

After Phase 10A1 is safely released, proceed to Phase 10A2 for private repository acquisition using a distinct execution class and short-lived GitHub installation credentials. Do not weaken `repository_snapshot_github_public_v1` or reuse public acquisition rules for private source.

# Phase 10A2 Private Repository Acquisition Working State

## Current checkpoint - 2026-09-15

Phase 10A2 private repository acquisition is implemented but intentionally remains a draft release candidate behind the live GitHub provider acceptance gate in issue #79.

Active PR: #76

Active branch: `feat/phase-10a2-private-repository-acquisition`

Current release order:

`#79 live negative provider canaries -> Phase 10A2 schema/runtime acceptance -> merge/release #76 -> reconcile and accept Phase 10A3 PR #77`

Do not reconcile #76 onto current `main` merely to make the branch current while #79 remains open. When #79 clears, fetch live refs, reconcile once, preserve all accepted hardening, and run a fresh exact-candidate validation before any production action.

## Provider gate status

Phase 10A1 GitHub provider activation has already completed its positive owner/admin production canary. Production has an active GitHub connection for `LeDoNguyenTu`, repository listing/import succeeded for `LeDoNguyenTu/ScopeForge`, and unauthenticated connect/callback requests remain behind the sign-in boundary.

Issue #79 now has exactly two remaining live authenticated negative canaries:

1. As an authorized owner/admin, exercise the normal signed application flow with a different valid GitHub installation ID and prove ScopeForge rejects it as not belonging to the authorized connection/workspace.
2. As a legitimate normal workspace member/viewer, attempt Connect GitHub and prove that role cannot initiate or complete provider connection.

Current production state does not provide a legitimate member/viewer session, and the existing installed GitHub App redirects a new Connect attempt into installed-App settings. Do not fabricate membership, forge callback state, downgrade an owner solely for testing, bypass authorization, or substitute unit/CI evidence for these browser canaries.

## Implemented architecture

Phase 10A2 introduces the distinct execution class:

`repository_snapshot_github_private_v1`

The existing `repository_snapshot_github_public_v1` path remains fail-closed to public repositories. Public acquisition still requires GitHub metadata with `private === false`.

Private acquisition uses the separate runtime capability:

`HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`

The capability remains disabled unless the environment value is explicitly `true`. Production private snapshot and repository-scan worker gates remain off.

Target flow:

`connected private GitHub repository -> exact private archive lease -> immutable snapshot -> existing zero-egress repository scan -> findings`

## Credential and authorization boundary

Long-lived GitHub App material and installation access tokens remain control-plane-only. The worker contract contains no installation token, Authorization header, GitHub App private key, OAuth credential, client secret, workspace ID, asset ID, or connection identity.

The trusted private worker claim now retains authoritative `workspaceId` and `assetId` only across the control-plane claim path. Before provider authority is minted, the broker reauthorizes the repository link against:

- link ID,
- workspace ID,
- asset ID,
- owner,
- repository name,
- canonical repository URL,
- active GitHub connection scoped to that workspace.

Those control-plane identifiers are stripped before the worker-facing contract.

The source broker also rechecks time-bounded authority after asynchronous provider operations. It fails closed if the worker lease, task deadline, or installation authority expires before the temporary codeload capability can safely be released.

The worker receives only an attempt-bounded `github_private_archive_lease_v1` containing bounded repository identity, immutable commit SHA, temporary exact codeload URL, and expiry.

## Network and execution boundary

The private snapshot worker may read only the exact validated `codeload.github.com` archive capability supplied for its claimed attempt and may write only through the existing attempt-scoped repository snapshot artifact upload descriptor.

The worker-side network boundary validates the canonical GitHub repository identity, exact owner/repository, immutable commit SHA, exact codeload path, lease expiry, pinned GitHub transport, no redirects, and compressed-byte ceiling.

If a private archive response has already been opened and execution fails before the parser takes ownership, the executor now destroys the response itself. If a lower layer has already destroyed the stream, the executor leaves it alone. This closes the pre-parser socket/source-transfer cleanup gap without changing the normal success path.

Repository source remains hostile data. The private worker does not execute repository code, package managers, install hooks, Git hooks, Dockerfiles, workflows, submodules, Git LFS commands, or project binaries.

The resulting archive is normalized through the bounded repository snapshot parser/bundle pipeline used by public acquisition.

## Connected-project orchestration

A private connected-project scan performs fresh GitHub provider revalidation before enqueueing. Visibility remains part of stored and provider-revalidated identity, so a public/private change fails closed instead of silently switching acquisition classes.

When the private runtime gate is disabled, the project remains connected but no private acquisition task is queued. When enabled after acceptance, the control plane uses the dedicated private connected-project enqueue RPC and never falls back to the public snapshot enqueue RPC.

Successful private snapshot publication enters the existing connected-project continuation path. Continuation is bound to the exact published `snapshotTaskId` and `snapshotId`, and recovery reuses that immutable snapshot instead of reacquiring source.

## Database authority and production schema state

Phase 10A2 uses forward migrations. The two reviewed Phase 10A2 migrations remain unapplied to production ScopeForge Supabase project `tdgpibrepzcvdivztkta`:

- `supabase/migrations/20260911100000_phase_10a2_private_repository_snapshot.sql`
- `supabase/migrations/20260911110000_phase_10a2_private_project_scan_routing.sql`

An earlier read-only production preflight verified required tables, keys, function signatures, CHECK-constraint compatibility, ACL assumptions, live-row compatibility, and absence of the Phase 10A2 targets.

PR #113 later changed the first migration's private worker claim body to return authoritative `workspaceId` and `assetId` for trusted control-plane reauthorization. Therefore the exact current migration must be re-reviewed before production apply. Do not treat the older preflight as sufficient authorization to apply it.

Privileged orchestration RPCs remain `SECURITY DEFINER` with pinned search paths and explicit `service_role` execution grants. Browser roles do not receive direct authority over private snapshot tasks or continuation persistence.

## Latest security hardening

### PR #113 - private claim workspace/asset binding

Root cause:

- SQL correctly bound the private repository link to the task workspace and asset;
- the trusted persistence claim dropped that binding;
- the source broker later re-read the link only by link ID before minting provider authority.

Fix:

- carry `workspaceId` and `assetId` through the trusted private persistence claim;
- validate both identifiers;
- reauthorize the repository link and GitHub connection against the claimed workspace/asset and immutable repository identity;
- keep those identifiers out of the worker-facing contract.

TDD evidence:

- RED run `34894877712`: 399 test files passed and exactly 3 new assertions failed at the missing SQL claim fields, parser binding, and lease composition boundary.
- GREEN run `34895910726`: 402/402 test files, 1,789/1,789 tests, audit 0 vulnerabilities, typecheck, CLI build/version, scanner and matrix benchmarks, optimized Next build, CSP browser acceptance, production UI diagnostic, and artifact upload passed.
- PR #113 merged only into #76 as `d3d24258299a8b9d72211a91f49e5b26a10d5563`.

### PR #114 - broker authority expiry recheck

Root cause:

The private source broker captured its clock once before asynchronous GitHub provider calls. A worker lease or task deadline could expire while those calls were in flight, allowing a temporary signed codeload capability to cross the control-plane boundary after authority had expired.

Fix:

- keep the initial pre-mint expiry rejection;
- recheck bounded authority after installation-token minting;
- recheck again after immutable commit resolution and before requesting the archive redirect;
- recheck and recompute final expiry immediately before returning the worker-facing capability.

TDD evidence and integration:

- RED run `34939622538`: audit passed, 401/402 test files and 1,789/1,790 tests passed, with exactly the new timing regression failing because the expired capability was returned.
- Initial GREEN run `34939960701`: 402/402 test files and 1,790/1,790 tests passed; audit 0 vulnerabilities; typecheck; CLI build/version; scanner and matrix benchmarks; optimized Next build; CSP browser acceptance; production UI/Turnstile diagnostic; and artifact upload passed.
- After the base documentation changed, the branch was reconciled without force-pushing and validated again instead of reusing stale SHA evidence.
- Final exact merge candidate `cf0d1011c9ce7bcfd76ae3d8fad5eebd50f54825` was checked out by CI run `34940910372`.
- Final run passed 402/402 test files and 1,790/1,790 tests, audit 0 vulnerabilities, typecheck, CLI build/version, scanner and matrix benchmarks, optimized Next build, CSP browser acceptance, production UI/Turnstile diagnostic, and artifact upload.
- Vercel deployment on final head `ce669e555669a1d28a544193d36e66afabbfd21d` completed successfully.
- Final UI acceptance artifact ID: `10385003353`.
- PR #114 merged only into #76 as `8df73ee4cec8b9433c53195ed6f01f6e92c7cd00`.

### PR #115 - private archive stream cleanup

Root cause:

The private snapshot executor opened the brokered codeload response before creating its local scratch directory. If scratch setup failed before parsing began, the parser never acquired cleanup ownership and the already-open private response could remain undestroyed.

Fix:

- retain the opened private archive response at the executor boundary;
- on execution failure, destroy it if a lower layer has not already destroyed it;
- keep existing parser cleanup, cancellation semantics, failure-code mapping, provenance, provider authorization, schema, and runtime-gate behavior unchanged.

TDD evidence and integration:

- RED run `34942092028`: audit 0 vulnerabilities, 401/402 test files and 1,790/1,791 tests passed, with exactly one failure proving `destroy()` was not called after scratch setup failed.
- GREEN CI run `34942497310` checked out exact PR merge candidate `6bec7471c1fb9376fe7943ab1617eb7d619f9b2a`.
- GREEN passed 402/402 test files and 1,791/1,791 tests, audit 0 vulnerabilities, typecheck, CLI build/version, scanner and matrix benchmarks, optimized Next build, CSP browser acceptance, production `scopeforge.dev` UI/Turnstile diagnostic, and artifact upload.
- Vercel passed on head `209af3ab174742e31c1011ac428bc50048e30698`.
- UI acceptance artifact ID: `10385602800`.
- PR #115 merged only into #76 as `778b5bf2abff4678bb1c4fce7f378fe5f179cb9b`.

These branch-only validation runs are integration evidence for the isolated hardening. They are not Phase 10A2 release proof. #76 remains intentionally behind current `main` while #79 is open, so release still requires reconciliation with current `main` and fresh exact-candidate validation afterward.

## Permanent architecture guards

The private acquisition test suite pins these boundaries:

- provider credentials remain absent from worker contracts and execution;
- the public GitHub acquirer remains fail-closed to private repositories;
- the private executor cannot call the GitHub API control plane;
- worker claim remains authenticated and request-body-free;
- hosted repository capability flags remain default-off unless explicitly `true`;
- privileged Phase 10A2 RPCs remain service-role only;
- private claim workspace/asset identity remains control-plane-only;
- private source capability cannot be released after its trusted authority expires;
- an opened private archive stream is closed on executor failure even when parsing never begins.

## Release gates after issue #79 clears

1. Fetch actual current `main`, #76 head, and production migration history.
2. Reconcile #76 onto current/released `main`, preserving PR #113, PR #114, and PR #115 hardening plus main's CI WebDriver isolation fix.
3. Run fresh exact-candidate validation after reconciliation. Historical branch CI is not release proof.
4. Re-review the exact changed Phase 10A2 migration and apply only absent reviewed migrations to `tdgpibrepzcvdivztkta`.
5. Verify schema, ACLs, RLS/private-table privileges, function bodies, and Security Advisor results.
6. Keep hosted private snapshot/scan runtime gates off until the dedicated private worker is independently accepted.
7. Complete containment, quotas, scratch/output ceilings, cleanup, observability, rollback, and credential-boundary checks.
8. Prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings end-to-end.
9. Merge/release #76 only after provider, schema, runtime, privacy, and rollback acceptance all pass.
10. Only then reconcile PR #77 onto the released Phase 10A2/main baseline and run fresh Phase 10A3 validation.

## Release rule

PR #76 stays draft and non-releasable while issue #79 remains open. No Phase 10A2/10A3 production migration, webhook secret, production membership, provider authorization rule, or private-worker runtime gate may be changed merely to satisfy the remaining canaries.

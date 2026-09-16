# Phase 10A2 Private Repository Acquisition Working State

Last reconciled: 2026-09-16, Asia/Singapore

Phase 10A2 is implemented and remains an unreleased draft behind its schema/runtime/privacy/rollback acceptance. Issue #79 is closed.

Active PR: #76

Active branch: `feat/phase-10a2-private-repository-acquisition`

Latest executable/security-hardening merge before this documentation-only branch update:

`2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`

Strict release order:

`reconcile/fresh-validate #76 -> Phase 10A2 schema/runtime acceptance -> merge/release #76 -> reconcile/fresh-validate #77 -> Phase 10A3 acceptance`

PR #76 was reconciled once onto released main `1b23dc8e5aa4c130d7ff6174cbf9444879b88bae` after issue #79 closed. The reconciliation had documentation-only conflicts; current-main documentation won while this Phase 10A2 working-state record was preserved and refreshed.

## Provider gate

Positive owner/admin GitHub App acceptance is complete. PR #118 workspace collaborator controls are also released and a legitimate collaborator now exists as a member of Brian's workspace while owning a separate workspace.

The legitimate normal-member production canary passed on 2026-09-16:

- authenticated `214nsa@gmail.com` selected Brian's workspace
- the active role rendered as `Member`
- the GitHub integration route rendered `GitHub integration unavailable` and `Workspace owner or admin access is required.`
- no Connect GitHub control was available

The owner/admin wrong-installation canary also passed on 2026-09-16 through a fresh signed production flow. GitHub authorization completed with a different real installation ID and ScopeForge rejected it at `?error=installation`. A clean reload still showed the original connection as verified and listed `LeDoNguyenTu/ScopeForge`.

The GitHub App's **Redirect on update** setting is enabled so existing-installation changes return to the configured Setup URL. Issue #79 is closed.

## Architecture boundary

Private acquisition uses the distinct task/runtime path and must remain separated from public acquisition.

Target flow:

`connected private GitHub repository -> exact private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings`

Long-lived GitHub App/private provider credentials remain control-plane-only. Worker-facing contracts must not contain installation tokens, Authorization headers, private keys, OAuth/client secrets, workspace identity, asset identity, or connection identity.

The worker may consume only bounded attempt-scoped source/upload capabilities. Repository source is hostile data and must never be executed.

## Integrated security hardening

### PR #113 - trusted claim workspace/asset binding

Authoritative `workspaceId` and `assetId` survive only the trusted control-plane claim path and are reauthorized against repository link, connection, and immutable repository identity before provider authority is minted. They remain absent from worker contracts.

### PR #114 - broker authority expiry rechecks

Time-bounded authority is rechecked across asynchronous provider calls so a worker lease/task deadline/installation authority cannot expire before a temporary codeload capability crosses into the worker contract.

### PR #115 - private archive stream cleanup

If an archive response is opened but local scratch setup fails before parsing owns the stream, the executor destroys the response and preserves the existing lower-layer cleanup semantics.

### PR #119 - repository scan download expiry enforcement

Finding: `downloadRepositoryScanArtifact()` parsed `descriptor.expiresAt` but did not reject an already elapsed signed R2 download capability before starting `fetch()`.

TDD evidence:

- RED head: `24c6f442c946fa1a676f7c79c401638c0f391895`
- RED CI: `35054474634`
- RED: 401/402 test files and 1,791/1,792 tests passed; the sole failure was the intended new expiry regression because the promise resolved instead of rejecting
- exact GREEN head: `9658a652f1e5416475489f9971da13409e5319d9`
- GREEN CI: `35054754370`
- GREEN: install, audit, full tests, typecheck, CLI build/version, scanner benchmarks, app build, CSP browser smoke, production diagnostic, and artifact step passed
- Vercel exact-head status passed
- PR #119 merged only into this branch as `79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

Minimal implementation: reject non-finite or elapsed `expiresAt` synchronously before the first R2 GET. No schema, provider authorization, worker gate, secret, membership, or production state changed.

### PR #120 - drain private execution before trusted finalization

Finding: `repository_snapshot_github_private_v1` used the supervisor's detachable abort wrapper. A deadline, cancellation request, or lost lease could therefore publish a terminal result while the private executor was still reading, processing, or uploading repository data.

TDD and release evidence:

- test-only RED head: `a88ab371628f3262f881243f117818f67fdddda4`
- Linux RED CI: `35067132487`; the intended assertion proved `finalize` ran before the held-open private executor settled
- exact GREEN head: `05b7959e61902d2916b4ba4e1166421b599d9f67`
- GREEN CI: `35067478620`
- GREEN: audit, full tests, typecheck, CLI build/version, both benchmarks, Next build, CSP browser smoke, production V5/Turnstile diagnostic, and artifact step passed
- exact-head Vercel deployment passed
- PR #120 merged only into this branch as `2ff2bf07cdf4e12b5b9c82d6a002167d29469d24`

Minimal implementation: route private snapshot execution through the existing drain-on-abort path already used for resource-owning execution classes. Trusted finalization now waits for the executor to settle and release its process/source/scratch/upload lifetime. Public execution behavior, provider authorization, schema, gates, and production state did not change.

The completed security diff review covered all 34 Phase 10A2 source files from merge base `33d21de652f3c04aa88ebd4f122348803e59b153` through pre-fix head `d485d435b7b62132ea088dbe16caae7c1a7038ca`. It recorded this one medium-severity, high-confidence CWE-664 finding; PR #120 remediated it.

## Production schema state

The Phase 10A2 migrations remain unapplied to ScopeForge Supabase `tdgpibrepzcvdivztkta`:

- `supabase/migrations/20260911100000_phase_10a2_private_repository_snapshot.sql`
- `supabase/migrations/20260911110000_phase_10a2_private_project_scan_routing.sql`

An older read-only compatibility preflight passed, but PR #113 changed the first migration's private worker claim body. Re-review the exact current migration before production apply. Do not treat the older preflight alone as authorization.

## Runtime state

Keep the following false/absent until the dedicated operational canary and rollback acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`

Historical Phase 6D Linux/rootless-Podman containment evidence is useful but does not authorize Phase 10A2 production runtime enablement.

## Release gates

1. Run fresh exact-candidate validation after reconciliation. Historical maintenance CI is not release proof.
2. Re-review exact current Phase 10A2 migrations and current production migration history.
3. Apply only absent reviewed migrations to `tdgpibrepzcvdivztkta`.
4. Verify schema, function bodies, ACLs, grants/revokes, RLS/private-table privileges, and Security Advisor results.
5. Keep private snapshot/scan gates off until dedicated private-worker acceptance.
6. Prove containment, quotas, scratch/output ceilings, cancellation, cleanup, observability, rollback, and credential boundaries.
7. Prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings end to end.
8. Prove provider credentials remain control-plane-only and private source/capability material does not leak to browser state or ordinary logs.
9. Merge/release #76 only after provider, schema, runtime, privacy, rollback, and production verification all pass.
10. Only then reconcile and fresh-validate Phase 10A3 PR #77.

## Permanent guards

The Phase 10A2 suite must continue to pin:

- public acquisition fails closed to private repositories
- provider credentials remain absent from worker contracts
- trusted workspace/asset binding remains control-plane-only
- provider/source authority cannot cross the worker boundary after expiry
- expired R2 download capabilities fail before network use
- opened private archive responses close on pre-parser failure
- private snapshot cancellation drains executor-owned resources before trusted finalization
- privileged orchestration remains service-role-only
- hosted repository capabilities remain default-off until explicitly accepted

## Release rule

PR #76 stays draft and non-releasable until exact-candidate, schema, private-worker, privacy, rollback, and production verification pass. Issue #79 is closed. Runtime gates remain off until their dedicated acceptance authorizes them.

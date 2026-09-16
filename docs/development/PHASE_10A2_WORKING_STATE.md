# Phase 10A2 Private Repository Acquisition Working State

Last reconciled: 2026-09-16, Asia/Singapore

Phase 10A2 is implemented but deliberately remains an unreleased draft behind issue #79 and its own schema/runtime/privacy/rollback acceptance.

Active PR: #76

Active branch: `feat/phase-10a2-private-repository-acquisition`

Latest executable/security-hardening merge before this documentation-only branch update:

`79e4b2a1e10a3fb2db7652b7d2f143a06f04156b`

Strict release order:

`issue #79 browser canaries -> reconcile/fresh-validate #76 -> Phase 10A2 schema/runtime acceptance -> merge/release #76 -> reconcile/fresh-validate #77 -> Phase 10A3 acceptance`

Do not reconcile #76 to current `main` merely to make it current while #79 remains open.

## Provider gate

Positive owner/admin GitHub App acceptance is complete. PR #118 workspace collaborator controls are also released and a legitimate collaborator now exists as a member of Brian's workspace while owning a separate workspace.

Exactly two production browser canaries remain in issue #79:

1. authorized owner/admin normal signed flow with a different valid GitHub installation ID must reject it as not belonging to the authorized connection/workspace
2. legitimate normal member/viewer must select Brian's workspace and be unable to initiate or complete Connect GitHub

Do not fabricate membership, forge callback state, downgrade an owner, directly mutate production role state for the test, weaken authorization, or substitute CI/unit coverage.

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

## Release gates after #79 clears

1. Fetch live current `main`, #76, production migration history, and actual runtime/config state.
2. Reconcile #76 exactly once onto current released main, preserving #113/#114/#115/#119 and all released mainline security fixes.
3. Run fresh exact-candidate validation after reconciliation. Historical maintenance CI is not release proof.
4. Re-review exact current Phase 10A2 migrations.
5. Apply only absent reviewed migrations to `tdgpibrepzcvdivztkta`.
6. Verify schema, function bodies, ACLs, grants/revokes, RLS/private-table privileges, and Security Advisor results.
7. Keep private snapshot/scan gates off until dedicated private-worker acceptance.
8. Prove containment, quotas, scratch/output ceilings, cancellation, cleanup, observability, rollback, and credential boundaries.
9. Prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings end to end.
10. Prove provider credentials remain control-plane-only and private source/capability material does not leak to browser state or ordinary logs.
11. Merge/release #76 only after provider, schema, runtime, privacy, rollback, and production verification all pass.
12. Only then reconcile and fresh-validate Phase 10A3 PR #77.

## Permanent guards

The Phase 10A2 suite must continue to pin:

- public acquisition fails closed to private repositories
- provider credentials remain absent from worker contracts
- trusted workspace/asset binding remains control-plane-only
- provider/source authority cannot cross the worker boundary after expiry
- expired R2 download capabilities fail before network use
- opened private archive responses close on pre-parser failure
- privileged orchestration remains service-role-only
- hosted repository capabilities remain default-off until explicitly accepted

## Release rule

PR #76 stays draft and non-releasable while issue #79 remains open. No Phase 10A2/10A3 production migration, webhook secret, production membership, provider authorization rule, or private-worker runtime gate may be changed merely to satisfy the remaining canaries.

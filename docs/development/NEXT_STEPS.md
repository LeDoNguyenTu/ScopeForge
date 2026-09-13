# ScopeForge Next Steps

Last reconciled: 2026-09-13 (Asia/Singapore)

## Released baseline

Current released application `main`:

`f4f76e823718b6571966e731ed5a5a85a67152b3`

Production deployment:

`dpl_DAXucvciwREJXfp9XXAGJKiccXh3` - READY on `https://scopeforge.dev`

ScopeForge Supabase: `tdgpibrepzcvdivztkta`.

PR #87 responsive admin/GitHub UI is released and production-verified. Do not reopen or repeat that implementation unless a new regression is demonstrated.

Preserve together: strict nonce CSP, authenticated workspace/admin boundaries, workspace RLS/RPC authority separation, worker/runtime authority separation, public/private repository acquisition separation, and default-off unaccepted hosted runtime gates.

## Priority 1 - finish issue #79 live negative provider acceptance

Positive provider acceptance is already live:

- `HOSTED_GITHUB_INTEGRATION_ENABLED=true` is active;
- owner/admin GitHub App install/proof completed;
- connection persisted active for `LeDoNguyenTu`;
- repository selection is `selected`;
- `LeDoNguyenTu/ScopeForge` imported successfully on `main`;
- repository access is active;
- post-PR87 production still routes unauthenticated Connect GitHub to the sign-in boundary, not the disabled-provider path.

Leak/boundary review is also clean:

- public integration rows contain safe metadata only;
- RLS is enabled on the integration tables;
- authenticated grants are SELECT-only and there is no anon table grant;
- checked ordinary production logs contain no provider secret/token markers;
- callback cookies are HttpOnly/Secure/SameSite=Lax, short-lived, callback-path scoped and cleared on terminal redirects;
- exact tests cover member rejection, cross-user state rejection, spoofed valid numeric installation rejection and safe-metadata-only persistence.

Still required as **live authenticated production canaries** before closing #79:

1. from an authenticated owner/admin callback flow, try a different valid numeric installation ID and verify rejection;
2. from an authenticated normal member/viewer session, try Connect GitHub and verify it cannot initiate/complete.

The current chat has no browser automation connector that can share those authenticated identities, so do not pretend these two production checks passed. Issue comment `5650236096` records the exact evidence and limitation.

Keep every repository snapshot/scan worker runtime flag false/absent while #79 is open.

## Priority 2 - Phase 10A2 private repository acquisition

PR #76:

- branch: `feat/phase-10a2-private-repository-acquisition`
- current head: `709ef8af4ce4befae12ba910d3bca15599b5cab1`
- state: draft/open
- currently reported not mergeable after later main changes, so reconciliation is required after #79 clears.

Fresh production migration preflight confirms the production history still ends at `20260911143049_phase_10a1_service_role_table_acl_hardening` and the Phase 10A2 targets are absent.

Reviewed migrations awaiting the gate:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

After #79 closes:

1. reconcile #76 onto released main;
2. run fresh exact-head tests/typecheck/CLI/benchmarks/build/browser validation;
3. re-read production migration history and apply only the two absent reviewed Phase 10A2 migrations;
4. verify private table/RPC ACLs, revokes/grants, RLS and Security Advisor;
5. verify the selected private repository remains accessible to the GitHub App with intended read-only permission;
6. complete dedicated private snapshot worker containment, quotas, cancellation/cleanup, observability and rollback acceptance;
7. run one complete private connected-project canary: project scan request -> private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings;
8. prove provider credentials stay control-plane-only and private source/capability material does not appear in browser-readable state or ordinary logs;
9. merge/release #76 only when code, schema, provider and runtime gates are all green;
10. verify production after merge.

If the exact containment canary requires direct SSH/host control not available here, hand off only that host-level probe to Codex/VS Code or another approved SSH environment. Do not hand off the broader release.

## Priority 3 - Phase 10A3 GitHub webhook reconciliation

PR #77 remains draft/open.

Recorded pre-reconciliation evidence:

- docs-only head: `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- executable candidate: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

After Phase 10A2 releases:

1. reconcile #77 onto released main/Phase 10A2;
2. run fresh exact validation;
3. re-read/apply only reviewed absent Phase 10A3 migrations;
4. configure the independent server-only webhook secret/endpoint without exposing secret material;
5. verify invalid-signature and oversize rejection, replay, installation/repository lifecycle, latest-head coalescing, same-head pending recovery, superseded-head authoritative recovery, public/private separation and leak boundaries;
6. prove one complete automatic webhook-triggered immutable-snapshot scan through findings;
7. merge/release #77 only after operational acceptance passes;
8. verify production after merge.

## Runtime gates

Keep false/absent until independently accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

CI success, schema presence, or product UI availability does not authorize production worker activation.

## Historical external-host work

Phase 6D Tasks 14-16, including real Oracle Linux/rootless-Podman Task 15 containment acceptance, are complete. Do not repeat or reassign them.

## Continuation rule

Complete #79 without weakening its live canary requirements, then proceed through #76 and #77 in strict release order. After each milestone, update `CURRENT_STATE.md` and this file with exact heads, validation evidence, production state and any genuine external blocker. Do not stop after a successful PR if the next release gate is safely actionable.

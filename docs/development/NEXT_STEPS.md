# ScopeForge Next Steps

Last reconciled: 2026-09-13 (Asia/Singapore)

## Released baseline

Current `main`:

`c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`

Latest authoritative main validation:

- CI #1030 / run `34745795461`: SUCCESS
- Node 24, audit 0 vulnerabilities
- 396/396 test files, 1,744/1,744 tests
- typecheck, CommonJS CLI, scanner benchmark, deterministic benchmark matrix, optimized Next build, strict-CSP browser acceptance, production diagnostic and artifact upload: PASS
- artifact `10314341432`

`scopeforge.dev` currently responds HTTP 200 with strict nonce CSP and expected security headers. During this reconciliation Vercel had not yet surfaced a production deployment whose Git SHA is the PR #90 merge SHA. PR #90 changes documentation plus an architecture regression test only, so executable application behavior is unchanged.

ScopeForge Supabase: `tdgpibrepzcvdivztkta`.

Recent independent maintenance now released:

- PR #87 responsive admin/GitHub UI
- PR #88 Node 24/runtime-tooling alignment
- PR #90 public CI-guide Node 24 alignment and regression guard

## Priority 1 - issue #79 live negative provider acceptance

Positive provider acceptance is already proven:

- provider gate active
- owner/admin GitHub App install/proof completed
- `LeDoNguyenTu` connection persisted active
- `LeDoNguyenTu/ScopeForge` imported successfully
- repository access active
- safe metadata, RLS, cookie, redirect and checked log boundaries reviewed

Still required as live authenticated production canaries:

1. authenticated owner/admin callback with a different valid numeric installation ID must be rejected
2. authenticated normal member/viewer must be unable to initiate or complete Connect GitHub

Current connector access cannot run those two browser sessions. Production also has no known member/viewer identity available for the second canary. Keep #79 open. Do not substitute unit/regression evidence, weaken authorization, expose secrets, or mutate an owner account to manufacture a pass.

Keep all repository snapshot/scan worker runtime flags false/absent while #79 remains open.

## Priority 2 - Phase 10A2 private repository acquisition

PR #76:

- branch `feat/phase-10a2-private-repository-acquisition`
- recorded head `709ef8af4ce4befae12ba910d3bca15599b5cab1`
- draft/open

Production migration history remains recorded through `20260911143049_phase_10a1_service_role_table_acl_hardening`; Phase 10A2 targets remain intentionally unapplied.

Reviewed migrations waiting behind #79:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

After #79 clears:

1. re-read actual #76 and current main, then reconcile
2. run fresh exact-candidate CI
3. re-read production migration history and apply only absent reviewed Phase 10A2 migrations
4. verify private tables/RPCs, ACLs, revokes/grants, RLS and Security Advisor posture
5. verify the selected private repository remains accessible to the GitHub App with intended read-only permissions
6. complete dedicated private snapshot worker containment, quotas, cancellation/cleanup, observability and rollback acceptance
7. prove one complete private connected-project flow: project scan request -> private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings
8. prove provider credentials remain control-plane-only and private source/capability material does not appear in browser state or ordinary logs
9. merge/release #76 only when provider, code, schema, runtime, privacy and rollback gates are green
10. verify production after merge

If the exact containment canary requires SSH/host control unavailable here, hand off only that host-level probe to Codex/VS Code or another approved SSH environment.

## Priority 3 - Phase 10A3 GitHub webhook reconciliation

PR #77 remains draft/open.

Recorded pre-reconciliation evidence:

- docs-only head `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- executable candidate `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

After Phase 10A2 releases:

1. reconcile #77 onto released main/Phase 10A2
2. run fresh exact validation
3. re-read/apply only reviewed absent Phase 10A3 migrations
4. configure the independent server-only webhook secret/endpoint without exposing secret material
5. prove invalid-signature and oversize rejection before JSON processing
6. prove replay, installation/repository lifecycle, latest-head coalescing, same-head pending recovery and stale-trigger authoritative-head recovery
7. prove public/private separation and leak boundaries
8. prove a complete automatic webhook-triggered immutable-snapshot scan through findings
9. merge/release only after operational acceptance passes
10. verify production after merge

## Runtime gates

Keep false/absent until independently accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

CI success, schema presence, UI availability or historical containment evidence does not authorize production worker activation.

## Safe work while #79 is postponed

Continue only work independent of the provider gate, including:

- narrowly scoped documentation repair
- dependency/runtime/tooling maintenance
- regression-test strengthening
- architecture/security review
- evidence-based UI bug fixes
- branch/handoff hygiene

Do not use any independent maintenance PR as evidence that #79, Phase 10A2 or Phase 10A3 operational acceptance has passed.

## Historical external-host work

Phase 6D Tasks 14-16, including the real Oracle Linux/rootless-Podman Task 15 acceptance, are complete. Do not repeat them.

## Continuation rule

Keep working through safe independent tasks while #79 is parked. Once the required browser surface exists, finish #79 without weakening its live-canary requirements, then proceed #76 -> #77 in strict order. Update the resume documents after every completed milestone.

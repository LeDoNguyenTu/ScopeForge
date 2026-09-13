# ScopeForge Unfinished Work Queue

Last reconciled: 2026-09-13 (Asia/Singapore)

This is the persistent resume queue for genuinely unfinished work. Historical branches, old phase checklists, and completed acceptance tasks are not a source of new work by themselves.

## Global rules

- start from actual current `main`; inspect current PR/issue heads before acting
- preserve the accepted Command Center presentation, PR #87 responsive admin/GitHub UI, strict nonce CSP, and browser security-header baseline
- never rewrite deployed Supabase migrations; corrections are forward-only
- do not claim green gates without exact executable-SHA evidence
- do not enable hosted worker/runtime capabilities merely because code, migrations, or tests exist
- do not add generic URL/proxy/browser/arbitrary network authority
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- keep provider credentials/control-plane capability material out of browser state, ordinary logs, worker payloads, repository files, and chat
- no AI co-author attribution

## Completed - do not recreate

The following boundaries are complete or released and should not be reimplemented from old branches:

- Phase 7 Community Security Packs local v1
- Phase 8A offline accuracy foundation
- Phase 8B deterministic scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A through 9E production/security hardening scope
- strict nonce CSP compatibility and enforcement
- accepted Command Center presentation restoration
- Phase 6D Tasks 14-16, including real Linux/rootless-Podman containment acceptance
- Phase 10A1 GitHub connected-project core
- Phase 10C platform administration
- PR #87 responsive admin/GitHub control-plane UI
- Phase 10A3 hardening issues #78, #80, #81, #82, and #85

Independent main tooling alignment is implemented in PR #88. Exact executable candidate `b987fd9db36173b0a338cce7796ac599ae46e163` passed CI #1026 / run `34744282931` with Node 24.20.0, npm 11.19.0, audit 0, 396/396 test files, 1,743/1,743 tests, typecheck, CommonJS CLI, benchmarks, Next build, responsive/CSP browser acceptance, production diagnostic, and `upload-artifact@v7`. If #88 is already merged when this file is read, use the post-merge main evidence instead.

## 1. Issue #79 - remaining live GitHub App negative canaries

Positive owner/admin provider activation and controlled repository import are already proven. Safe metadata, RLS, cookie, redirect, and checked log boundaries have also been reviewed.

Two live production checks remain and require a browser/session surface able to use controlled authenticated identities:

1. submit a different valid numeric GitHub installation ID through the authenticated owner/admin callback flow and prove rejection
2. use an authenticated normal workspace member/viewer and prove Connect GitHub cannot be initiated or completed

Regression tests cover these properties, but test evidence is not a substitute for live provider acceptance. Leave issue #79 open until both live checks are independently evidenced. Do not paste provider secrets or weaken authorization to make the canary easier.

## 2. Phase 10A2 - PR #76 private repository acquisition

PR #76 remains draft/open at recorded head `709ef8af4ce4befae12ba910d3bca15599b5cab1` and must remain behind #79.

Production migration history currently ends at `20260911143049_phase_10a1_service_role_table_acl_hardening`. Phase 10A2 migrations are still unapplied.

After #79 clears, execute in this order:

1. re-read actual PR #76 head and current main, then reconcile the stack
2. run fresh exact-candidate CI
3. re-read production migration history and apply only absent reviewed Phase 10A2 migrations
4. verify schema, RLS, grants/revokes, service-role boundaries, and Security Advisor posture
5. complete private acquisition-worker containment, quotas, cancellation, cleanup, observability, rollback, and staged canary acceptance
6. prove provider credential use remains control-plane-only
7. prove private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings
8. merge/release #76 only when provider, code, schema, runtime, privacy, and rollback gates all pass

Do not enable these gates ahead of acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`

## 3. Phase 10A3 - PR #77 webhook reconciliation

PR #77 remains draft/open and must follow the Phase 10A2 release.

Recorded executable evidence before future reconciliation:

- executable candidate `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

After #76 releases:

1. reconcile #77 onto released main
2. run fresh exact-candidate validation
3. re-read production migration history and apply only absent reviewed Phase 10A3 migrations
4. configure the independent server-only webhook secret/endpoint without exposing it
5. prove invalid-signature and oversize rejection before JSON processing
6. prove replay, installation/repository lifecycle, latest-head coalescing, same-head pending recovery, and superseded-head authoritative recovery
7. prove public/private separation and leak boundaries
8. prove a full automatic webhook-triggered scan through immutable snapshot publication to findings
9. merge/release only after all operational checks pass

## 4. Other hosted runtime enablement

Passive and active runtime worker code/release acceptance exists, but production enablement remains independently gated.

Keep these false/absent until their own monitoring, rollback, and staged canary evidence authorizes them:

- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Do not use Phase 6D containment evidence, Phase 8 benchmark success, or Phase 10 progress as automatic authorization for production enablement.

## 5. Provider/security operations not yet directly verified

Where a supported account surface becomes available, separately verify external provider controls that repository source cannot prove, including any still-unverified Cloudflare/Vercel WAF/rate-limit state and Supabase/provider security settings recorded as unknown in the current-state documents.

Do not silently upgrade `NOT VERIFIED` to enabled/enforced from application code alone.

## 6. Branch cleanup

Historical completed `diag/*`, `preview/*`, reconciliation, documentation, feature, CSP, and temporary branches may remain.

When a genuine delete-ref surface is available:

1. re-audit each candidate against current `main`
2. delete only branches proven historical/completed and not backing an open PR
3. preserve `main`, #76, #77, and any current maintenance branch until their work is integrated
4. re-list refs after deletion and document the cleanup result

Never fake deletion by force-moving or repointing refs.

## UI baseline

PR #87 is the released responsive admin/GitHub UI baseline. Do not create more cosmetic churn without concrete evidence of an actual defect.

If new visual evidence identifies a real issue, preserve mobile no-horizontal-page-scroll, iOS safe-area behavior, minimum touch targets, semantic/accessibility behavior, strict CSP, and authorization boundaries.

## What can be done while #79 is postponed

Safe independent work includes narrowly scoped documentation repair, dependency/runtime/tooling maintenance, regression-test strengthening, architecture/security review, and evidence-based UI bug fixes that do not alter provider authorization, production schema, hosted capability flags, or the #76/#77 release order.

Any such work should stay in an isolated branch/PR and must not be used to claim that #79, Phase 10A2, or Phase 10A3 operational acceptance has passed.

# ScopeForge Unfinished Work Queue

Last reconciled: 2026-09-13 (Asia/Singapore)

This is the persistent queue for genuinely unfinished work. Historical branches, old phase checklists and completed acceptance tasks are not new work by themselves.

## Global rules

- fetch actual current `main`; do not infer it from a SHA embedded in this document
- inspect current PR/issue heads before acting
- preserve the accepted Command Center presentation, PR #87 responsive admin/GitHub UI, strict nonce CSP and browser security headers
- never rewrite deployed Supabase migrations; corrections are forward-only
- do not claim green gates without exact executable-SHA evidence
- do not enable hosted runtime capabilities merely because code, migrations or tests exist
- do not add generic URL/proxy/browser/arbitrary network authority
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- keep provider credentials/control-plane capability material out of browser state, ordinary logs, worker payloads, repository files and chat
- no AI co-author attribution

## Executable baseline

Latest authoritative executable main evidence:

- merge `c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`
- post-merge CI #1030 / run `34745795461`: SUCCESS
- 396/396 files and 1,744/1,744 tests
- typecheck, CommonJS CLI, benchmarks, optimized build, strict-CSP browser acceptance, production diagnostic and artifact upload: PASS

Latest directly verified production evidence before this documentation update:

- deployment `dpl_FQ8JPMgvFbSY4SkK6tCxHuKZdEd6`
- READY on docs-only main SHA `e157fb8150df76cc8166e3c695a6ed83d74d0077`
- `scopeforge.dev` HTTP 200 with expected nonce CSP and security headers

Documentation-only merges may advance live main without changing executable behavior. Fetch the live ref at resume time. Any future executable change requires fresh exact-candidate validation.

Recent independent maintenance now complete:

- PR #88 Node 24/runtime-tooling alignment
- PR #90 public CI-guide Node 24 alignment and permanent regression guard
- PR #92 branch-cleanup audit/manifest
- PR #93 resume-state synchronization
- PR #94 GitHub App setup-state reconciliation

Do not recreate these tasks from older documents.

## Completed - do not recreate

- Phase 7 Community Security Packs local v1
- Phase 8A offline accuracy foundation
- Phase 8B deterministic scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A through 9E production/security hardening scope
- strict nonce CSP compatibility/enforcement
- accepted Command Center presentation restoration
- Phase 6D Tasks 14-16, including real Linux/rootless-Podman containment acceptance
- Phase 10A1 GitHub connected-project core
- Phase 10C platform administration
- PR #87 responsive admin/GitHub control-plane UI
- Phase 10A3 hardening issues #78, #80, #81, #82 and #85
- PR #88 runtime/tooling alignment
- PR #90 published CI runtime documentation alignment
- PR #92 complete branch audit and cleanup manifest
- PR #93 persistent resume-state synchronization
- PR #94 GitHub App setup-state reconciliation
- positive owner/admin GitHub App connection/install/import canary
- read-only Phase 10A2 migration/schema transactional preflight

## 1. Issue #79 - remaining live GitHub App negative canaries

Positive owner/admin provider activation, controlled repository import and safe metadata/RLS/cookie/redirect/log review are proven. Issue #79 and the GitHub App setup guide explicitly mark these checks complete.

Two live production checks still require a suitable authenticated browser/session surface:

1. submit a different valid numeric GitHub installation ID through an authenticated owner/admin callback flow and prove rejection
2. use an authenticated normal workspace member/viewer and prove Connect GitHub cannot be initiated or completed

Regression tests are not a substitute for these live canaries. Production currently has no known member/viewer identity available for the second check. Leave #79 open until both are independently evidenced. Do not expose secrets, weaken authorization, or mutate an owner role merely to create test data.

## 2. Phase 10A2 - PR #76 private repository acquisition

PR #76 remains draft/open at recorded head:

`709ef8af4ce4befae12ba910d3bca15599b5cab1`

Its PR description reflects the completed positive provider canary and completed schema preflight.

Production migration history remains recorded through `20260911143049_phase_10a1_service_role_table_acl_hardening`; Phase 10A2 migrations remain unapplied.

Do not repeat the same migration compatibility preflight unless PR #76 or production schema changes materially.

After #79 clears:

1. fetch live main, re-read actual #76, and reconcile
2. run fresh exact-candidate CI
3. re-read production migration history and apply only absent reviewed Phase 10A2 migrations
4. verify schema, RLS, grants/revokes, service-role boundaries and Security Advisor posture
5. complete private acquisition-worker containment, quotas, cancellation, cleanup, observability, rollback and staged canary acceptance
6. prove provider credential use remains control-plane-only
7. prove private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings
8. merge/release only when provider, code, schema, runtime, privacy and rollback gates are green

Do not enable ahead of acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`

If the final containment canary requires SSH/host control unavailable here, hand off only that exact probe to Codex/VS Code or another approved SSH environment.

## 3. Phase 10A3 - PR #77 webhook reconciliation

PR #77 remains draft/open and must follow Phase 10A2 release. Its PR description has been refreshed and no longer treats Phase 10A1 provider activation as dark-gated.

Recorded executable evidence before future reconciliation:

- executable candidate `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

After #76 releases:

1. reconcile #77 onto released live main
2. run fresh exact-candidate validation
3. re-read production migration history and apply only absent reviewed Phase 10A3 migrations
4. configure the independent server-only webhook secret/endpoint without exposing it
5. prove invalid-signature and oversize rejection before JSON processing
6. prove replay, installation/repository lifecycle, latest-head coalescing, same-head pending recovery and stale-trigger authoritative-head recovery
7. prove public/private separation and leak boundaries
8. prove a full automatic webhook-triggered scan through immutable snapshot publication to findings
9. merge/release only after all operational checks pass

## 4. Other hosted runtime enablement

Passive and active runtime worker code/release acceptance exists, but production enablement remains independently gated.

Keep false/absent until dedicated monitoring, rollback and staged-canary evidence authorizes them:

- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Do not use Phase 6D containment evidence, Phase 8 benchmark success or Phase 10 progress as automatic authorization.

## 5. Provider/security operations not yet directly verified

When supported account surfaces become available, separately verify external controls that repository source cannot prove, including any still-unverified Cloudflare/Vercel WAF/rate-limit state and Supabase/provider security settings recorded as unknown.

Do not silently upgrade `NOT VERIFIED` to enabled/enforced from application code alone.

## 6. Branch cleanup

PR #92 published `docs/development/BRANCH_CLEANUP_CANDIDATES.md` from a fresh live audit.

Audit-point state:

- 60 branches
- exactly 2 open PR heads: #76 and #77
- 4 retain refs: `main`, #76, #77, `demo/portfolio-20260910`
- 56 refs classified safe to delete

The connected GitHub surface has no real delete-ref action. When a genuine delete-ref surface is available:

1. re-fetch the complete branch list because later maintenance/docs branches will have changed the count
2. preserve `main`, #76, #77, intentional demo refs, and any newly active task/PR branch
3. delete only refs proven historical/completed and not backing an open PR
4. re-list refs after deletion and document the result

Never fake deletion by force-moving or repointing refs.

## UI baseline

PR #87 remains the responsive admin/GitHub UI baseline. Do not create cosmetic churn without concrete evidence of a real defect. Any future visual repair must preserve mobile no-horizontal-page-scroll, iOS safe-area behavior, minimum touch targets, semantic/accessibility behavior, strict CSP and authorization boundaries.

## Safe work while #79 is postponed

Safe independent work includes:

- documentation/handoff repair
- dependency/runtime/tooling maintenance
- regression-test strengthening
- architecture/security review
- evidence-based UI fixes
- branch/release hygiene

Any such work must stay isolated from provider authorization, production schema, hosted capability flags and the #76/#77 release order. It must not be used to claim #79, Phase 10A2 or Phase 10A3 operational acceptance.

At each resume, fetch live main first. Update this file for semantic state changes, not merely because a docs-only merge changed the main SHA.
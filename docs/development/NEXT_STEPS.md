# ScopeForge Next Steps

Last verified: 2026-09-13 (Asia/Singapore).

## Current validated stack

- Phase 10A1 PR #74 is merged/released as `33d21de652f3c04aa88ebd4f122348803e59b153` and remains production-dark behind `HOSTED_GITHUB_INTEGRATION_ENABLED`.
- Phase 10A2 PR #76 remains open/draft on `feat/phase-10a2-private-repository-acquisition`; last verified branch head is `709ef8af4ce4befae12ba910d3bca15599b5cab1`.
- Phase 10A3 PR #77 remains open/draft and stacked on #76.
- Latest verified Phase 10A3 executable head is `5f05ed964c8ab43f38a420b1b77317bae630cc1e`.
- Exact synthetic merge validated by CI is `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`.
- CI #981 / run `34711218370`: SUCCESS.
- Node `v24.20.0`, npm `11.19.0`, audit 0 vulnerabilities.
- Vitest: 415 / 415 files, 1,900 / 1,900 tests.
- Typecheck and CommonJS CLI build/version passed (`ScopeForge 0.1.0`).
- Scanner benchmark passed: 700 files, 0 errors, 697 ms wall time / 20,000 ms budget.
- Benchmark matrix passed: dependency-lockfile-heavy median 1,823 ms / 20,000 ms; IaC-heavy median 425 ms / 30,000 ms; source-AST-heavy median 1,220 ms / 30,000 ms.
- Optimized Next.js 15.5.24 build, strict CSP browser acceptance, production UI/Turnstile diagnostic and `actions/upload-artifact@v7` all passed.
- Visual acceptance artifact: `10303292695`.
- Documentation-only `[skip ci]` commits after `5f05ed964c8ab43f38a420b1b77317bae630cc1e` do not replace CI #981 as executable-tree evidence. Any later executable change requires fresh exact-candidate validation.

Completed hardening/maintenance now includes #78 bounded webhook streaming, #80 same-head pending enqueue recovery, #81 artifact action runtime update, #82 architecture/runtime alignment audit, and #85 superseded-push authoritative-head recovery. Those issues are closed.

No Phase 10A2/10A3 production migration has been applied, no production webhook has been registered, no provider/webhook secret has been exposed, and no hosted worker runtime flag has been enabled.

## Priority 1 - GitHub provider operational acceptance

Issue #79 is the current external blocker. It is access-blocked, not approval-blocked.

The current connected Vercel surface can inspect project/deployment/log state but cannot safely read or mutate production environment variables. Do not paste provider secrets into chat, issues, PR comments, repository files, browser-readable variables or ordinary logs.

1. Use a supported authenticated environment-management surface for Vercel project `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`, team `team_WEcf1g1YcD6vYU8LD5jVUOKF`.
2. Verify/configure the six server-only GitHub App values from `PHASE_10A1_GITHUB_APP_SETUP.md`: `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, `GITHUB_APP_STATE_SECRET`.
3. Verify GitHub App homepage `https://scopeforge.dev`, setup/callback `https://scopeforge.dev/api/integrations/github/callback`, installation-time OAuth disabled, Contents read-only and Metadata read-only.
4. Keep `HOSTED_GITHUB_INTEGRATION_ENABLED` false/missing until those settings are verified. Set exact `true` only for the controlled owner/admin canary.
5. Prove Connect GitHub -> installation proof -> repository listing -> one repository import, including persistence, wrong-installation rejection, role authorization and leak checks.
6. Disable the provider gate immediately on any failure.
7. Keep all hosted worker runtime flags disabled throughout this provider-only canary.

Code/CI success does not substitute for live provider acceptance.

## Priority 2 - Phase 10A2 private repository operational acceptance

After Priority 1 passes:

1. Re-read the actual PR #76 head and production migration history.
2. Apply only absent reviewed Phase 10A2 forward migrations to ScopeForge Supabase project `tdgpibrepzcvdivztkta`; verify ACL/RLS/RPC boundaries and advisors.
3. Verify the dedicated worker environment for containment, quotas, cleanup, observability and rollback.
4. Verify intended read-only private-repository provider access.
5. Enable only the accepted private acquisition canary execution class and prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings.
6. Confirm provider credentials stay control-plane-only and private source/capabilities do not leak into worker contracts, persistence or logs.
7. Disable on failure. Merge/release #76 only after provider, schema and runtime acceptance all pass.

Static review already rechecked the private archive trust boundary and found no additional actionable Phase 10A2 defect: authoritative repository/commit identity is control-plane-bound, the worker revalidates the exact codeload host/path/commit, and the snapshot reader independently enforces streamed archive bounds.

## Priority 3 - Phase 10A3 webhook operational acceptance

After PR #76 is released:

1. Reconcile PR #77 onto released Phase 10A2/main and perform fresh exact-candidate validation.
2. Apply only reviewed absent Phase 10A3 migrations, including `20260912024000_phase_10a3_same_head_pending_recovery.sql`; verify private persistence, service-only RPCs, ACL/RLS and advisors.
3. Configure the independent server-only `GITHUB_APP_WEBHOOK_SECRET` and reviewed endpoint/events through a trusted provider surface.
4. Prove invalid-signature rejection, declared/actual oversized-body rejection, delivery replay idempotency, installation/repository lifecycle reconciliation and latest-head coalescing.
5. Canary #80 explicitly: a newer same-head delivery must recover `pending=true` when no active intent owns the chain, while older racing enqueue attempts remain rejected by exact `latest_delivery_id` checks.
6. Canary #85 explicitly: when the signed push payload SHA is older than GitHub's freshly revalidated default-branch head, the payload SHA must never be scanned and the provider-authoritative newer head must enter the existing coalescing/enqueue path.
7. Prove public/private acquisition-class separation and a complete automatic scan through immutable snapshot publication to findings.
8. Verify no raw webhook payload, signature, installation token, private archive URL or private source leaks into browser state, persistence or ordinary logs.
9. Merge/release #77 only after all operational checks pass.

Do not redo completed code hardening unless later reconciliation changes its executable behavior.

## Repository hygiene and maintenance

Retain `main`, the Phase 10A2 branch, the Phase 10A3 branch and `demo/portfolio-20260910`. `docs/development/BRANCH_CLEANUP_CANDIDATES.md` remains the branch-cleanup reference on PR #76.

The connected GitHub surface still does not expose a genuine delete-ref operation. Do not simulate deletion by force-moving refs.

Completed maintenance:

- CI/runtime baseline is Node 24 with root engine contract `>=24 <25`.
- `vitest.config.mts` removes the prior CommonJS-loaded ESM config warning without converting the CommonJS CLI package to ESM.
- `actions/upload-artifact@v7` removes the old Node 20 hosted action-runtime warning.

Remaining independent operational items are not release substitutes:

- Vercel custom WAF/rate-limit configuration remains unverified because authenticated firewall configuration is not exposed by the current connector.
- Supabase leaked-password protection remains plan-gated on the current Free organization.
- The private GitHub scan-intent RLS/no-policy INFO remains intentional for its service-only boundary.
- Existing CAPTCHA evidence proves password sign-in rejects a missing CAPTCHA token; it does not claim successful interactive acceptance for every Auth endpoint.

## Boundaries

Preserve the released UI/admin/auth/CSP baseline, workspace authorization, immutable snapshot provenance, public/private execution-class separation, raw-byte webhook HMAC verification before JSON parsing, provider-authoritative repository/default-head truth, exact stale-delivery checks, latest-head coalescing and default-off hosted capabilities.

Never skip stack order or infer provider/runtime acceptance from code or CI alone.

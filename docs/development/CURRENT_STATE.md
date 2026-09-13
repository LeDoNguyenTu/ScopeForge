# ScopeForge Current State

Last reconciled: 2026-09-13 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `f4f76e823718b6571966e731ed5a5a85a67152b3`
- production domain: `https://scopeforge.dev`
- production Vercel deployment: `dpl_DAXucvciwREJXfp9XXAGJKiccXh3` - READY
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`

Released main includes Phase 10A1 GitHub connected-project core, Phase 10C platform administration, strict nonce CSP/security headers, the accepted command-center presentation, and PR #87 responsive admin/GitHub control-plane UI.

## Responsive admin control plane - released

PR #87 (`Responsive admin control plane and GitHub UI`) was squash-merged to main at `f4f76e823718b6571966e731ed5a5a85a67152b3`.

Final release evidence:

- exact PR head: `1041031260d29e9e3e0278d224f0f9f61d5c783f`
- exact synthetic merge validated by CI: `87ea8a428aecbb70be58769eef42a053e23322e3`
- CI #1018 / run `34732818845`: SUCCESS
- audit: 0 vulnerabilities
- tests: 393/393 files, 1,740/1,740 tests
- typecheck, CommonJS CLI build/version, scanner benchmarks and optimized Next build: PASS
- strict-CSP responsive browser acceptance: PASS
- production landing/Turnstile diagnostic: PASS
- exact visual artifact: `10310078836`, 15 PNGs
- exact-head preview before merge: `dpl_BcpjcTJvRZjbVq9nfXhp4MVXkWC9` - READY

Post-merge production verification:

- `dpl_DAXucvciwREJXfp9XXAGJKiccXh3` built main `f4f76e823718b6571966e731ed5a5a85a67152b3` successfully and is READY/production;
- `scopeforge.dev` returns HTTP 200 with strict nonce CSP, HSTS, nosniff, frame denial, permissions policy and referrer policy intact;
- production `/preview/admin` returns 404 as designed;
- unauthenticated `/api/integrations/github/connect` still resolves to the ScopeForge sign-in boundary for `/dashboard/integrations/github`, not the disabled-provider error path;
- no fresh error/fatal runtime entries were found for the released deployment in the checked window.

PR #87 changed UI/docs/tests only. It did not alter GitHub provider authorization, Supabase schema, worker contracts or hosted runtime capability defaults.

## GitHub App provider acceptance - issue #79

The positive production owner/admin canary passed before PR #87 and remains healthy after the release:

- `HOSTED_GITHUB_INTEGRATION_ENABLED=true` is active;
- owner/admin connection/install proof completed;
- the connection persisted active for `LeDoNguyenTu` with repository selection `selected`;
- `LeDoNguyenTu/ScopeForge` imported successfully on default branch `main`;
- repository access is active;
- the expected connect -> callback -> integration -> import flow was observed;
- no fresh runtime failure was observed during the positive canary.

Fresh leak/boundary verification also confirms:

- `github_connections` and `github_repository_links` persist safe metadata only and contain no provider credential/token/state-secret fields;
- both tables have RLS enabled;
- authenticated browser grants are SELECT-only; service-role grants are limited to SELECT/INSERT/UPDATE/DELETE; no anon table grant was returned;
- workspace-member SELECT policies remain scoped through `private.is_workspace_member(workspace_id)`;
- checked production logs contained no matches for `GITHUB_APP_`, `installation_token`, `Bearer`, `PRIVATE KEY`, or ordinary `github` provider output;
- state/installation cookies are HttpOnly, Secure, SameSite=Lax, callback-path scoped, short-lived, and cleared on terminal redirects;
- redirects expose normalized error codes rather than provider bodies/tokens;
- exact regression tests cover normal-member rejection, cross-user signed-state rejection, spoofed valid numeric installation rejection and safe-metadata-only persistence.

Issue #79 remains open because two checklist items still require independent live authenticated negative canaries that this chat cannot currently execute:

1. live rejection of a different valid numeric installation ID from an authenticated owner/admin callback flow;
2. live rejection of Connect GitHub from an authenticated normal member/viewer session.

No browser-automation integration capable of sharing those authenticated sessions is available in this chat. Do not convert regression-test evidence into a claimed live production pass.

## Production Supabase truth

Production migration history still ends at:

- `20260911143049_phase_10a1_service_role_table_acl_hardening`

The reviewed Phase 10A2/10A3 migrations remain unapplied.

Fresh Phase 10A2 absence preflight confirms production does not yet contain:

- `register_private_repository_snapshot_worker_node(text,text)`;
- `enqueue_private_repository_snapshot_worker_task(uuid,uuid,uuid,uuid)`;
- `enqueue_connected_private_project_snapshot(uuid,uuid,uuid,uuid)`;
- `private.repository_snapshot_tasks.github_repository_link_id`.

The next reviewed Phase 10A2 migrations remain:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

Do not apply them until issue #79's live negative provider acceptance is complete.

## Phase 10A2

PR #76 (`feat/phase-10a2-private-repository-acquisition`) remains draft/open at head `709ef8af4ce4befae12ba910d3bca15599b5cab1`.

After PR #87 changed main, GitHub currently reports PR #76 as not mergeable, so stack reconciliation will be required after #79 clears. Do not resolve/rebase the release stack ahead of the provider gate merely to make the PR green.

Required order after #79:

1. reconcile #76 onto released main;
2. run fresh exact-head validation;
3. re-read migration history and apply only absent reviewed Phase 10A2 migrations;
4. verify private tables/RPCs, grants/revokes, RLS and security posture;
5. complete private worker containment, quotas, cancellation/cleanup, observability and rollback acceptance;
6. prove archive lease -> immutable private snapshot -> exact zero-egress repository scan -> findings;
7. prove GitHub credentials remain control-plane-only and no private source/capability material leaks into browser state or ordinary logs;
8. merge/release #76 only when code, schema, provider and runtime gates are green.

## Phase 10A3

PR #77 (`feat/phase-10a3-github-webhook-reconciliation`) remains draft/open.

Recorded pre-reconciliation evidence:

- docs-only head: `ad6eb05c1e004ca905ad68ce3708ae64c35856d2`
- executable candidate: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- prior synthetic merge: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS

After Phase 10A2 release, reconcile #77 onto released main, run fresh exact validation, apply only reviewed absent Phase 10A3 migrations, configure the independent webhook secret/endpoint, and complete invalid-signature/oversize, replay, lifecycle, coalescing, recovery, leak and automatic-scan acceptance before merge.

## Runtime gates

Keep these false/absent until independent canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Product implementation, migration presence or CI success does not authorize hosted worker activation.

## Historical external-host work

Phase 6D Tasks 14-16, including the real Oracle Linux/rootless-Podman Task 15 containment acceptance, are complete. Do not repeat that work.

A future external/Codex handoff is appropriate only for an exact host-level probe that genuinely requires SSH/control unavailable in the current tool surface.

## Immediate resume point

1. Complete the two live authenticated negative canaries in issue #79 through a browser session capable of using the production owner/admin and member/viewer identities.
2. Close #79 only if both reject as designed and the leak checks remain clean.
3. Reconcile/validate/apply/accept/release PR #76 in strict order.
4. Reconcile/validate/apply/accept/release PR #77 in strict order.
5. Continue with the next documented ScopeForge task rather than stopping after one PR.

# ScopeForge Current State

Last reconciled: 2026-09-12 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
- released `main` includes Phase 10C platform administration
- production domain: `scopeforge.dev`

The released `main` tree remains authoritative until a later PR is merged and production-verified.

## Released security baseline

Preserve together throughout later phases:

- strict nonce CSP with `strict-dynamic`,
- no permanent production `unsafe-inline` or `unsafe-eval`,
- HSTS, nosniff, frame denial, referrer and permissions policies,
- authenticated dashboard boundaries,
- workspace RLS/RPC authority separation,
- worker/runtime authority separation,
- accepted Command Center V5 desktop/mobile presentation.

## Phase 10A1 - connected GitHub projects core

PR #74 (`feat/phase-10a-github-connected-projects`) remains open/draft and mergeable.

Exact head:

`17831b98dbbf06adf213cd2c8694ecd0d6852b74`

CI #912 / run `34611735763`: SUCCESS.

The exact head passed dependency installation/audit, 387 test files / 1,720 tests, TypeScript, CLI build/version, both scanner benchmarks, production Next.js build, strict-CSP browser smoke, production V5/Turnstile diagnostic, and artifact handling.

Correct ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Production records all five reviewed Phase 10A1 migrations:

- `20260910160000_phase_10a1_github_connected_projects`
- `20260910160010_phase_10a1_project_scan_retry_idempotency`
- `20260910160020_phase_10a1_project_scan_waiting_idempotency`
- `20260910160030_phase_10a1_project_scan_recovery`
- `20260911143049_phase_10a1_service_role_table_acl_hardening`

Verified production authority:

- authenticated browser roles have `SELECT` only on `github_connections` and `github_repository_links`,
- `service_role` has only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on those public integration tables,
- private project-scan intent has no direct browser/service-role table grant,
- privileged Phase 10A1 RPCs are `SECURITY DEFINER`, have pinned search paths, and execute only for `service_role`,
- Security Advisor has no Phase 10A1 release-blocking schema issue.

The remaining release gate is operational provider acceptance. The connected Vercel tool surface in this session does not expose environment-variable metadata, so the required server-only GitHub App settings cannot be asserted from that surface without guessing. A genuine authenticated owner/admin `Connect GitHub -> installation proof -> repository list -> repository import` canary must be observed before PR #74 is released. Hosted worker gates remain off.

## Phase 10A2 - private GitHub repository acquisition

PR #76 (`feat/phase-10a2-private-repository-acquisition`) is cleanly reconciled and stacked on the exact Phase 10A1 head.

Current head:

`e812a236f3782059e72a5fd2793d4f9b2641e81f`

CI #913 / run `34621671597`: SUCCESS.

Fresh current-base evidence:

- dependency audit: 0 vulnerabilities,
- 393 Vitest files / 1,732 tests: PASS,
- typecheck: PASS,
- CLI build/version: PASS,
- scanner and matrix benchmarks: PASS,
- production Next.js build: PASS,
- strict-CSP browser smoke: PASS,
- production V5/Turnstile diagnostic: PASS,
- artifact handling: PASS.

Phase 10A2 preserves a distinct `repository_snapshot_github_private_v1` execution class, a separate default-off private runtime gate, control-plane-only provider credentials, attempt-bound private archive capabilities, no public fallback, immutable publication, and exact-snapshot zero-egress continuation.

Production migration history intentionally stops after Phase 10A1. Neither reviewed Phase 10A2 migration is authorized for production before Phase 10A1 releases and the private provider/worker canary sequence is accepted.

PR #76 remains draft and must not merge ahead of Phase 10A1.

## Phase 10A3 - authenticated GitHub webhook reconciliation

PR #77 (`feat/phase-10a3-github-webhook-reconciliation`) is stacked on exact Phase 10A2 head `e812a236f3782059e72a5fd2793d4f9b2641e81f`.

Latest executable-validation head:

`2a99c0fb91d1b28c309cf145f1367cbffa3410c3`

CI #938 / run `34653612240`: SUCCESS.

That exact candidate passed:

- dependency installation,
- `npm audit --audit-level=info` with 0 vulnerabilities,
- complete Vitest suite,
- TypeScript typecheck,
- CLI build and version execution,
- scanner benchmark and matrix benchmark,
- production Next.js build,
- strict-CSP browser smoke,
- production V5/Turnstile diagnostic,
- visual acceptance artifact handling.

Implemented Phase 10A3 boundaries include:

- seventh server-only setting `GITHUB_APP_WEBHOOK_SECRET`, separate from OAuth/state/private-key material,
- exact raw-byte HMAC-SHA256 verification before JSON parsing or persistence,
- strict delivery/event/content-type validation and 10 MiB declared/actual body ceilings,
- provider-authoritative installation/repository/default-branch/default-head revalidation,
- delivery replay protection and latest-default-head coalescing,
- explicit `github_webhook` system-trigger provenance,
- lifecycle reconciliation for installation/repository access, rename/transfer/privacy/archive/delete changes,
- completion authority bound to exact webhook intent, snapshot task, immutable snapshot ID, and `repository_source_snapshots.resolved_commit_sha`,
- replay-safe successful-head watermark advancement and exactly-one newest-head follow-up scheduling,
- public/private acquisition runtime/class separation preserved,
- browser read model exposes only existing safe repository/link state including `auto_scan_enabled`,
- manual owner/admin scan behavior remains independent from automatic-scan preference,
- architecture guards reject private webhook/coalescing-table browser access and credential/raw-payload persistence.

Phase 10A3 migrations remain source-only. No Phase 10A3 production DDL has been applied, no production webhook has been registered, and no production webhook secret or hosted runtime flag has been activated.

The current branch is in Task 8 documentation/release reconciliation. Documentation-only changes after executable CI #938 must be formally compared to the validated executable head, and a final exact-head CI should be run before any integration decision.

## Runtime truth

Keep these false/absent until independent canary and rollback acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Product implementation, schema presence, or CI success does not authorize hosted worker activation.

## Immediate release sequence

1. Finish Phase 10A3 Task 8 docs/README/security review and exact-head validation.
2. Re-check Phase 10A1 production provider/configuration state with every connected supported surface.
3. Complete the authenticated Phase 10A1 GitHub App connection/import canary; merge PR #74 only after it is genuine and clean.
4. Verify the merged `main` deployment/security baseline.
5. Retarget/reconcile PR #76 onto released `main`, verify/apply only absent Phase 10A2 migrations, then complete the dedicated private provider/worker/runtime canary before Phase 10A2 merge.
6. Retarget/reconcile PR #77 onto released Phase 10A2/main, verify/apply only absent Phase 10A3 migrations, configure the seventh webhook secret and reviewed GitHub App webhook settings, then complete replay/lifecycle/coalescing/end-to-end automatic-scan canaries before Phase 10A3 merge.
7. Never skip stack order or infer provider/runtime acceptance from CI alone.

## Production services

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8` (`scopeforge`)
- production: `scopeforge.dev`

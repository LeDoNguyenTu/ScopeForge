# ScopeForge Current State

Last reconciled: 2026-09-12 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
- production: `scopeforge.dev`
- released baseline includes Phases 1-9E, strict nonce CSP, accepted Command Center V5, and Phase 10C platform administration

The released `main` tree remains authoritative until a later PR is merged and production-verified.

## Phase 10A1 - connected GitHub projects core

PR #74 (`feat/phase-10a-github-connected-projects`) is open, draft, and mergeable.

Exact Phase 10A1 head:

`17831b98dbbf06adf213cd2c8694ecd0d6852b74`

Fresh current-`main` validation supersedes the older exact-head run:

- current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
- synthetic merge ref: `c53b21f0b28735f3fc3fa59c85414f977346a403`
- CI #949 / run `34656537969`: SUCCESS
- `npm audit --audit-level=info`: 0 vulnerabilities
- Vitest: 387 / 387 files, 1,720 / 1,720 tests
- TypeScript typecheck: PASS
- CLI build/version: PASS (`ScopeForge 0.1.0`)
- scanner benchmark and dependency/IaC/source-AST benchmark matrix: PASS
- optimized Next.js 15.5.24 production build: PASS
- strict-CSP browser smoke: PASS
- production `scopeforge.dev` V5/Turnstile diagnostic: PASS
- four-file visual acceptance artifact upload: PASS, artifact `10285666527`

Correct ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Production records exactly the five reviewed Phase 10A1 migrations, ending at:

`20260911143049_phase_10a1_service_role_table_acl_hardening`

Verified production authority remains least-privilege:

- authenticated browser roles have `SELECT` only on `github_connections` and `github_repository_links`
- `service_role` has only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on those integration tables
- private project-scan intent has no direct browser/service-role table grant
- privileged Phase 10A1 RPCs are `SECURITY DEFINER`, pin `search_path`, and execute only for `service_role`
- Security Advisor has no Phase 10A1 release-blocking schema issue

Production still contains zero `github_connections` and zero `github_repository_links`.

The remaining Phase 10A1 release blocker is a real provider acceptance gate, not code/schema validation. Before merge, a workspace owner/admin must complete `Connect GitHub -> installation proof -> repository listing -> repository import` against the configured production GitHub App, and the six server-only GitHub App settings must be verified through a configuration surface that does not expose their values. Current connected Vercel tooling does not expose environment-variable metadata, so those settings cannot be asserted from this session without guessing.

## Phase 10A2 - private GitHub repository acquisition

PR #76 (`feat/phase-10a2-private-repository-acquisition`) is open, draft, mergeable, and stacked exactly on Phase 10A1.

Current head:

`e812a236f3782059e72a5fd2793d4f9b2641e81f`

CI #913 / run `34621671597`: SUCCESS against synthesized merge `b7abd24bf5aa76663ecbdebcc78cdc06fd309122`.

Validated evidence:

- audit: 0 vulnerabilities
- 393 Vitest files / 1,732 tests: PASS
- typecheck: PASS
- CLI build/version: PASS
- scanner and matrix benchmarks: PASS
- production Next.js build: PASS
- strict-CSP browser smoke: PASS
- production V5/Turnstile diagnostic: PASS
- artifact handling: PASS

Phase 10A2 preserves a distinct `repository_snapshot_github_private_v1` execution class, a separate default-off private runtime gate, control-plane-only provider credentials, attempt-bound private archive capabilities, no public fallback, immutable publication, and exact-snapshot zero-egress continuation.

No Phase 10A2 migration has been applied to production and no private runtime flag has been enabled. PR #76 must not merge ahead of Phase 10A1.

## Phase 10A3 - authenticated GitHub webhook reconciliation

PR #77 (`feat/phase-10a3-github-webhook-reconciliation`) is open, draft, mergeable, and stacked on exact Phase 10A2 head `e812a236f3782059e72a5fd2793d4f9b2641e81f`.

Current head before this documentation reconciliation:

`3cf6dc800eafeb7967b231063afb2e4177acf64f`

Final docs-inclusive validation at that head:

- synthetic merge ref: `87e11f9e22bb79e6f9810860ed182a85cc868fd2`
- CI #948 / run `34656348562`: SUCCESS
- `npm audit --audit-level=info`: 0 vulnerabilities
- Vitest: 402 / 402 files, 1,839 / 1,839 tests
- TypeScript typecheck: PASS
- CLI build/version: PASS
- scanner benchmark and benchmark matrix: PASS
- optimized Next.js 15.5.24 production build: PASS
- strict-CSP browser smoke: PASS
- production `scopeforge.dev` V5/Turnstile diagnostic: PASS
- four-file visual acceptance artifact upload: PASS, artifact `10286501039`

Implemented Phase 10A3 boundaries include:

- independent server-only `GITHUB_APP_WEBHOOK_SECRET`
- exact raw-byte HMAC-SHA256 verification before JSON parsing or persistence
- strict delivery/event/content-type validation and 10 MiB declared/actual body ceilings
- provider-authoritative installation/repository/default-branch/default-head revalidation
- delivery replay protection and latest-default-head coalescing
- lifecycle reconciliation for installation/repository access, rename/transfer/privacy/archive/delete changes
- completion authority bound to exact webhook intent, snapshot task, snapshot ID, and immutable resolved commit SHA
- replay-safe successful-head watermark advancement and at-most-one newest-head follow-up scheduling
- public/private acquisition runtime/class separation preserved
- browser read model exposes only the existing safe `auto_scan_enabled` preference

Release-hardening review found and fixed a manual-scan/coalesced-webhook no-lost-head edge case before release. The forward-only correction binds settlement to the persisted repository `scan_task_id`, preserves queued/leased/`retry_wait`, accepts only terminal task/job pairs, and triggers provider-authoritative follow-up only after trusted repository-scan terminal settlement. RED CI #940 isolated exactly eight new failing assertions; GREEN CI #947 and final CI #948 passed all eight plus the full suite.

No Phase 10A3 migration has been applied to production, no production webhook has been registered, and no webhook secret/runtime flag has been activated.

## Independent security follow-ups

### Supabase leaked-password protection

Fresh project/org inspection confirms the ScopeForge Supabase organization is on the `free` plan. Current Supabase documentation states leaked-password protection is available on Pro and above. Therefore the existing leaked-password-protection advisor warning cannot be removed on the current plan by a safe project configuration change. Do not change unrelated database/auth behavior merely to silence the warning.

### Turnstile enforcement

The released auth UI requires a Turnstile token when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is configured and forwards `captchaToken` directly to Supabase Auth. Production browser diagnostics prove the Turnstile widget/script is active. That does not independently prove Supabase Auth server-side CAPTCHA enforcement; the current tool surface cannot issue the required production Auth POST probe or read hosted Auth CAPTCHA configuration. Treat server-side enforcement verification as still open.

### Vercel firewall / rate limiting

Vercel provides automatic platform DDoS mitigation on all plans, but the connected Vercel surface available in this session does not expose the project's live custom firewall/rate-limit configuration and no authenticated Vercel CLI is available in the execution container. Treat custom WAF/rate-limit verification as still open rather than inferring it from platform defaults.

## Runtime truth

Keep these false/absent until independent canary and rollback acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Product implementation, schema presence, or CI success does not authorize hosted worker activation.

## Immediate release sequence

1. Complete the authenticated Phase 10A1 GitHub App provider canary; merge PR #74 only after it is genuine and clean.
2. Verify the merged Phase 10A1 production deployment/security baseline.
3. Retarget/reconcile PR #76 onto released `main`, apply only absent reviewed Phase 10A2 migrations, and complete the private provider/worker/runtime canary before Phase 10A2 merge.
4. Retarget/reconcile PR #77 onto released Phase 10A2/main, apply only absent reviewed Phase 10A3 migrations, configure the webhook secret/endpoint, and complete signed-delivery/replay/lifecycle/coalescing/end-to-end automatic-scan canaries before Phase 10A3 merge.
5. Independently close Turnstile server-enforcement and Vercel WAF/rate-limit verification when a supported authenticated management or HTTP-probe surface is available.
6. Never skip stack order or infer provider/runtime acceptance from CI alone.

## Production services

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8` (`scopeforge`)
- production: `scopeforge.dev`

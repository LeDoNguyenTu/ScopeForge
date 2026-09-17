# ScopeForge account and provider context checklist

Prepared: 2026-09-18, Asia/Singapore

This file contains only non-secret identity/context information. It is a guard against operating the wrong account or project. Never add secret values to this file.

Provider dashboards and connected tools can change. Verify live state before a write operation.

## 1. GitHub

Expected repository:

- owner/login: `LeDoNguyenTu`
- repository: `LeDoNguyenTu/ScopeForge`
- default branch: `main`

The connected GitHub account was verified during this handoff as `LeDoNguyenTu`.

Before work:

- confirm `git remote -v` points to the ScopeForge repository
- fetch/prune refs and inspect live `main`
- inspect all open PRs and issues, not only the numbers embedded in older documentation
- inspect the exact candidate CI result before merge/release claims
- confirm local Git author configuration is the intended user

Also verify the ScopeForge GitHub App under the intended GitHub account. The production connection is expected to be associated with GitHub account `LeDoNguyenTu` and selected repository access for `LeDoNguyenTu/ScopeForge`. Do not expose the App private key, client secret, state secret, installation token, or OAuth token.

As of 2026-09-18, the ScopeForge GitHub App webhook is configured for `https://scopeforge.dev/api/integrations/github/webhook`; Push and Repository subscriptions are saved. Installation and Installation repositories are default GitHub App events and do not appear as selectable subscription checkboxes.

## 2. Vercel

Verified during this handoff:

- team name: `Brian`
- team slug: `itsbrian`
- team ID: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- project: `scopeforge`
- project ID: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- framework: Next.js
- configured Node runtime: 24.x
- production domain includes: `scopeforge.dev`
- production `GITHUB_APP_WEBHOOK_SECRET`: configured on 2026-09-18; never reveal its value

At handoff time, the connected Vercel project reported a READY production deployment. Treat its deployment ID and commit as historical unless re-read live.

Before changing environment variables, domains, firewall rules, deployment configuration, or production state:

- confirm the selected Vercel team is `itsbrian`
- confirm project ID exactly matches `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- confirm `scopeforge.dev` belongs to this project
- compare required variable names with `docs/ENVIRONMENT.md`
- verify public and server Supabase values point to the ScopeForge Supabase project, not another project
- do not reveal environment variable values in logs, PRs, chat, or documentation

## 3. Supabase

Verified during this handoff, two live projects exist in the same Supabase organization. This is a high-risk account-context mistake to guard against.

Correct ScopeForge project:

- name: `ScopeForge`
- project ref/ID: `tdgpibrepzcvdivztkta`
- region: `ap-southeast-1`
- status at handoff: `ACTIVE_HEALTHY`
- Phase 10A3 migrations applied on 2026-09-18; live generated versions `20260917180241` through `20260917180257`

Different project - do not use for ScopeForge:

- name: `Brian Job Command Center`
- project ref/ID: `xwsergbpvkcsugexssmc`

Before SQL, migrations, Auth, Storage, Edge Functions, RLS, grants, or advisor work:

- explicitly print/check the non-secret project ref and confirm it is `tdgpibrepzcvdivztkta`
- inspect live migration history before applying anything
- apply only reviewed migrations that are absent
- never rewrite a deployed migration
- run security/performance advisors after relevant schema changes
- keep RLS and privilege boundaries intact
- never expose the Supabase secret/service-role key

## 4. Cloudflare

The connected tools used to prepare this handoff could not independently verify the active Cloudflare account, so this must be checked manually or through an authenticated Cloudflare tool before any write.

Expected ScopeForge resources include:

- authoritative DNS zone for `scopeforge.dev`
- Vercel application DNS records kept DNS-only, not Cloudflare-proxied, unless the architecture is deliberately changed and re-reviewed
- Cloudflare Turnstile configuration used by ScopeForge authentication flows
- Cloudflare R2 account matching production `R2_ACCOUNT_ID`
- the private R2 bucket matching production `R2_BUCKET_NAME`

Check that the account you are logged into actually owns all intended ScopeForge resources before modifying DNS, Turnstile, R2, WAF, or rate-limit settings. Do not paste account secrets, R2 access keys, Turnstile secret keys, or full dashboard exports into Codex.

Provider-security controls such as current WAF/rate-limit state must be reported as `NOT VERIFIED` until directly observed. Do not infer them from source code.

## 5. Domain registrar

Check the registrar account that owns `scopeforge.dev` before renewal, nameserver, transfer, or DNS delegation changes.

Expected architecture is Cloudflare authoritative DNS with Vercel hosting. The registrar account and Cloudflare account are separate trust boundaries even if the domain currently resolves correctly.

Do not change nameservers or transfer settings during ordinary application work.

## 6. Oracle Cloud / worker host

Historical Phase 6D Task 15 containment acceptance used a dedicated Oracle Cloud Linux VM in `ap-singapore-1`. That acceptance is complete and must not be recreated merely because a new Codex session starts.

Before any future host-level probe or worker-host mutation:

- confirm the OCI tenancy/account and compartment are the intended ScopeForge environment
- confirm region is the intended Singapore region when operating the historical worker host
- confirm the exact host/runtime/image under test before treating old containment evidence as applicable
- confirm SSH identity/key belongs to this environment
- never copy production provider credentials to the scanner sandbox

If the current Phase 10 work eventually needs a new host-level containment canary, scope it to the exact remaining probe and record fresh evidence for the exact candidate.

## 7. Codex / local development environment

Before allowing Codex to take external actions:

- verify Codex is opened on the current ScopeForge checkout, not an older clone or worktree
- verify GitHub authentication maps to `LeDoNguyenTu` or another explicitly authorized identity
- verify any Supabase MCP/CLI project selection is `tdgpibrepzcvdivztkta`
- verify any Vercel CLI/project link maps to team `itsbrian` and project `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- verify Cloudflare/OCI sessions separately before using them
- never place production secrets in prompts or tracked `.env` files

## Stop-on-mismatch rule

A mismatch in repository owner, Supabase project ref, Vercel team/project ID, domain zone, GitHub App identity, R2 account/bucket, or worker tenancy is not a minor warning. Stop the external write, determine why the context differs, and only continue after the intended target is proven.

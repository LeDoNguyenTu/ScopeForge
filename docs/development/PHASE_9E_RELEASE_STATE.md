# ScopeForge Phase 9E Release State

Last updated: 2026-09-09 (Asia/Singapore)

## Status

`RELEASED`

Phase 9E incident readiness and exact-release security engineering is released on production `main`.

Provider state remains conservative. A provider control that was not directly inspectable is recorded as `NOT VERIFIED`, not converted into PASS.

## Final repository identity

- implementation PR: #64 - `Phase 9E incident readiness and release engineering`
- base `main`: `b8ceb94bd603331883a26f4da73293dc4f4421b0`
- exact frozen candidate: `887325d13900b2f7653d81b78a3013d887ac4508`
- exact frozen candidate tree: `91bbc94f5c3c00050da21a4b5288bc17b0847540`
- squash merge: `6c6c07b070d2751a96729d3e58a86414ae148edc`
- released `main` tree: `91bbc94f5c3c00050da21a4b5288bc17b0847540`

The merge preserved the exact candidate tree.

## Released deliverables

Phase 9E adds:

- operational private vulnerability reporting and coordinated disclosure in `SECURITY.md`
- `docs/security/INCIDENT_RESPONSE.md`
- `docs/security/RELEASE_SECURITY_CHECKLIST.md`
- `tests/architecture/phase-9e-incident-release-engineering.test.ts`
- Phase 9E design and implementation plan
- this exact release-state record

The implementation did not change:

- accepted Command Center UI V5 presentation or poster assets
- package dependencies
- Supabase migrations or RLS implementation
- scanner families
- worker/runtime implementation
- hosted runtime defaults
- CSP enforcement

## Exact candidate validation

Final exact candidate GitHub CI:

- workflow: `CI / validate`
- run: #781
- run ID: `34315557014`
- exact SHA: `887325d13900b2f7653d81b78a3013d887ac4508`
- conclusion: SUCCESS

All permanent gates passed:

- dependency install
- `npm audit --audit-level=info`
- full `npm test`
- `npm run typecheck`
- `npm run build:cli`
- CLI version execution
- `npm run benchmark:scanner`
- `npm run benchmark:matrix`
- production `npm run build`

Final exact-head Vercel Preview:

- deployment: `dpl_mn4BFJNJCmyZnF6JehU1Lp9sGQeD`
- Git SHA: `887325d13900b2f7653d81b78a3013d887ac4508`
- state: READY
- `aliasError=null`

Before merge, PR #64 was mergeable, had zero unresolved review threads, no requested-change review, and exactly seven Phase 9E files in the base-to-head diff.

## Independent post-merge validation

Post-merge `main` CI:

- workflow: `CI / validate`
- run: #782
- run ID: `34315902360`
- exact SHA: `6c6c07b070d2751a96729d3e58a86414ae148edc`
- conclusion: SUCCESS

The independent `main` run again passed:

- dependency install
- npm audit
- full test suite
- typecheck
- CLI build/version
- scanner benchmark
- benchmark matrix
- production Next.js build

## Exact production deployment

Production Vercel release:

- project: `scopeforge`
- project ID: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- deployment: `dpl_5sQid6VJ4xC2BS7iYrHBYUrzzQFP`
- exact Git SHA: `6c6c07b070d2751a96729d3e58a86414ae148edc`
- target: production
- state: READY
- `aliasError=null`
- production alias: `scopeforge.dev`

A fresh provider-backed fetch of `https://scopeforge.dev` after the production deployment returned HTTP 200.

The response contains the accepted V5 evidence:

- `data-testid="command-center-v5-desktop"`
- `data-testid="command-center-v5-mobile"`
- `/command-center-v5-poster-desktop.webp`
- `/command-center-v5-poster-mobile.webp`

The current security-header baseline remains present, including HSTS, nosniff, `X-Frame-Options: DENY`, restrictive Permissions Policy, and strict-origin referrer policy.

No `Content-Security-Policy` header was present. CSP remains intentionally `NOT ENFORCED` at the Phase 9E boundary.

## Supabase production truth

Directly inspected ScopeForge Supabase project:

- project ID: `tdgpibrepzcvdivztkta`
- name: `ScopeForge`
- region: `ap-southeast-1`
- status: `ACTIVE_HEALTHY`
- PostgreSQL: 17.6.1.155

Migration head remains:

`20260908084554_phase_9c_function_acl_hardening`

No later migration was present during Phase 9E evidence collection.

Live database checks confirmed:

- ordinary-role direct privilege violations across private base tables: `0`
- authenticated `private` schema usage: `true`
- authenticated `private.is_workspace_member(uuid)` execute: `true`
- authenticated `private.has_workspace_role(uuid, public.workspace_role[])` execute: `true`

Phase 9E introduced no database mutation.

## Supabase Security Advisor

Current known warning:

- `auth_leaked_password_protection`
- `Leaked Password Protection Disabled`
- level: WARN

State: `VERIFIED DISABLED`

This was not silently enabled during Phase 9E.

## Provider controls not overclaimed

### Turnstile production provider enforcement

`NOT VERIFIED`

Application support exists from Phase 9B, but provider enforcement is not inferred from source code.

### Vercel custom WAF/rate-limit rules

`NOT VERIFIED`

The currently connected Vercel surface does not expose project-specific firewall-rule configuration.

### CSP

`NOT ENFORCED`

Directly confirmed by the post-release production response.

## Hosted runtime authority

Expected false/absent unless separately accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

The preceding verified Phase 9D release state records these capabilities as false or absent unless separately accepted. Phase 9E made no Vercel environment mutation and no runtime-authority code change.

The current Vercel connector does not expose environment-variable names/state for fresh direct inspection, so direct Phase 9E provider reinspection is:

`NOT VERIFIED BY CURRENT CONNECTOR`

This is an inspection limitation, not evidence that a capability is enabled.

## Branch cleanup

Historical completed `diag/*`, `preview/*`, reconciliation, docs, and feature branches are cleanup candidates after their work has been merged or superseded.

The connected GitHub write surface in this chat does not expose a genuine delete-ref operation. Repository setting `delete_branch_on_merge` is currently false. Moving old refs to `main` would not delete them and is not an acceptable substitute.

Branch deletion therefore remains blocked by connector capability. No stale ref was rewritten or disguised as deleted.

## Phase 9E release decision

`RELEASED`

All code/repository release blockers were cleared:

- exact frozen candidate CI: PASS
- exact frozen candidate Preview: PASS
- diff/review/mergeability gate: PASS
- expected-head protected squash merge: PASS
- independent post-merge main CI: PASS
- exact production deployment: PASS
- production HTTP/V5 preservation: PASS
- database boundary regression evidence: PASS

Provider items explicitly listed as `NOT VERIFIED` or `VERIFIED DISABLED` remain operational follow-ups rather than hidden release claims.

## Next engineering boundary

Strict CSP enforcement is the next separate compatibility gate.

It must be tested against the exact current Next.js and Command Center V5 behavior before enforcement. Do not use broad permanent `unsafe-inline` or `unsafe-eval` as a shortcut.
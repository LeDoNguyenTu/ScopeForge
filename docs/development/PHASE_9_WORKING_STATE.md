# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Phase status

- Phase 9 architecture: approved
- Phase 9A authentication boundary: complete and released
- Phase 9B provider/auth hardening code: complete and released; external provider activation remains pending direct verification where documented
- Phase 9C database/RPC defense-in-depth: complete and released
- Phase 9D security telemetry/browser hardening: complete and released
- Phase 9E incident/release engineering: next implementation boundary
- strict CSP enforcement: separate later compatibility gate

## Authoritative production baseline

Current released `main`:

`27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`

Tree:

`007474c194f687f126c000d98b1d1ed3a5d032d9`

Exact production Vercel deployment:

- `dpl_ExY8TxoHpFT7wsiMwg3w4BTUNE8V`
- target production
- exact Git SHA `27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`
- READY
- `aliasError=null`
- aliases include `scopeforge.dev`

Independent post-merge repository CI run `34311757445` completed successfully on the exact released SHA, including install, npm audit, full tests, typecheck, CLI build/version, scanner benchmark, benchmark matrix, and the production Next.js build.

A fresh production GET returned HTTP 200 with the accepted Command Center UI V5 desktop/mobile composition markers and both V5 poster assets.

## Released Phase 9D boundary

Release record:

`docs/development/PHASE_9D_RELEASE_STATE.md`

Approved written spec:

`docs/superpowers/specs/2026-09-09-phase-9d-security-telemetry-browser-hardening-design.md`

Implementation plan:

`docs/superpowers/plans/2026-09-09-phase-9d-security-telemetry-browser-hardening.md`

Phase 9D released bounded operational security telemetry, durable audit-metadata validation, and regression coverage for the existing browser-header baseline without modifying the accepted V5 presentation source.

The stale pre-V5 PR #61 was closed as superseded. PR #62 was merged with exact-head protection after successful exact-head Preview and CI validation.

## Browser hardening and CSP truth

Existing security headers remain pinned by architecture tests.

CSP state: NOT ENFORCED.

Strict CSP remains a separate compatibility gate. Do not add broad permanent `unsafe-inline` or `unsafe-eval` simply to claim CSP coverage.

## Current provider/runtime truth

Still intentionally not claimed:

- production Turnstile enforcement
- Supabase leaked-password protection enabled
- Vercel project custom WAF rules active
- Vercel automated security alerts active
- CSP enforcement
- real protected Preview POST plus Runtime Log observation of the Phase 9D authentication-rejection telemetry event

Keep false or absent:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Phase 9E direction

Phase 9E is the next approved architecture boundary. It covers incident readiness and the final security launch gate, including:

- private vulnerability disclosure workflow
- severity and triage procedure
- containment and worker-disable procedure
- credential rotation order
- Supabase containment/recovery actions
- Vercel rollback and traffic-control actions
- data-impact assessment
- evidence preservation without collecting secrets
- recovery validation
- post-incident review
- final release-security checklist tied to exact release evidence

Phase 9E must describe the system that actually exists. It must not claim provider controls are active until those controls are directly verified.

## Outstanding review items

Legacy broad SQL grants on `profiles`, `workspaces`, and `workspace_members` remain a separate review point. RLS is enabled and Phase 9C did not change those grants. Do not silently mix that cleanup into Phase 9E.

Provider activation for Turnstile, leaked-password protection, and project-specific Vercel edge controls remains separately verified operational work.

Strict CSP remains a separate compatibility gate after Phase 9E unless its own design and exact V5/Next.js compatibility evidence are approved.

## UI baseline rule

Current production `main` is authoritative. Phase 9E must preserve the released Command Center UI V5 and must not resurrect historical PR #49 or its old branches as an implementation source.

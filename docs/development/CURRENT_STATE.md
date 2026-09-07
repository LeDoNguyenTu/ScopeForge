# ScopeForge Current State

Last reconciled: 2026-09-08 (Asia/Singapore)

This is the authoritative non-UI current-state summary. Dashboard V5/UI remains a separate active workstream and is excluded from mutation here.

## Repository state

- repository: `LeDoNguyenTu/ScopeForge`
- current released non-UI baseline on `main`: `5c08003c8bf8cb920832431a346c9254aae92239`
- released tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- latest merged non-UI PR: #58, `Phase 9A authentication boundary hardening`
- Phase 9A final verified PR head: `386308657bca0d8ba66f86074992d9983db600ba`
- Phase 9A final PR CI: #767, success
- post-merge main CI: #768, success
- authoritative Phase 9A release state: `docs/development/PHASE_9A_RELEASE_STATE.md`
- broader Phase 9 design: `docs/superpowers/specs/2026-09-08-phase-9-security-hardening-design.md`

## Completed non-UI boundaries

Phases 1-5C, Phase 6A foundation, Phase 6B acquisition code, Phase 6C isolated scanner code, Phase 6D dedicated network-worker code/release acceptance, Phase 7 Community Security Packs v1, Phase 8A offline accuracy foundation, Phase 8B performance matrix, Phase 8C reproducible technical publication, and Phase 9A authentication-boundary hardening are complete and merged.

Code merge is not runtime authorization. Production worker capabilities remain separately gated.

## Phase 8 validation baseline

The committed `scopeforge-offline-v1@1.0.0` corpus remains:

- 32 reviewed cases: 16 vulnerable / 16 clean
- 8 represented rules across `iac`, `jsts`, and `secrets`
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Covered-corpus precision, recall, and F1 are 1.00 and FPR is 0.00. These values describe only the committed reviewed corpus and are not global or real-world ScopeForge accuracy.

Phase 8B retains the deterministic local/offline performance matrix with exactly three runs per profile. RSS delta is observational only. Catastrophic benchmark ceilings are regression guards, not product SLOs.

Phase 8C remains the released deterministic publication layer for those accepted measurements.

## Phase 9A - complete and released

Phase 9A closes the browser authentication boundary without changing provider settings or production worker authority.

Released behavior:

- one shared local-only parser validates post-auth return paths
- `/auth/callback` and `/auth/confirm` no longer redirect to untrusted external `next` targets
- absolute URLs, protocol-relative URLs, backslash host-confusion forms, control characters, malformed encodings, and decoded unsafe forms fall back to `/dashboard`
- safe local paths retain query strings and fragments
- browser-visible authentication failures no longer render raw Supabase provider messages
- rate-limit failures retain bounded retry guidance without exposing provider details
- focused behavior, route, component, and architecture regression tests are committed

## Phase 9A release evidence

Final candidate:

- PR: #58
- PR head: `386308657bca0d8ba66f86074992d9983db600ba`
- tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- PR CI #767: success
- npm audit: success
- full test suite: success
- typecheck: success
- CLI build/version: success
- historical benchmark: success
- Phase 8B matrix: success
- production build: success
- exact-head Vercel Preview `dpl_8KXQU6NguYtVPLv42EwKK7eEoyPP`: READY, `aliasError=null`

Release integration:

- squash merge: `5c08003c8bf8cb920832431a346c9254aae92239`
- main tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- post-merge main CI #768: success
- exact production deployment: `dpl_BePDHoKDzWPXU6L2PX3Rj8bpTTue`
- deployment state: READY
- deployment target: `production`
- deployment Git SHA: `5c08003c8bf8cb920832431a346c9254aae92239`
- production domain includes `scopeforge.dev`
- `aliasError=null`

## Phase 9 controls still pending

Phase 9A did not change provider or database configuration.

Still pending under their own reviewed subphase gates:

- Supabase leaked-password protection
- Supabase Auth rate-limit configuration review
- Cloudflare Turnstile
- Vercel WAF/rate-limit rules
- database/private-function defense-in-depth
- security telemetry and alerting
- CSP hardening
- incident/release hardening

Current live Supabase Security Advisor still reports one warning: `auth_leaked_password_protection`.

## Production runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 8 validation and Phase 9A authentication hardening authorize none of these capabilities.

## Production services

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Never confuse it with the separate Job Command Center Supabase project.

Vercel project: `scopeforge`; production domain: `scopeforge.dev`.

## UI isolation

PR #49 and all active Dashboard V5/UI branches remain separate. Non-UI work must not edit, merge, replace, retarget, or deploy that UI stream.

## Next non-UI boundary

Phase 9C database/RPC defense-in-depth is next.

Start with live privilege inventory and executable regression evidence before proposing any forward-only migration. In particular, do not blindly revoke `authenticated` usage on schema `private`, because current RLS policies intentionally depend on private membership/role helper functions.

Phase 9B Turnstile/WAF/provider changes remain separate and require their own operational acceptance.

## Branch cleanup

Delete merged backend branches only through a genuine remote delete-ref operation. If the connected GitHub surface does not expose branch deletion, leave merged refs intact rather than force-moving them. Preserve all V5/UI branches.

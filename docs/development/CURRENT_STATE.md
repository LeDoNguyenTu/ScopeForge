# ScopeForge Current State

Last reconciled: 2026-09-10 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `a84478dfe1d361f6d9fa3d67f0e26ea9b2088e54`
- current released tree: `f2a39880347444967f2f2b0e2eb78d63342afbef`
- latest implementation PRs: #66 strict CSP compatibility, then #67 approved V5 UI restoration
- final V5 restoration candidate: `e66b6fc4b8693deb052fa89ae9d82647d51c3a94`
- candidate CI: #802 / run `34395508634`, success
- post-merge main CI: #803 / run `34396470298`, success
- production deployment: `dpl_3F4rnzhWQ93RoPKqdTe4U96TPSKb`, READY, `aliasError=null`
- production domain: `scopeforge.dev`

The released `main` tree is the integration baseline for future work.

## Completed phases and compatibility gates

Released work includes:

- Phases 1 through 6D
- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B deterministic scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B provider/auth hardening code
- Phase 9C database/RPC defense-in-depth
- Phase 9D security telemetry and browser hardening
- Phase 9E incident readiness and release engineering
- post-Phase-9 strict CSP compatibility gate
- approved Command Center V5 restoration on top of the strict CSP baseline

The combined CSP/restoration evidence is recorded in `docs/development/STRICT_CSP_AND_V5_RESTORATION_RELEASE_STATE.md`.

## Production UI

The accepted Command Center UI V5 is restored and remains authoritative.

Fresh production and browser-gate evidence confirms:

- `scopeforge.dev` returns HTTP 200
- desktop V5 marker is present
- mobile V5 marker is present
- desktop and mobile V5 poster assets are present
- the desktop public V5 scale is browser-checked
- the authenticated dashboard uses the immersive V5 shell rather than the later SaaS/workspace-shell composition
- authenticated topology and lower evidence panels are browser-checked for the approved geometry and scale
- corrected landing and dashboard screenshots were captured and inspected before merge

Historical V4, preview, diagnostic, reconciliation, and temporary restoration branches are not implementation baselines.

## Browser security baseline

Strict CSP is now enforced in production.

The current policy is nonce-based, includes `strict-dynamic`, keeps exact ScopeForge Supabase HTTPS connectivity, and does not use permanent production `unsafe-inline` or `unsafe-eval` allowances.

Fresh production checks also confirm the existing HSTS, nosniff, frame-denial, referrer-policy, and permissions-policy headers remain present. `/auth/sign-in` renders normally under the nonce CSP.

The repository CI now performs a real Chrome browser acceptance gate covering CSP execution, hydration, navigation, auth, 404 behavior, dashboard auth boundaries, the public WebGL scene, and V5 restoration visual geometry.

## Supabase baseline

- ScopeForge project: `tdgpibrepzcvdivztkta`
- migration head remains `20260908084554_phase_9c_function_acl_hardening`
- fresh Security Advisor inspection reports only the known leaked-password-protection warning
- leaked-password protection: `VERIFIED DISABLED`

The CSP/restoration work introduced no database migration and no Auth-provider mutation.

## Provider and runtime truth

Current conservative state:

- production Turnstile provider enforcement: `NOT VERIFIED`
- Vercel custom WAF/rate-limit rule state: `NOT VERIFIED`
- Supabase leaked-password protection: `VERIFIED DISABLED`
- strict CSP: `ENFORCED`

The current Vercel connector does not expose project environment-variable values. A fresh direct read of the four hosted capability flags is therefore `NOT VERIFIED BY CURRENT CONNECTOR`. No Vercel environment mutation or hosted-runtime activation occurred in the strict-CSP or V5-restoration releases.

The operational requirement remains to keep these false/absent until separate acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Branch hygiene

A fresh branch audit confirms many historical completed diagnostic, preview, reconciliation, documentation, feature, and temporary restoration branches remain.

The connected GitHub write surface still does not expose a genuine branch delete-ref operation. Stale refs must not be disguised as deleted by force-moving them to `main`.

## Next engineering boundary

No new product capability is implicitly authorized by the CSP/restoration release.

Remaining operational follow-ups are deliberately separate:

1. provider verification or activation, including Turnstile/WAF/leaked-password controls
2. independent hosted-runtime canary and rollback acceptance before any capability flag is enabled
3. physical stale-branch deletion when a genuine delete-ref surface becomes available

Any new implementation phase must start from the current released `main` and preserve V5, CSP, authorization, and runtime safety boundaries.

## Production services

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel project: `scopeforge`
- production: `scopeforge.dev`

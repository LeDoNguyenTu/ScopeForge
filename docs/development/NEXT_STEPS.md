# ScopeForge Next Steps

Last reconciled: 2026-09-10 (Asia/Singapore)

## Completed boundaries

Do not recreate these released phases or compatibility gates:

- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B provider/auth hardening code
- Phase 9C database/RPC defense-in-depth
- Phase 9D security telemetry/browser hardening
- Phase 9E incident readiness and release engineering
- strict nonce-based CSP compatibility and enforcement
- restoration of the accepted Command Center V5 public and authenticated presentation on top of strict CSP

Current executable production `main`:

`a84478dfe1d361f6d9fa3d67f0e26ea9b2088e54`

Current production tree:

`f2a39880347444967f2f2b0e2eb78d63342afbef`

Exact production deployment:

`dpl_3F4rnzhWQ93RoPKqdTe4U96TPSKb`

Post-merge CI #803 / run `34396470298` passed the full repository validation gate, including the real Chrome CSP/V5 restoration acceptance and screenshot publication. Production is READY on the exact released SHA and fresh requests to `scopeforge.dev` and `/auth/sign-in` return HTTP 200 under the enforced nonce CSP.

Detailed evidence: `docs/development/STRICT_CSP_AND_V5_RESTORATION_RELEASE_STATE.md`.

## Immediate priority - operational truth, not automatic activation

There is no unfinished implementation PR and no approved new product phase currently queued.

The remaining work is operationally gated. Do not turn these follow-ups into implicit capability activation.

### 1. Provider verification remains separate

Current truth:

- production Turnstile provider enforcement: `NOT VERIFIED`
- Vercel custom WAF/rate-limit rule state: `NOT VERIFIED`
- Supabase leaked-password protection: `VERIFIED DISABLED`
- strict CSP: `ENFORCED`

Provider inspection may continue when a supported surface is available. Enabling or changing provider controls is a separate operational decision and must preserve a tested rollback path.

### 2. Hosted runtime enablement remains separately gated

Phase 6 code and release acceptance do not automatically authorize production runtime activation.

Keep these false/absent until their independent operational canary and rollback gates explicitly authorize them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

The current Vercel connector does not expose environment-variable values, so direct fresh inspection of those values is not available through the present tool surface. No environment mutation was performed by the CSP or V5 restoration work.

### 3. Branch cleanup remains pending a real delete-ref operation

A fresh branch audit still shows historical completed `diag/*`, `preview/*`, reconciliation, documentation, feature, CSP, and temporary V5 restoration branches.

The connected GitHub write surface has search/create/update-ref operations but no genuine branch delete-ref mutation. Do not simulate deletion by moving old branch pointers to `main`.

When a true delete-ref surface becomes available, delete only branches already proven historical/completed and re-audit `main` afterwards.

## UI and security baseline rule

The released production `main` tree is authoritative.

Preserve all of the following together:

- accepted Command Center V5 desktop/mobile public presentation
- accepted immersive authenticated dashboard presentation
- strict nonce CSP
- existing browser security headers
- Supabase/RLS/RPC authorization boundaries
- worker/runtime authority separation
- disabled/unaccepted hosted capability defaults

Do not use stale V4, preview, diagnostic, reconciliation, or temporary restoration branches as implementation bases.

## Future implementation work

A future product phase should begin only when its scope is explicitly defined against current `main`. It must not be inferred from historical branches or from the existence of dormant worker/provider capability.

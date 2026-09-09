# ScopeForge Unfinished Work Queue

Last reconciled: 2026-09-10 (Asia/Singapore)

This is the persistent non-UI resume queue. It records only work that is actually unfinished. Historical implementation branches and old phase checklists are not a source of new work by themselves.

## Global rules

- start from current `main`; never use stale feature, reconciliation, preview, diagnostic, or temporary restoration branches as integration bases
- preserve the accepted Command Center V5 public and authenticated presentation
- preserve strict nonce CSP and the existing browser security-header baseline
- preflight before CI; do not use Actions as the first debugging loop
- do not claim green gates without exact-SHA evidence
- keep deployed Supabase migrations immutable; corrections are forward-only
- do not enable hosted worker/runtime capability flags merely because their code exists
- do not add generic URL/proxy/browser/arbitrary network authority
- do not confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- no AI co-author attribution
- do not infer provider or environment state from repository source

## Completed - do not recreate

The following previously queued boundaries are released:

- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B deterministic scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B provider/auth hardening code
- Phase 9C database/RPC defense-in-depth
- Phase 9D security telemetry/browser hardening
- Phase 9E incident readiness and release engineering
- post-Phase-9 strict CSP compatibility and enforcement
- restoration of the accepted Command Center V5 presentation on top of strict CSP

The latest substantively validated executable release is `a84478dfe1d361f6d9fa3d67f0e26ea9b2088e54`. Post-merge CI #803 / run `34396470298` passed the full validation gate, including real Chrome CSP/V5 visual acceptance. Later docs-only `main` commits may advance the Git ref without changing the executable application tree.

Detailed release evidence is in `docs/development/STRICT_CSP_AND_V5_RESTORATION_RELEASE_STATE.md`.

## 1. Provider operational verification - separate gate

Current conservative truth:

- production Turnstile provider enforcement: `NOT VERIFIED`
- Vercel custom WAF/rate-limit rule state: `NOT VERIFIED`
- Supabase leaked-password protection: `VERIFIED DISABLED`
- strict CSP: `ENFORCED`

Provider inspection is legitimate unfinished operational work when a supported account surface is available. Provider activation or configuration changes are not implied by this queue and require their own reviewed operational plan, rollback path, and verification evidence.

Do not describe configuration-gated Turnstile application support as production provider enforcement until the external Cloudflare/Supabase/Vercel state is directly proven.

## 2. Production worker enablement - separate from completed code phases

### Phase 6B

Hosted GitHub repository acquisition remains disabled pending a dedicated acquisition-worker/private-artifact operational acceptance, monitoring, rollback, and staged canary gate.

### Phase 6C

Hosted zero-egress repository scanning remains disabled pending its own execution-boundary operational acceptance for zero egress, read-only boundaries, resource enforcement, cancellation/container termination, monitoring, rollback, and canary evidence.

### Phase 6D

Passive and active runtime worker code and release acceptance are complete. Production enablement remains a separate operational gate for each capability and requires monitoring, rollback, staged canary evidence, and exact environment-state verification.

The operational requirement remains that these four flags stay false/absent until their independent gates authorize them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

The current Vercel connector does not expose environment-variable values, so a fresh direct environment read is not available through the present tool surface. No environment mutation was performed by the CSP or V5 restoration releases.

Do not use Phase 6D containment evidence, Phase 8 validation success, or the public release as automatic authorization for 6B/6C/6D production enablement.

## 3. Branch cleanup

A fresh branch audit still shows historical completed `diag/*`, `preview/*`, reconciliation, documentation, feature, CSP, and temporary V5 restoration branches.

The connected GitHub write surface does not expose a genuine branch delete-ref operation. Do not force-move or repoint those refs to make them look deleted.

When a true delete-ref surface becomes available:

1. re-audit each candidate against current `main`
2. delete only branches already proven historical/completed
3. preserve `main`
4. re-list branches after deletion and record the cleanup result

## 4. Future product work

There is currently no open implementation PR, no open issue, and no approved new product phase in the repository queue.

Do not invent a Phase 10 from historical branches or dormant capability. A new implementation boundary must be explicitly scoped against current `main`, pass the normal design/spec review gate, and preserve V5, CSP, authorization, and runtime safety invariants.

## UI baseline

The earlier separate V5 UI stream is complete. PR #67 restored and released the accepted V5 presentation on top of the strict CSP baseline.

Accessibility/responsive work may be proposed as a future scoped change if new evidence identifies a concrete issue, but the old UI branches are not active workstreams.

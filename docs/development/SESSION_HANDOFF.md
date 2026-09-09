# ScopeForge Session Handoff

Last refreshed: 2026-09-10 (Asia/Singapore)

Use this as the fastest resume point for current ScopeForge work. Do not resume from historical Phase 9, V4, preview, diagnostic, reconciliation, or temporary restoration branches.

## Hard execution rules

- current `main` is the authoritative integration baseline
- preserve the accepted Command Center UI V5 unless a separate UI change is explicitly authorized
- preserve the enforced strict nonce CSP and existing browser security headers
- preflight before CI and reserve substantive Actions for meaningful exact candidates/integration gates
- never rewrite deployed Supabase migrations
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim tests, provider state, WAF state, alerts, environment flags, or production enforcement without direct evidence
- do not enable hosted worker/runtime capability flags merely because implementation and containment evidence exist
- do not use stale branch state to override newer released code or documentation

## Latest validated executable release

Latest substantively validated executable release:

`a84478dfe1d361f6d9fa3d67f0e26ea9b2088e54`

Executable release tree:

`f2a39880347444967f2f2b0e2eb78d63342afbef`

This release is PR #67, `Restore approved V5 UI`, layered directly on the strict CSP merge from PR #66.

Subsequent docs-only `main` commits may advance the repository Git ref without changing executable application behavior. Always branch from the actual current `main`, but use `a84478d...` as the exact executable release evidence point until a newer executable release passes its own gates.

## Strict CSP release

PR #66: `Strict CSP compatibility gate`

- final head: `98ca45e46c83cafcacef4d87971907196724f40f`
- candidate CI: #794 / run `34382364401`, success
- candidate Preview: `dpl_697F2soQBLYSQkMsdkMXKtiF3jtd`, READY
- merge: `191a7ee1c93f179adad51f108d4ad1fade2e78f2`
- CSP merge production deployment: `dpl_2nNgDZDkMMem67h1drBaVJtMsYpN`, READY

Production CSP is nonce-based and enforced. It does not rely on permanent production `unsafe-inline` or `unsafe-eval`. The repository CI includes real Chrome browser acceptance for CSP, hydration, navigation, auth, 404, dashboard authorization boundaries, and public V5 WebGL.

## V5 restoration release

PR #67: `Restore approved V5 UI`

- frozen candidate: `e66b6fc4b8693deb052fa89ae9d82647d51c3a94`
- candidate CI: #802 / run `34395508634`, success
- candidate Preview: `dpl_AoyDGZEcsMZ1BYkqhn33MyugUtTH`, READY, `aliasError=null`
- corrected screenshot artifact: GitHub Actions artifact `10121486960`
- merge: `a84478dfe1d361f6d9fa3d67f0e26ea9b2088e54`
- post-merge main CI: #803 / run `34396470298`, success
- production deployment: `dpl_3F4rnzhWQ93RoPKqdTe4U96TPSKb`, READY, `aliasError=null`

The browser acceptance gate now checks visual geometry rather than DOM presence alone. It verifies the large public V5 desktop composition and the authenticated immersive dashboard, including headline/metric scale, topology geometry, lower evidence-panel layout, and absence of the later SaaS/workspace-shell composition.

Both `landing-v5-desktop.png` and `dashboard-v5-desktop.png` from the corrected candidate were inspected before merge.

Fresh production checks after the executable release confirmed:

- `scopeforge.dev` HTTP 200
- V5 desktop/mobile markers and both poster assets present
- enforced nonce CSP present
- expected HSTS, nosniff, frame-denial, referrer and permissions headers retained
- `/auth/sign-in` HTTP 200 with the email/password form rendering under CSP
- no post-release error/fatal Vercel runtime logs in the inspected window

Detailed record: `docs/development/STRICT_CSP_AND_V5_RESTORATION_RELEASE_STATE.md`.

## Supabase and provider truth

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Fresh post-release Security Advisor output contains only the known leaked-password-protection warning.

Current conservative truth:

- Supabase leaked-password protection: `VERIFIED DISABLED`
- production Turnstile provider enforcement: `NOT VERIFIED`
- Vercel custom WAF/rate-limit rule state: `NOT VERIFIED`
- strict CSP: `ENFORCED`

Turnstile-compatible application code exists, but the current production sign-in response does not prove external provider enforcement. Do not upgrade that claim without direct provider evidence.

## Hosted runtime flags

The current Vercel connector does not expose environment-variable values, so a fresh direct read of the four hosted capability flags is `NOT VERIFIED BY CURRENT CONNECTOR`.

No Vercel environment mutation or hosted-runtime activation occurred during PR #66 or PR #67. Operational policy remains to keep all four false/absent until independent canary/rollback acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 6D Tasks 14, 15, and 16 are complete. Their acceptance does not authorize production enablement.

## Current repository queue

At the latest audit:

- open implementation PRs: none
- open GitHub issues: none
- Phase 7 through Phase 9E: complete
- strict CSP gate: complete
- V5 restoration: complete

Actual unfinished work is operationally gated only:

1. provider verification/activation, with explicit rollback and evidence
2. Phase 6B/6C/6D hosted runtime operational canaries before any capability enablement
3. stale branch deletion when a genuine delete-ref operation becomes available

See `docs/development/UNFINISHED_WORK.md` for the persistent queue.

## Branch hygiene

Historical completed branches still exist, including `diag/*`, `preview/*`, reconciliation, older phase branches, CSP branches, and temporary V5 restoration branches.

The connected GitHub surface currently lacks a genuine branch delete-ref mutation. Never fake deletion by repointing those refs to `main`.

## Resume procedure

On the next engineering session:

1. fetch current `main` and read `CURRENT_STATE.md`, `NEXT_STEPS.md`, this file, and `UNFINISHED_WORK.md`
2. confirm whether a provider/runtime operational gate has been explicitly authorized before changing external state or capability flags
3. if starting a new product implementation boundary, write/review its design and plan against current `main` before code
4. preserve exact-SHA candidate, Preview, CI, browser, production, and rollback evidence for any release
5. keep V5 and strict CSP as coupled non-regression requirements

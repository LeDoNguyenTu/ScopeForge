# ScopeForge Next Steps

Last reconciled: 2026-09-09 (Asia/Singapore)

## Completed boundaries

Do not recreate these released phases:

- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B Turnstile-capable provider/auth hardening code
- Phase 9C database/RPC defense-in-depth
- Phase 9D security telemetry/browser hardening

Current production `main` baseline:

`27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`

Current production tree:

`007474c194f687f126c000d98b1d1ed3a5d032d9`

Exact production deployment:

`dpl_ExY8TxoHpFT7wsiMwg3w4BTUNE8V`

Production is READY on the exact released SHA with `aliasError=null`, and a fresh GET to `scopeforge.dev` returned HTTP 200 with the accepted V5 desktop/mobile composition and poster assets.

## Immediate priority - Phase 9E incident readiness and launch gate

Phase 9E is the next implementation boundary.

Use the approved Phase 9 umbrella architecture as the starting point, then complete the repository design/plan workflow for the Phase 9E subphase before implementation.

Required Phase 9E scope:

1. Expand the minimal security disclosure policy into an operational private-reporting policy without publishing sensitive contact data.
2. Define severity and triage criteria with bounded acknowledgement and escalation expectations.
3. Define initial containment actions, including explicit use of the four hosted runtime flags where relevant.
4. Define credential/key rotation order without storing secrets in the runbook.
5. Define Supabase containment, recovery, and validation actions.
6. Define Vercel rollback and traffic-control actions using only provider controls that are actually available and verified.
7. Define data-impact assessment and evidence-preservation rules that avoid collecting passwords, tokens, credentials, raw source, or unnecessary personal data.
8. Define recovery validation and post-incident review.
9. Create the final Phase 9 release-security checklist and tie each claim to exact release evidence.
10. Preserve the accepted V5 UI and all worker/runtime authority boundaries.

Prefer a repository-native runbook and checklist over introducing a new incident-management subsystem unless a concrete need proves otherwise.

## Provider follow-up remains separate

Current truth:

- leaked-password protection is not claimed enabled
- production Turnstile enforcement is not claimed until external provider configuration is directly verified
- Vercel project-specific custom WAF rule state is not claimed without direct inspected evidence
- Supabase native Auth rate limiting remains the auth-endpoint limiter
- CSP is not enforced

Do not silently add billing, provider secrets, external firewall rules, or availability-sensitive provider changes. Any provider activation must use a supported inspected surface, record rollback, and be verified after change.

## Outstanding database review item

Legacy broad SQL grants on `profiles`, `workspaces`, and `workspace_members` remain a separate review point. RLS is enabled and Phase 9C did not change these grants. Do not silently mix cleanup into Phase 9E.

## Runtime authority

Keep false or absent until their own operational acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## UI baseline rule

The production `main` tree is authoritative. Preserve the released Command Center UI V5. Do not edit or resurrect historical PR #49 or use stale preview/diagnostic branches as an implementation base.

## After Phase 9E

Strict CSP enforcement remains a separate compatibility gate. First produce and test a candidate policy against the exact current production Next.js/V5 behavior, then enforce only if compatibility evidence is clean. Do not ship broad permanent `unsafe-inline` or `unsafe-eval` as a shortcut.
